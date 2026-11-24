/**
 * Textures for rope, painted on a canvas when the viewport starts. Each is nearly white, so that the
 * colour of the rope multiplies it, and each repeats exactly, so that it can wrap along and round a rope.
 */

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import type { RopeMaterial } from './materials.ts';

const SIZE = 256;

function painter(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D | null } {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return { canvas, context: canvas.getContext('2d') };
}

function textureOf(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** The same sequence every time, so that the drawing does not change from one visit to the next. */
function sequence(seed: number): () => number {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/** One strand of a laid rope: yarns slanting across it, loose fibres, and shade towards the grooves on either side. */
function laid(material: RopeMaterial): CanvasTexture {
  const { canvas, context } = painter();
  if (context) {
    const random = sequence(7);
    context.fillStyle = '#f4f1ea';
    context.fillRect(0, 0, SIZE, SIZE);

    // uneven colour, as natural fibre has
    for (let i = 0; i < 70 * material.fuzz; i++) {
      const [x, y, r] = [random() * SIZE, random() * SIZE, 14 + random() * 34];
      const blot = context.createRadialGradient(x, y, 0, x, y, r);
      blot.addColorStop(0, random() < 0.5 ? 'rgba(70, 44, 14, 0.16)' : 'rgba(255, 250, 235, 0.2)');
      blot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = blot;
      context.fillRect(x - r, y - r, 2 * r, 2 * r);
    }

    // yarns: they slant the opposite way to the strands, and repeat exactly so that the texture tiles
    for (let k = -material.yarns; k < 2 * material.yarns; k++) {
      const offset = (k / material.yarns) * SIZE;
      for (const [width, alpha] of [
        [SIZE / material.yarns / 3.2, 0.55],
        [1.6, 1],
      ] as const) {
        context.strokeStyle = material.detail;
        context.globalAlpha = alpha;
        context.lineWidth = width;
        context.beginPath();
        context.moveTo(-8, offset + 8);
        context.lineTo(SIZE + 8, offset - SIZE - 8);
        context.stroke();
      }
    }
    context.globalAlpha = 1;

    // loose fibres: short ones along the yarns, and on a hairy rope longer ones that go their own way
    for (let i = 0; i < 160 + 900 * material.fuzz; i++) {
      const [x, y] = [random() * SIZE, random() * SIZE];
      const stray = random() < 0.35 * material.fuzz;
      const reach = stray ? 14 + random() * 30 : 5 + random() * 14;
      const angle = stray ? random() * Math.PI : -Math.PI / 4 + (random() - 0.5) * 0.5;
      context.strokeStyle = random() < 0.55 ? 'rgba(255, 252, 240, 0.34)' : 'rgba(64, 42, 16, 0.26)';
      context.lineWidth = stray ? 0.8 : 1;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + reach * Math.cos(angle), y + reach * Math.sin(angle));
      context.stroke();
    }

    // shade towards the grooves between strands, at the top and bottom of the tile
    const shade = context.createLinearGradient(0, 0, 0, SIZE);
    shade.addColorStop(0, 'rgba(20, 14, 6, 0.6)');
    shade.addColorStop(0.22, 'rgba(20, 14, 6, 0)');
    shade.addColorStop(0.78, 'rgba(20, 14, 6, 0)');
    shade.addColorStop(1, 'rgba(20, 14, 6, 0.6)');
    context.fillStyle = shade;
    context.fillRect(0, 0, SIZE, SIZE);
  }
  return textureOf(canvas);
}

/** The sheath of a braided rope: threads crossing over and under each other, some of them in a tracer colour. */
function braided(material: RopeMaterial): CanvasTexture {
  const { canvas, context } = painter();
  if (context) {
    const random = sequence(11);
    const count = material.yarns;
    const cell = SIZE / count;
    context.fillStyle = '#7a7a7a'; // the gaps between threads
    context.fillRect(0, 0, SIZE, SIZE);
    for (let j = -1; j <= count; j++) {
      for (let i = -1; i <= count; i++) {
        const rising = (((i + j) % 2) + 2) % 2 === 0;
        const tracer = rising && (((i - j) % 4) + 4) % 4 === 0;
        context.save();
        context.translate((i + 0.5) * cell, (j + 0.5) * cell);
        context.rotate(rising ? -Math.PI / 4 : Math.PI / 4);
        const [length, width] = [cell * 1.38, cell * 0.82];
        const across = context.createLinearGradient(0, -width / 2, 0, width / 2);
        across.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        across.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        across.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        context.beginPath();
        context.roundRect(-length / 2, -width / 2, length, width, width * 0.45);
        context.fillStyle = tracer ? material.detail : '#f6f6f2';
        context.fill();
        context.fillStyle = across;
        context.fill();
        context.restore();
      }
    }
    for (let i = 0; i < 700 * material.fuzz; i++) {
      const [x, y, reach] = [random() * SIZE, random() * SIZE, 4 + random() * 9];
      context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + reach, y + (random() - 0.5) * reach);
      context.stroke();
    }
  }
  return textureOf(canvas);
}

/** The texture for a material, or none for a smooth one. */
export function textureFor(material: RopeMaterial): CanvasTexture | null {
  if (material.construction === 'laid') return laid(material);
  if (material.construction === 'braided') return braided(material);
  return null;
}
