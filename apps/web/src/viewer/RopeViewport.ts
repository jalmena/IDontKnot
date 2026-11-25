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
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PerspectiveCamera,
  PMREMGenerator,
  Quaternion,
  Scene,
  SRGBColorSpace,
  type Material,
  type Object3D,
  type Texture,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildFuzz, buildTuft, FUZZ_PIECES } from './fuzz.ts';
import { ROPE_MATERIALS, ropeColour, type RopeMaterialId } from './materials.ts';
import { rgbOf, toned } from './images.ts';
import { RopeTextures } from './textures.ts';
import {
  buildCap,
  buildDome,
  buildLaid,
  buildLaidCap,
  buildTube,
  curveLength,
  laidFrames,
  resample,
  type TubeData,
} from './tube.ts';

export type Detail = 'full' | 'plain';

/**
 * How long the first picture waits for the images of its rope, in milliseconds. A browser that kept them
 * on an earlier visit hands them over within that time, and the rope is then first seen as it will stay;
 * otherwise it is shown without them, and again with them once they are computed.
 */
const PATIENCE = 200;

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
  /**
   * How much of each side of the view the box keeps out of, in CSS pixels: the air round it, and room
   * for what is written over the view.
   */
  readonly clear?: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
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
/**
 * A picture centred exactly looks low. The box is drawn this fraction of the free height above the middle:
 * the optical centre.
 */
const OPTICAL_LIFT = 0.03;
const MAX_ROWS = 2400;
const MAX_FIBRES = 12000;
/** Where the key light stands, seen from the ropes: to one side and above, or almost straight above. */
export const LIGHT_FROM_THE_SIDE: Point3 = [-5, 7, 4.5];
export const LIGHT_FROM_ABOVE: Point3 = [-1.5, 8, 2.5];
const FORWARD = new Vector3(0, 0, 1);

/** How far along a centerline each of its points is, as a fraction of its length. */
function stepsAlong(points: readonly Point3[]): Float32Array {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = lengths[lengths.length - 1] || 1;
  return Float32Array.from(lengths, (length) => length / total);
}

/** How the cut end of a laid rope is turned at a point of the rope: along the rope there, and round it as its strands are. */
function turned(turns: ReturnType<typeof laidFrames>, i: number): Quaternion {
  const [normal, binormal, tangent] = [turns.normals[i]!, turns.binormals[i]!, turns.tangents[i]!];
  const [c, s] = [Math.cos(turns.angles[i]!), Math.sin(turns.angles[i]!)];
  const x = new Vector3(...normal).multiplyScalar(c).addScaledVector(new Vector3(...binormal), s);
  const y = new Vector3(...normal).multiplyScalar(-s).addScaledVector(new Vector3(...binormal), c);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, new Vector3(...tangent)));
}

function geometryOf(tube: TubeData, withTexture: boolean): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(tube.positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(tube.normals, 3));
  if (withTexture) geometry.setAttribute('uv', new BufferAttribute(tube.uvs, 2));
  geometry.setIndex(new BufferAttribute(tube.indices, 1));
  return geometry;
}

/**
 * How a drawn thing appears as its rope is laid. `steps` are the fractions of the rope, in rising order, at
 * which each row of a surface or each loose fibre is there; `each` is how much of the drawing one of them is.
 */
interface Laying {
  readonly steps: Float32Array;
  readonly each: number;
}

/** The rows of a surface along an open rope, each there once the rope is laid as far as its far edge. */
function rowsOf(tube: TubeData, along: Float32Array): Laying {
  const steps = new Float32Array(tube.rows - 1);
  for (let row = 0; row < tube.rows - 1; row++) steps[row] = along[(row + 1) * tube.columns]!;
  return { steps, each: tube.indices.length / (tube.rows - 1) };
}

/** How many of the rising `steps` are not beyond `reach`. */
function laid(steps: Float32Array, reach: number): number {
  let [low, high] = [0, steps.length];
  while (low < high) {
    const middle = (low + high) >> 1;
    if (steps[middle]! <= reach + 1e-6) low = middle + 1;
    else high = middle;
  }
  return low;
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
  private reaches: readonly number[] = [];
  private fit: Fit | null = null;
  /** The direction the key light comes from. */
  private readonly light = new Vector3(...LIGHT_FROM_THE_SIDE).normalize();
  /** How far from the middle of the view its centre of attention is drawn, in CSS pixels. */
  private shift = { right: 0, down: 0 };
  /** The middle of the box that is framed, and the distance from which it fills the view. */
  private framed: { centre: Vector3; distance: number } | null = null;
  /** Whether the eye is being placed by the viewport itself. */
  private placing = false;
  /** Whether the person has turned or zoomed the view since it was last framed. */
  private moved = false;
  /** Whether the last drawing left out the images of a rope, because they had not arrived. */
  private bare = false;
  /** Whether the picture has been shown yet, and the wait for the images of its rope while it has not. */
  private shown: boolean;
  private wait: number | null = null;
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
    this.shown = detail === 'plain';
    if (!this.shown) this.renderer.domElement.style.visibility = 'hidden';
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
    this.controls.addEventListener('change', this.turned);
    this.controls.addEventListener('start', this.touched);
    this.controls.saveState();

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }

  /** Replaces what is drawn with these ropes. */
  setRopes(specs: readonly RopeSpec[]): void {
    this.specs = specs;
    this.clear();
    this.bare = false;
    specs.forEach((spec, place) => {
      if (this.detail === 'plain') this.drawPlain(spec, place);
      else this.drawFull(spec, place);
    });
    if (this.detail === 'full') this.aimShadows(specs);
    this.shade();
    this.lay();
    this.render();
    if (!this.shown && specs.length > 0) {
      if (this.bare) this.wait ??= window.setTimeout(this.show, PATIENCE);
      else this.show();
    }
  }

  /**
   * Draws each open rope only as far as a fraction of its length, from its start: the rope as it is being
   * laid. Without a fraction, a rope is drawn whole.
   */
  setReach(reaches: readonly number[]): void {
    this.reaches = reaches;
    this.lay();
    this.renderer.shadowMap.needsUpdate = true;
    this.render();
  }

  /** Dims all the rope except these stretches of it. With none, every rope is drawn as it is. */
  emphasise(stretches: readonly Stretch[]): void {
    this.stretches = stretches;
    this.shade();
    this.render();
  }

  /**
   * Moves the camera to +z of a box in the x-y plane, far enough to take all of it in. The view keeps to
   * that as its size changes, until the person turns or zooms it.
   */
  /**
   * Frames a box of the scene. With `draw` false nothing is drawn yet: the ropes are about to be given, and
   * giving them draws.
   */
  fitTo(fit: Fit, draw = true): void {
    this.moved = false;
    const distance = this.frame(fit);
    this.controls.target.set(...fit.centre);
    this.camera.position.set(fit.centre[0], fit.centre[1], fit.centre[2] + distance);
    this.settle(draw);
  }

  /**
   * Frames another box as the last one is being looked at: from the same side, and as near to it in
   * proportion. What changes shape under the eye is followed; it is not looked at afresh, from the front.
   */
  follow(fit: Fit, draw = true): void {
    const before = this.framed;
    if (!before || !this.moved) return this.fitTo(fit, draw);
    const ratio = this.frame(fit) / before.distance;
    // where the eye is from what it looks at, and how far that had been moved off the middle of the box
    const eye = this.camera.position.clone().sub(this.controls.target).multiplyScalar(ratio);
    const aside = this.controls.target.clone().sub(before.centre).multiplyScalar(ratio);
    this.controls.target.set(...fit.centre).add(aside);
    this.camera.position.copy(this.controls.target).add(eye);
    this.settle(draw);
  }

  /**
   * Takes a box as what the view frames, and sets all that follows from its size but where the eye is.
   * It gives the distance from which the box, seen from the front, fills the free part of the view.
   */
  private frame(fit: Fit): number {
    this.fit = fit;
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    const clear = fit.clear ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const free = {
      width: Math.max(width - clear.left - clear.right, width / 4),
      height: Math.max(height - clear.top - clear.bottom, height / 4),
    };
    // the box fills the free part of the view one way or the other, and sits at its optical centre
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    const perPixel = Math.max(fit.width / free.width, fit.height / free.height);
    const distance = (perPixel * height) / (2 * half);
    this.shift = {
      right: (clear.left - clear.right) / 2,
      down: (clear.top - clear.bottom) / 2 - OPTICAL_LIFT * free.height,
    };
    [this.camera.near, this.camera.far] = [distance / 100, distance * 10];
    this.camera.setViewOffset(width, height, -this.shift.right, -this.shift.down, width, height);
    [this.controls.minDistance, this.controls.maxDistance] = [distance * 0.2, distance * 2.2];
    this.framed = { centre: new Vector3(...fit.centre), distance };
    return distance;
  }

  /** After the eye has been placed: the controls take it from there, and the shadows are aimed again. */
  private settle(draw: boolean): void {
    // placing the eye is not the person turning the view: nothing is drawn for it here
    this.placing = true;
    this.controls.update();
    this.placing = false;
    if (!this.moved) this.controls.saveState();
    if (this.detail === 'full') this.aimShadows(this.specs);
    if (draw) this.render();
  }

  /** Where a point of the scene is on the canvas now. */
  place(point: Point3): Placed {
    const seen = new Vector3(...point).project(this.camera);
    const hidden = seen.z > 1 || Math.abs(seen.x) > 1 || Math.abs(seen.y) > 1;
    return { x: (seen.x + 1) / 2, y: (1 - seen.y) / 2, hidden };
  }

  /**
   * Moves the key light: the direction it comes from, seen from the ropes. The shadows follow at once; the
   * loose fibres of a rope are lit from there the next time the ropes are given.
   */
  setLight(direction: Point3, draw = true): void {
    this.light.set(...direction).normalize();
    if (this.detail !== 'full') return;
    this.aimShadows(this.specs);
    if (draw) this.render();
  }

  /** Whether the last drawing had the images of every rope: until then a rope is drawn without them. */
  get settled(): boolean {
    return !this.bare;
  }

  /** The picture as it is now, as the address of an image with nothing behind the ropes. */
  picture(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/webp', 0.9);
  }

  resetView(): void {
    if (this.fit) this.fitTo(this.fit);
    else this.controls.reset();
    this.moved = false;
    this.render();
  }

  dispose(): void {
    if (this.wait !== null) window.clearTimeout(this.wait);
    this.observer.disconnect();
    this.controls.removeEventListener('change', this.turned);
    this.controls.removeEventListener('start', this.touched);
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
    if (this.fit) {
      // the shadows are as fine as they can be where the view looks: a rope that runs far out of it would
      // otherwise spread them thin, and strands that lie together would not be told apart
      reach = Math.hypot(this.fit.width, this.fit.height) / 2 + 1;
      this.key.target.position.set(...this.fit.centre);
    } else {
      for (const { points, radius } of specs) {
        for (const point of points) reach = Math.max(reach, Math.hypot(point[0], point[1], point[2]) + 2 * radius);
      }
      this.key.target.position.set(0, 0, 0);
    }
    this.key.target.updateMatrixWorld();
    this.key.position
      .copy(this.light)
      .multiplyScalar(3 * reach)
      .add(this.key.target.position);
    const shadow = this.key.shadow.camera;
    [shadow.left, shadow.right, shadow.bottom, shadow.top] = [-reach, reach, -reach, reach];
    [shadow.near, shadow.far] = [reach, 5 * reach];
    shadow.updateProjectionMatrix();
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Adds a surface of the rope at this place in the list, ready to be dimmed stretch by stretch. */
  private add(place: number, geometry: BufferGeometry, material: Material, along: Float32Array, laying?: Laying): Mesh {
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(along.length * 3).fill(1), 3));
    const mesh = new Mesh(geometry, material);
    mesh.userData = { rope: place, along, laying };
    this.ropes.add(mesh);
    return mesh;
  }

  /**
   * The two cut ends of an open rope. The far one is a disc that can be moved along the rope, to close
   * it wherever it has been laid to.
   */
  /** Closes the two ends of an open rope of the plain drawing, each with a disc. The far one follows the rope as it is laid. */
  private addEnds(place: number, points: readonly Point3[], radius: number, material: () => Material): void {
    const start = buildCap(points, radius, 'start');
    this.add(place, geometryOf(start, false), material(), new Float32Array(start.columns));
    const end = buildCap(
      [
        [0, 0, -1],
        [0, 0, 0],
      ],
      radius,
      'end',
    );
    const far = this.add(place, geometryOf(end, false), material(), new Float32Array(end.columns).fill(1));
    far.userData['tip'] = { spine: points, steps: stepsAlong(points) };
  }

  /**
   * Finishes the two ends of an open rope as rope of its kind ends where it is cut: natural fibre frayed,
   * synthetic laid rope melted into one round end, and rope with a core cut across, the core showing in
   * the melted rim of its sheath. The far end follows the rope as it is laid.
   */
  private dressEnds(place: number, points: readonly Point3[], radius: number, id: RopeMaterialId, index: number): void {
    const look = ROPE_MATERIALS[id];
    const colour = ropeColour(id, index);
    const lay = look.construction === 'laid' ? look.lay * radius : Infinity;
    const turns = laidFrames(points, lay);
    const steps = stepsAlong(points);
    // the colour of the rope, darker; its values are those of a colour as it is written, not of light
    const tone = (amount: number): Color => {
      const [r, g, b] = toned(rgbOf(colour), amount).map((c) => c / 255) as [number, number, number];
      return new Color().setRGB(r, g, b, SRGBColorSpace).multiplyScalar(look.brightness);
    };
    const solid = (color: Color, roughness: number, clearcoat = 0): Material =>
      new MeshPhysicalMaterial({ color, roughness, metalness: 0, clearcoat, vertexColors: true });

    for (const facing of [-1, 1] as const) {
      const along = facing === 1 ? 1 : 0;
      const set = (thing: Object3D): void => {
        if (facing === 1) thing.userData['tip'] = { spine: points, steps, turns };
        else {
          thing.position.set(...(points[0] as Point3));
          thing.quaternion.copy(turned(turns, 0));
        }
      };
      const close = (data: TubeData, material: Material, forward = 0): void => {
        const geometry = geometryOf(data, false);
        if (forward !== 0) geometry.translate(0, 0, facing * forward);
        const mesh = this.add(place, geometry, material, new Float32Array(data.columns).fill(along));
        mesh.castShadow = true;
        set(mesh);
      };

      if (look.end.kind === 'sealed') {
        // melted: one smooth end, a little darker than the rope, that shines
        close(buildDome(0.94 * radius, 0.36 * radius, facing), solid(tone(-0.1), 0.3, 0.6));
      } else if (look.end.kind === 'cored') {
        // cut with a hot blade: the sheath melts into a dark rim, and the core shows inside it
        const [rim, inside] = [0.99 * radius, 0.62 * radius];
        const stands = 0.28 * radius;
        close(buildDome(rim, stands, facing, inside), solid(tone(-0.5), 0.45, 0.3));
        close(
          buildDome(inside, 0.08 * radius, facing),
          solid(new Color(look.end.core), 0.95),
          stands * (1 - (inside / rim) ** 2),
        );
      } else if (look.construction === 'laid') {
        // each strand is cut across: its end is as dark as the shade between the strands
        close(buildLaidCap(radius, lay, facing), solid(tone(-0.5), 1));
      } else {
        close(
          buildDome(0.97 * radius, 0.05 * radius, facing),
          solid(tone(look.end.kind === 'frayed' ? -0.22 : -0.35), 1),
        );
      }

      if (look.end.kind === 'frayed') {
        // and its fibres stand out of the end, lit like the loose fibres along the rope
        const tuft = buildTuft(radius, { ...look.end, seed: 31 + index + (facing === 1 ? 7 : 0) });
        if (facing === -1) for (let k = 2; k < tuft.positions.length; k += 3) tuft.positions[k] = -tuft.positions[k]!;
        const fibre = new Color(colour).lerp(new Color(0xffffff), 0.3).multiplyScalar(look.brightness);
        const count = tuft.strengths.length;
        const colours = new Float32Array(count * 4);
        for (let k = 0; k < count; k++) {
          const light = 0.7 + (0.3 * ((k * 7919) % 13)) / 12;
          colours.set([fibre.r * light, fibre.g * light, fibre.b * light, 0.9 * tuft.strengths[k]!], 4 * k);
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute('position', new BufferAttribute(tuft.positions, 3));
        geometry.setAttribute('color', new BufferAttribute(colours.slice(), 4));
        const fibres = new LineSegments(geometry, this.loose);
        fibres.userData = { rope: place, along: new Float32Array(count).fill(along), lit: colours };
        set(fibres);
        this.ropes.add(fibres);
      }
    }
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
    const along = alongOf(rope);
    this.add(place, geometryOf(rope, false), flat(), along, closed ? undefined : rowsOf(rope, along));
    if (!closed) this.addEnds(place, points, radius, flat);
    const edge = new Mesh(geometryOf(hull, false), this.edge);
    if (!closed) edge.userData = { rope: place, laying: rowsOf(hull, alongOf(hull)) };
    this.ropes.add(edge);
  }

  private drawFull({ points, closed, radius, material, index }: RopeSpec, place: number): void {
    const look = ROPE_MATERIALS[material];
    // enough rows for the strands to turn smoothly, without letting a long rope grow without limit
    const fine = resample(points, closed, Math.max(radius * 0.22, curveLength(points, closed) / MAX_ROWS));
    const colour = ropeColour(material, index);
    const maps = this.textures.mapsFor(material, index);
    if (!maps && look.construction !== 'smooth') this.bare = true;

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
    const along = alongOf(surface);
    const rows = closed ? undefined : rowsOf(surface, along);
    const rope = this.add(place, geometryOf(surface, maps !== null), skin, along, rows);
    rope.castShadow = true;
    rope.receiveShadow = true;
    if (!closed) this.dressEnds(place, fine, radius, material, index);

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
          fuzz.facings[3 * k]! * this.light.x +
          fuzz.facings[3 * k + 1]! * this.light.y +
          fuzz.facings[3 * k + 2]! * this.light.z;
        const light = 0.6 + 0.4 * Math.max(facing, 0);
        colours.set([tone.r * light, tone.g * light, tone.b * light, 0.7 * fuzz.strengths[k]!], 4 * k);
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(fuzz.positions, 3));
      geometry.setAttribute('color', new BufferAttribute(colours.slice(), 4));
      const fibres = new LineSegments(geometry, this.loose);
      const each = FUZZ_PIECES * 2;
      const steps = Float32Array.from({ length: count / each }, (_, fibre) => fuzz.alongs[fibre * each]!);
      fibres.userData = { rope: place, along: fuzz.alongs, lit: colours, laying: closed ? undefined : { steps, each } };
      this.ropes.add(fibres);
    }
  }

  /** Draws each rope as far as it has been laid, and closes it there. */
  private lay(): void {
    for (const child of this.ropes.children as Object3D[]) {
      const { rope, laying, tip } = child.userData as {
        rope?: number;
        laying?: Laying;
        tip?: { spine: readonly Point3[]; steps: Float32Array; turns?: ReturnType<typeof laidFrames> };
      };
      if (rope === undefined) continue;
      const reach = Math.min(Math.max(this.reaches[rope] ?? 1, 0), 1);
      const drawn = child as Mesh<BufferGeometry>;
      if (laying) drawn.geometry.setDrawRange(0, laid(laying.steps, reach) * laying.each);
      if (tip) {
        const last = tip.spine.length - 1;
        const i = Math.min(Math.max(laid(tip.steps, reach) - 1, 0), last);
        const [before, here, after] = [
          tip.spine[Math.max(i - 1, 0)]!,
          tip.spine[i]!,
          tip.spine[Math.min(i + 1, last)]!,
        ];
        drawn.position.set(...here);
        if (tip.turns) drawn.quaternion.copy(turned(tip.turns, i));
        else {
          drawn.quaternion.setFromUnitVectors(
            FORWARD,
            new Vector3(after[0] - before[0], after[1] - before[1], after[2] - before[2]).normalize(),
          );
        }
      }
    }
  }

  /** Gives every vertex its light: all of it, or little where another stretch of rope is emphasised. */
  private shade(): void {
    for (const child of this.ropes.children) {
      const { rope, along, lit } = child.userData as { rope?: number; along?: Float32Array; lit?: Float32Array };
      if (rope === undefined || !along) continue; // the dark hull of the plain drawing has no light to lose
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
    this.camera.setViewOffset(width, height, -this.shift.right, -this.shift.down, width, height);
    if (this.fit && !this.moved) this.fitTo(this.fit);
    else this.render();
  };

  private readonly show = (): void => {
    if (this.wait !== null) window.clearTimeout(this.wait);
    this.wait = null;
    this.shown = true;
    this.renderer.domElement.style.visibility = '';
  };

  private readonly touched = (): void => {
    this.moved = true;
  };

  /** The person has turned the view, or it is still coming to rest. */
  private readonly turned = (): void => {
    if (!this.placing) this.render();
  };

  private readonly render = (): void => {
    this.renderer.render(this.scene, this.camera);
    this.onDraw?.();
    // how much was drawn in the last frame, so that a test can tell a drawn rope from an empty canvas
    this.host.dataset['triangles'] = String(this.renderer.info.render.triangles);
    // and where the images of the rope came from: computed in this visit, or kept from an earlier one
    this.host.dataset['images'] = this.textures.source ?? 'none';
  };
}
