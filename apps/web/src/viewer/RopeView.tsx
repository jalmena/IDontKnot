import type { Point3 } from '@idontknot/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RopeViewport } from './RopeViewport.ts';

interface Props {
  readonly points: readonly Point3[];
  readonly closed: boolean;
  readonly radius: number;
  /** What the picture shows, for people who cannot see it. */
  readonly label: string;
}

/** The single React component around the imperative viewport. */
export function RopeView({ points, closed, radius, label }: Props) {
  const { t } = useTranslation();
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<RopeViewport | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    try {
      viewport.current = new RopeViewport(host.current);
    } catch {
      setUnavailable(true);
    }
    return () => {
      viewport.current?.dispose();
      viewport.current = null;
    };
  }, []);

  useEffect(() => {
    viewport.current?.setCurve(points, closed, radius);
  }, [points, closed, radius]);

  return (
    <figure className="rope-view">
      <div ref={host} className="rope-view__canvas" role="img" aria-label={label} data-testid="rope-canvas" />
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
