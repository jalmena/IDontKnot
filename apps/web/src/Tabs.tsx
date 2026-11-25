import type { KeyboardEvent } from 'react';

interface Props<Id extends string> {
  /** A word that makes the ids of these tabs and of their panels unique on the page. */
  readonly name: string;
  /** What the tabs choose between, for people who cannot see them. */
  readonly label: string;
  readonly tabs: readonly { readonly id: Id; readonly label: string }[];
  readonly selected: Id;
  readonly onSelect: (id: Id) => void;
}

/** What the element that a tab shows must say of itself: spread it on that element. */
export const tabPanel = (name: string, id: string) =>
  ({ role: 'tabpanel', id: `${name}-panel-${id}`, 'aria-labelledby': `${name}-tab-${id}` }) as const;

/** A row of tabs of which one is chosen. The arrow keys move between them, as the pattern for tabs asks. */
export function Tabs<Id extends string>({ name, label, tabs, selected, onSelect }: Props<Id>) {
  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    const at = tabs.findIndex((tab) => tab.id === selected);
    const steps: Readonly<Record<string, number>> = {
      ArrowRight: at + 1,
      ArrowLeft: at - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const to = steps[event.key];
    const tab = to === undefined ? undefined : tabs[(to + tabs.length) % tabs.length];
    if (!tab) return;
    event.preventDefault();
    onSelect(tab.id);
    document.getElementById(`${name}-tab-${tab.id}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={move}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          id={`${name}-tab-${tab.id}`}
          aria-selected={tab.id === selected}
          aria-controls={tab.id === selected ? `${name}-panel-${tab.id}` : undefined}
          tabIndex={tab.id === selected ? 0 : -1}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
