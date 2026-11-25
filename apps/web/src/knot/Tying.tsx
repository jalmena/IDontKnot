import type { Method } from '@idontknot/core';
import type { Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { inLanguage, type LibraryEntry } from './library.ts';
import {
  next,
  pause,
  play,
  playStep,
  previous,
  seek,
  SPEEDS,
  stepAt,
  type Playback,
  type Timeline,
} from './playback.ts';

interface Props {
  readonly method: Method;
  /** What the library says of the method: what each step tells the person to do. */
  readonly texts: NonNullable<LibraryEntry['methods']>[string] | undefined;
  readonly timeline: Timeline;
  /** The length of the rope whose end is led. */
  readonly length: number;
  readonly state: Playback;
  readonly setState: Dispatch<SetStateAction<Playback>>;
  readonly speed: number;
  readonly setSpeed: (speed: number) => void;
}

/** Whether the person has asked their device for less movement: then steps are shown done, not played. */
const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How a knot is tied: the buttons that play its steps, and the steps, each of which plays itself. */
export function Tying({ method, texts, timeline, length, state, setState, speed, setSpeed }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const begun = state.position > timeline.start + 1e-9;
  const tied = state.position >= length - 1e-9;
  const current = stepAt(timeline, state.position);
  // with less movement asked for, a step is shown done at once
  const moved = (playback: Playback): Playback => (still() ? seek(timeline, playback.target) : playback);

  return (
    <>
      <h2 id="knot-steps">{t('knot.tying.how')}</h2>
      <div className="player" role="group" aria-label={t('knot.tying.player')}>
        <button type="button" disabled={!begun} onClick={() => setState(previous(state, timeline))}>
          {t('knot.tying.previous')}
        </button>
        <button
          type="button"
          className="player__play"
          onClick={() => setState(state.playing ? pause(state) : moved(play(state, timeline)))}
          data-testid="play"
        >
          {state.playing ? t('knot.tying.pause') : t('knot.tying.play')}
        </button>
        <button type="button" disabled={tied} onClick={() => setState(moved(next(state, timeline)))}>
          {t('knot.tying.next')}
        </button>
      </div>
      <div className="player__row">
        <input
          type="range"
          min={timeline.start}
          max={length}
          step={0.05}
          value={state.position}
          aria-label={t('knot.tying.progress')}
          data-testid="progress"
          onChange={(event) => setState(seek(timeline, Number(event.target.value)))}
        />
        <label className="choice">
          <span>{t('knot.tying.speed')}</span>
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            {SPEEDS.map((value) => (
              <option key={value} value={value}>
                {`${value}×`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ol className="steps" aria-labelledby="knot-steps" data-testid="steps">
        {method.steps.map((step, index) => (
          <li key={step.id} aria-current={begun && !tied && index === current ? 'step' : undefined}>
            <button type="button" onClick={() => setState(moved(playStep(timeline, index)))}>
              {inLanguage(texts?.steps[step.id], language) || step.id}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
