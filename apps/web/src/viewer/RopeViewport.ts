/**
 * The 3D viewport: an imperative module around Three.js. It is given centerlines and draws them as rope.
 * It renders on demand (when the ropes, the camera or the size change), not in a continuous loop.
 * It computes no topology: that is the core's work.
 *
 * Each rope is drawn twice. Once in its material: laid, braided or smooth, with its texture. And once,
 * slightly larger and inside out, in a dark colour: that leaves a thin dark edge wherever a rope passes
 * in front of something, which is what makes over and under readable.
 *
 * In "plain" detail the ropes are smooth tubes with few vertices and no texture. Automated tests use it:
 * without a graphics card the full drawing takes seconds per frame.
 */

import type { Point3 } from '@idontknot/core';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  type CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROPE_MATERIALS, ropeColour, type RopeMaterialId } from './materials.ts';
import { laidPhoto, textureFor, type PhotoMaps } from './textures.ts';
import { buildTube, curveLength, resample, type TubeData } from './tube.ts';

export type Detail = 'full' | 'plain';

export interface RopeSpec {
  readonly points: readonly Point3[];
  readonly closed: boolean;
  readonly radius: number;
  readonly material: RopeMaterialId;
  /** Which loop this is, counting from 0: it selects the colour within the material. */
  readonly index: number;
}

const EDGE_COLOUR = 0x030d07;
const MAX_ROWS = 1600;

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
  private readonly textures = new Map<RopeMaterialId, CanvasTexture | null>();
  private readonly edge = new MeshBasicMaterial({ color: EDGE_COLOUR, side: BackSide });
  private readonly ropes = new Group();
  private photo: PhotoMaps | null = null;
  private readonly observer: ResizeObserver;
  private readonly host: HTMLElement;
  private readonly detail: Detail;

  constructor(host: HTMLElement, detail: Detail = 'full') {
    this.host = host;
    this.detail = detail;
    host.dataset['detail'] = detail;
    this.renderer = new WebGLRenderer({ antialias: detail === 'full', alpha: true });
    this.renderer.setPixelRatio(detail === 'full' ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

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
      const { rope, edge, map } = this.surfaces(spec);
      const look = ROPE_MATERIALS[spec.material];
      if (this.detail === 'full' && look.construction === 'laid') {
        // laid rope is drawn from a photograph of one: colour, relief and roughness
        this.photo ??= laidPhoto(3, this.renderer.capabilities.getMaxAnisotropy(), this.render);
        const photographed = new MeshStandardMaterial({
          color: ropeColour(spec.material, spec.index),
          ...this.photo,
          roughness: look.roughness,
          metalness: 0,
        });
        photographed.normalScale.set(1.6, 1.6);
        this.ropes.add(new Mesh(geometryOf(rope, true), photographed));
        this.ropes.add(new Mesh(geometryOf(edge, false), this.edge));
        continue;
      }
      const material = new MeshStandardMaterial({
        color: ropeColour(spec.material, spec.index),
        map,
        bumpMap: map,
        bumpScale: look.relief,
        roughness: look.roughness,
        metalness: 0,
      });
      this.ropes.add(new Mesh(geometryOf(rope, map !== null), material));
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
    for (const texture of this.textures.values()) texture?.dispose();
    if (this.photo) for (const texture of Object.values(this.photo)) texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** The surface of the rope, the slightly larger surface that gives it its edge, and its texture. */
  private surfaces(spec: RopeSpec): { rope: TubeData; edge: TubeData; map: CanvasTexture | null } {
    const { points, closed, radius } = spec;
    if (this.detail === 'plain') {
      return {
        rope: buildTube(points, closed, radius, { strands: 0, sides: 8 }),
        edge: buildTube(points, closed, radius * 1.14, { strands: 0, sides: 8 }),
        map: null,
      };
    }
    const look = ROPE_MATERIALS[spec.material];
    // enough rows for the strands to turn smoothly, without letting a long rope grow without limit
    const fine = resample(points, closed, Math.max(radius * 0.3, curveLength(points, closed) / MAX_ROWS));
    const rope =
      look.construction === 'laid'
        ? buildTube(fine, closed, radius, { strands: 0, sides: 24, textureLength: look.lay * 2.4 * radius })
        : buildTube(fine, closed, radius, { strands: 0, sides: 24, textureLength: 2 * Math.PI * radius });
    const edge = buildTube(fine, closed, radius * 1.14, { strands: 0, sides: 14 });
    return { rope, edge, map: look.construction === 'laid' ? null : this.texture(spec.material) };
  }

  private texture(id: RopeMaterialId): CanvasTexture | null {
    if (!this.textures.has(id)) {
      const texture = textureFor(ROPE_MATERIALS[id]);
      if (texture) texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.textures.set(id, texture);
    }
    return this.textures.get(id) ?? null;
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
