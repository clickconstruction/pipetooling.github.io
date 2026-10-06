/**
 * The Share step's body (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 3): the
 * Share button with its line, then the room — its link, Copy / Close / Reopen, and each person on
 * it with how they arrived, what they did, and whether they decide or watch. It draws what it is
 * handed and reports each press; the tab owns the room and every write.
 */
import { useState, type CSSProperties } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { anonymousOpens, asPersonHow, asRoomRole, describeHow, describeTrail, personTrail, roomLink, roomPreviewLink, ROOM_ROLE_LABELS, type SubmittalEventRow, type SubmittalPersonRow, type SubmittalRoomRow } from '../../lib/submittals/submittalRoom'
import type { StageGate } from '../../lib/submittals/submittalJourney'
import { APP_CALENDAR_TZ as ROOM_TZ } from '../../utils/dateUtils'
import { btn, btnPrimary, btnQuiet, smallMuted } from './submittalTabStyles'
import { formatShortDate } from '../../lib/submittals/submittalRevision'
import { todayYmdInAppTz } from '../../utils/dateUtils'

// v2.4691 · the Sent by email door and its day box.
const link: CSSProperties = { ...btnQuiet, color: 'var(--text-blue-700)', fontWeight: 600 }
const inp: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', padding: '0.15rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)' }

export type SubmittalRoomPanelProps = {
  /** The newest revision has rows: the Share button draws. */
  showShare: boolean
  /** v2.4691 · `bid_submittals.sent_outside_at`: the revision went by email or on paper. */
  sentOutsideAt?: string | null
  /** v2.4691 · the office says the draft went out by email on a day (YYYY-MM-DD). Not given: no door. */
  onSentOutside?: (ymd: string) => void
  /** That revision is already shared: the button reads "share again". */
  revisionShared: boolean
  shareGate: StageGate
  room: SubmittalRoomRow | null
  /** The room in one line, as the step's summary reads it. */
  roomLine: string
  people: ReadonlyArray<SubmittalPersonRow>
  events: ReadonlyArray<SubmittalEventRow>
  /** How many rows a person decided, for their trail. */
  decidedBy: (personId: string) => number
  busy: boolean
  onShare: () => void
  onCloseRoom: () => void
  onReopenRoom: () => void
  onSetMayDecide: (personId: string, mayDecide: boolean) => void
  onClosePerson: (personId: string) => void
}

export function SubmittalRoomPanel({ showShare, revisionShared, shareGate, room, roomLine, people, events, decidedBy, busy, onShare, onCloseRoom, onReopenRoom, onSetMayDecide, onClosePerson, sentOutsideAt = null, onSentOutside }: SubmittalRoomPanelProps) {
  const { showToast } = useToastContext()
  // v2.4691 · "Sent by email on…": a day box opens in line; Save hands the day back.
  const [sentOn, setSentOn] = useState<string | null>(null)
  return (
    <>
      {showShare ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: room ? '0.5rem' : 0 }}>
          <button type="button" disabled={busy || room?.status === 'closed' || !shareGate.on} onClick={onShare} style={{ ...(revisionShared ? btn : btnPrimary), opacity: shareGate.on ? 1 : 0.5 }} data-testid="share-button" title={room ? 'Mark this revision shared; the room link shows it' : 'Mint the bid\'s review room and copy its link'} data-tour="submittals-share">
            {revisionShared ? 'Shared · share again' : 'Share'}
          </button>
          <span style={smallMuted} data-testid="share-caption">{!shareGate.on ? shareGate.why : room ? 'The same link shows every later version.' : 'Makes the link for the GC and copies it. Paste it into your email.'}</span>
          {onSentOutside && !revisionShared && !room?.shared_at ? (
            sentOn == null ? (
              <button type="button" disabled={busy} onClick={() => setSentOn(todayYmdInAppTz())} style={{ ...link, fontSize: '0.8125rem' }} title="You emailed the package yourself, or handed it over. Nothing is sent." data-testid="sent-outside-open">
                {sentOutsideAt ? `Sent by email ${formatShortDate(sentOutsideAt)} · change` : 'Sent by email on…'}
              </button>
            ) : (
              <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.8125rem' }} data-testid="sent-outside-form">
                <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                  Sent by email on
                  <input type="date" aria-label="Sent by email on" value={sentOn} onChange={(e) => setSentOn(e.target.value)} style={{ ...inp, width: 'auto' }} />
                </label>
                <button type="button" disabled={busy || !sentOn} onClick={() => { if (sentOn) onSentOutside(sentOn); setSentOn(null) }} style={{ ...btnPrimary, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }} data-testid="sent-outside-save">Save</button>
                <button type="button" onClick={() => setSentOn(null)} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>Cancel</button>
              </span>
            )
          ) : null}
        </div>
      ) : null}
      {room ? (
        <div style={{ border: '1px solid var(--border-blue)', background: room.status === 'closed' ? 'var(--bg-muted)' : 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="room-line" data-tour="submittals-room">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>{roomLine}</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {room.shared_at ? (
                // v2.4608 · their real page, opened as the office: flagged, so nothing is counted or saved (Copy link stays the plain link).
                <a href={roomPreviewLink(window.location.origin, room.token)} target="_blank" rel="noreferrer" style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', textDecoration: 'none' }} title="Their page as they see it now. Nothing you do there is counted or saved." data-testid="room-open-preview">
                  Open their page ↗
                </a>
              ) : null}
              {room.status === 'open' ? (
                <>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(roomLink(window.location.origin, room.token)).then(() => showToast('Link copied.', 'success'), () => showToast(roomLink(window.location.origin, room.token), 'info'))} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                    Copy link
                  </button>
                  <button type="button" onClick={onCloseRoom} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Close the room
                  </button>
                </>
              ) : (
                <button type="button" onClick={onReopenRoom} style={{ ...btn, padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}>
                  Reopen
                </button>
              )}
            </div>
          </div>
          {people.filter((p) => !p.closed_at).length > 0 || anonymousOpens(events) > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.3rem 0.75rem', alignItems: 'center', fontSize: '0.78rem' }} data-testid="room-people">
              {people.filter((p) => !p.closed_at).map((p) => {
                const t = personTrail(p.id, events, decidedBy(p.id))
                return (
                  <div key={p.id} style={{ display: 'contents' }}>
                    <span><b style={{ color: 'var(--text-strong)' }}>{p.name}</b> <span style={smallMuted}>· {ROOM_ROLE_LABELS[asRoomRole(p.role)]}</span></span>
                    <span style={smallMuted}>{describeHow(asPersonHow(p.how))} · {describeTrail(t, ROOM_TZ)}</span>
                    <span style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', fontSize: '0.7rem' }} role="group" aria-label={`${p.name} may`}>
                      <button type="button" aria-pressed={p.may_decide} onClick={() => onSetMayDecide(p.id, true)} style={{ padding: '0.15rem 0.5rem', border: 'none', cursor: 'pointer', font: 'inherit', background: p.may_decide ? '#16a34a' : 'var(--surface)', color: p.may_decide ? 'white' : 'var(--text-muted)', fontWeight: p.may_decide ? 700 : 500 }}>deciding</button>
                      <button type="button" aria-pressed={!p.may_decide} onClick={() => onSetMayDecide(p.id, false)} style={{ padding: '0.15rem 0.5rem', border: 'none', cursor: 'pointer', font: 'inherit', background: !p.may_decide ? 'var(--text-strong)' : 'var(--surface)', color: !p.may_decide ? 'white' : 'var(--text-muted)', fontWeight: !p.may_decide ? 700 : 500 }}>watching</button>
                    </span>
                    <span style={{ display: 'flex', gap: '0.3rem' }}>
                      {p.token ? (
                        <button type="button" onClick={() => void navigator.clipboard.writeText(roomLink(window.location.origin, p.token as string)).then(() => showToast('Personal link copied.', 'success'), () => showToast(roomLink(window.location.origin, p.token as string), 'info'))} style={{ ...btn, padding: '0.1rem 0.45rem', fontSize: '0.7rem' }}>
                          Personal link
                        </button>
                      ) : null}
                      <button type="button" aria-label={`Close ${p.name}'s link`} onClick={() => onClosePerson(p.id)} style={{ ...btn, padding: '0.1rem 0.45rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        ×
                      </button>
                    </span>
                  </div>
                )
              })}
              {anonymousOpens(events) > 0 ? (
                <div style={{ display: 'contents' }}>
                  <span style={smallMuted}>+ {anonymousOpens(events)} open{anonymousOpens(events) === 1 ? '' : 's'}</span>
                  <span style={smallMuted}>by people who did not say who they were</span>
                  <span />
                  <span />
                </div>
              ) : null}
            </div>
          ) : (
            <span style={smallMuted}>Nobody has identified themselves yet. Anyone with the link can read; deciding or asking asks who they are.</span>
          )}
        </div>
      ) : null}
    </>
  )
}
