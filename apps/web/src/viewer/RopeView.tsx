import type { Point3 } from '@idontknot/core';
import { useEffect, useRef, useState } from 'react';
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
  /** A view much wider than tall, for a knot laid along a rope. */
  readonly wide?: boolean;
}

const NONE: readonly Stretch[] = [];

/** The single React component around the imperative viewport. */
export function RopeView({ ropes, label, fit, emphasis = NONE, names, wide = false }: Props) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const tags = useRef<HTMLDivElement>(null);
  const viewport = useRef<RopeViewport | null>(null);
  const [unavailable, setUnavailable] = useState(false);

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
        tag.style.left = `${(100 * x).toFixed(2)}%`;
        tag.style.top = `${(100 * y).toFixed(2)}%`;
        tag.hidden = hidden;
      });
    };
    view.onDraw = place;
    place();
    return () => {
      view.onDraw = null;
    };
  }, [names]);

  return (
    <figure className={wide ? 'rope-view rope-view--wide' : 'rope-view'}>
      <div className="rope-view__stage">
        <div ref={host} className="rope-view__canvas" role="img" aria-label={label} data-testid="rope-canvas" />
        {names && (
          <div ref={tags} className="rope-view__names" aria-hidden="true">
            {names.map((name) => (
              <span key={name.id} className={name.marked ? 'tag tag--marked' : 'tag'}>
                {name.text}
              </span>
            ))}
          </div>
        )}
      </div>
      {unavailable ? (
        <p className="rope-view__note">{t('lab.view.unavailable')}</p>
      ) : (
        <figcaption className="rope-view__caption">
          <span>{t('lab.view.help')}</span>
          <button type="button" onClick={() => viewport.current?.resetView()}>
            {t('lab.view.reset')}
          </button>
        </figcaption>
      )}
    </figure>
  );
}
