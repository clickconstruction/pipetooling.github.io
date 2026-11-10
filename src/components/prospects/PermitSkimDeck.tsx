import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { useToastContext } from '../../contexts/ToastContext'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { contactKeys, rowLens, rowsAboveFloor, type ContactHistory, type ResearchPermitRow, type ValueFloor } from '../../lib/research/permitResearch'
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
  toSkimWords,
  type PassReasonCode,
  type SkimAnswer,
  type SkimCard,
} from '../../lib/research/permitSkim'
import { loadContactHistory, loadResearchPermits, lookupParcel, recordVerdict } from '../../lib/research/permitResearchIo'
import { GoogleSearchPress } from './GoogleSearchPress'
import { PermitBuildingSheet } from './PermitBuildingSheet'
import { WhoPulledItSheet } from './WhoPulledItSheet'

/**
 * Permits, the skim (punch list #302): step one. One permit on one card, best first, with two
 * answers, Keep or Pass, by button, and by arrow key on a desk. Nothing is typed: a pass offers
 * four one-tap reasons in the bar under the next card, and the bar is the undo. An answer is held
 * a few seconds before it is written, so Undo has something to take back. The deck has no window:
 * a permit stays until it is answered. The Who line and the Property line open the two sheets.
 */
const SKIM_SINCE_YMD = '2000-01-01'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem' }
const cardStyle: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }
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

type Pending = { card: SkimCard; answer: SkimAnswer; reasonCode: PassReasonCode | null }
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
  onDigIn,
}: {
  authUserId: string
  city: string
  floor: ValueFloor
  todayYmd: string
  isMobile: boolean
  /** Opens the kept permits, where step two works them. */
  onDigIn: () => void
}) {
  const { showToast } = useToastContext()
  const office = useOfficeAnchor(true)
  const [rows, setRows] = useState<ResearchPermitRow[]>([])
  const [history, setHistory] = useState<Map<string, ContactHistory>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [tally, setTally] = useState({ kept: 0, passed: 0 })
  const [pending, setPending] = useState<Pending | null>(null)
  const pendingRef = useRef<Pending | null>(null)
  const [parcels, setParcels] = useState<Map<string, Parcel>>(new Map())
  const [sheet, setSheet] = useState<{ kind: 'who' | 'site'; card: SkimCard } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await loadResearchPermits(city, SKIM_SINCE_YMD, false)
      setRows(list)
      // Our history with the names in the deck alone, one read, fail-soft: the deck stands without it.
      try {
        const waiting = rowsAboveFloor(list, floor).filter((r) => rowLens(r) === 'waiting')
        setHistory(await loadContactHistory(waiting.flatMap((r) => contactKeys(r.contact))))
      } catch {
        setHistory(new Map())
      }
    } catch (e) {
      setError(formatErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [city, floor])

  useEffect(() => {
    void load()
  }, [load])

  const deck = useMemo(() => skimDeck(rows, { todayYmd, office, history }, floor).filter((c) => !done.has(c.row.id)), [rows, todayYmd, office, history, floor, done])
  const top = deck[0] ?? null
  const keptCount = useMemo(() => rows.filter((r) => rowLens(r) === 'look').length + tally.kept, [rows, tally.kept])

  /** Write one held answer. A failure names the permit, says why, and puts the card back. */
  const write = useCallback(
    async (p: Pending) => {
      const v = skimVerdict(p.answer, p.reasonCode)
      try {
        await recordVerdict({ permitId: p.card.row.id, verdict: v.verdict, reason: v.reason, lookAgainOn: null, prospectId: null, userId: authUserId })
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
    [authUserId, showToast],
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
      const p: Pending = { card, answer: a, reasonCode: null }
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

  const bar = pending && (
    <div role="status" style={{ margin: isMobile ? '0 0 10px' : '14px 0 0', padding: '10px 12px', borderRadius: 10, background: 'var(--text)', color: 'var(--surface)', fontSize: '0.8125rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      <span>{answeredWords(pending.answer)}</span>
      {pending.answer === 'pass' &&
        PASS_REASONS.map((r) => {
          const on = pending.reasonCode === r.code
          return (
            <button key={r.code} type="button" aria-pressed={on} onClick={() => pickReason(r.code)} style={{ font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 999, border: '1px solid var(--surface)', background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--text)' : 'var(--surface)', padding: '3px 10px', minHeight: 32, cursor: 'pointer' }}>
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
        <button type="button" onClick={() => void load()} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  if (!top) {
    const dig = digInWords(keptCount)
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', width: '100%' }}>
        <div style={{ ...cardStyle, padding: '1.5rem 1rem', textAlign: 'center' }}>
          <EmptyState main="Nothing waiting on a skim." tail={caughtUpWords(tally.kept, tally.passed)} compact />
          {dig && (
            <button type="button" onClick={onDigIn} style={{ background: '#2563eb', color: '#ffffff', border: 0, borderRadius: 10, padding: '12px 18px', fontSize: '0.9375rem', fontWeight: 700, minHeight: 48, cursor: 'pointer', width: '100%', maxWidth: 360 }}>
              {dig}
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

  const card = (
    <div style={cardStyle}>
      <div style={{ padding: '14px 16px 4px' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {row.work_type ?? 'Permit'} · {filedWords(row, todayYmd)}
        </div>
        <h3 style={{ margin: '2px 0 0', fontSize: '1.1875rem', lineHeight: 1.25 }}>{skimTitle(row)}</h3>
        <div style={{ fontSize: '0.9375rem', marginTop: 2 }}>{skimMoney(row)}</div>
        <div style={{ fontSize: '0.875rem', marginTop: 6 }}>
          {where}
          {far ? <span style={muted}> · {far}</span> : null}
        </div>
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
            <span style={pill(top.hint.tone === 'warm' ? 'amber' : top.hint.tone === 'new' ? 'blue' : 'grey')}>{top.hint.word}</span>
            <span style={{ ...muted, display: 'block', marginTop: 2 }}>{top.hint.detail}</span>
          </span>
          <GoogleSearchPress ask={asks.company ?? asks.person} />
        </div>

        <div style={factRow}>
          <span style={factName}>Plumber</span>
          <span>
            <span style={pill('green')}>none yet</span>
          </span>
          <span />
        </div>

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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 16px 16px', ...(isMobile ? stickyAnswers : null) }}>
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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        <span>
          <strong style={{ color: 'var(--text)', fontSize: '0.9375rem' }}>{toSkimWords(deck.length)}</strong> · best first
        </span>
        {answered > 0 && (
          <span>
            {tally.kept} kept, {tally.passed} passed
          </span>
        )}
      </div>
      <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.round((answered / Math.max(1, answered + deck.length)) * 100)}%`, background: '#2563eb' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : '220px minmax(0, 560px)', gap: 14, alignItems: 'start' }}>
        {!isMobile && (
          <div>
            <div style={{ ...factName, marginBottom: 4 }}>Up next</div>
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
