import { useMemo } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { RoomRevisionBody } from './SubmittalRoomView'
import { ROOM_COPPER, roomLabel, roomQuiet } from '../../lib/submittals/roomStyles'
import { describeLink, toRoomItemSource, type LinkView } from '../../lib/submittals/seeWhatTheySee'
import { roomCounts, roomRowsFrom, type RoomItemSource, type RoomPartSource, type RoomRevision } from '../../../supabase/functions/_shared/submittalRoomPayload'

/**
 * See what the GC sees (v2.4189, punch list #62 Layer 2): the reviewer's page for the rows
 * as they stand — the same `RoomRevisionBody` the GC's page renders, from the same kernel
 * (`roomRowsFrom` → `roomCounts`), read-only. A window over the road at every width since
 * 2026-10-02 (Grace: a pane beside the road squeezed the rows); a sheet on a phone, as before.
 * Nothing here is minted or shared. What the link shows today is the line's own words
 * (`describeLink`, v2.4593).
 */
export function SeeWhatTheGcSees({
  items,
  parts = [],
  revNumber,
  link,
  hasPackage,
  company,
  bid,
  onClose,
}: {
  items: ReadonlyArray<RoomItemSource>
  /** The rows' parts (2026-10-01); the GC's card lists the ones it sees. */
  parts?: ReadonlyArray<RoomPartSource>
  revNumber: number
  /** What the room's link shows now: the shared revision, if any, and whether the room is closed. */
  link: Omit<LinkView, 'rev'>
  hasPackage: boolean
  company: { name: string; tagline?: string | null; phone?: string | null }
  bid: { label: string; projectName: string | null; address: string | null }
  onClose: () => void
}) {
  const rev = useMemo<RoomRevision>(() => {
    const byItem = new Map<string, RoomPartSource[]>()
    for (const p of parts) byItem.set(p.item_id, [...(byItem.get(p.item_id) ?? []), p])
    const rows = roomRowsFrom(items.map(toRoomItemSource), byItem)
    return { id: 'preview', rev: revNumber, sharedAt: null, current: true, hasPackage, rows, counts: roomCounts(rows) }
  }, [items, parts, revNumber, hasPackage])
  const words = describeLink({ rev: revNumber, ...link })

  const body = (
    <div data-theme="light" data-testid="see-gc-pane" style={{ background: 'var(--bg-subtle)', color: 'var(--text-strong)', borderRadius: 10, padding: '0.9rem 0.9rem 1.1rem' }}>
      <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }} data-testid="see-gc-why">
        {words.intro} <b style={{ color: 'var(--text-strong)' }}>{words.note}</b>
      </p>
      <header style={{ marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingBottom: '0.55rem', borderBottom: '3px solid var(--text-strong)' }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{company.name.toUpperCase()}</div>
            {company.tagline ? <div style={{ ...roomLabel, marginTop: 4, letterSpacing: '0.22em' }}>{company.tagline}</div> : null}
          </div>
          {company.phone ? <div style={{ ...roomQuiet, fontSize: '0.72rem', textAlign: 'right' }}>{company.phone}</div> : null}
        </div>
        <div style={{ marginTop: '0.7rem' }}>
          <div style={{ ...roomLabel, color: ROOM_COPPER }}>Product review · Rev {revNumber}</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.25 }}>{bid.projectName || bid.label}</div>
          <div style={roomQuiet}>Plumbing fixtures &amp; equipment{bid.address ? ` · ${bid.address}` : ''}</div>
        </div>
      </header>
      <RoomRevisionBody rev={rev} readOnly />
    </div>
  )

  // The GC's page is about as wide as a phone held sideways; the window can still fill the screen.
  return (
    <ResponsiveModalShell title="What the GC sees" onRequestClose={onClose} maxWidthDesktop={720} fullScreenKey="submittals-see-gc">
      {body}
    </ResponsiveModalShell>
  )
}
