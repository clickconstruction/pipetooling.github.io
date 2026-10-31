import type { CSSProperties } from 'react'
import { MapPin } from 'lucide-react'
import type { PartiesStrip, PartyCell, PartyDoor } from '../../../lib/legal/legalParties'

/**
 * The parties strip (punch list #219, v2.6172): three cells under the account's name — who we
 * have a contract with, who owns the building, the venue — each a name, one quiet line and a
 * door. The words come from `partiesStrip`; this draws them. On a phone the cells stack as rows.
 */
const CELL: CSSProperties = { position: 'relative', display: 'block', width: '100%', textAlign: 'left', padding: '7px 26px 8px 11px', borderWidth: 0, borderStyle: 'solid', borderColor: 'var(--border)', background: 'transparent', color: 'var(--text)', font: 'inherit', cursor: 'pointer', minWidth: 0 }

const ALL_DOORS: ReadonlyArray<PartyDoor> = ['edit_customer', 'link_customer', 'property_record', 'venue']

export default function LegalPartiesStrip({ strip, stacked = false, onPress, doors = ALL_DOORS }: {
  strip: PartiesStrip
  stacked?: boolean
  onPress: (door: PartyDoor, cell: PartyCell) => void
  /** The doors this surface offers (PR 3, v2.6175): the firm's portal has none of the office's records, only the map. A cell without a door is words, not a button. */
  doors?: ReadonlyArray<PartyDoor>
}) {
  const cols = stacked ? 'minmax(0, 1fr)' : strip.cells.map((c) => (c.key === 'venue' ? 'minmax(0, 1.25fr)' : c.key === 'contract_owner' ? 'minmax(0, 2fr)' : 'minmax(0, 1fr)')).join(' ')
  return (
    <div role="group" aria-label="The parties and the venue" data-legal-parties style={{ display: 'grid', gridTemplateColumns: cols, border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden', marginTop: 10, background: 'var(--surface)' }}>
      {strip.cells.map((c, i) => {
        const open = doors.includes(c.door)
        const style = {
          ...CELL,
          ...(stacked ? { borderTopWidth: i === 0 ? 0 : 1 } : { borderLeftWidth: i === 0 ? 0 : 1 }),
          ...(c.amber ? { background: 'var(--bg-amber-tint)' } : {}),
          ...(open ? {} : { cursor: 'default', paddingRight: 11 }),
        }
        const inner = (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: c.amber ? 'var(--text-amber-800)' : 'var(--text-muted)', marginBottom: 1 }}>
              {c.label}
              {c.key === 'venue' && !c.amber ? <MapPin size={13} strokeWidth={2} aria-hidden="true" style={{ flex: 'none', color: 'var(--text-blue-700)' }} /> : null}
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.84rem', lineHeight: 1.3, color: c.amber ? 'var(--text-amber-800)' : 'var(--text)', overflowWrap: 'anywhere' }}>{c.main}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem', lineHeight: 1.35 }}>{c.quiet}</div>
            {open ? <span aria-hidden="true" style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>›</span> : null}
          </>
        )
        return open ? (
          <button
            key={c.key}
            type="button"
            className="legalDeskSeg"
            onClick={() => onPress(c.door, c)}
            title={c.title}
            aria-label={`${c.label}: ${c.main}. ${c.quiet}`}
            data-legal-party={c.key}
            data-legal-party-door={c.door}
            data-legal-party-amber={c.amber ? 'true' : undefined}
            style={style}
          >
            {inner}
          </button>
        ) : (
          <div key={c.key} data-legal-party={c.key} data-legal-party-door="none" data-legal-party-amber={c.amber ? 'true' : undefined} style={style}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
