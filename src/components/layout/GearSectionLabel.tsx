/**
 * The small label over a group of the gear menu's rows (v2.8059; the groups and their names are in
 * `lib/gearMenuSections.ts`). The same look as the phone dock's More sheet labels, on a grey strip so a
 * label reads as a divider too.
 */
export function GearSectionLabel({ label }: { label: string }) {
  return (
    <div
      data-gear-section={label}
      style={{
        padding: '0.4rem 1rem 0.2rem',
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        background: 'var(--bg-muted)',
        borderBottom: '1px solid var(--chrome-border)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}
