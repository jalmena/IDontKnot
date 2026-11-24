/**
 * The 3D viewport: an imperative module around Three.js. It is given centerlines and draws them as rope.
 * It renders on demand (when the ropes, the camera or the size change), not in a continuous loop.
 * It computes no topology: that is the core's work.
 *
 * Each rope is drawn twice. Once as laid rope: three strands, with a texture of fibres that follows them.
 * And once, slightly larger and inside out, in a dark colour: that leaves a thin dark edge wherever a rope
 * passes in front of something, which is what makes over and under readable.
 */

import type { Point3 } from '@idontknot/core';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTube, curveLength, resample, type TubeData } from './tube.ts';

export interface RopeSpec {
  readonly points: readonly Point3[];
  readonly closed: boolean;
  readonly radius: number;
  /** A CSS colour. */
  readonly color: string;
}

const EDGE_COLOUR = 0x030d07;
const MAX_ROWS = 1600;

/** One strand's worth of fibres: yarns slanting across the strand, darker towards the grooves on either side. */
function fibreTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#f4f1ea';
    context.fillRect(0, 0, size, size);
    // yarns: they slant the opposite way to the strands, and repeat exactly so that the texture tiles
    const yarns = 9;
    for (let k = -yarns; k < 2 * yarns; k++) {
      const offset = (k / yarns) * size;
      for (const [width, colour] of [
        [7, 'rgba(92, 70, 38, 0.30)'],
        [2, 'rgba(48, 34, 16, 0.38)'],
      ] as const) {
        context.strokeStyle = colour;
        context.lineWidth = width;
        context.beginPath();
        context.moveTo(-8, offset + 8);
        context.lineTo(size + 8, offset - size - 8);
        context.stroke();
      }
    }
    // loose fibres
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 520; i++) {
      const x = random() * size;
      const y = random() * size;
      const reach = 6 + random() * 16;
      context.strokeStyle = random() < 0.5 ? 'rgba(255, 255, 255, 0.28)' : 'rgba(70, 50, 24, 0.22)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + reach, y - reach * (0.8 + random() * 0.4));
      context.stroke();
    }
    // shade towards the grooves between strands, at the top and bottom of the tile
    const shade = context.createLinearGradient(0, 0, 0, size);
    shade.addColorStop(0, 'rgba(20, 14, 6, 0.55)');
    shade.addColorStop(0.2, 'rgba(20, 14, 6, 0)');
    shade.addColorStop(0.8, 'rgba(20, 14, 6, 0)');
    shade.addColorStop(1, 'rgba(20, 14, 6, 0.55)');
    context.fillStyle = shade;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function geometryOf(tube: TubeData, withTexture: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(tube.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(tube.normals, 3));
  if (withTexture) geometry.setAttribute('uv', new BufferAttribute(tube.uvs, 2));
  geometry.setIndex(new BufferAttribute(tube.indices, 1));
  return geometry;
}

export class RopeViewport {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly fibres: CanvasTexture;
  private readonly edge = new MeshBasicMaterial({ color: EDGE_COLOUR, side: BackSide });
  private readonly ropes = new Group();
  private readonly observer: ResizeObserver;
  private readonly host: HTMLElement;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    this.fibres = fibreTexture();
    this.fibres.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // the diagram convention is "seen from +z", so that is where the camera starts
    this.camera.position.set(0, 0, 9.5);
    this.scene.add(new HemisphereLight(0xfff6e0, 0x2a4636, 1.7));
    const key = new DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 5, 8);
    this.scene.add(key);
    const fill = new DirectionalLight(0xffe9c0, 0.8);
    fill.position.set(-6, -2, 4);
    this.scene.add(fill);
    this.scene.add(this.ropes);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 20;
    this.controls.addEventListener('change', this.render);
    this.controls.saveState();

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }

  /** Replaces what is drawn with these ropes. */
  setRopes(specs: readonly RopeSpec[]): void {
    this.clear();
    for (const spec of specs) {
      // enough rows for the strands to turn smoothly, without letting a long rope grow without limit
      const spacing = Math.max(spec.radius * 0.3, curveLength(spec.points, spec.closed) / MAX_ROWS);
      const points = resample(spec.points, spec.closed, spacing);

      const rope = buildTube(points, spec.closed, spec.radius, { strands: 3, sides: 30 });
      const material = new MeshStandardMaterial({
        color: spec.color,
        map: this.fibres,
        bumpMap: this.fibres,
        bumpScale: 1.4,
        roughness: 0.9,
        metalness: 0,
      });
      this.ropes.add(new Mesh(geometryOf(rope, true), material));

      const edge = buildTube(points, spec.closed, spec.radius * 1.14, { strands: 0, sides: 14 });
      this.ropes.add(new Mesh(geometryOf(edge, false), this.edge));
    }
    this.render();
  }

  resetView(): void {
    this.controls.reset();
    this.render();
  }

  dispose(): void {
    this.observer.disconnect();
    this.controls.removeEventListener('change', this.render);
    this.controls.dispose();
    this.clear();
    this.edge.dispose();
    this.fibres.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private clear(): void {
    for (const child of [...this.ropes.children]) {
      const mesh = child as Mesh;
      mesh.geometry.dispose();
      if (mesh.material !== this.edge) (mesh.material as MeshStandardMaterial).dispose();
      this.ropes.remove(mesh);
    }
  }

  private readonly resize = (): void => {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.render();
  };

  private readonly render = (): void => {
    this.renderer.render(this.scene, this.camera);
    // how much was drawn in the last frame, so that a test can tell a drawn rope from an empty canvas
    this.host.dataset['triangles'] = String(this.renderer.info.render.triangles);
  };
}
