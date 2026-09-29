/**
 * A labelled row of a Contract window rail (v2.4154): an uppercase label and the buttons that
 * belong to it, wrapping. Module-level so a re-render keeps its buttons mounted (v2.4175) — the
 * sent rail (v2.4154) and the signed rail (v2.4183) share it.
 */
import type { ReactNode } from 'react'

export function RailGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ font: '700 0.66rem/1.2 inherit', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', minWidth: 78 }}>{label}</span>
      {children}
    </div>
  )
}
