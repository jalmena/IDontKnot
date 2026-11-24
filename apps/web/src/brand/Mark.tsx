/** The mark, drawn from the same paths as docs/design/brand/sources/make_brand.py. Decorative: it has no text alternative. */
export function Mark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="24" strokeLinecap="butt" strokeLinejoin="miter">
        <path d="M64 30H112M144 30H192" />
        <path d="M64 80H192M76 80A52 52 0 0 0 180 80" />
        <path d="M64 180H192M110 180L76 224M146 180L180 224" />
      </g>
      <circle cx="128" cy="180" r="17" fill="var(--gold)" />
    </svg>
  );
}
