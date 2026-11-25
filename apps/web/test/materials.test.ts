import { expect, it } from 'vitest';
import { ROPE_MATERIALS, ROPE_MATERIAL_IDS, ROPE_OF_DISCIPLINE, ropeColour } from '../src/viewer/materials.ts';

it('gives every material enough colours to tell five loops apart', () => {
  for (const id of ROPE_MATERIAL_IDS) {
    const { colours } = ROPE_MATERIALS[id];
    expect(new Set(colours).size).toBeGreaterThanOrEqual(5);
    for (const colour of colours) expect(colour).toMatch(/^#[0-9a-f]{6}$/);
  }
});

it('gives each of the six disciplines a rope that exists', () => {
  expect(Object.keys(ROPE_OF_DISCIPLINE).sort()).toEqual(
    ['climbing', 'decorative', 'nautical', 'pioneering', 'shibari', 'theory'].sort(),
  );
  for (const id of Object.values(ROPE_OF_DISCIPLINE)) expect(ROPE_MATERIALS[id]).toBeDefined();
  expect(ROPE_OF_DISCIPLINE['shibari']).toBe('jute');
});

it('cycles through the colours when there are more loops than colours', () => {
  expect(ropeColour('jute', 0)).toBe(ROPE_MATERIALS.jute.colours[0]);
  expect(ropeColour('jute', 5)).toBe(ROPE_MATERIALS.jute.colours[0]);
  expect(ropeColour('line', 7)).toBe(ROPE_MATERIALS.line.colours[2]);
});

it('gives every laid rope a lay and yarns to twist', () => {
  for (const id of ROPE_MATERIAL_IDS) {
    const material = ROPE_MATERIALS[id];
    if (material.construction !== 'laid') continue;
    expect(material.lay).toBeGreaterThan(2);
    expect(material.repeat).toBeGreaterThan(0);
    expect(material.surface.yarns).toBeGreaterThanOrEqual(2);
    expect(material.surface.fibres).toBeGreaterThanOrEqual(2);
  }
});

it('gives every braided rope a braid that closes round it, with a colour for each carrier', () => {
  const divisor = (a: number, b: number): number => (b === 0 ? a : divisor(b, a % b));
  for (const id of ROPE_MATERIAL_IDS) {
    const material = ROPE_MATERIALS[id];
    if (material.construction !== 'braided') continue;
    const { carriers, crossings, over, warp, weft } = material.surface;
    expect(carriers % (2 * over)).toBe(0);
    for (const pattern of [warp, weft]) {
      expect(divisor(carriers, crossings) % pattern.length).toBe(0);
      for (const place of pattern) {
        expect(place).toBeGreaterThanOrEqual(0);
        expect(place).toBeLessThanOrEqual(1);
      }
    }
    const coloured = [...warp, ...weft].some((place) => place > 0);
    expect(material.tracers.length > 0).toBe(coloured);
  }
});

it('leaves a smooth rope without texture or loose fibres', () => {
  expect(ROPE_MATERIALS.line.construction).toBe('smooth');
  expect(ROPE_MATERIALS.line.fuzz).toBeNull();
});

it('says how every rope ends where it is cut: natural fibre frayed, synthetic rope sealed', () => {
  const kinds = Object.fromEntries(ROPE_MATERIAL_IDS.map((id) => [id, ROPE_MATERIALS[id].end.kind]));
  expect(kinds).toEqual({
    jute: 'frayed',
    sisal: 'frayed',
    cotton: 'frayed',
    polyester: 'sealed',
    kernmantle: 'cored',
    line: 'plain',
  });
  for (const id of ROPE_MATERIAL_IDS) {
    const { end } = ROPE_MATERIALS[id];
    if (end.kind !== 'frayed') continue;
    // a few short fibres: an end that has frayed a little, not a brush
    expect(end.fibres).toBeGreaterThan(20);
    expect(end.fibres).toBeLessThan(80);
    expect(end.reach).toBeGreaterThan(0.2);
    expect(end.reach).toBeLessThan(1);
    expect(end.stiffness).toBeGreaterThanOrEqual(0);
    expect(end.stiffness).toBeLessThanOrEqual(1);
  }
});
