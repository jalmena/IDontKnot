import { describe, expect, it } from 'vitest';
import { KNOTS } from '../src/knot/library.ts';
import {
  begin,
  next,
  PACE,
  pause,
  play,
  playStep,
  previous,
  REST,
  seek,
  stepAt,
  tick,
  timelineOf,
  type Playback,
  type Timeline,
} from '../src/learn/playback.ts';

const timeline: Timeline = { start: 10, stops: [20, 30, 45] };
/** Lets time pass in small steps, as the clock of a page does. */
const after = (state: Playback, seconds: number, speed = 1): Playback => {
  let current = state;
  for (let passed = 0; passed < seconds - 1e-9; passed += 0.05) current = tick(current, timeline, 0.05, speed);
  return current;
};

it('reads the stops of a method of the library', () => {
  const method = KNOTS['figure-eight']!.document.construction!.methods[0]!;
  const read = timelineOf(method);
  expect(read.start).toBe(method.start);
  expect(read.stops).toEqual(method.steps.map((step) => step.to));
  expect(read.stops.at(-1)).toBe(KNOTS['figure-eight']!.document.components[0]!.length);
});

it('says which step a position is in: the one whose stop has not been passed', () => {
  expect([10, 15, 20, 20.5, 30, 44, 45, 99].map((position) => stepAt(timeline, position))).toEqual([
    0, 0, 0, 1, 1, 2, 2, 2,
  ]);
});

describe('waiting', () => {
  it('begins at the start, and time does not move it', () => {
    const state = begin(timeline);
    expect(state).toMatchObject({ position: 10, playing: false });
    expect(tick(state, timeline, 5, 1)).toBe(state);
  });

  it('can be put anywhere between the start and the end, and nowhere else', () => {
    expect(seek(timeline, 33).position).toBe(33);
    expect(seek(timeline, 2).position).toBe(10);
    expect(seek(timeline, 80).position).toBe(45);
    expect(seek(timeline, 33).playing).toBe(false);
  });
});

describe('playing one step', () => {
  it('goes to the end of the step at its pace, and stops there', () => {
    const playing = next(begin(timeline), timeline);
    expect(playing).toMatchObject({ playing: true, target: 20 });
    expect(after(playing, 1).position).toBeCloseTo(10 + PACE, 6);
    expect(after(playing, 5)).toMatchObject({ position: 20, playing: false });
  });

  it('goes twice as far in the same time at twice the speed', () => {
    const playing = next(begin(timeline), timeline);
    expect(after(playing, 0.5, 2).position).toBeCloseTo(after(playing, 1, 1).position, 6);
  });

  it('from the end of a step, goes to the end of the next; at the end of the last, nowhere', () => {
    expect(next(seek(timeline, 20), timeline)).toMatchObject({ playing: true, target: 30 });
    expect(next(seek(timeline, 45), timeline).playing).toBe(false);
  });

  it('plays a chosen step from where it begins', () => {
    expect(playStep(timeline, 0)).toMatchObject({ position: 10, target: 20, playing: true });
    expect(playStep(timeline, 2)).toMatchObject({ position: 30, target: 45, playing: true });
    expect(after(playStep(timeline, 1), 10)).toMatchObject({ position: 30, playing: false });
  });
});

describe('playing them all', () => {
  it('rests at the end of each step, goes on, and stops at the end of the last', () => {
    const playing = play(begin(timeline), timeline);
    const atFirstStop = after(playing, 10 / PACE);
    expect(atFirstStop).toMatchObject({ position: 20, playing: true });
    expect(atFirstStop.rest).toBeGreaterThan(0);
    expect(after(atFirstStop, REST / 2).position).toBe(20); // still resting
    expect(after(atFirstStop, REST + 0.5).position).toBeGreaterThan(20); // gone on
    const total = 35 / PACE + 2 * REST;
    expect(after(playing, total + 1)).toMatchObject({ position: 45, playing: false });
  });

  it('starts again from the start when it had finished', () => {
    expect(play(seek(timeline, 45), timeline)).toMatchObject({ position: 10, target: 20, playing: true });
    expect(play(seek(timeline, 27), timeline)).toMatchObject({ position: 27, target: 30, playing: true });
  });

  it('stops where it is when paused', () => {
    const paused = pause(after(play(begin(timeline), timeline), 1));
    expect(paused.playing).toBe(false);
    expect(after(paused, 3).position).toBe(paused.position);
  });
});

it('goes back to where the step began, and from there to where the one before began', () => {
  expect(previous(seek(timeline, 27), timeline).position).toBe(20);
  expect(previous(seek(timeline, 20), timeline).position).toBe(10);
  expect(previous(seek(timeline, 10), timeline).position).toBe(10);
  expect(previous(seek(timeline, 45), timeline).position).toBe(30);
});
