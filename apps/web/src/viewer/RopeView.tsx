import type { Point3 } from '@idontknot/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { chosenDetail } from './detail.ts';
import { LIGHT_FROM_THE_SIDE, RopeViewport, type Fit, type RopeSpec, type Stretch } from './RopeViewport.ts';
import type { SceneObject } from './things.ts';

/** A name written over the view, at a point of the scene: it follows that point as the view turns. */
export interface ViewName {
  readonly id: string;
  readonly text: string;
  readonly at: Point3;
  readonly marked: boolean;
}

interface Props {
  readonly ropes: readonly RopeSpec[];
  /** What the picture shows, for people who cannot see it. */
  readonly label: string;
  /** What the camera takes in to begin with. Without it, the view suits the knots of the laboratory. */
  readonly fit?: Fit;
  /** Stretches of rope to bring out: the rest is dimmed. */
  readonly emphasis?: readonly Stretch[];
  /** How much of each rope is laid, from its start, as a fraction of its length. Without it, all of it. */
  readonly reach?: readonly number[];
  readonly names?: readonly ViewName[];
  /**
   * The diagram of the same ropes. With it the view has a switch, and shows the diagram in place of the
   * 3D picture when asked: the picture stays underneath, as it was left.
   */
  readonly diagram?: ReactNode;
  /** The heading of the page, written in the top left corner of the view. */
  readonly title?: ReactNode;
  /** Something for the top right corner of the view, on the line of the title. */
  readonly corner?: ReactNode;
  /** Where the key light stands, seen from the ropes. Without it, to one side and above. */
  readonly light?: Point3;
  /**
   * What the view shows, whatever it is: while it stays the same, a new `fit` follows it from where the
   * person is looking instead of framing it afresh. A knot that tightens is still the same knot.
   */
  readonly subject?: unknown;
  /** What the ropes are shown tied to. */
  readonly objects?: readonly SceneObject[];
}

const NONE: readonly Stretch[] = [];
const NO_OBJECTS: readonly SceneObject[] = [];
const WHOLE: readonly number[] = [];

/**
 * The margins a picture keeps inside the view, in CSS pixels. At the sides and the bottom, twice the margin
 * at which the writing starts: a rope that ends nearer the edge than its own thickness looks like a mistake.
 * At the top, the line the title is written on.
 */
export const VIEW_MARGINS = { top: 84, right: 45, bottom: 40, left: 45 } as const;

/** The single React component around the imperative viewport. */
export function RopeView({
  ropes,
  label,
  fit,
  emphasis = NONE,
  reach = WHOLE,
  names,
  diagram,
  title,
  corner,
  light = LIGHT_FROM_THE_SIDE,
  subject,
  objects = NO_OBJECTS,
}: Props) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const viewport = useRef<RopeViewport | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [flat, setFlat] = useState(false);
  const covered = flat && diagram !== undefined;

  useEffect(() => {
    if (!host.current) return;
    try {
      viewport.current = new RopeViewport(host.current, chosenDetail());
    } catch {
      setUnavailable(true);
    }
    return () => {
      viewport.current?.dispose();
      viewport.current = null;
    };
  }, []);

  // when the ropes change with the framing or the light, as they do while a knot is tightened, the picture
  // is drawn once, by the ropes, which come last
  const drawn = useRef<readonly RopeSpec[] | null>(null);
  // a new framing of the same subject follows it, from wherever the person is looking; of another, begins afresh
  const framed = useRef<unknown>(undefined);
  useEffect(() => {
    if (!fit) return;
    const same = subject !== undefined && framed.current === subject;
    framed.current = subject;
    if (same) viewport.current?.follow(fit, drawn.current === ropes);
    else viewport.current?.fitTo(fit, drawn.current === ropes);
    // only a new framing frames again: new ropes alone leave the view as the person has it
  }, [fit]);

  useEffect(() => {
    viewport.current?.setLight(light, drawn.current === ropes);
  }, [light]);

  useEffect(() => {
    viewport.current?.setObjects(objects, drawn.current === ropes);
  }, [objects]);

  useEffect(() => {
    viewport.current?.setRopes(ropes);
    drawn.current = ropes;
  }, [ropes]);

  useEffect(() => {
    viewport.current?.emphasise(emphasis);
  }, [emphasis]);

  useEffect(() => {
    viewport.current?.setReach(reach);
  }, [reach]);

  // the names are moved by hand each time the view is drawn: turning it must not wait for React
  useEffect(() => {
    const view = viewport.current;
    if (!view) return;
    const place = (): void => {
      const elements = tags.current?.children ?? [];
      (names ?? []).forEach((name, i) => {
        const tag = elements[i] as HTMLElement | undefined;
        if (!tag) return;
        const { x, y, hidden } = view.place(name.at);
        tag.hidden = hidden;
        // a name near the edge of the view stays whole, inside it
        const width = tags.current?.clientWidth ?? 0;
        const reach = tag.offsetWidth / 2 + 8;
        tag.style.left = `${Math.min(Math.max(x * width, reach), Math.max(width - reach, reach)).toFixed(1)}px`;
        tag.style.top = `${(100 * y).toFixed(2)}%`;
      });
    };
    view.onDraw = place;
    place();
    return () => {
      view.onDraw = null;
    };
  }, [names]);

  return (
    <figure className="rope-view">
      <div className="rope-view__stage">
        <div
          ref={host}
          className="rope-view__canvas"
          role="img"
          aria-label={label}
          aria-hidden={covered || undefined}
          data-testid="rope-canvas"
        />
        {names && (
          <div ref={tags} className="rope-view__names" aria-hidden="true">
            {names.map((name) => (
              <span key={name.id} className={name.marked ? 'tag tag--marked' : 'tag'}>
                {name.text}
              </span>
            ))}
          </div>
        )}
        {covered && <div className="rope-view__cover">{diagram}</div>}
        {(title !== undefined || corner !== undefined) && (
          <div className="rope-view__head">
            {title}
            {corner}
          </div>
        )}
      </div>
      {unavailable && <p className="rope-view__note">{t('lab.view.unavailable')}</p>}
      <figcaption className="rope-view__caption">
        {diagram !== undefined && (
          <span className="switch" role="group" aria-label={t('lab.view.switch')}>
            <button type="button" aria-pressed={!covered} onClick={() => setFlat(false)}>
              {t('lab.view.rope')}
            </button>
            <button type="button" aria-pressed={covered} onClick={() => setFlat(true)}>
              {t('lab.view.diagram')}
            </button>
          </span>
        )}
        <span className="rope-view__help">
          {covered ? t('lab.diagram.caption') : unavailable ? '' : t('lab.view.help')}
        </span>
        {!covered && !unavailable && (
          <button type="button" onClick={() => viewport.current?.resetView()}>
            {t('lab.view.reset')}
          </button>
        )}
      </figcaption>
    </figure>
  );
}
