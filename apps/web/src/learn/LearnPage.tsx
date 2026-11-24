import {
  checkDocument,
  checkFrame,
  checkMethod,
  cutCurve,
  diagramFromGeometry,
  framePolylines,
  type Frame,
} from '@idontknot/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Diagram2D } from '../diagram/Diagram2D.tsx';
import { inLanguage, type LibraryKnot } from '../knot/library.ts';
import { boundsOf, pointAt } from '../knot/parts.ts';
import { ropeColour } from '../viewer/materials.ts';
import { useRope } from '../viewer/RopeChoice.tsx';
import { RopeSelect } from '../viewer/RopeSelect.tsx';
import { RopeView, VIEW_MARGINS } from '../viewer/RopeView.tsx';
import type { Fit, RopeSpec } from '../viewer/RopeViewport.ts';
import { begin, next, pause, play, playStep, previous, seek, SPEEDS, stepAt, tick, timelineOf } from './playback.ts';

interface Props {
  readonly knot: LibraryKnot;
}

const DIAGRAM_LINE = 0.36;
const DIAGRAM_TEXT = 0.62;
/** The room the name of the end takes above the rope, in CSS pixels. */
const NAME_HEIGHT = 44;

/** Whether the person has asked their device for less movement: then steps are shown done, not played. */
const still = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A knot of the library being tied: the end of the rope is led step by step along the finished knot. */
export function LearnPage({ knot }: Props) {
  const { t, i18n } = useTranslation();
  const { document, entry } = knot;
  const language = i18n.resolvedLanguage ?? 'en';
  const title = inLanguage(entry.names, language);
  const [material, setMaterial] = useRope();
  const method = document.construction?.methods[0];
  const frame = document.geometry?.frames.find((candidate) => candidate.id === method?.frame) as Frame;

  const timeline = useMemo(() => (method ? timelineOf(method) : { start: 0, stops: [] }), [method]);
  const [state, setState] = useState(() => begin(timeline));
  const [speed, setSpeed] = useState<number>(1);

  // while it plays, the clock moves the end; a hidden page stops the clock, and the end waits
  useEffect(() => {
    if (!state.playing) return;
    let last = performance.now();
    let request = requestAnimationFrame(function step(now) {
      const seconds = Math.min((now - last) / 1000, 0.1);
      last = now;
      setState((current) => tick(current, timeline, seconds, speed));
      request = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(request);
  }, [state.playing, speed, timeline]);

  const curves = useMemo(() => (frame ? framePolylines(document, frame) : []), [document, frame]);
  const led = method?.steps[0]?.actor[0];
  const rope = curves.findIndex((curve) => curve.id === led);
  const length = document.components.find((component) => component.id === led)?.length ?? 1;
  const ropes = useMemo<RopeSpec[]>(
    () =>
      curves.map((curve, index) => ({
        points: curve.points,
        closed: curve.closed,
        radius: document.components.find((component) => component.id === curve.id)?.radius ?? 0.5,
        material,
        index,
      })),
    [curves, document, material],
  );
  const fit = useMemo<Fit>(() => {
    const [minX, minY, maxX, maxY] = boundsOf(curves, 0.5);
    return {
      centre: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
      width: maxX - minX,
      height: maxY - minY,
      clear: { ...VIEW_MARGINS, top: VIEW_MARGINS.top + NAME_HEIGHT },
    };
  }, [curves]);
  const sound = useMemo(
    () =>
      method !== undefined &&
      checkDocument(document).every((issue) => issue.level !== 'error') &&
      checkFrame(document, frame).length === 0 &&
      checkMethod(document, method).every((issue) => issue.level !== 'error'),
    [document, frame, method],
  );

  const reach = useMemo(
    () => curves.map((_, index) => (index === rope ? state.position / length : 1)),
    [curves, rope, state.position, length],
  );
  const end = useMemo(
    () =>
      rope < 0 ? [] : [{ id: 'end', text: t('learn.end'), at: pointAt(curves[rope]!, state.position), marked: true }],
    [curves, rope, state.position, t],
  );
  const drawing = useMemo(() => {
    const [minX, minY, maxX, maxY] = boundsOf(curves, 1.6);
    const cut = curves.map((curve, index) => (index === rope ? cutCurve(curve, state.position) : curve));
    return { bounds: [minX, minY, maxX, maxY] as const, cut, ...diagramFromGeometry(cut) };
  }, [curves, rope, state.position]);

  if (!method) {
    return (
      <section className="missing">
        <h1>{title}</h1>
        <p>{t('learn.none')}</p>
      </section>
    );
  }
  const current = stepAt(timeline, state.position);
  const begun = state.position > timeline.start + 1e-9;
  const texts = entry.methods?.[method.id];
  // with less movement asked for, a step is shown done at once
  const moved = (playback: typeof state): typeof state => (still() ? seek(timeline, playback.target) : playback);

  return (
    <section className="lab" aria-labelledby="learn-title">
      <div className="lab__stage">
        <RopeView
          ropes={ropes}
          label={t('learn.view', { name: title })}
          title={<h1 id="learn-title">{title}</h1>}
          corner={<RopeSelect value={material} onChange={setMaterial} />}
          fit={fit}
          reach={reach}
          names={end}
          diagram={
            <Diagram2D
              curves={drawing.cut}
              visits={drawing.visits}
              colours={curves.map((_, index) => ropeColour(material, index))}
              label={t('lab.diagram.label', { count: drawing.diagram.crossings.length })}
              bounds={drawing.bounds}
              line={DIAGRAM_LINE}
              text={DIAGRAM_TEXT}
            />
          }
        />
      </div>

      <div className="lab__facts panel">
        <h2 id="learn-steps">{t('learn.how')}</h2>
        <div className="player" role="group" aria-label={t('learn.player')}>
          <button type="button" disabled={!begun} onClick={() => setState(previous(state, timeline))}>
            {t('learn.previous')}
          </button>
          <button
            type="button"
            className="player__play"
            onClick={() => setState(state.playing ? pause(state) : moved(play(state, timeline)))}
            data-testid="play"
          >
            {state.playing ? t('learn.pause') : t('learn.play')}
          </button>
          <button
            type="button"
            disabled={state.position >= length - 1e-9}
            onClick={() => setState(moved(next(state, timeline)))}
          >
            {t('learn.next')}
          </button>
        </div>
        <div className="player__row">
          <input
            type="range"
            min={timeline.start}
            max={length}
            step={0.05}
            value={state.position}
            aria-label={t('learn.progress')}
            data-testid="progress"
            onChange={(event) => setState(seek(timeline, Number(event.target.value)))}
          />
          <label className="choice">
            <span>{t('learn.speed')}</span>
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
              {SPEEDS.map((value) => (
                <option key={value} value={value}>
                  {`${value}×`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ol className="steps" aria-labelledby="learn-steps" data-testid="steps" data-checked={sound ? 'ok' : 'failed'}>
          {method.steps.map((step, index) => (
            <li key={step.id} aria-current={begun && index === current ? 'step' : undefined}>
              <button type="button" onClick={() => setState(moved(playStep(timeline, index)))}>
                {inLanguage(texts?.steps[step.id], language) || step.id}
              </button>
            </li>
          ))}
        </ol>
        {!sound && (
          <p className="verdict" role="alert" data-testid="verdict">
            {t('learn.unsound')}
          </p>
        )}
      </div>
    </section>
  );
}
