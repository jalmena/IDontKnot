import type { Point3 } from '@idontknot/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { RopeViewport, type Detail, type Fit, type RopeSpec, type Stretch } from './RopeViewport.ts';

/**
 * Full detail for people. A browser driven by a test gets the plain drawing, because without a graphics card
 * the full one takes seconds per frame. Either can be asked for with ?rope=full or ?rope=plain.
 */
function chosenDetail(): Detail {
  const asked = new URLSearchParams(window.location.search).get('rope');
  if (asked === 'full' || asked === 'plain') return asked;
  return navigator.webdriver ? 'plain' : 'full';
}

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
  readonly names?: readonly ViewName[];
  /**
   * The diagram of the same ropes. With it the view has a switch, and shows the diagram in place of the
   * 3D picture when asked: the picture stays underneath, as it was left.
   */
  readonly diagram?: ReactNode;
  /** The heading of the page, written in the top left corner of the view. */
  readonly title?: ReactNode;
}

const NONE: readonly Stretch[] = [];

/** The single React component around the imperative viewport. */
export function RopeView({ ropes, label, fit, emphasis = NONE, names, diagram, title }: Props) {
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

  useEffect(() => {
    if (fit) viewport.current?.fitTo(fit);
  }, [fit]);

  useEffect(() => {
    viewport.current?.setRopes(ropes);
  }, [ropes]);

  useEffect(() => {
    viewport.current?.emphasise(emphasis);
  }, [emphasis]);

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
        {title !== undefined && <div className="rope-view__title">{title}</div>}
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
