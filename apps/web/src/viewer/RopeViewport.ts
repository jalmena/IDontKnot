/**
 * The 3D viewport: an imperative module around Three.js. It is given centerlines and draws them as rope.
 * It renders on demand (when the curve, the camera or the size changes), not in a continuous loop.
 * It computes no topology: that is the core's work.
 */

import type { Point3 } from '@idontknot/core';
import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTube } from './tube.ts';

export class RopeViewport {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.1, 100);
  private readonly controls: OrbitControls;
  private readonly material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  private readonly observer: ResizeObserver;
  private readonly host: HTMLElement;
  private mesh: Mesh | null = null;

  constructor(host: HTMLElement) {
    this.host = host;
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(this.renderer.domElement);

    // the diagram convention is "seen from +z", so that is where the camera starts
    this.camera.position.set(0, 0, 9.5);
    this.scene.add(new HemisphereLight(0xfff6e0, 0x335544, 1.9));
    const key = new DirectionalLight(0xffffff, 2.8);
    key.position.set(3, 5, 8);
    this.scene.add(key);
    const fill = new DirectionalLight(0xffe9c0, 0.9);
    fill.position.set(-6, -2, 4);
    this.scene.add(fill);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 20;
    this.controls.addEventListener('change', this.render);
    this.controls.saveState();

    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(host);
    this.resize();
  }

  /** Replaces the rope with the tube around this centerline. */
  setCurve(points: readonly Point3[], closed: boolean, radius: number): void {
    const tube = buildTube(points, closed, radius);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(tube.positions, 3));
    geometry.setAttribute('normal', new BufferAttribute(tube.normals, 3));
    geometry.setAttribute('color', new BufferAttribute(tube.colors, 3));
    geometry.setIndex(new BufferAttribute(tube.indices, 1));
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.mesh = new Mesh(geometry, this.material);
    this.scene.add(this.mesh);
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
    this.mesh?.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
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
