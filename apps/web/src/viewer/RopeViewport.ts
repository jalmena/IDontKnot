/**
 * The 3D viewport: an imperative module around Three.js. It is given centerlines and draws them as rope.
 * It renders on demand (when the ropes, the camera or the size change), not in a continuous loop.
 * It computes no topology: that is the core's work.
 *
 * In "full" detail a rope is drawn as it is made. Laid rope is its three strands, each with its yarns and
 * fibres; braided rope is a tube with its woven sheath; natural fibre has loose fibres standing out of it.
 * The ropes are lit by a room and a key light, and shade each other: where one passes over another, its
 * shadow on the one below is what makes over and under readable.
 *
 * In "plain" detail the ropes are smooth tubes with few vertices and no texture, each inside a slightly
 * larger dark hull that gives it an edge. Automated tests use it: without a graphics card the full drawing
 * takes seconds per frame.
 */

import type { Point3 } from '@idontknot/core';
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  type Texture,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFuzz } from './fuzz.ts';
import { ROPE_MATERIALS, ropeColour, type RopeMaterialId } from './materials.ts';
import { rgbOf, toned } from './images.ts';
import { RopeTextures } from './textures.ts';
import { buildLaid, buildTube, curveLength, resample, type TubeData } from './tube.ts';

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
const MAX_ROWS = 2400;
const MAX_FIBRES = 12000;
const KEY_DIRECTION = new Vector3(-5, 7, 4.5).normalize();

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
  private readonly textures: RopeTextures;
  private readonly edge = new MeshBasicMaterial({ color: EDGE_COLOUR, side: BackSide });
  private readonly loose = new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  private readonly ropes = new Group();
  private readonly key = new DirectionalLight(0xfff3e0, 3.2);
  private environment: Texture | null = null;
  private specs: readonly RopeSpec[] = [];
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
    // a rope whose images are still being computed is drawn without them, and again when they arrive
    this.textures = new RopeTextures(this.renderer.capabilities.getMaxAnisotropy(), () => this.setRopes(this.specs));

    // the diagram convention is "seen from +z", so that is where the camera starts
    this.camera.position.set(0, 0, 9.5);
    if (detail === 'full') this.lightRoom();
    else this.lightPlainly();
    this.scene.add(this.ropes);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 20;
    this.controls.addEventListener('change', this.render);
    this.controls.saveState();

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }

  /** Replaces what is drawn with these ropes. */
  setRopes(specs: readonly RopeSpec[]): void {
    this.specs = specs;
    this.clear();
    for (const spec of specs) {
      if (this.detail === 'plain') this.drawPlain(spec);
      else this.drawFull(spec);
    }
    if (this.detail === 'full') this.aimShadows(specs);
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
    this.loose.dispose();
    this.textures.dispose();
    this.environment?.dispose();
    this.key.shadow.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** A room to reflect, a key light that casts shadows, and two weaker lights to lift the far sides. */
  private lightRoom(): void {
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = VSMShadowMap;
    this.renderer.shadowMap.autoUpdate = false; // the ropes stand still: shadows change only with them

    const room = new PMREMGenerator(this.renderer);
    this.environment = room.fromScene(new RoomEnvironment(), 0.04).texture;
    room.dispose();
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.4;

    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.008;
    this.key.shadow.radius = 9; // a soft edge, as a lamp of some size gives
    this.key.shadow.blurSamples = 16;
    this.key.shadow.intensity = 0.85;
    this.scene.add(this.key);
    const fill = new DirectionalLight(0xffe9c0, 0.4);
    fill.position.set(6, -2, 5);
    this.scene.add(fill);
    const rim = new DirectionalLight(0xdce8ff, 1.4);
    rim.position.set(4, 2, -7);
    this.scene.add(rim);
  }

  private lightPlainly(): void {
    this.scene.add(new HemisphereLight(0xfff6e0, 0x2a4636, 1.7));
    this.key.intensity = 2.6;
    this.key.position.set(3, 5, 8);
    this.scene.add(this.key);
    const fill = new DirectionalLight(0xffe9c0, 0.8);
    fill.position.set(-6, -2, 4);
    this.scene.add(fill);
  }

  /** Points the key light at the ropes, with its shadows covering all of them and no more. */
  private aimShadows(specs: readonly RopeSpec[]): void {
    let reach = 1;
    for (const { points, radius } of specs) {
      for (const point of points) reach = Math.max(reach, Math.hypot(point[0], point[1], point[2]) + 2 * radius);
    }
    this.key.position.copy(KEY_DIRECTION).multiplyScalar(3 * reach);
    const shadow = this.key.shadow.camera;
    [shadow.left, shadow.right, shadow.bottom, shadow.top] = [-reach, reach, -reach, reach];
    [shadow.near, shadow.far] = [reach, 5 * reach];
    shadow.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
  }

  private drawPlain({ points, closed, radius, material, index }: RopeSpec): void {
    const rope = buildTube(points, closed, radius, { sides: 8 });
    const hull = buildTube(points, closed, radius * 1.14, { sides: 8 });
    const flat = new MeshStandardMaterial({ color: ropeColour(material, index), roughness: 0.6, metalness: 0 });
    this.ropes.add(new Mesh(geometryOf(rope, false), flat));
    this.ropes.add(new Mesh(geometryOf(hull, false), this.edge));
  }

  private drawFull({ points, closed, radius, material, index }: RopeSpec): void {
    const look = ROPE_MATERIALS[material];
    // enough rows for the strands to turn smoothly, without letting a long rope grow without limit
    const fine = resample(points, closed, Math.max(radius * 0.22, curveLength(points, closed) / MAX_ROWS));
    const colour = ropeColour(material, index);
    const maps = this.textures.mapsFor(material, index);

    const surface =
      look.construction === 'laid'
        ? buildLaid(fine, closed, radius, {
            sides: 12,
            layLength: look.lay * radius,
            textureLength: look.repeat * radius,
          })
        : buildTube(fine, closed, radius, {
            sides: 40,
            textureLength: (look.construction === 'braided' ? look.repeat : 6) * radius,
          });
    const skin = new MeshPhysicalMaterial({
      color: maps ? 0xffffff : colour,
      map: maps?.map ?? null,
      normalMap: maps?.normalMap ?? null,
      roughnessMap: maps?.detailMap ?? null,
      aoMap: maps?.detailMap ?? null,
      roughness: look.construction === 'smooth' ? look.roughness : 1,
      metalness: 0,
      specularIntensity: look.construction === 'smooth' ? 1 : look.gloss,
      sheen: look.sheen,
      sheenRoughness: 0.6,
      sheenColor: new Color(...toned(rgbOf(colour), 0.25).map((c) => c / 255)),
    });
    skin.normalScale.set(look.relief, look.relief);
    skin.color.multiplyScalar(look.brightness);
    const rope = new Mesh(geometryOf(surface, maps !== null), skin);
    rope.castShadow = true;
    rope.receiveShadow = true;
    this.ropes.add(rope);

    if (look.fuzz) {
      // a long rope has thinner fuzz rather than ever more fibres
      const density = Math.min(look.fuzz.density, (MAX_FIBRES * radius) / curveLength(fine, closed));
      const fuzz = buildFuzz(fine, closed, radius, { ...look.fuzz, density, seed: 19 + index });
      const tone = new Color(colour).lerp(new Color(0xffffff), 0.3).multiplyScalar(look.brightness);
      const count = fuzz.strengths.length;
      const colours = new Float32Array(count * 4);
      for (let k = 0; k < count; k++) {
        // lit as the surface it leaves is, and fading towards its tip
        const facing =
          fuzz.facings[3 * k]! * KEY_DIRECTION.x +
          fuzz.facings[3 * k + 1]! * KEY_DIRECTION.y +
          fuzz.facings[3 * k + 2]! * KEY_DIRECTION.z;
        const light = 0.6 + 0.4 * Math.max(facing, 0);
        colours.set([tone.r * light, tone.g * light, tone.b * light, 0.7 * fuzz.strengths[k]!], 4 * k);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(fuzz.positions, 3));
      geometry.setAttribute('color', new BufferAttribute(colours, 4));
      this.ropes.add(new LineSegments(geometry, this.loose));
    }
  }

  private clear(): void {
    for (const child of [...this.ropes.children]) {
      const drawn = child as Mesh<BufferGeometry, Material>;
      drawn.geometry.dispose();
      if (drawn.material !== this.edge && drawn.material !== this.loose) drawn.material.dispose();
      this.ropes.remove(drawn);
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
