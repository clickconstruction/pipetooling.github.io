/**
 * The look of a press that does one thing on the Materials screens: a pill with a quiet glyph and its words. First
 * drawn for Scan a label and Print labels on the Materials strip (v2.6851); shared since v2.6890 so the Materials
 * desk's Add a container, Print labels and Print the manifest are the same family, where they were three plain boxes.
 * A tab or a filter chip carries no glyph, so a glyph says "this does something" at a glance. The pill's style is
 * `lib/materials/materialsPressStyle.ts`.
 */
export type MaterialsPressKind = 'print-labels' | 'scan-label' | 'add' | 'manifest'

export function MaterialsPressGlyph({ kind, dead = false }: { kind: MaterialsPressKind; dead?: boolean }) {
  const common = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, style: { display: 'block', color: dead ? 'currentColor' : 'var(--text-muted)' } }
  if (kind === 'print-labels') {
    return (
      <svg {...common}>
        <path d="M4.5 6V2.5h7V6" />
        <rect x="2" y="6" width="12" height="5.5" rx="1.2" />
        <path d="M4.5 9.5h7v4h-7z" />
      </svg>
    )
  }
  if (kind === 'add') {
    return (
      <svg {...common}>
        <path d="M8 3v10M3 8h10" />
      </svg>
    )
  }
  if (kind === 'manifest') {
    // A page with its lines: the sheet that hangs on a box.
    return (
      <svg {...common}>
        <path d="M4 2.5h5.5L12 5v8.5H4z" />
        <path d="M6 7.5h4M6 10h4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3" />
      <path d="M5.5 8h5" />
    </svg>
  )
}
