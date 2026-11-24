import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';

/**
 * The address shown by the browser decides the page. There are few pages and no parameters to speak of,
 * so this is all the routing the application has; the server answers every path with the application.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function go(path: string): void {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  for (const listener of listeners) listener();
  window.scrollTo(0, 0);
}

interface LinkProps {
  readonly to: string;
  readonly className?: string;
  /** Whether this link leads to the page being shown. */
  readonly current?: boolean;
  readonly children: ReactNode;
}

/** A link to another page of the application, followed without loading it again. */
export function Link({ to, className, current, children }: LinkProps) {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    // leave to the browser anything that is not a plain click: a new tab, a download
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    go(to);
  };
  return (
    <a href={to} className={className} aria-current={current ? 'page' : undefined} onClick={follow}>
      {children}
    </a>
  );
}
