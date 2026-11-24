import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { byLabel } from '../lab/format.ts';
import { ROPE_MATERIAL_IDS, type RopeMaterialId } from './materials.ts';

interface Props {
  readonly value: RopeMaterialId;
  readonly onChange: (value: RopeMaterialId) => void;
  readonly className?: string;
}

/** The choice of rope a knot is drawn with, in alphabetical order of the language in use. */
export function RopeSelect({ value, onChange, className }: Props) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const language = i18n.resolvedLanguage ?? 'en';
  const options = useMemo(
    () =>
      byLabel(
        ROPE_MATERIAL_IDS.map((rope) => ({ id: rope, label: t(`lab.ropes.${rope}`) })),
        language,
      ),
    [t, language],
  );
  return (
    <>
      <label htmlFor={id}>{t('lab.rope')}</label>
      <select
        id={id}
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value as RopeMaterialId)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
