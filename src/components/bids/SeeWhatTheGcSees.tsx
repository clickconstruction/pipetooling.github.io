import { useMemo } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { RoomHeader, RoomRevisionBody, RoomRevisionChips } from './SubmittalRoomView'
import { roomQuiet } from '../../lib/submittals/roomStyles'
import { describeLink, linkListLine, linkRevisionsAfterShare, toRoomItemSource, type LinkView } from '../../lib/submittals/seeWhatTheySee'
import { roomCounts, roomRowsFrom, type RoomItemSource, type RoomPartSource, type RoomRevision } from '../../../supabase/functions/_shared/submittalRoomPayload'

/**
 * See what the GC sees (v2.4189, punch list #62 Layer 2): the reviewer's page for the rows
 * as they stand — the same `RoomRevisionBody` the GC's page renders, from the same kernel
 * (`roomRowsFrom` → `roomCounts`), read-only. A window over the road at every width since
 * 2026-10-02 (Grace: a pane beside the road squeezed the rows); a sheet on a phone, as before.
 * Nothing here is minted or shared. What the link shows today is the line's own words
 * (`describeLink`, v2.4593). The header and the revision chips are the page's own (v2.4606),
 * the chips the list the GC will see once this revision is shared, read only.
 */
export function SeeWhatTheGcSees({
  items,
  parts = [],
  revNumber,
  revisions = [],
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
  /** The bid's revisions: the chips list the ones the GC's page will show after the share. */
  revisions?: ReadonlyArray<{ id: string; rev_number: number; shared_at: string | null }>
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
  const list = useMemo(() => linkRevisionsAfterShare(revisions, revNumber), [revisions, revNumber])
  const listLine = linkListLine(list)

  const body = (
    <div data-theme="light" data-testid="see-gc-pane" style={{ background: 'var(--bg-subtle)', color: 'var(--text-strong)', borderRadius: 10, padding: '0.9rem 0.9rem 1.1rem' }}>
      <p style={{ margin: '0 0 0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }} data-testid="see-gc-why">
        {words.intro} <b style={{ color: 'var(--text-strong)' }}>{words.note}</b>
      </p>
      <RoomHeader company={company} bid={bid} />
      <RoomRevisionChips revisions={list.chips} selectedId={list.chips[0]!.id} />
      {listLine ? <p style={{ ...roomQuiet, margin: '-0.4rem 0 0.8rem' }} data-testid="see-gc-list-line">{listLine}</p> : null}
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
