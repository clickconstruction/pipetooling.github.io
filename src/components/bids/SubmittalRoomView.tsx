import { useState, type CSSProperties, type ReactNode } from 'react'
import { ROOM_COPPER, roomCard, roomLabel, roomQuiet, roomShortDate } from '../../lib/submittals/roomStyles'
import { roomHeadline, roomSubline, type RoomRevision, type RoomRow } from '../../../supabase/functions/_shared/submittalRoomPayload'

/**
 * The reviewer's view of one revision (v2.4187, punch list #62 Layer 2 PR 1): the headline
 * card, the rows that differ, the fold of rows that match. Moved verbatim out of
 * `pages/SubmittalRoom.tsx` so the office's "See what the GC sees" pane renders the same
 * markup the GC gets, from the same `RoomRevision` — read-only, so it draws no call group.
 * The page keeps the identify sheet, the pending notes and the send bar around it.
 */

export type DecisionKind = NonNullable<RoomRow['decision']>['kind']

const seg = (on: boolean, tone: 'g' | 'a' | 'r'): CSSProperties => ({
  padding: '0.5rem 0.85rem',
  fontSize: '0.85rem',
  fontWeight: on ? 700 : 500,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  background: on ? (tone === 'g' ? '#1f7a3a' : tone === 'a' ? ROOM_COPPER : '#b42318') : 'var(--surface)',
  color: on ? 'white' : 'var(--text-muted)',
})

export function RoomRowCard({ row, local, onDecide, readOnly = false }: { row: RoomRow; local?: DecisionKind; onDecide?: (kind: DecisionKind) => void; readOnly?: boolean }) {
  const differs = row.kind === 'differs' || row.kind === 'proposed'
  const shown = local ?? row.decision?.kind
  const tone = row.kind === 'added' ? 'var(--text-muted)' : row.performanceChange ? '#b42318' : ROOM_COPPER
  return (
    <div style={{ ...roomCard, borderColor: differs && !row.decision ? ROOM_COPPER : 'var(--border)' }} data-testid="room-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b>{row.tag || 'Accessory'}</b>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: tone }}>
          {row.kind === 'differs' ? 'differs' : row.kind === 'proposed' ? 'proposed' : row.kind === 'added' ? 'added for the fixture' : row.kind === 'not_quoted' ? 'to follow' : 'as the plans specify'}
        </span>
      </div>
      {row.plans ? (
        <div style={{ ...roomQuiet, marginTop: 4 }}>
          The plans: <b style={{ color: 'var(--text-strong)' }}>{row.plans}</b>
        </div>
      ) : null}
      {row.proposed ? (
        <div style={{ marginTop: 2, fontSize: '0.9rem' }}>
          {row.kind === 'matches' ? 'Submitted' : 'Proposed'}: <b>{row.proposed}</b>
        </div>
      ) : null}
      {row.why ? <div style={{ ...roomQuiet, marginTop: 4 }}>{row.kind === 'differs' ? 'Why: ' : ''}{row.why}</div> : null}
      {row.performanceChange ? <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#b42318' }}>This changes a performance value on the plans.</div> : null}
      {row.decision ? (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-strong)' }}>
          <b>{row.decision.kind === 'revise' ? 'Revise' : row.decision.kind === 'approved' ? 'Approved' : 'Rejected'}</b>
          {row.decision.byName ? ` · ${row.decision.byName}` : ''}
          {row.decision.at ? ` · ${roomShortDate(row.decision.at)}` : ''}
          {row.decision.note ? <span style={roomQuiet}> · “{row.decision.note}”</span> : null}
        </div>
      ) : null}
      {differs && !readOnly && onDecide ? (
        <div style={{ marginTop: 10, display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} role="group" aria-label={`Your call on ${row.tag}`}>
          <button type="button" aria-pressed={shown === 'approved'} onClick={() => onDecide('approved')} style={seg(shown === 'approved', 'g')}>Approve</button>
          <button type="button" aria-pressed={shown === 'revise'} onClick={() => onDecide('revise')} style={seg(shown === 'revise', 'a')}>Revise</button>
          <button type="button" aria-pressed={shown === 'rejected'} onClick={() => onDecide('rejected')} style={seg(shown === 'rejected', 'r')}>Reject</button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The headline card, the differing rows, the matches fold — what the reviewer reads for one
 * revision. `personLine` is the page's "This link was made for …" line; `afterSubline` is the
 * page's "Just looking? Fine." invitation, which a read-only preview leaves out.
 */
export function RoomRevisionBody({
  rev,
  pending,
  onDecide,
  readOnly = false,
  afterSubline,
  personLine,
}: {
  rev: RoomRevision
  pending?: Record<string, { decision: DecisionKind; note: string }>
  onDecide?: (rowId: string, kind: DecisionKind) => void
  readOnly?: boolean
  afterSubline?: ReactNode
  personLine?: ReactNode
}) {
  const [showMatches, setShowMatches] = useState(false)
  const rowCard = (r: RoomRow) => <RoomRowCard key={r.id} row={r} local={pending?.[r.id]?.decision} onDecide={onDecide ? (k) => onDecide(r.id, k) : undefined} readOnly={readOnly} />
  return (
    <>
      <div style={{ ...roomCard, borderLeft: `4px solid ${ROOM_COPPER}` }} data-testid="room-headline">
        <div style={{ ...roomLabel, color: ROOM_COPPER }}>{roomHeadline(rev.counts)}</div>
        <div style={{ ...roomQuiet, marginTop: 4 }}>
          {roomSubline(rev.counts)} {afterSubline}
        </div>
        {personLine}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>{rev.rows.filter((r) => r.kind !== 'matches').map(rowCard)}</div>

      {rev.counts.matches > 0 ? (
        <div style={{ marginTop: 10 }}>
          <button type="button" aria-expanded={showMatches} onClick={() => setShowMatches(!showMatches)} style={{ background: 'none', border: 'none', padding: '0.4rem 0', font: 'inherit', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
            {showMatches ? 'Hide' : 'Show'} the {rev.counts.matches} row{rev.counts.matches === 1 ? '' : 's'} as the plans specify {showMatches ? '▴' : '▾'}
          </button>
          {showMatches ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{rev.rows.filter((r) => r.kind === 'matches').map(rowCard)}</div> : null}
        </div>
      ) : null}
    </>
  )
}
