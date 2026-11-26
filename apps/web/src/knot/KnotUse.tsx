import { useTranslation } from 'react-i18next';
import type { DisciplineId } from '../disciplines.ts';
import { inLanguage, type LibraryEntry } from './library.ts';

interface Props {
  readonly entry: LibraryEntry;
  /** The discipline the knot is seen in. Without one, what it is for in any discipline that uses it. */
  readonly discipline: DisciplineId | null;
  /** Whether the thing it is tied to is in the view, and what shows it or takes it away. */
  readonly shown: boolean;
  readonly onShow: (shown: boolean) => void;
}

/** What a knot is: its category; what it is for in the discipline; and, where it says, what it is tied to. */
export function KnotUse({ entry, discipline, shown, onShow }: Props) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? 'en';
  const use = discipline ? entry.uses?.[discipline] : Object.values(entry.uses ?? {})[0];
  return (
    <>
      {entry.category && (
        <>
          <h2>{t('knot.use.category')}</h2>
          <p className="category" data-testid="category">
            {t(`categories.one.${entry.category}`)}
          </p>
        </>
      )}
      <h2>{t('knot.use.what')}</h2>
      <p className="use" data-testid="use">
        {use
          ? inLanguage(use.text, language)
          : t('knot.use.none', { discipline: t(`disciplines.names.${discipline ?? 'decorative'}`) })}
      </p>
      {use?.object && (
        <>
          <h2>{t('knot.use.inUse')}</h2>
          <div>
            <button
              type="button"
              className="toggle"
              aria-pressed={shown}
              onClick={() => onShow(!shown)}
              data-testid="show-object"
            >
              {t(`knot.use.show.${use.object}`)}
            </button>
          </div>
        </>
      )}
    </>
  );
}
