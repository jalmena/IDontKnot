/**
 * Playing a method of tying: where the end of the rope is as time passes. Positions are material
 * coordinates of the rope: the end begins at `start`, and each step takes it to its stop.
 * Pure: it knows nothing about the views or the clock.
 */
import type { Method } from '@idontknot/core';

export interface Timeline {
  readonly start: number;
  /** Where each step leaves the end, in order. */
  readonly stops: readonly number[];
}

export interface Playback {
  /** How far the end has come. */
  readonly position: number;
  readonly playing: boolean;
  /** Where the end is going before it rests: the stop of a step. */
  readonly target: number;
  /** Whether it goes on to the next step after resting at a stop. */
  readonly through: boolean;
  /** Seconds it still rests at the stop it has reached. */
  readonly rest: number;
}

/** Rope diameters the end travels in a second, at normal speed. */
export const PACE = 5;
/** Seconds the end rests at the end of a step before going on. */
export const REST = 0.9;
export const SPEEDS = [0.5, 1, 2] as const;

export function timelineOf(method: Method): Timeline {
  return { start: method.start, stops: method.steps.map((step) => step.to) };
}

const finish = (timeline: Timeline): number => timeline.stops.at(-1) ?? timeline.start;
/** The first stop beyond a position, or the last stop. */
const stopAfter = (timeline: Timeline, position: number): number =>
  timeline.stops.find((stop) => stop > position + 1e-9) ?? finish(timeline);
/** Where the step that a position is in begins. */
const stopBefore = (timeline: Timeline, position: number): number =>
  [timeline.start, ...timeline.stops].filter((stop) => stop < position - 1e-9).at(-1) ?? timeline.start;

/** The step being done at a position, counting from 0: the one whose stop has not been passed. */
export function stepAt(timeline: Timeline, position: number): number {
  const index = timeline.stops.findIndex((stop) => position <= stop + 1e-9);
  return index < 0 ? Math.max(timeline.stops.length - 1, 0) : index;
}

/** At the start, waiting. */
export function begin(timeline: Timeline): Playback {
  return { position: timeline.start, playing: false, target: timeline.start, through: false, rest: 0 };
}

/** Stopped at a position, wherever it is. */
export function seek(timeline: Timeline, position: number): Playback {
  const within = Math.min(Math.max(position, timeline.start), finish(timeline));
  return { position: within, playing: false, target: within, through: false, rest: 0 };
}

/** Plays every step from here, resting between them; from the start again if it had finished. */
export function play(state: Playback, timeline: Timeline): Playback {
  const from = state.position >= finish(timeline) - 1e-9 ? timeline.start : state.position;
  return { position: from, playing: true, target: stopAfter(timeline, from), through: true, rest: 0 };
}

export function pause(state: Playback): Playback {
  return { ...state, playing: false, target: state.position, through: false, rest: 0 };
}

/** Plays as far as the end of the step, and stops there. */
export function next(state: Playback, timeline: Timeline): Playback {
  const target = stopAfter(timeline, state.position);
  return { position: state.position, playing: target > state.position, target, through: false, rest: 0 };
}

/** Goes back to where the step began; from there, to where the step before it began. */
export function previous(state: Playback, timeline: Timeline): Playback {
  return seek(timeline, stopBefore(timeline, state.position));
}

/** Plays one step from its beginning. */
export function playStep(timeline: Timeline, index: number): Playback {
  const from = index <= 0 ? timeline.start : (timeline.stops[index - 1] ?? timeline.start);
  const target = timeline.stops[index] ?? finish(timeline);
  return { position: from, playing: true, target, through: false, rest: 0 };
}

/** The state some seconds later. */
export function tick(state: Playback, timeline: Timeline, seconds: number, speed: number): Playback {
  if (!state.playing) return state;
  if (state.rest > 0) {
    const rest = state.rest - seconds;
    return rest > 0 ? { ...state, rest } : { ...state, rest: 0, target: stopAfter(timeline, state.position) };
  }
  const position = Math.min(state.position + PACE * speed * seconds, state.target);
  if (position < state.target) return { ...state, position };
  const more = state.through && position < finish(timeline) - 1e-9;
  return { ...state, position, playing: more, rest: more ? REST : 0 };
}
