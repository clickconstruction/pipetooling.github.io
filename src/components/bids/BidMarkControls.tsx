/**
 * The small controls of a bid mark (v2.4287) and of a mark for a teammate (v2.4297):
 *
 *   - `BidMarkDot`: the circle at a picker row's left. Your own mark: hidden until the row is
 *     hovered, filled when marked, one click marks or clears. A mark for you: the sender's
 *     initial in a filled circle, a dot until you open the bid; a click opens the card with
 *     Done and Not for me. A mark you sent: the receiver's initial in an outlined circle; a
 *     click opens the card with where it stands and Take it back.
 *   - `BidMarkInitial` + `BidMarkRequestCard`: the same circle and card on the Bid Board.
 *   - `MarkedBidsToggle`: *Marked · N* beside *Only my bids* on the nine tabs and in the Bid
 *     Board's tools row. On, the list shows only bids marked by you or for you.
 *   - `BidMarkButton`: *Mark* / *Marked · today* in the open bid's title, then *For someone…*
 *     (`BidMarkForSomeone`) and, when you sent one, where it stands.
 *   - `BidMarkRequestStrip`: under the open bid's title, the note from whoever marked it for
 *     you, with Done and Not for me. Opening the bid marks it seen.
 *
 * All read the store directly; nothing is threaded through the nine hosts.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useCloseOnOutsideClick } from '../../hooks/useCloseOnOutsideClick'
import { bidMarkButtonWords, bidMarkCount, bidMarkDayWords, isBidMarked } from '../../lib/bids/bidMarks'
import {
  BID_MARK_REQUEST_NOTE_MAX,
  firstName,
  forMeByBid,
  fromMeByBid,
  personInitial,
  receiverHeading,
  senderStateWords,
  senderTone,
  suggestedPeople,
  type BidMarkRequest,
} from '../../lib/bids/bidMarkRequests'
import {
  closeBidRequestsForMe,
  markBidForPerson,
  markBidRequestsSeen,
  personHasPushDevice,
  sendBidMarkPush,
  setOnlyMarkedBids,
  takeBackBidRequest,
  toggleBidMarkNow,
  useBidMarks,
} from '../../lib/bids/bidMarksStore'

export const BID_MARK_SAVE_FAILED = 'Could not save the mark. Check your connection and try again.'

function useToggleMark() {
  const { showToast } = useToastContext()
  return (bidId: string) => {
    void toggleBidMarkNow(bidId).catch(() => showToast(BID_MARK_SAVE_FAILED, 'error'))
  }
}

/** The marks state every surface needs: requests for me and from me, by bid. */
export function useBidMarkRequests() {
  const snap = useBidMarks()
  const now = new Date()
  const dayKey = now.toDateString()
  const forMe = useMemo(() => forMeByBid(snap.requests, snap.me), [snap.requests, snap.me])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the day, not the millisecond, moves the window
  const fromMe = useMemo(() => fromMeByBid(snap.requests, snap.me, new Date()), [snap.requests, snap.me, dayKey])
  const nameOf = (id: string) => snap.people[id]?.name ?? 'Someone'
  return { ...snap, forMe, fromMe, nameOf, now }
}

/** The receiver finishes from anywhere: a hold on the row, the card, the strip. */
export function useFinishBidRequests() {
  const { showToast } = useToastContext()
  return (bidId: string, outcome: 'done' | 'not_for_me') => {
    void closeBidRequestsForMe(bidId, outcome).catch(() => showToast(BID_MARK_SAVE_FAILED, 'error'))
  }
}

export function BidMarkDot({ bidId, bidLabel }: { bidId: string; bidLabel: string }) {
  const { marks, forMe, fromMe, nameOf } = useBidMarkRequests()
  const toggle = useToggleMark()
  const mine = forMe.get(bidId)
  const sent = fromMe.get(bidId)
  if (mine && mine.length > 0) return <BidMarkInitial bidId={bidId} variant="for-me" requests={mine} name={nameOf(mine[0]!.from_user_id)} />
  const marked = isBidMarked(marks, bidId)
  if (!marked && sent) return <BidMarkInitial bidId={bidId} variant="sent" requests={[sent]} name={nameOf(sent.for_user_id)} />
  const words = marked ? `Clear the mark on ${bidLabel}` : `Mark ${bidLabel}`
  return (
    <button
      type="button"
      className="bid-mark-dot"
      aria-pressed={marked}
      aria-label={words}
      title={words}
      onClick={(e) => {
        e.stopPropagation()
        toggle(bidId)
      }}
    >
      <span aria-hidden="true" className="bid-mark-dot__ring" />
    </button>
  )
}

/** A circle with a person's initial, and the card it opens. `for-me` is filled, `sent` is outlined. */
export function BidMarkInitial({
  bidId,
  variant,
  requests,
  name,
  size = 'row',
}: {
  bidId: string
  variant: 'for-me' | 'sent'
  requests: BidMarkRequest[]
  name: string
  size?: 'row' | 'board'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const first = requests[0]!
  const unseen = variant === 'for-me' && requests.some((r) => !r.seen_at)
  const tone = variant === 'sent' ? senderTone(first) : null
  const more = variant === 'for-me' && requests.length > 1 ? requests.length - 1 : 0
  const label =
    variant === 'for-me'
      ? `${firstName(name)} marked this for you${unseen ? ', not opened yet' : ''}. Open the note.`
      : `You marked this for ${firstName(name)}. See where it stands.`
  return (
    <span ref={rootRef} className={`bid-mark-initial-wrap bid-mark-initial-wrap--${size}`}>
      <button
        type="button"
        className="bid-mark-initial-button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        <span className="bid-mark-initial" data-variant={variant} data-tone={tone ?? undefined}>
          {tone === 'done' ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            personInitial(name)
          )}
          {unseen ? <span className="bid-mark-initial__new" aria-hidden="true" /> : null}
          {more > 0 ? <span className="bid-mark-initial__more" aria-hidden="true">+{more}</span> : null}
        </span>
      </button>
      {open ? (
        <FloatingCard anchorRef={rootRef} onClose={() => setOpen(false)}>
          <BidMarkRequestCard bidId={bidId} variant={variant} requests={requests} onClose={() => setOpen(false)} />
        </FloatingCard>
      ) : null}
    </span>
  )
}

const CARD_WIDTH = 320

/**
 * The card floats in a layer on the page body, under its circle: the picker list and the Bid
 * Board table both clip their overflow, so a card drawn inside the row would be cut off. A
 * click outside the circle and the card, Escape, or a scroll closes it.
 */
function FloatingCard({ anchorRef, onClose, children }: { anchorRef: RefObject<HTMLElement | null>; onClose: () => void; children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_WIDTH - 8))
    setPos({ top: r.bottom + 4, left })
  }, [anchorRef])
  useEffect(() => {
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (!!cardRef.current?.contains(target) || !!anchorRef.current?.contains(target))
    const onDown = (e: MouseEvent) => {
      if (!inside(e.target)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = (e: Event) => {
      if (!inside(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [anchorRef, onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={cardRef}
      className="bid-mark-floating"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: CARD_WIDTH }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}

export function BidMarkRequestCard({
  bidId,
  variant,
  requests,
  onClose,
}: {
  bidId: string
  variant: 'for-me' | 'sent'
  requests: BidMarkRequest[]
  onClose: () => void
}) {
  const { nameOf, now } = useBidMarkRequests()
  const finish = useFinishBidRequests()
  const { showToast } = useToastContext()
  if (variant === 'for-me') {
    return (
      <span role="dialog" aria-label="Marked for you" className="bid-mark-card">
        {requests.map((r) => (
          <span key={r.id} className="bid-mark-card__item">
            <span className="bid-mark-card__head">{receiverHeading(r, nameOf(r.from_user_id), now)}</span>
            {r.note.trim() ? <span className="bid-mark-card__note">{r.note.trim()}</span> : null}
          </span>
        ))}
        <span className="bid-mark-card__actions">
          <button
            type="button"
            className="bid-mark-card__link"
            onClick={() => {
              finish(bidId, 'not_for_me')
              onClose()
            }}
          >
            Not for me
          </button>
          <button
            type="button"
            className="bid-mark-card__primary"
            onClick={() => {
              finish(bidId, 'done')
              onClose()
            }}
          >
            Done
          </button>
        </span>
      </span>
    )
  }
  const r = requests[0]!
  const who = nameOf(r.for_user_id)
  return (
    <span role="dialog" aria-label={`Marked for ${firstName(who)}`} className="bid-mark-card">
      <span className="bid-mark-card__head">You marked this for {firstName(who)} {bidMarkDayWords(r.created_at, now)}</span>
      {r.note.trim() ? <span className="bid-mark-card__note">{r.note.trim()}</span> : null}
      <span className="bid-mark-card__state" data-tone={senderTone(r)}>{senderStateWords(r, who, now)}</span>
      {!r.closed_at ? (
        <span className="bid-mark-card__actions">
          <button
            type="button"
            className="bid-mark-card__secondary"
            onClick={() => {
              void takeBackBidRequest(r.id).catch(() => showToast(BID_MARK_SAVE_FAILED, 'error'))
              onClose()
            }}
          >
            Take it back
          </button>
        </span>
      ) : null}
    </span>
  )
}

export function MarkedBidsToggle({ compact = false }: { compact?: boolean }) {
  const { marks, onlyMarked, forMe } = useBidMarkRequests()
  const forYou = forMe.size
  let count = bidMarkCount(marks)
  for (const bidId of forMe.keys()) if (!isBidMarked(marks, bidId)) count++
  const title = onlyMarked ? 'Showing only the bids marked by you or for you. Press to show every bid.' : 'Show only the bids marked by you or for you. Hold a row, or click its circle, to mark it.'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={onlyMarked}
      aria-label={`Marked bids${count > 0 ? ` (${count})` : ''}${forYou > 0 ? `, ${forYou} for you` : ''}`}
      title={title}
      onClick={() => setOnlyMarkedBids(!onlyMarked)}
      className="bid-mark-toggle"
      data-on={onlyMarked ? 'true' : undefined}
      style={compact ? { padding: '0.5rem 0.6rem' } : undefined}
    >
      <span aria-hidden="true" className="bid-mark-toggle__dot" />
      {compact ? null : 'Marked'}
      {count > 0 ? <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{count}</span> : null}
      {forYou > 0 && !compact ? <span className="bid-mark-toggle__for-you">{forYou} for you</span> : null}
    </button>
  )
}

export function BidMarkButton({ bidId, now = new Date() }: { bidId: string; now?: Date }) {
  const { marks } = useBidMarks()
  const toggle = useToggleMark()
  const marked = isBidMarked(marks, bidId)
  const { label, since } = bidMarkButtonWords(marks, bidId, now)
  const title = marked ? 'Marked. Press to clear the mark.' : 'Mark this bid to find it again on every tab and on the Bid Board.'
  return (
    <button
      type="button"
      aria-pressed={marked}
      title={title}
      onClick={() => toggle(bidId)}
      className="bid-mark-toggle bid-mark-toggle--title"
      data-on={marked ? 'true' : undefined}
    >
      <span aria-hidden="true" className="bid-mark-toggle__dot" />
      {label}
      {since ? <span style={{ fontWeight: 400, opacity: 0.8 }}>{since}</span> : null}
    </button>
  )
}

/** Where a mark you sent on this bid stands, beside the title buttons. */
export function BidMarkSentStatus({ bidId }: { bidId: string }) {
  const { fromMe, nameOf, now } = useBidMarkRequests()
  const sent = fromMe.get(bidId)
  if (!sent) return null
  const who = nameOf(sent.for_user_id)
  return (
    <span className="bid-mark-sent-status" data-tone={senderTone(sent)}>
      <BidMarkInitial bidId={bidId} variant="sent" requests={[sent]} name={who} />
      <span>{senderStateWords(sent, who, now)}</span>
    </span>
  )
}

export const BID_MARK_FOR_SOMEONE_NOTE_LABEL = 'What should they look at? Optional'

/** *For someone…* in the open bid's title: pick a person, add a note, mark it for them. */
export function BidMarkForSomeone({
  bid,
}: {
  bid: { id: string; bid_number?: string | null; estimator_id?: string | null; account_manager_id?: string | null }
}) {
  const { people, me } = useBidMarks()
  const { showToast } = useToastContext()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState(false)
  const [canPush, setCanPush] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  useCloseOnOutsideClick(rootRef, open, () => setOpen(false))
  const roster = useMemo(() => Object.values(people), [people])
  const { onBid, others } = useMemo(() => suggestedPeople(roster, bid, me), [roster, bid, me])

  useEffect(() => {
    if (!open) return
    setPicked((p) => p ?? onBid[0]?.id ?? null)
  }, [open, onBid])

  useEffect(() => {
    setCanPush(null)
    if (!picked) return
    let cancelled = false
    void personHasPushDevice(picked).then((has) => {
      if (!cancelled) setCanPush(has)
    })
    return () => {
      cancelled = true
    }
  }, [picked])

  const pickedName = picked ? firstName(people[picked]?.name) : ''

  const send = async () => {
    if (!picked || saving) return
    setSaving(true)
    try {
      const requestId = await markBidForPerson(bid.id, picked, note)
      let pushed = 0
      if (phone && canPush) {
        try {
          pushed = await sendBidMarkPush(requestId)
        } catch {
          pushed = 0
        }
      }
      showToast(
        pushed > 0 ? `Marked for ${pickedName}, with a phone notification.` : `Marked for ${pickedName}. It waits on the bid lists.`,
        'success',
      )
      setOpen(false)
      setNote('')
      setPhone(false)
      setPicked(null)
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : 'Could not mark it. Check your connection and try again.'
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <span ref={rootRef} className="bid-mark-for-someone">
      <button
        type="button"
        className="bid-mark-toggle bid-mark-toggle--title"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        title="Mark this bid for a teammate, with a note"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
          <path d="M17 8h5M19.5 5.5v5" />
        </svg>
        For someone…
      </button>
      {open ? (
        <span role="dialog" aria-label="Mark this bid for someone" className="bid-mark-card bid-mark-card--form">
          <span className="bid-mark-card__head">Mark this bid for someone</span>
          {onBid.length > 0 ? <span className="bid-mark-card__label">On this bid</span> : null}
          {onBid.length > 0 ? (
            <span className="bid-mark-people">
              {onBid.map((p) => (
                <PersonChip key={p.id} on={picked === p.id} name={p.name} sub={p.label} onPick={() => setPicked(p.id)} />
              ))}
            </span>
          ) : null}
          <label className="bid-mark-card__label">
            {onBid.length > 0 ? 'Someone else' : 'Who'}
            <select
              className="bid-mark-select"
              value={picked && !onBid.some((p) => p.id === picked) ? picked : ''}
              onChange={(e) => setPicked(e.target.value || (onBid[0]?.id ?? null))}
            >
              <option value="">{onBid.length > 0 ? 'Pick someone else…' : 'Pick someone…'}</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="bid-mark-card__label">
            {BID_MARK_FOR_SOMEONE_NOTE_LABEL}
            <input
              type="text"
              className="bid-mark-input"
              value={note}
              maxLength={BID_MARK_REQUEST_NOTE_MAX}
              placeholder="GC moved the due date. Reprice the trim."
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void send()
              }}
            />
          </label>
          {picked && canPush === true ? (
            <label className="bid-mark-check">
              <input type="checkbox" checked={phone} onChange={(e) => setPhone(e.target.checked)} />
              Also send it to {pickedName}'s phone
            </label>
          ) : null}
          {picked && canPush === false ? (
            <span className="bid-mark-card__state">{pickedName} has phone notifications off. It waits on the bid lists.</span>
          ) : null}
          <span className="bid-mark-card__actions">
            <button type="button" className="bid-mark-card__secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="button" className="bid-mark-card__primary" disabled={!picked || saving} onClick={() => void send()}>
              {picked ? `Mark for ${pickedName}` : 'Mark for someone'}
            </button>
          </span>
        </span>
      ) : null}
    </span>
  )
}

function PersonChip({ on, name, sub, onPick }: { on: boolean; name: string; sub: string; onPick: () => void }) {
  return (
    <button type="button" className="bid-mark-person" aria-pressed={on} onClick={onPick}>
      <span className="bid-mark-person__avatar" aria-hidden="true">
        {personInitial(name)}
      </span>
      <span className="bid-mark-person__text">
        <span>{name}</span>
        <span className="bid-mark-person__sub">{sub}</span>
      </span>
    </button>
  )
}

/** Under the open bid's title: what whoever marked it for you said, with Done and Not for me. */
export function BidMarkRequestStrip({ bidId }: { bidId: string }) {
  const { forMe, nameOf, now } = useBidMarkRequests()
  const finish = useFinishBidRequests()
  const mine = forMe.get(bidId)
  const anyUnseen = !!mine?.some((r) => !r.seen_at)
  useEffect(() => {
    if (anyUnseen) void markBidRequestsSeen(bidId)
  }, [bidId, anyUnseen])
  if (!mine || mine.length === 0) return null
  return (
    <div className="bid-mark-strip" role="note" aria-label="Marked for you">
      {mine.map((r) => (
        <div key={r.id} className="bid-mark-strip__item">
          <span className="bid-mark-initial" data-variant="for-me" aria-hidden="true">
            {personInitial(nameOf(r.from_user_id))}
          </span>
          <span className="bid-mark-strip__text">
            <span className="bid-mark-strip__head">{receiverHeading(r, nameOf(r.from_user_id), now)}</span>
            {r.note.trim() ? <span className="bid-mark-strip__note">{r.note.trim()}</span> : null}
          </span>
        </div>
      ))}
      <span className="bid-mark-card__actions bid-mark-strip__actions">
        <button type="button" className="bid-mark-card__link" onClick={() => finish(bidId, 'not_for_me')}>
          Not for me
        </button>
        <button type="button" className="bid-mark-card__primary" onClick={() => finish(bidId, 'done')}>
          Done
        </button>
      </span>
    </div>
  )
}
