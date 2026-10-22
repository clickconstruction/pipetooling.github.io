import { useState } from 'react'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { archivedFoldWords, archivedOnWords, type FleetTwin } from '../../lib/twins/fleetArchive'
import { BTN, MUTED } from '../bids/twinConsoleStyles'

/**
 * The archived twins, folded under the fleet (v2.5741): one muted line, *1 archived*, that opens to the rows with a
 * Restore each. Nothing here while no twin is archived. The confirm and the call are the panel's.
 */
export default function TwinArchivedFold({ archived, busy, onRestore }: { archived: readonly FleetTwin[]; busy: boolean; onRestore: (twin: FleetTwin) => void }) {
  const [open, setOpen] = useState(false)
  if (archived.length === 0) return null
  return (
    <div style={{ marginTop: '0.6rem' }} data-twins-archived>
      <button
        type="button"
        aria-expanded={open}
        style={{ font: 'inherit', fontSize: '0.74rem', color: 'var(--text-muted)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
        title="Twins taken out of the fleet. Restore brings one back with no live key."
      >
        {open ? '▾' : '▸'} {archivedFoldWords(archived.length)}
      </button>
      {open ? (
        <ul style={{ listStyle: 'none', margin: '0.4rem 0 0', padding: 0, display: 'grid', gap: '0.3rem' }}>
          {archived.map((t) => (
            <li key={t.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{(t.name ?? '').trim() || t.email}</span>
              <code style={{ fontSize: '0.68rem', overflowWrap: 'anywhere' }}>{t.email}</code>
              <span>{archivedOnWords(t, APP_CALENDAR_TZ)}</span>
              <button type="button" style={{ ...BTN, marginLeft: 'auto', padding: '0.1rem 0.55rem', fontSize: '0.72rem' }} disabled={busy} onClick={() => onRestore(t)} title="Back to the fleet, with no live key">
                Restore
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <span style={{ ...MUTED, display: 'none' }} />
    </div>
  )
}
