import { ledBy, type Method } from '@idontknot/core';
import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
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
  /**
   * For a knot that can be tightened: whether it is, and what tightens it and loosens it again, as seen;
   * `slacken` loosens it at once, for the buttons that go back to the tying.
   */
  readonly tightening?: {
    readonly tight: boolean;
    readonly tighten: () => void;
    readonly loosen: () => void;
    readonly slacken: () => void;
  };
}

/** How far the slider moves the end of the rope at a time, in rope diameters. */
const SLIDER_STEP = 0.05;

/** Whether the person has asked their device for less movement: then steps are shown done, not played. */
const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** How a knot is tied: the buttons that play its steps, and the steps, each of which plays itself. */
export function Tying({ method, texts, timeline, length, state, setState, speed, setSpeed, tightening }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const begun = state.position > timeline.start + 1e-9;
  const tied = state.position >= length - 1e-9;
  const current = stepAt(timeline, state.position);
  // where the steps scroll beside the view, the step being tied is kept in sight; the page itself does not move
  const list = useRef<HTMLOListElement>(null);
  const shown = begun && !tied ? current : -1;
  useEffect(() => {
    const steps = list.current;
    const item = steps?.children[shown] as HTMLElement | undefined;
    if (!steps || !item || steps.scrollHeight <= steps.clientHeight) return;
    if (item.offsetTop < steps.scrollTop) steps.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > steps.scrollTop + steps.clientHeight) {
      steps.scrollTop = item.offsetTop + item.offsetHeight - steps.clientHeight;
    }
  }, [shown]);
  // with less movement asked for, a step is shown done at once
  const moved = (playback: Playback): Playback => (still() ? seek(timeline, playback.target) : playback);
  // going back to the tying, a knot that was tightened is loose again at once
  const tie = (playback: Playback): void => {
    tightening?.slacken();
    setState(playback);
  };

  return (
    <>
      <h2 id="knot-steps">{t('knot.tying.how')}</h2>
      <div className="player" role="group" aria-label={t('knot.tying.player')}>
        <button
          type="button"
          disabled={!begun}
          onClick={() => (tightening?.tight ? tightening.loosen() : setState(previous(state, timeline)))}
        >
          {t('knot.tying.previous')}
        </button>
        <button
          type="button"
          className="player__play"
          onClick={() => tie(state.playing ? pause(state) : moved(play(state, timeline)))}
          data-testid="play"
        >
          {state.playing ? t('knot.tying.pause') : t('knot.tying.play')}
        </button>
        <button type="button" disabled={tied} onClick={() => tie(moved(next(state, timeline)))}>
          {t('knot.tying.next')}
        </button>
        {tightening && (
          <button
            type="button"
            disabled={!tied}
            onClick={tightening.tight ? tightening.loosen : tightening.tighten}
            data-testid="tighten"
          >
            {tightening.tight ? t('knot.tying.loosen') : t('knot.tying.tighten')}
          </button>
        )}
      </div>
      <div className="player__row">
        <input
          type="range"
          min={timeline.start}
          max={length}
          step={SLIDER_STEP}
          value={state.position}
          aria-label={t(ledBy(method) === 'bight' ? 'knot.tying.progressBight' : 'knot.tying.progress')}
          data-testid="progress"
          onChange={(event) => {
            // the slider moves in steps, and the end of the rope is seldom on one: its last step is the end
            const value = Number(event.target.value);
            tie(seek(timeline, value > length - SLIDER_STEP ? length : value));
          }}
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
      <ol ref={list} className="steps" aria-labelledby="knot-steps" data-testid="steps">
        {method.steps.map((step, index) => (
          <li key={step.id} aria-current={index === shown ? 'step' : undefined}>
            <button type="button" onClick={() => tie(moved(playStep(timeline, index)))}>
              {inLanguage(texts?.steps[step.id], language) || step.id}
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}
