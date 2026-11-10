import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { EmptyState } from '../EmptyState'
import { useToastContext } from '../../contexts/ToastContext'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { contactKeys, rowsAboveFloor, type ContactHistory, type ResearchPermitRow, type ValueFloor } from '../../lib/research/permitResearch'
import { BUILDER_KIND_WORDS, builderLine, isBuilderKind, placeCounts, placeOf, skimBuilderContext, type SkimLive } from '../../lib/research/permitBuilders'
import { googleAsksForContact } from '../../lib/research/permitPublic'
import {
  PASS_REASONS,
  SKIM_HOLD_MS,
  answeredWords,
  caughtUpWords,
  digInWords,
  filedWords,
  milesWords,
  skimDeck,
  skimKeyAct,
  skimMoney,
  skimTitle,
  skimVerdict,
  type PassReasonCode,
  type SkimAnswer,
  type SkimCard,
} from '../../lib/research/permitSkim'
import { cardHistory, earlierWords, type HistoryEvent } from '../../lib/research/permitHistory'
import { loadContactHistory, loadPermitHistory, lookupParcel, recordVerdict } from '../../lib/research/permitResearchIo'
import { passedByWords, secondLookAnsweredWords, secondLookCaughtUpWords, secondLookCount, secondLookDeck, secondLookVerdict, waitsOnSecondLook } from '../../lib/research/permitSecondLook'
import { swipeAnswer, swipeIsScroll, swipeMayStart, swipeProgress } from '../../lib/research/permitLook'
import { skimCardSidePadding } from '../../lib/prospects/pagePadding'
import { GoogleSearchPress } from './GoogleSearchPress'
import { PermitSkimLook } from './PermitSkimLook'
import { PermitBuildingSheet } from './PermitBuildingSheet'
import { WhoPulledItSheet } from './WhoPulledItSheet'
import { usePermitRecordsStart } from '../../hooks/usePermitRecordsStart'
import { reachWords, recordsReach } from '../../lib/research/permitReach'

/**
 * Permits, the skim (punch list #302): step one. One permit on one card, best first, with two
 * answers, Keep or Pass, by button, and by arrow key on a desk. Nothing is typed: a pass offers
 * four one-tap reasons in the bar under the next card, and the bar is the undo. An answer is held
 * a few seconds before it is written, so Undo has something to take back. The deck has no window:
 * a permit stays until it is answered. The Who line and the Property line open the two sheets.
 * Two pictures sit across the top (PermitSkimLook), and on a phone a drag answers: right keeps,
 * left passes, with the word showing as the card passes a third of its width.
 *
 * In `second` mode the same deck deals what someone else passed (permitSecondLook): the card says
 * who passed and why, Keep sends it to Kept under this person's name, and Pass closes it for good.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const cardStyle: CSSProperties = { position: 'relative', touchAction: 'pan-y', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }
// On a phone the two answers stay at the foot of the screen, over the app's own bottom bar, however tall the card is.
const stickyAnswers: CSSProperties = { position: 'sticky', bottom: 'calc(var(--app-bottom-chrome, 0px) + 8px)', background: 'var(--surface)', borderTop: '1px solid var(--border)', borderRadius: '0 0 14px 14px', zIndex: 5 }
const factRow: CSSProperties = { display: 'grid', gridTemplateColumns: '74px minmax(0, 1fr) auto', gap: 8, alignItems: 'start', padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem', textAlign: 'left', width: '100%', background: 'transparent', color: 'var(--text)', font: 'inherit' }
const factName: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', paddingTop: 2 }
const pill = (tone: 'green' | 'grey' | 'blue' | 'amber'): CSSProperties => ({
  display: 'inline-block',
  borderRadius: 999,
  padding: '2px 9px',
  fontSize: '0.75rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  background: tone === 'green' ? 'var(--bg-green-tint)' : tone === 'blue' ? 'var(--bg-blue-tint)' : tone === 'amber' ? 'var(--bg-amber-tint)' : 'var(--bg-200)',
  color: tone === 'green' ? 'var(--text-green-700)' : tone === 'blue' ? 'var(--text-blue-800)' : tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-700)',
})
const keyCap: CSSProperties = { font: 'inherit', fontSize: '0.6875rem', fontWeight: 600, border: '1px solid currentColor', borderRadius: 4, padding: '0 5px', opacity: 0.75 }

type Pending = { card: SkimCard; answer: SkimAnswer; reasonCode: PassReasonCode | null; forUserId: string | null }

/** A person a kept permit can be handed to. */
export type Researcher = { id: string; name: string }
/** What an answer changed on a row, handed up so the step strip and the lists read it without a reload. */
export type AnsweredPatch = Pick<ResearchPermitRow, 'verdict' | 'verdict_reason' | 'verdict_reason_code' | 'verdict_for_user' | 'verdict_for_name' | 'verdict_at' | 'verdict_by'>
type Parcel = { state: 'loading' } | { state: 'done'; facts: ParcelFacts | null }

/** The property line's words from the county's parcel: the owner, and what stands on the lot. */
function lotWords(facts: ParcelFacts): string {
  const built = facts.building_sf ? `${Math.round(facts.building_sf).toLocaleString('en-US')} sq ft built${facts.year_built ? ` in ${facts.year_built}` : ''}` : 'nothing built on the roll'
  return [built, facts.acres ? `${facts.acres} acres` : null].filter(Boolean).join(', ')
}

export function PermitSkimDeck({
  authUserId,
  city,
  floor,
  todayYmd,
  isMobile,
  rows,
  loading,
  error,
  researchers,
  onReload,
  onAnswered,
  onDigIn,
  onLive,
  mode = 'skim',
  onSecondLook,
}: {
  authUserId: string
  city: string
  floor: ValueFloor
  todayYmd: string
  isMobile: boolean
  /** Every permit the feed has brought, with no window: the tab reads them once for the deck, the strip and the lists. */
  rows: readonly ResearchPermitRow[]
  loading: boolean
  error: string | null
  /** The people a keep can be handed to. Empty when the list cannot be read: the bar then offers no names. */
  researchers: readonly Researcher[]
  onReload: () => void
  /** An answer was written: what it changed on the row. */
  onAnswered: (permitId: string, patch: AnsweredPatch) => void
  /** Opens the kept permits, where step two works them. */
  onDigIn: () => void
  /** The deck's own count and the answer it holds, for the strip above it. Null while it reads, when it fails and when it closes. */
  onLive?: (live: SkimLive | null) => void
  /** `second` deals what someone else passed, for a second look. */
  mode?: 'skim' | 'second'
  /** Opens the second look, offered once the skim is caught up. */
  onSecondLook?: () => void
}) {
  const { showToast } = useToastContext()
  const office = useOfficeAnchor(true)
  const [history, setHistory] = useState<Map<string, ContactHistory>>(new Map())
  const [done, setDone] = useState<Set<string>>(new Set())
  const [tally, setTally] = useState({ kept: 0, passed: 0 })
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const [parcels, setParcels] = useState<Map<string, Parcel>>(new Map())
  const [histories, setHistories] = useState<Map<string, HistoryEvent[]>>(new Map())
  const [sheet, setSheet] = useState<{ kind: 'who' | 'site'; card: SkimCard } | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; width: number; live: boolean } | null>(null)
  const [dx, setDx] = useState(0)

  // Our history with the names in the deck alone, one read, fail-soft: the deck stands without it.
  const waitingKeys = useMemo(() => [...new Set(rowsAboveFloor(rows, floor).filter((r) => (mode === 'second' ? waitsOnSecondLook(r, authUserId) : placeOf(r).place === 'skim')).flatMap((r) => contactKeys(r.contact)))].sort().join('|'), [rows, floor, mode, authUserId])
  useEffect(() => {
    if (waitingKeys === '') {
      setHistory(new Map())
      return
    }
    let live = true
    loadContactHistory(waitingKeys.split('|'))
      .then((h) => live && setHistory(h))
      .catch(() => live && setHistory(new Map()))
    return () => {
      live = false
    }
  }, [waitingKeys])

  const deck = useMemo(() => {
    const ctx = { todayYmd, office, history, ...skimBuilderContext(rows) }
    return (mode === 'second' ? secondLookDeck(rows, ctx, floor, authUserId) : skimDeck(rows, ctx, floor)).filter((c) => !done.has(c.row.id))
  }, [rows, todayYmd, office, history, floor, done, mode, authUserId])
  // How far back the builder's count can see (punch list #307): the day the records start, or a year.
  const recordsStart = usePermitRecordsStart(city)
  const reach = reachWords(recordsReach(recordsStart, todayYmd), todayYmd)
  const top = deck[0] ?? null
  // A kept permit the tab has not yet been told about is still held here, so the press counts it.
  const keptCount = useMemo(() => placeCounts(rows, floor).kept + (pending?.answer === 'keep' ? 1 : 0), [rows, floor, pending])

  // The strip above is the one count on the page, so it reads the deck's number and the held answer.
  const left = deck.length
  const heldAnswer = pending?.answer ?? null
  const deckReady = !loading && !error
  useEffect(() => {
    onLive?.(deckReady ? { mode, left, held: heldAnswer } : null)
  }, [onLive, deckReady, mode, left, heldAnswer])
  useEffect(() => () => onLive?.(null), [onLive])

  /** Write one held answer. A failure names the permit, says why, and puts the card back. */
  const write = useCallback(
    async (p: Pending) => {
      // A second look writes its own words and an sl_ code; the skim writes the tapped reason, if any.
      const v = mode === 'second' ? secondLookVerdict(p.answer, p.reasonCode, p.card.row.verdict_by_name) : { ...skimVerdict(p.answer, p.reasonCode), reasonCode: p.answer === 'pass' ? p.reasonCode : null }
      try {
        await recordVerdict({ permitId: p.card.row.id, verdict: v.verdict, reason: v.reason, lookAgainOn: null, prospectId: null, userId: authUserId, reasonCode: v.reasonCode, forUserId: p.answer === 'keep' ? p.forUserId : null })
        onAnswered(p.card.row.id, {
          verdict: v.verdict,
          verdict_reason: v.reason,
          verdict_reason_code: v.reasonCode,
          verdict_for_user: p.answer === 'keep' ? p.forUserId : null,
          verdict_for_name: p.answer === 'keep' ? (researchers.find((r) => r.id === p.forUserId)?.name ?? null) : null,
          verdict_at: new Date().toISOString(),
          verdict_by: authUserId,
        })
      } catch (e) {
        showToast(`${p.card.row.address ?? p.card.row.permit_number} was not saved. ${formatErrorMessage(e)}`, 'error')
        setDone((prev) => {
          const next = new Set(prev)
          next.delete(p.card.row.id)
          return next
        })
        setTally((t) => (p.answer === 'keep' ? { ...t, kept: Math.max(0, t.kept - 1) } : { ...t, passed: Math.max(0, t.passed - 1) }))
      }
    },
    [authUserId, showToast, onAnswered, researchers, mode],
  )

  const flush = useCallback(() => {
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    setPending(null)
    void write(p)
  }, [write])

  const answer = useCallback(
    (card: SkimCard, a: SkimAnswer) => {
      flush()
      const p: Pending = { card, answer: a, reasonCode: null, forUserId: null }
      pendingRef.current = p
      setPending(p)
      setSheet(null)
      setDone((prev) => new Set(prev).add(card.row.id))
      setTally((t) => (a === 'keep' ? { ...t, kept: t.kept + 1 } : { ...t, passed: t.passed + 1 }))
    },
    [flush],
  )

  const undo = useCallback(() => {
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    setPending(null)
    setDone((prev) => {
      const next = new Set(prev)
      next.delete(p.card.row.id)
      return next
    })
    setTally((t) => (p.answer === 'keep' ? { ...t, kept: Math.max(0, t.kept - 1) } : { ...t, passed: Math.max(0, t.passed - 1) }))
  }, [])

  const pickReason = useCallback((code: PassReasonCode) => {
    const p = pendingRef.current
    if (!p || p.answer !== 'pass') return
    const next: Pending = { ...p, reasonCode: p.reasonCode === code ? null : code }
    pendingRef.current = next
    setPending(next)
  }, [])

  const pickFor = useCallback((userId: string | null) => {
    const p = pendingRef.current
    if (!p || p.answer !== 'keep') return
    const next: Pending = { ...p, forUserId: userId }
    pendingRef.current = next
    setPending(next)
  }, [])

  // A held answer is written after a few seconds, when the tab is hidden, and when the deck closes.
  useEffect(() => {
    if (!pending) return
    const t = window.setTimeout(flush, SKIM_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [pending, flush])
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flush)
    }
  }, [flush])
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  useEffect(() => () => flushRef.current(), [])

  // The county's owner of record for the top card: the same cached call the sheets make.
  const topId = top?.row.id ?? null
  const topAddress = top?.row.address ?? null
  useEffect(() => {
    if (!topId || !topAddress) return
    let live = true
    setParcels((prev) => (prev.has(topId) ? prev : new Map(prev).set(topId, { state: 'loading' })))
    lookupParcel(topAddress, city)
      .then((a) => live && setParcels((prev) => new Map(prev).set(topId, { state: 'done', facts: a.facts })))
      .catch(() => live && setParcels((prev) => new Map(prev).set(topId, { state: 'done', facts: null })))
    return () => {
      live = false
    }
  }, [topId, topAddress, city])

  // What was done on the top card before: who moved it, where to and when. Fail-soft, the card stands without it.
  useEffect(() => {
    if (!topId) return
    let live = true
    loadPermitHistory(topId)
      .then((list) => live && setHistories((prev) => new Map(prev).set(topId, list)))
      .catch(() => live && setHistories((prev) => new Map(prev).set(topId, [])))
    return () => {
      live = false
    }
  }, [topId])

  // The desk's keys. They rest while a sheet is open or a field has the caret.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (document.querySelector('[role="dialog"]')) return
      const act = skimKeyAct(e.key)
      if (!act) return
      if (act.act === 'undo') {
        if (!pendingRef.current) return
        e.preventDefault()
        undo()
      } else if (act.act === 'reason') {
        if (pendingRef.current?.answer !== 'pass') return
        e.preventDefault()
        pickReason(act.code)
      } else if (top) {
        e.preventDefault()
        if (act.act === 'open') setSheet({ kind: 'site', card: top })
        else answer(top, act.act)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheet, top, answer, undo, pickReason])

  // The swipe: a touch drags the card; past a third of its width it answers, short of it the card springs back.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    if (!swipeMayStart(e.pointerType, e.clientX, window.innerWidth)) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, width: cardRef.current?.offsetWidth ?? 320, live: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const moved = e.clientX - d.x
    if (!d.live) {
      if (swipeIsScroll(moved, e.clientY - d.y)) {
        drag.current = null
        return
      }
      if (Math.abs(moved) < 8) return
      d.live = true
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // A browser that will not capture still gets the moves while the finger is on the card.
      }
    }
    setDx(moved)
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    drag.current = null
    setDx(0)
    if (!d || !d.live || cancelled || !top) return
    const a = swipeAnswer(e.clientX - d.x, d.width)
    if (a) answer(top, a)
  }

  const bar = pending && (
    <div role="status" style={{ margin: isMobile ? '0 0 10px' : '14px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--text-strong)', color: 'var(--surface)', fontSize: '0.8125rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span>{pending.answer === 'keep' && researchers.length > 0 ? 'Kept. For?' : mode === 'second' ? secondLookAnsweredWords(pending.answer) : answeredWords(pending.answer)}</span>
      {pending.answer === 'keep' &&
        researchers.length > 0 &&
        [{ id: null as string | null, name: 'Anyone' }, ...researchers.slice(0, 8)].map((r) => {
          const on = pending.forUserId === r.id
          return (
            <button key={r.id ?? 'anyone'} type="button" aria-pressed={on} onClick={() => pickFor(r.id)} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 999, border: '1px solid var(--surface)', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text-strong)' : 'var(--surface)', padding: '3px 10px', minHeight: 32, cursor: 'pointer' }}>
              {r.id === authUserId ? 'Me' : r.name}
            </button>
          )
        })}
      {pending.answer === 'pass' &&
        PASS_REASONS.map((r) => {
          const on = pending.reasonCode === r.code
          return (
            <button key={r.code} type="button" aria-pressed={on} onClick={() => pickReason(r.code)} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 999, border: '1px solid var(--surface)', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text-strong)' : 'var(--surface)', padding: '3px 10px', minHeight: 32, cursor: 'pointer' }}>
              {r.words}
            </button>
          )
        })}
      <span style={{ flex: '1 1 auto' }} />
      <button type="button" onClick={undo} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 700, background: 'transparent', border: 0, color: 'var(--surface)', textDecoration: 'underline', padding: '3px 4px', minHeight: 32, cursor: 'pointer' }}>
        Undo
      </button>
    </div>
  )

  if (loading) return <div style={muted}>Reading the permits…</div>
  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
        <span>{error}</span>
        <button type="button" onClick={onReload} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  if (!top) {
    const dig = digInWords(keptCount)
    const again = mode === 'skim' && onSecondLook ? secondLookCount(rows, floor, authUserId) : 0
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <div style={{ ...cardStyle, padding: '1.5rem 1rem', textAlign: 'center' }}>
          {mode === 'second' ? <EmptyState main="Nothing waiting on a second look." tail={secondLookCaughtUpWords(tally.kept, tally.passed)} compact /> : <EmptyState main="Nothing waiting on a skim." tail={caughtUpWords(tally.kept, tally.passed)} compact />}
          {dig && (
            <button type="button" onClick={onDigIn} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 10, padding: '12px 18px', fontSize: '0.9375rem', fontWeight: 700, minHeight: 48, cursor: 'pointer', width: '100%', maxWidth: 360 }}>
              {dig}
            </button>
          )}
          {again > 0 && (
            <button type="button" onClick={onSecondLook} style={{ background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 18px', fontSize: '0.9375rem', fontWeight: 700, minHeight: 48, cursor: 'pointer', width: '100%', maxWidth: 360, marginTop: dig ? 8 : 0 }}>
              Second look · {again} someone else passed
            </button>
          )}
        </div>
        {bar}
      </div>
    )
  }

  const row = top.row
  const answered = tally.kept + tally.passed
  const parcel = parcels.get(row.id)
  const asks = googleAsksForContact(row.contact, row.city)
  const where = [row.address ?? row.permit_number, row.zip].filter(Boolean).join(', ')
  const far = milesWords(top.miles)
  const side = skimCardSidePadding(isMobile)
  // A second-look card says the pass in its amber line, so its history starts one answer earlier.
  const past = cardHistory(histories.get(row.id) ?? [], 2, mode === 'second' ? 1 : 0)
  const earlier = earlierWords(past.earlier)

  const pull = swipeProgress(dx, drag.current?.width ?? 320)
  const stamp: CSSProperties = { position: 'absolute', top: 16, zIndex: 6, fontWeight: 800, fontSize: '1.375rem', letterSpacing: '0.08em', padding: '2px 12px', borderRadius: 8, border: '3px solid', background: 'var(--surface)', pointerEvents: 'none' }
  const card = (
    <div
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e, false)}
      onPointerCancel={(e) => endDrag(e, true)}
      style={{ ...cardStyle, transform: dx ? `translateX(${dx}px) rotate(${dx / 22}deg)` : undefined, transition: dx ? 'none' : 'transform 150ms ease-out' }}
    >
      {dx !== 0 && (
        <>
          <span aria-hidden="true" style={{ ...stamp, left: 14, color: 'var(--text-green-700)', opacity: Math.max(0, pull), transform: 'rotate(-12deg)' }}>
            KEEP
          </span>
          <span aria-hidden="true" style={{ ...stamp, right: 14, color: 'var(--text-muted)', opacity: Math.max(0, -pull), transform: 'rotate(12deg)' }}>
            PASS
          </span>
        </>
      )}
      <PermitSkimLook row={row} milesWords={far} compact={isMobile} />
      {mode === 'second' && <div style={{ padding: `7px ${side}px`, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', fontWeight: 600 }}>{passedByWords(row, todayYmd)}</div>}
      <div style={{ padding: `14px ${side}px 4px` }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {row.work_type ?? 'Permit'} · {filedWords(row, todayYmd)}
        </div>
        <h3 style={{ margin: '2px 0 0', fontSize: '1.1875rem', lineHeight: 1.25 }}>{skimTitle(row)}</h3>
        <div style={{ fontSize: '0.9375rem', marginTop: 2 }}>{skimMoney(row)}</div>
        <div style={{ fontSize: '0.875rem', marginTop: 6 }}>{where}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-green-700)', margin: '4px 0 10px' }}>{top.why}</div>

        <div style={factRow}>
          <span style={factName}>Who</span>
          <span style={{ minWidth: 0 }}>
            {row.contact ? (
              <button type="button" onClick={() => setSheet({ kind: 'who', card: top })} style={{ background: 'transparent', border: 0, padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }} title="Who pulled it: the company on Google, our history, their other permits">
                {row.contact}
              </button>
            ) : (
              <span style={muted}>nobody named</span>
            )}{' '}
            {row.builder_mark === 'good' && <span style={pill('green')}>Good</span>}
            {row.builder_mark === 'avoid' && <span style={{ ...pill('grey'), background: 'var(--bg-red-tint, var(--bg-200))', color: 'var(--text-red-700)' }}>Avoid</span>}{' '}
            {isBuilderKind(row.builder_kind) && row.builder_kind === 'files_for_others' ? <span style={pill('grey')}>{BUILDER_KIND_WORDS.files_for_others}</span> : <span style={pill(top.hint.tone === 'warm' ? 'amber' : top.hint.tone === 'new' ? 'blue' : 'grey')}>{top.hint.word}</span>}
            {row.builder_mark && row.builder_mark_reason ? (
              <span style={{ ...muted, display: 'block', marginTop: 2 }}>
                “{row.builder_mark_reason}”{row.builder_mark_by_name ? ` ${row.builder_mark_by_name}.` : ''}
              </span>
            ) : null}
            <span style={{ ...muted, display: 'block', marginTop: 2 }}>{row.builder_kind === 'files_for_others' ? 'Not who builds it. Read the owner under Property.' : top.hint.detail}</span>
            {builderLine(row, reach) && <span style={{ ...muted, display: 'block', marginTop: 2 }}>{builderLine(row, reach)}</span>}
          </span>
          <GoogleSearchPress ask={asks.company ?? asks.person} />
        </div>

        {/* Every card in the deck has no plumber yet, and the green line says so: a phone spends the row on the answers. */}
        {!isMobile && (
          <div style={factRow}>
            <span style={factName}>Plumber</span>
            <span>
              <span style={pill('green')}>none yet</span>
            </span>
            <span />
          </div>
        )}

        <div style={factRow}>
          <span style={factName}>Property</span>
          <span style={{ minWidth: 0 }}>
            <button type="button" onClick={() => setSheet({ kind: 'site', card: top })} style={{ background: 'transparent', border: 0, padding: 0, font: 'inherit', color: 'var(--text-link)', textAlign: 'left', cursor: 'pointer' }} title="The building: the permit as the city gave it, the property at the county, every permit on this address">
              {parcel?.state === 'done' && parcel.facts?.owner ? parcel.facts.owner : 'The permit and the county’s record'}
            </button>
            <span style={{ ...muted, display: 'block', marginTop: 2 }}>
              {!parcel || parcel.state === 'loading' ? 'Asking the county…' : parcel.facts ? lotWords(parcel.facts) : 'The county has no parcel under this street address.'}
            </span>
          </span>
          <span />
        </div>

        {past.lines.length > 0 && (
          <div style={factRow}>
            <span style={factName}>{mode === 'second' ? 'Before' : 'History'}</span>
            <span style={{ minWidth: 0 }}>
              {past.lines.map((l) => (
                <span key={l.id} style={{ display: 'block', overflowWrap: 'anywhere', fontSize: '0.8125rem', lineHeight: 1.45 }}>
                  {l.words}
                </span>
              ))}
              {earlier && (
                <button type="button" onClick={() => setSheet({ kind: 'site', card: top })} style={{ background: 'transparent', border: 0, padding: 0, marginTop: 2, font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-link)', cursor: 'pointer' }} title="The building: everything that was done on this permit">
                  {earlier}
                </button>
              )}
            </span>
            <span />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: `12px ${side}px ${isMobile ? 12 : 16}px`, ...(isMobile ? stickyAnswers : null) }}>
        <button type="button" onClick={() => answer(top, 'pass')} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 10, minHeight: 52, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {!isMobile && (
            <kbd aria-hidden="true" style={keyCap}>
              ←
            </kbd>
          )}
          Pass
        </button>
        <button type="button" onClick={() => answer(top, 'keep')} style={{ background: '#16a34a', color: '#ffffff', border: 0, borderRadius: 10, minHeight: 52, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          Keep
          {!isMobile && (
            <kbd aria-hidden="true" style={keyCap}>
              →
            </kbd>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* How far this sitting has come. Not drawn before the first answer: an empty bar under the strip says nothing. */}
      {answered > 0 && (
        <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round((answered / Math.max(1, answered + deck.length)) * 100)}%`, background: '#2563eb' }} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '220px minmax(0, 560px)', gap: 14, alignItems: 'start' }}>
        {!isMobile && (
          <div>
            <div style={{ ...factName, marginBottom: 4 }}>Up next · best first</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden', fontSize: '0.8125rem' }}>
              {deck.slice(0, 6).map((c, i) => (
                <div key={c.row.id} style={{ padding: '7px 10px', borderTop: i === 0 ? 0 : '1px solid var(--border)', background: i === 0 ? 'var(--bg-blue-tint)' : undefined }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skimTitle(c.row)}</strong>
                  <span style={{ ...muted, fontSize: '0.72rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[c.row.contact, c.miles != null ? `${c.miles} mi` : null].filter(Boolean).join(' · ') || c.row.address}
                  </span>
                </div>
              ))}
              {deck.length > 6 && <div style={{ ...muted, padding: '7px 10px', borderTop: '1px solid var(--border)', fontSize: '0.72rem' }}>and {deck.length - 6} more</div>}
            </div>
            {answered > 0 && (
              <div style={{ ...muted, fontSize: '0.75rem', paddingTop: 6 }}>
                This sitting: {tally.kept} kept, {tally.passed} passed
              </div>
            )}
          </div>
        )}
        <div>
          {isMobile && bar}
          {card}
          {!isMobile && (
            <div style={{ ...muted, fontSize: '0.75rem', display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', paddingTop: 10 }}>
              <span>← Pass</span>
              <span>→ Keep</span>
              <span>Z Undo</span>
              <span>Enter opens the building</span>
              <span>1 to 4 a pass reason</span>
            </div>
          )}
          {!isMobile && bar}
        </div>
      </div>

      {sheet?.kind === 'who' && (
        <WhoPulledItSheet row={sheet.card.row} hint={sheet.card.hint} onClose={() => setSheet(null)} onApproach={() => setSheet(null)} answers={{ onPass: () => answer(sheet.card, 'pass'), onKeep: () => answer(sheet.card, 'keep') }} />
      )}
      {sheet?.kind === 'site' && (
        <PermitBuildingSheet
          row={sheet.card.row}
          onClose={() => setSheet(null)}
          onDecide={() => setSheet(null)}
          onWho={() => setSheet({ kind: 'who', card: sheet.card })}
          answers={{ onPass: () => answer(sheet.card, 'pass'), onKeep: () => answer(sheet.card, 'keep') }}
        />
      )}
    </div>
  )
}
