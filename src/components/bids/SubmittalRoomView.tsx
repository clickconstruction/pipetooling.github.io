import { useState, type CSSProperties, type ReactNode } from 'react'
import { ROOM_COPPER, roomCard, roomLabel, roomQuiet, roomShortDate } from '../../lib/submittals/roomStyles'
import { pendingKey } from '../../lib/submittals/submittalRoom'
import { roomHeadline, roomSubline, type RoomPart, type RoomRow } from '../../../supabase/functions/_shared/submittalRoomPayload'
import type { RecordRoomRevision } from '../../../supabase/functions/_shared/submittalRecord'

/**
 * The reviewer's view of one revision (v2.4187, punch list #62 Layer 2 PR 1): the headline
 * card, the rows that differ, the fold of rows that match. Moved verbatim out of
 * `pages/SubmittalRoom.tsx` so the office's "See what the GC sees" pane renders the same
 * markup the GC gets, from the same `RoomRevision` — read-only, so it draws no call group.
 * The page keeps the identify sheet, the pending notes and the send bar around it.
 */

export type DecisionKind = NonNullable<RoomRow['decision']>['kind']


const DECISION_WORD: Record<DecisionKind, string> = { approved: 'Approved', revise: 'Revise', rejected: 'Rejected' }
const DECISION_INK: Record<DecisionKind, string> = { approved: '#1f7a3a', revise: ROOM_COPPER, rejected: '#b42318' }

/** "3 parts · 3 approved · 1 revise · 2 to answer" over a card's parts, counting the calls not sent yet. */
function partsSummary(parts: ReadonlyArray<RoomPart>, localParts: Record<string, DecisionKind | undefined>): string {
  const c = { approved: 0, revise: 0, rejected: 0, open: 0 }
  for (const p of parts) {
    const k = localParts[p.id] ?? p.decision?.kind
    if (k) c[k] += 1
    else c.open += 1
  }
  const bits = [c.approved ? `${c.approved} approved` : '', c.revise ? `${c.revise} revise` : '', c.rejected ? `${c.rejected} rejected` : '', c.open ? `${c.open} to answer` : ''].filter(Boolean)
  return `${parts.length} part${parts.length === 1 ? '' : 's'}${bits.length ? ` · ${bits.join(' · ')}` : ''}`
}

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

export function RoomRowCard({ row, local, localParts = {}, onDecide, readOnly = false }: { row: RoomRow; local?: DecisionKind; /** calls not sent yet, by part (2026-10-01) */ localParts?: Record<string, DecisionKind | undefined>; onDecide?: (kind: DecisionKind, partId?: string) => void; readOnly?: boolean }) {
  const differs = row.kind === 'differs' || row.kind === 'proposed'
  const shown = local ?? row.decision?.kind
  const tone = row.kind === 'added' ? 'var(--text-muted)' : row.performanceChange ? '#b42318' : ROOM_COPPER
  const parts = row.parts ?? []
  const canCall = differs && !readOnly && !!onDecide
  const openParts = parts.filter((p) => !p.decision && !localParts[p.id])
  return (
    <div style={{ ...roomCard, borderColor: differs && !row.decision ? ROOM_COPPER : 'var(--border)' }} data-testid="room-row">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b>{row.tag || 'Accessory'}</b>
        <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: tone }}>
          {row.kind === 'differs' ? 'differs' : row.kind === 'proposed' ? 'for your review' : row.kind === 'added' ? 'added for the fixture' : row.kind === 'not_quoted' ? 'to follow' : 'as the plans specify'}
        </span>
      </div>
      {row.plans ? (
        // 2026-10-03 · a row from the takeoff carries our own name for the fixture, not the plans' product: it reads as the fixture, with no "The plans:".
        <div style={{ ...roomQuiet, marginTop: 4 }} data-testid="room-row-plans">
          {row.kind === 'proposed' ? row.plans : <>The plans: <b style={{ color: 'var(--text-strong)' }}>{row.plans}</b></>}
        </div>
      ) : null}
      {parts.length > 0 ? (
        <div style={{ marginTop: 4 }} data-testid="room-parts">
          <div style={{ ...roomQuiet, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>{row.kind === 'matches' ? 'Submitted' : row.kind === 'proposed' ? 'We intend to install' : 'Proposed'}:</span>
            <span data-testid="room-parts-summary">{partsSummary(parts, localParts)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 2 }}>
            {parts.map((p) => {
              const pending = localParts[p.id]
              const callShown = pending ?? p.decision?.kind
              return (
                <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.35rem 0.75rem', padding: '0.45rem 0', borderTop: '1px solid var(--border)' }} data-testid="room-part">
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 14rem' }}>
                    <b style={{ fontSize: '0.9rem', overflowWrap: 'anywhere' }}>{p.head}{p.quantity > 1 ? <span style={{ ...roomQuiet, fontWeight: 400 }}> × {p.quantity}</span> : null}</b>
                    {p.words ? <span style={{ ...roomQuiet, overflowWrap: 'anywhere' }}>{p.words}</span> : null}
                    {p.decision && !pending ? (
                      <span style={{ fontSize: '0.78rem', marginTop: 2, color: DECISION_INK[p.decision.kind] }} data-testid="room-part-call">
                        <b>{DECISION_WORD[p.decision.kind]}</b>
                        {p.carried ? ' on the last revision' : ''}
                        {p.decision.byName ? ` · ${p.decision.byName}` : ''}
                        {p.decision.at ? ` · ${roomShortDate(p.decision.at)}` : ''}
                        {p.decision.note ? <span style={roomQuiet}> · “{p.decision.note}”</span> : null}
                      </span>
                    ) : null}
                  </span>
                  {canCall && (!p.decision || pending || !p.carried) ? (
                    <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }} role="group" aria-label={`Your call on ${p.head}`}>
                      <button type="button" aria-pressed={callShown === 'approved'} onClick={() => onDecide!('approved', p.id)} style={{ ...seg(callShown === 'approved', 'g'), padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>Approve</button>
                      <button type="button" aria-pressed={callShown === 'revise'} onClick={() => onDecide!('revise', p.id)} style={{ ...seg(callShown === 'revise', 'a'), padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>Revise</button>
                      <button type="button" aria-pressed={callShown === 'rejected'} onClick={() => onDecide!('rejected', p.id)} style={{ ...seg(callShown === 'rejected', 'r'), padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>Reject</button>
                    </span>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      ) : row.proposed ? (
        <div style={{ marginTop: 2, fontSize: '0.9rem' }}>
          {row.kind === 'matches' ? 'Submitted' : row.kind === 'proposed' ? 'We intend to install' : 'Proposed'}: <b>{row.proposed}</b>
        </div>
      ) : null}
      {row.why ? <div style={{ ...roomQuiet, marginTop: 4 }}>{row.kind === 'differs' ? 'Why: ' : ''}{row.why}</div> : null}
      {row.performanceChange ? <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#b42318' }}>This changes a performance value on the plans.</div> : null}
      {row.decision && parts.length === 0 ? (
        <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-strong)' }}>
          <b>{row.decision.kind === 'revise' ? 'Revise' : row.decision.kind === 'approved' ? 'Approved' : 'Rejected'}</b>
          {row.decision.byName ? ` · ${row.decision.byName}` : ''}
          {row.decision.at ? ` · ${roomShortDate(row.decision.at)}` : ''}
          {row.decision.note ? <span style={roomQuiet}> · “{row.decision.note}”</span> : null}
        </div>
      ) : null}
      {canCall && parts.length > 0 && openParts.length > 1 ? (
        <button type="button" onClick={() => { for (const p of openParts) onDecide!('approved', p.id) }} style={{ marginTop: 8, padding: '0.55rem 1rem', minHeight: 44, borderRadius: 6, border: '1px solid #1f7a3a', background: '#1f7a3a', color: 'white', font: 'inherit', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }} data-testid="room-approve-parts">
          Approve all {openParts.length}
        </button>
      ) : null}
      {canCall && parts.length === 0 ? (
        <div style={{ marginTop: 10, display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} role="group" aria-label={`Your call on ${row.tag}`}>
          <button type="button" aria-pressed={shown === 'approved'} onClick={() => onDecide!('approved')} style={seg(shown === 'approved', 'g')}>Approve</button>
          <button type="button" aria-pressed={shown === 'revise'} onClick={() => onDecide!('revise')} style={seg(shown === 'revise', 'a')}>Revise</button>
          <button type="button" aria-pressed={shown === 'rejected'} onClick={() => onDecide!('rejected')} style={seg(shown === 'rejected', 'r')}>Reject</button>
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
  rev: RecordRoomRevision
  /** Calls not sent yet, keyed by `pendingKey(row, part?)`. */
  pending?: Record<string, { decision: DecisionKind; note: string }>
  onDecide?: (rowId: string, kind: DecisionKind, partId?: string) => void
  readOnly?: boolean
  afterSubline?: ReactNode
  personLine?: ReactNode
}) {
  const [showMatches, setShowMatches] = useState(false)
  const rowCard = (r: RoomRow) => (
    <RoomRowCard
      key={r.id}
      row={r}
      local={pending?.[r.id]?.decision}
      localParts={Object.fromEntries((r.parts ?? []).map((p) => [p.id, pending?.[pendingKey(r.id, p.id)]?.decision]))}
      onDecide={onDecide ? (k, partId) => (partId ? onDecide(r.id, k, partId) : onDecide(r.id, k)) : undefined}
      readOnly={readOnly}
    />
  )
  return (
    <>
      {rev.answeredByEmailAt ? (
        // 2026-10-06 · a revision answered by email is on the record with its package; the answers are theirs, typed in by the office.
        <p style={{ ...roomQuiet, margin: '0 0 0.5rem' }} data-testid="room-emailed-line">
          You answered this revision by email. Our office typed your answers in here, as the record.
        </p>
      ) : null}
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

/**
 * The reviewer page's header (moved verbatim out of `pages/SubmittalRoom.tsx`, v2.4606, punch list
 * #62 PR 1b): the letterhead, *Product review*, the project and its address. The office's window
 * draws this same header, so it cannot say what the page does not.
 */
export function RoomHeader({ company, bid }: { company: { name: string; tagline?: string | null; phone?: string | null }; bid: { label: string; projectName: string | null; address: string | null } }) {
  return (
    <header style={{ marginBottom: '0.9rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, paddingBottom: '0.7rem', borderBottom: `3px solid var(--text-strong)` }}>
        <div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{company.name.toUpperCase()}</div>
          {company.tagline ? <div style={{ ...roomLabel, marginTop: 4, letterSpacing: '0.22em' }}>{company.tagline}</div> : null}
        </div>
        {company.phone ? <div style={{ ...roomQuiet, fontSize: '0.75rem', textAlign: 'right' }}>{company.phone}</div> : null}
      </div>
      <div style={{ marginTop: '0.9rem' }}>
        <div style={{ ...roomLabel, color: ROOM_COPPER }}>Product review</div>
        <div style={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.25 }}>{bid.projectName || bid.label}</div>
        <div style={roomQuiet}>Plumbing fixtures &amp; equipment{bid.address ? ` · ${bid.address}` : ''}</div>
      </div>
    </header>
  )
}

/** One revision as the page's chips read it. */
export type RoomChip = { id: string; rev: number; current: boolean; sharedAt: string | null; /** On the record by email (2026-10-06): the answers' own day. */ answeredByEmailAt?: string | null }

/**
 * The page's revision chips (moved verbatim, v2.4606), drawn only when there is more than one. With
 * `onSelect` a chip picks the revision on screen, as the page does; without it the chips are the
 * list read only, the office's window: the same look, nothing to press.
 */
export function RoomRevisionChips({ revisions, selectedId, onSelect }: { revisions: ReadonlyArray<RoomChip>; selectedId: string; onSelect?: (id: string) => void }) {
  if (revisions.length <= 1) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '0.8rem' }} data-testid="room-revisions">
      {revisions.map((r) => (
        <button key={r.id} type="button" aria-pressed={r.id === selectedId} aria-disabled={onSelect ? undefined : true} onClick={onSelect ? () => onSelect(r.id) : undefined} style={{ padding: '0.3rem 0.7rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: r.id === selectedId ? 'var(--text-strong)' : 'var(--surface)', color: r.id === selectedId ? 'white' : 'var(--text-muted)', font: 'inherit', fontSize: '0.75rem', fontWeight: r.id === selectedId ? 700 : 500, cursor: onSelect ? 'pointer' : 'default' }}>
          Rev {r.rev}{r.current ? ' · current' : ''}{r.answeredByEmailAt ? ` · answered by email · ${roomShortDate(r.answeredByEmailAt)}` : r.sharedAt ? ` · ${roomShortDate(r.sharedAt)}` : ''}
        </button>
      ))}
    </div>
  )
}

