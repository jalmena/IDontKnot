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
import { buildCap, buildLaid, buildTube, curveLength, resample, type TubeData } from './tube.ts';

export type Detail = 'full' | 'plain';

export interface RopeSpec {
  readonly points: readonly Point3[];
  readonly closed: boolean;
  readonly radius: number;
  readonly material: RopeMaterialId;
  /** Which loop this is, counting from 0: it selects the colour within the material. */
  readonly index: number;
}

/** A stretch of one rope: `rope` is its place in the list given to `setRopes`; from and to are fractions of its length. */
export interface Stretch {
  readonly rope: number;
  readonly from: number;
  readonly to: number;
}

/** What the camera should take in: a box in the x-y plane, seen from +z. */
export interface Fit {
  readonly centre: Point3;
  readonly width: number;
  readonly height: number;
}

/** Where a point of the scene is on the canvas, as fractions of its width and height from its top left corner. */
export interface Placed {
  readonly x: number;
  readonly y: number;
  readonly hidden: boolean;
}

const EDGE_COLOUR = 0x030d07;
/** How much of its light a rope keeps while another stretch of rope is emphasised. */
const DIMMED = 0.26;
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

/** How far along its rope each vertex of a surface is, from 0 to 1: its texture runs along the rope. */
function alongOf(tube: TubeData): Float32Array {
  const count = tube.uvs.length / 2;
  const along = new Float32Array(count);
  let furthest = 0;
  for (let k = 0; k < count; k++) furthest = Math.max(furthest, tube.uvs[2 * k]!);
  for (let k = 0; k < count; k++) along[k] = tube.uvs[2 * k]! / (furthest || 1);
  return along;
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
  private stretches: readonly Stretch[] = [];
  /** Called after every drawing: the camera may have moved. */
  onDraw: (() => void) | null = null;
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
    specs.forEach((spec, place) => {
      if (this.detail === 'plain') this.drawPlain(spec, place);
      else this.drawFull(spec, place);
    });
    if (this.detail === 'full') this.aimShadows(specs);
    this.shade();
    this.render();
  }

  /** Dims all the rope except these stretches of it. With none, every rope is drawn as it is. */
  emphasise(stretches: readonly Stretch[]): void {
    this.stretches = stretches;
    this.shade();
    this.render();
  }

  /** Moves the camera to +z of a box in the x-y plane, far enough to take all of it in. */
  fitTo(fit: Fit): void {
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    const distance = 1.08 * Math.max(fit.height / (2 * half), fit.width / (2 * half * this.camera.aspect));
    this.controls.target.set(...fit.centre);
    this.camera.position.set(fit.centre[0], fit.centre[1], fit.centre[2] + distance);
    [this.camera.near, this.camera.far] = [distance / 100, distance * 10];
    this.camera.updateProjectionMatrix();
    [this.controls.minDistance, this.controls.maxDistance] = [distance * 0.2, distance * 2.2];
    this.controls.update();
    this.controls.saveState();
    this.render();
  }

  /** Where a point of the scene is on the canvas now. */
  place(point: Point3): Placed {
    const seen = new Vector3(...point).project(this.camera);
    const hidden = seen.z > 1 || Math.abs(seen.x) > 1 || Math.abs(seen.y) > 1;
    return { x: (seen.x + 1) / 2, y: (1 - seen.y) / 2, hidden };
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

  /** Adds a surface of the rope at this place in the list, ready to be dimmed stretch by stretch. */
  private add(place: number, geometry: BufferGeometry, material: Material, along: Float32Array): Mesh {
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(along.length * 3).fill(1), 3));
    const mesh = new Mesh(geometry, material);
    mesh.userData = { rope: place, along };
    this.ropes.add(mesh);
    return mesh;
  }

  /** The two cut ends of an open rope. */
  private addEnds(place: number, points: readonly Point3[], radius: number, material: () => Material): Mesh[] {
    return (['start', 'end'] as const).map((end) => {
      const cap = buildCap(points, radius, end);
      return this.add(
        place,
        geometryOf(cap, false),
        material(),
        new Float32Array(cap.columns).fill(end === 'start' ? 0 : 1),
      );
    });
  }

  private drawPlain({ points, closed, radius, material, index }: RopeSpec, place: number): void {
    const rope = buildTube(points, closed, radius, { sides: 8 });
    const hull = buildTube(points, closed, radius * 1.14, { sides: 8 });
    const flat = (): Material =>
      new MeshStandardMaterial({
        color: ropeColour(material, index),
        roughness: 0.6,
        metalness: 0,
        vertexColors: true,
      });
    this.add(place, geometryOf(rope, false), flat(), alongOf(rope));
    if (!closed) this.addEnds(place, points, radius, flat);
    this.ropes.add(new Mesh(geometryOf(hull, false), this.edge));
  }

  private drawFull({ points, closed, radius, material, index }: RopeSpec, place: number): void {
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
      vertexColors: true,
    });
    skin.normalScale.set(look.relief, look.relief);
    skin.color.multiplyScalar(look.brightness);
    const rope = this.add(place, geometryOf(surface, maps !== null), skin, alongOf(surface));
    rope.castShadow = true;
    rope.receiveShadow = true;
    if (!closed) {
      // where the rope was cut, the ends of its fibres show: darker, and dull
      const cut = (): Material =>
        new MeshPhysicalMaterial({
          color: new Color(...toned(rgbOf(colour), -0.4).map((c) => c / 255)).multiplyScalar(look.brightness),
          roughness: 1,
          metalness: 0,
          vertexColors: true,
        });
      for (const end of this.addEnds(place, fine, radius * 0.97, cut)) end.castShadow = true;
    }

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
      geometry.setAttribute('color', new BufferAttribute(colours.slice(), 4));
      const fibres = new LineSegments(geometry, this.loose);
      fibres.userData = { rope: place, along: fuzz.alongs, lit: colours };
      this.ropes.add(fibres);
    }
  }

  /** Gives every vertex its light: all of it, or little where another stretch of rope is emphasised. */
  private shade(): void {
    for (const child of this.ropes.children) {
      const { rope, along, lit } = child.userData as { rope?: number; along?: Float32Array; lit?: Float32Array };
      if (rope === undefined || !along) continue;
      const mine = this.stretches.filter((stretch) => stretch.rope === rope);
      const colour = (child as Mesh<BufferGeometry>).geometry.getAttribute('color') as BufferAttribute;
      const values = colour.array as Float32Array;
      const size = colour.itemSize;
      for (let k = 0; k < along.length; k++) {
        const at = along[k]!;
        const full = this.stretches.length === 0 || mine.some((stretch) => at >= stretch.from && at <= stretch.to);
        const light = full ? 1 : DIMMED;
        for (let c = 0; c < 3; c++) values[k * size + c] = (lit ? lit[k * size + c]! : 1) * light;
      }
      colour.needsUpdate = true;
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
    this.onDraw?.();
    // how much was drawn in the last frame, so that a test can tell a drawn rope from an empty canvas
    this.host.dataset['triangles'] = String(this.renderer.info.render.triangles);
  };
}
