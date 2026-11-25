import type { Detail } from './RopeViewport.ts';

/**
 * Full detail for people. A browser driven by a test gets the plain drawing, because without a graphics card
 * the full one takes seconds per frame. Either can be asked for with ?rope=full or ?rope=plain.
 */
export function chosenDetail(): Detail {
  const asked = new URLSearchParams(window.location.search).get('rope');
  if (asked === 'full' || asked === 'plain') return asked;
  return navigator.webdriver ? 'plain' : 'full';
}
