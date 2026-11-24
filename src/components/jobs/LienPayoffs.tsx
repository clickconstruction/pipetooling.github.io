import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { EmptyState } from '../EmptyState'
import { Money, MoneyText } from '../Money'
import { ValueSentence, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { emptyWords } from '../../lib/emptyWords'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import type { BankCheck } from '../../lib/jobs/checkCleared'
import {
  LIEN_PAYOFF_STEPS,
  LIEN_PAYOFF_WORDS,
  lienPayoffOtherLine,
  lienPayoffPlaces,
  lienPayoffStepState,
  lienPayoffStrip,
  type LienPayoffBill,
  type LienPayoffDoor,
  type LienPayoffFacts,
  type LienPayoffPlace,
  type LienPayoffRow,
  type LienPayoffValueKind,
} from '../../lib/jobs/lienPayoff'
import { readLienPayoffFacts } from '../../lib/jobs/lienPayoffIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { PAYOFF_CHECK_WORDS, checkBills, liensPayoffAmount } from '../../lib/jobs/lienPayoffCheck'
import LienPayoffCheck from './LienPayoffCheck'

/**
 * Payoffs on the Lien desk (punch list #435, piece 1; the rule is `lienPayoff.ts`, the reads `lienPayoffIo.ts`).
 *
 * One line over the desk's lists says what waits on a release, with one press, *Someone paid ›*. The press opens a
 * window of every filed lien under its place. Each lien says where it stands in one sentence and offers the one
 * press that comes next: record the payment, make the release, record the county's stamp. The window stays open
 * under the door it sends the office through, and reads again when the desk does, so the next step is there on the
 * way back.
 *
 * The window itself writes one thing, since piece 3: *One check for this place ›* on a place opens the check pane
 * (`LienPayoffCheck.tsx`), which records one check over the place's bills. Everything else is a door: the Bill tab
 * records a single payment and the Lien window's Release of record tab makes the paper.
 */

type Props = {
  todayYmd: string
  /** Changes whenever the desk reads again: a payment saved, a release saved. */
  refreshKey: unknown
  /** The job's Bill tab, where a payment is recorded. */
  onOpenBill: (jobId: string) => void
  /** The job's Lien window on its Release of record tab. */
  onOpenRelease: (jobId: string) => void
  isMobile?: boolean
  /** Told once the check pane recorded a payment, so the desk reads again. */
  onChanged?: () => void
  /** Tests hand the facts in and skip the read. */
  read?: (todayYmd: string) => Promise<LienPayoffFacts>
  /** Tests hand the check pane's write in. */
  record?: Parameters<typeof LienPayoffCheck>[0]['record']
  /** Open the window at once: the address's `?payoffs=1`. */
  initiallyOpen?: boolean
}

const VALUES: Partial<Record<LienPayoffValueKind, (text: string) => ReactNode>> = {
  money: (t) => (
    <WorkedOutValue>
      <MoneyText text={t} bare />
    </WorkedOutValue>
  ),
}

const strip: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem 0.75rem', padding: '0.4rem 0.75rem', margin: '0 0 0.4rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: '0.8125rem', lineHeight: 1.4 }
const stripAmber: CSSProperties = { ...strip, borderColor: 'var(--border-amber)', background: 'var(--bg-amber-tint)' }
const press: CSSProperties = { padding: '0.35rem 0.85rem', fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 600, borderRadius: 6, border: '1px solid transparent', background: '#2563eb', color: '#ffffff', cursor: 'pointer', whiteSpace: 'nowrap' }
const plainPress: CSSProperties = { ...press, background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)' }
const linkPress: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer' }
const head: CSSProperties = { margin: 0, fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const small: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }

const STEP_LOOK: Record<'done' | 'now' | 'later', CSSProperties> = {
  done: { background: 'var(--bg-green-tint, var(--bg-muted))', color: 'var(--text-green-700)', borderColor: 'var(--text-green-700)' },
  now: { background: '#2563eb', color: '#ffffff', borderColor: '#2563eb' },
  later: { background: 'var(--surface)', color: 'var(--text-muted)', borderColor: 'var(--border-strong)' },
}

/** The three steps as three small rounds: a tick behind the lien, its number on the step it stands on. */
function StepRounds({ row }: { row: LienPayoffRow }) {
  return (
    <span data-lien-payoff-steps style={{ display: 'inline-flex', gap: 4, flex: 'none' }}>
      {LIEN_PAYOFF_STEPS.map((s, i) => {
        const state = lienPayoffStepState(row.step.step, s.key)
        return (
          <span
            key={s.key}
            data-step={s.key}
            data-state={state}
            title={s.label}
            aria-label={`${s.label}: ${state === 'done' ? 'done' : state === 'now' ? 'next' : 'later'}`}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', borderWidth: 1, borderStyle: 'solid', fontSize: '0.6875rem', fontWeight: 700, lineHeight: 1, ...STEP_LOOK[state] }}
          >
            {state === 'done' ? '✓' : i + 1}
          </span>
        )
      })}
    </span>
  )
}

function LienRow({ row, isMobile, onDoor }: { row: LienPayoffRow; isMobile: boolean; onDoor: (door: LienPayoffDoor, jobId: string) => void }) {
  const done = row.step.step === 'done'
  return (
    <div data-lien-payoff-row={row.affidavitId} data-step={row.step.step} style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto', gap: '0.4rem 0.9rem', alignItems: 'center', padding: '0.55rem 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ minWidth: 0, display: 'grid', gap: 3 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.15rem 0.6rem', fontSize: '0.8125rem' }}>
          <b>{row.jobNumber}</b>
          {row.jobName ? <span>{row.jobName}</span> : null}
          <Money amount={row.lienAmount} style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
        </div>
        <div style={small}>
          Filed lien{row.county ? `, ${row.county} County` : ''}
          {row.instrument ? `, instrument ${row.instrument}` : ''}
          {row.filedYmd ? `, filed ${formatYmdMonthDay(row.filedYmd)}` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <StepRounds row={row} />
          <span data-lien-payoff-say style={{ minWidth: 0, color: done ? 'var(--text-green-700)' : undefined }}>
            <ValueSentence<LienPayoffValueKind> text={row.step.say} values={VALUES} />
          </span>
        </div>
        {row.step.warn ? (
          <div data-lien-payoff-warn={row.step.warnTone ?? ''} style={{ fontSize: '0.78rem', color: row.step.warnTone === 'red' ? 'var(--text-red-700)' : 'var(--text-amber-800)' }}>
            <ValueSentence<LienPayoffValueKind> text={row.step.warn} values={VALUES} />
          </div>
        ) : null}
      </div>
      {row.step.press ? (
        <button type="button" data-lien-payoff-press={row.step.press.door} onClick={() => onDoor(row.step.press!.door, row.jobId)} style={{ ...press, ...(isMobile ? { minHeight: 44 } : {}) }}>
          {row.step.press.label}
        </button>
      ) : done ? (
        <span data-lien-payoff-released style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-green-700)', whiteSpace: 'nowrap' }}>
          {LIEN_PAYOFF_WORDS.released}
        </span>
      ) : (
        // A check the bank has not cleared (#437, piece 1): no release press until it has.
        <span data-lien-payoff-waiting style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)', whiteSpace: 'nowrap' }}>
          {LIEN_PAYOFF_WORDS.waiting}
        </span>
      )}
    </div>
  )
}

function PlaceCard({ place, isMobile, onDoor, onCheck }: { place: LienPayoffPlace; isMobile: boolean; onDoor: (door: LienPayoffDoor, jobId: string) => void; onCheck?: () => void }) {
  const other = lienPayoffOtherLine(place.other)
  return (
    <section data-lien-payoff-place={place.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.85rem 0.15rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.1rem 0.6rem' }}>
        <b style={{ fontSize: '0.875rem' }}>{place.place}</b>
        {place.payer ? <span style={small}>{place.payer}</span> : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.3rem 0.9rem', margin: '0.15rem 0 0.45rem' }}>
        <p data-lien-payoff-headline style={{ margin: 0, flex: '1 1 14rem', minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.45 }}>
          <ValueSentence<LienPayoffValueKind> text={place.headline} values={VALUES} />
        </p>
        {/* One check that pays several bills here (piece 3): typed once, placed by the app. */}
        {onCheck ? (
          <button type="button" data-lien-payoff-check-open onClick={onCheck} style={{ ...plainPress, color: 'var(--text-link)', ...(isMobile ? { minHeight: 44 } : {}) }}>
            {PAYOFF_CHECK_WORDS.open}
          </button>
        ) : null}
      </div>
      {/* The bank's check for exactly what pays these liens off (#437, piece 1): at the bank, or cleared and ready. */}
      {place.bank ? (
        <p data-lien-payoff-bank={place.bank.answer.state} style={{ margin: '-0.2rem 0 0.45rem', fontSize: '0.78rem', fontWeight: place.bank.answer.cleared ? 600 : undefined, color: place.bank.tone === 'red' ? 'var(--text-red-700)' : place.bank.tone === 'green' ? 'var(--text-green-700)' : 'var(--text-amber-800)' }}>
          <ValueSentence<LienPayoffValueKind> text={place.bank.say} values={VALUES} />
        </p>
      ) : null}
      {other ? (
        <p data-lien-payoff-other style={{ margin: '-0.2rem 0 0.45rem', fontSize: '0.78rem', color: 'var(--text-amber-800)' }}>
          <ValueSentence<LienPayoffValueKind> text={other} values={VALUES} />
        </p>
      ) : null}
      {place.rows.map((row) => (
        <LienRow key={row.affidavitId} row={row} isMobile={isMobile} onDoor={onDoor} />
      ))}
    </section>
  )
}

function PayoffsWindow({ places, billsByJob, bankChecks, todayYmd, failure, loading, isMobile, onRetry, onClose, onDoor, onRecorded, record }: { places: LienPayoffPlace[]; billsByJob: Readonly<Record<string, ReadonlyArray<LienPayoffBill>>>; bankChecks?: ReadonlyArray<BankCheck>; todayYmd: string; failure: string | null; loading: boolean; isMobile: boolean; onRetry: () => void; onClose: () => void; onDoor: (door: LienPayoffDoor, jobId: string) => void; onRecorded: () => void; record?: Parameters<typeof LienPayoffCheck>[0]['record'] }) {
  useModalStackEntry()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const open = places.filter((p) => p.rows.some((r) => r.step.step !== 'done'))
  const released = places.filter((p) => p.rows.every((r) => r.step.step === 'done'))
  const [showReleased, setShowReleased] = useState(false)
  /** The place whose check pane is open, by key. The pane stands in for the list until it is closed. */
  const [checkKey, setCheckKey] = useState<string | null>(null)
  const checkPlace = places.find((p) => p.key === checkKey) ?? null
  /** A place offers the check pane while a job with a lien on record still has an open bill. */
  const checkDoor = (p: LienPayoffPlace) => (liensPayoffAmount(checkBills(p, billsByJob)) > 0 ? () => setCheckKey(p.key) : undefined)
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={LIEN_PAYOFF_WORDS.title}
      data-lien-payoffs-window
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', paddingTop: 'var(--app-top-chrome, 0px)', background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1005 }}
    >
      <div style={{ background: 'var(--bg-page, var(--surface))', borderRadius: 10, width: 'min(760px, calc(100vw - 1.5rem))', maxHeight: 'calc(100dvh - 3rem - var(--app-top-chrome, 0px) - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '0.75rem 1rem 0.65rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>{LIEN_PAYOFF_WORDS.title}</h2>
            <div style={{ marginTop: 2, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{LIEN_PAYOFF_WORDS.sub}</div>
          </div>
          <button type="button" data-lien-payoffs-close aria-label="Close" onClick={onClose} style={{ ...plainPress, padding: '0.2rem 0.6rem', ...(isMobile ? { minHeight: 44, minWidth: 44 } : {}) }}>
            ✕
          </button>
        </div>
        {checkPlace ? (
          <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem 1rem' }}>
            <LienPayoffCheck place={checkPlace} billsByJob={billsByJob} bankChecks={bankChecks} todayYmd={todayYmd} isMobile={isMobile} onBack={() => setCheckKey(null)} onRecorded={onRecorded} onOpenBill={(jobId) => onDoor('bill', jobId)} record={record} />
          </div>
        ) : (
        <div style={{ overflow: 'auto', minHeight: 0, padding: '0.75rem 1rem 1rem', display: 'grid', gap: '0.7rem', alignContent: 'start' }}>
          <section style={{ display: 'grid', gap: '0.25rem' }}>
            <h3 style={head}>What you do when someone pays</h3>
            <ol data-lien-payoff-legend style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8125rem', lineHeight: 1.5 }}>
              {LIEN_PAYOFF_STEPS.map((s) => (
                <li key={s.key}>{s.label}.</li>
              ))}
            </ol>
            <p style={{ ...small, margin: 0 }}>Find the place below. Each lien shows the one press that comes next.</p>
          </section>
          {failure ? (
            <div role="alert" data-lien-payoffs-failure style={{ border: '1px solid var(--text-red-700)', borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.8125rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.75rem', alignItems: 'center' }}>
              <span style={{ flex: '1 1 16rem', color: 'var(--text-red-700)' }}>{failure}</span>
              <button type="button" onClick={onRetry} style={plainPress}>
                Try again
              </button>
            </div>
          ) : null}
          {!failure && loading && places.length === 0 ? <p style={{ ...small, margin: 0 }}>Reading the filed liens…</p> : null}
          {!failure && !loading && places.length === 0 ? <EmptyState main={emptyWords({ kind: 'waiting', who: 'a release' }).main} compact /> : null}
          {open.map((p) => (
            <PlaceCard key={p.key} place={p} isMobile={isMobile} onDoor={onDoor} onCheck={checkDoor(p)} />
          ))}
          {released.length ? (
            <section style={{ display: 'grid', gap: '0.5rem' }}>
              <button type="button" data-lien-payoffs-released-fold aria-expanded={showReleased} onClick={() => setShowReleased((v) => !v)} style={{ ...linkPress, justifySelf: 'start', fontSize: '0.8125rem' }}>
                {showReleased ? '▾' : '▸'} {LIEN_PAYOFF_WORDS.released}, {released.reduce((n, p) => n + p.rows.length, 0)}
              </button>
              {showReleased ? released.map((p) => <PlaceCard key={p.key} place={p} isMobile={isMobile} onDoor={onDoor} />) : null}
            </section>
          ) : null}
        </div>
        )}
      </div>
    </div>
  )
}

export default function LienPayoffs({ todayYmd, refreshKey, onOpenBill, onOpenRelease, onChanged, isMobile = false, read = readLienPayoffFacts, record, initiallyOpen = false }: Props) {
  const [facts, setFacts] = useState<LienPayoffFacts | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(initiallyOpen)
  const [again, setAgain] = useState(0)
  const readRef = useRef(read)
  readRef.current = read

  useEffect(() => {
    let live = true
    setLoading(true)
    readRef
      .current(todayYmd)
      .then((f) => {
        if (!live) return
        setFacts(f)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (live) setFailure(formatErrorMessage(e, LIEN_PAYOFF_WORDS.readFailed))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [todayYmd, refreshKey, again])

  const places = useMemo(() => (facts ? lienPayoffPlaces(facts) : []), [facts])
  const words = useMemo(() => lienPayoffStrip(places), [places])
  const onDoor = useCallback((door: LienPayoffDoor, jobId: string) => (door === 'bill' ? onOpenBill(jobId) : onOpenRelease(jobId)), [onOpenBill, onOpenRelease])

  // The wrapper is always drawn: the page's grid gives this strip its own row, and the desk the row under it.
  return (
    <div data-lien-payoffs>
      {words.say || failure ? (
        <div data-lien-payoffs-strip data-tone={words.tone} style={words.tone === 'amber' ? stripAmber : strip}>
          <b>{LIEN_PAYOFF_WORDS.title}</b>
          <span style={{ flex: '1 1 12rem', minWidth: 0 }}>{words.say ? <ValueSentence<LienPayoffValueKind> text={words.say} values={VALUES} /> : <span style={{ color: 'var(--text-red-700)' }}>{failure}</span>}</span>
          <button type="button" data-lien-payoffs-open onClick={() => setOpen(true)} style={{ ...press, ...(isMobile ? { minHeight: 44 } : {}) }}>
            {LIEN_PAYOFF_WORDS.open}
          </button>
        </div>
      ) : null}
      {open ? (
        <PayoffsWindow
          places={places}
          billsByJob={facts?.billsByJob ?? {}}
          bankChecks={facts?.bank}
          todayYmd={todayYmd}
          failure={failure}
          loading={loading}
          isMobile={isMobile}
          onRetry={() => setAgain((n) => n + 1)}
          onClose={() => setOpen(false)}
          onDoor={onDoor}
          onRecorded={() => {
            setAgain((n) => n + 1)
            onChanged?.()
          }}
          record={record}
        />
      ) : null}
    </div>
  )
}
