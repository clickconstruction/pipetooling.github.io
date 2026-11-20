/**
 * The Documents page's **Document builder** tab (punch list #404, the owner's ask of 2026-11-19), for a dev only. It
 * lists the builders, one row each, with chips that say where each stands and its press. A builder makes one kind of
 * paper. There is no New builder press: a new kind is added in `lib/documentBuilder/builders.ts`.
 *
 * A builder's contents live in the database (`document_builders`, step 2). A builder with none yet offers **Load the
 * first draft**, which writes placeholder words for a dev to change. After that the press is **Open**, and the open
 * builder takes the tab's whole body, with the address keeping which one (`?tab=builder&builder=sub-nda`), so a reload
 * and the browser's Back both land where the person was.
 *
 * There are two kinds. The Sub NDA is walked: its step-by-step flow (`DocumentBuilderFlow`) over the draft the
 * database holds, whose review press requires nothing of anyone. Insurance requirements for subs is filled: one
 * sheet with blanks for each job (`FilledBuilder`).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { DocumentBuilderFlow } from '../documentBuilder/DocumentBuilderFlow'
import { FilledBuilder } from '../documentBuilder/FilledBuilder'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import {
  BUILDER_PARAM,
  DOCUMENT_BUILDERS,
  DOCUMENT_BUILDER_WORDS as WORDS,
  openBuilderFromSearch,
  type BuilderChip,
  type BuilderChipTone,
  type DocumentBuilderEntry,
} from '../../lib/documentBuilder/builders'
import { readPaperDef } from '../../lib/documentBuilder/definition'
import type { PaperDef } from '../../lib/documentBuilder/documentBuilder'
import { loadFirstDraft, readDocumentBuilders } from '../../lib/documentBuilder/documentBuildersIo'
import { firstDraftOf } from '../../lib/documentBuilder/firstDrafts'
import { FRAME_SCROLL_MARGIN_CSS, frameHeightCss, framePlace, frameScrollsIntoView, type FramePlace } from '../../lib/documentBuilder/frame'
import { filledRowChips } from '../../lib/documentBuilder/sheetScreen'
import { builderRowPress, builderStandingChips, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { GC_COMPANY } from '../../lib/gc/company'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'

type Props = {
  /** Every builder the reader can read, by its name. For a smoke. */
  read?: typeof readDocumentBuilders
  /** Writes a builder's first draft. For a smoke. */
  load?: typeof loadFirstDraft
}

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.25 }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const REFUSAL: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-red-700)' }
const CHIPS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '4px 6px', alignItems: 'center' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }
const CHIP_TONES: Record<BuilderChipTone, CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  wait: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
const DEV_CHIP: CSSProperties = { ...CHIP, background: 'var(--bg-violet-tint)', color: 'var(--text-violet-700)' }
const BACK_PRESS: CSSProperties = {
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  borderRadius: 8,
  padding: '3px 10px',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  minHeight: 32,
  cursor: 'pointer',
}

function mainPress(dead: boolean): CSSProperties {
  return {
    border: 0,
    background: dead ? DEAD_PRESS_FILL : '#2563eb',
    color: dead ? DEAD_PRESS_TEXT : 'white',
    borderRadius: 9,
    padding: '9px 14px',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 700,
    minHeight: 40,
    cursor: dead ? 'not-allowed' : 'pointer',
  }
}

function Chips({ chips }: { chips: BuilderChip[] }) {
  if (chips.length === 0) return null
  return (
    <span style={CHIPS}>
      {chips.map((c) => (
        <span key={c.words} style={{ ...CHIP, ...CHIP_TONES[c.tone] }}>
          {c.words}
        </span>
      ))}
    </span>
  )
}

/**
 * The flow in a frame that fits on the screen whole, so the slider and the Next press stay in reach while the page
 * above them scrolls. Where the frame starts is measured, since the bars above it differ by screen and by role, and
 * `lib/documentBuilder/frame.ts` decides from that how the frame is sized: to the bottom of the screen on a computer,
 * and to the screen from the builder's own top on a phone, where the builder then scrolls itself to the top once.
 */
function FlowOnScreen({ def, anchor }: { def: PaperDef; anchor: RefObject<HTMLElement | null> }) {
  const holder = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<FramePlace | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      if (!holder.current || !anchor.current) return
      const frameTop = holder.current.getBoundingClientRect().top
      const next = framePlace({
        top: Math.round(frameTop + window.scrollY),
        inset: Math.round(frameTop - anchor.current.getBoundingClientRect().top),
        screen: window.innerHeight,
      })
      setPlace((was) => (was && was.from === next.from && was.offset === next.offset ? was : next))
    }
    measure()
    window.addEventListener('resize', measure)
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    watch?.observe(document.body)
    return () => {
      window.removeEventListener('resize', measure)
      watch?.disconnect()
    }
  }, [anchor])

  // Once, as the builder opens: on a screen with too little room under the tab row, bring the builder to the top.
  const scrolled = useRef(false)
  const scrolls = frameScrollsIntoView(place)
  useEffect(() => {
    if (!scrolls || scrolled.current) return
    scrolled.current = true
    if (typeof anchor.current?.scrollIntoView === 'function') anchor.current.scrollIntoView({ block: 'start' })
  }, [scrolls, anchor])

  return (
    <div ref={holder} style={{ minWidth: 0 }}>
      <DocumentBuilderFlow def={def} style={{ height: frameHeightCss(place) }} />
    </div>
  )
}

/** The press that loads a builder's first draft, with the reason under it when the database refuses. */
function LoadFirstDraft({ entry, busy, refusal, onLoad }: { entry: DocumentBuilderEntry; busy: boolean; refusal: string | null; onLoad: () => void }) {
  const none = firstDraftOf(entry) == null
  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
      <button type="button" aria-label={`${WORDS.load} of ${entry.name}`} disabled={busy || none} style={mainPress(busy || none)} onClick={onLoad}>
        {busy ? WORDS.loading : WORDS.load}
      </button>
      {refusal ? (
        <p role="alert" style={REFUSAL}>
          {refusal}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A walked builder, open: the bar with the way back, then what a GC would walk, over the draft the database holds. A
 * draft that does not read as a paper is never half drawn: the page lists what is wrong with it instead.
 */
function WalkedBuilder({ entry, rec, onBack }: { entry: DocumentBuilderEntry; rec: BuilderRecord; onBack: () => void }) {
  const anchor = useRef<HTMLDivElement>(null)
  const parsed = readPaperDef(rec.draft)
  return (
    <div ref={anchor} style={{ display: 'grid', gap: 10, minWidth: 0, scrollMarginTop: FRAME_SCROLL_MARGIN_CSS }}>
      <BuilderBar entry={entry} rec={rec} onBack={onBack} />
      {parsed.ok ? (
        <div style={{ maxWidth: 492, margin: '0 auto', width: '100%', minWidth: 0, display: 'grid', gap: 8 }}>
          <FlowOnScreen def={parsed.def} anchor={anchor} />
          <p style={FINE}>
            {`${parsed.def.title} on job ${parsed.def.job}, for ${parsed.def.protectedParty}. Nobody is asked to sign. The disclaimer, the breach lines, the site lines and the meanings are placeholders until an attorney has read them. No clause wording is on this page.`}
          </p>
        </div>
      ) : (
        <div style={CARD}>
          <h2 style={CARD_TITLE}>{`${entry.name} cannot be shown`}</h2>
          <p style={MUTED}>The contents the database holds for this builder do not read as a paper. Nothing was changed.</p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-base)' }}>
            {parsed.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BuilderBar({ entry, rec, onBack }: { entry: DocumentBuilderEntry; rec: BuilderRecord | null; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
      <button type="button" style={BACK_PRESS} onClick={onBack}>
        {`‹ ${WORDS.back}`}
      </button>
      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>{entry.name}</span>
      <Chips chips={entry.kind === 'filled' ? filledRowChips(entry, rec, null) : builderStandingChips(entry, rec)} />
    </div>
  )
}

export default function DocumentsBuilderTab({ read = readDocumentBuilders, load = loadFirstDraft }: Props) {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const open = openBuilderFromSearch(location.search)

  const [records, setRecords] = useState<Map<string, BuilderRecord> | null>(null)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [tries, setTries] = useState(0)
  /** The builder whose first draft is being loaded, and the reason the last load was refused. */
  const [loading, setLoading] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<{ key: string; words: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void read()
      .then((got) => {
        if (cancelled) return
        setRecords(got)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setFailure(recoveryFailureFromError(e, 'The builders did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [read, tries])

  // A load that lands after the tab is taken down sets nothing: there is no screen left to draw on.
  const here = useRef(true)
  useEffect(() => {
    here.current = true
    return () => {
      here.current = false
    }
  }, [])

  const loadDraft = useCallback(
    async (entry: DocumentBuilderEntry) => {
      // The sheet goes out under the company's own name, so its first draft starts on it.
      const draft = firstDraftOf(entry, GC_COMPANY)
      if (draft == null || loading != null) return
      setLoading(entry.id)
      setRefusal(null)
      const res = await load(entry.id, entry.kind, draft)
      if (!here.current) return
      setLoading(null)
      if (!res.ok) {
        setRefusal({ key: entry.id, words: res.error })
        return
      }
      setRecords((was) => new Map(was ?? []).set(entry.id, res.value))
    },
    [load, loading],
  )

  /** Open a builder, or go back to the list with null. Each is its own step in the browser's history. */
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(searchParams)
    if (id == null) next.delete(BUILDER_PARAM)
    else next.set(BUILDER_PARAM, id)
    setSearchParams(next)
  }

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={() => setTries((n) => n + 1)} surface="documents-builder" idempotent busy={reading} />
  if (!records) return <p style={MUTED}>{`${WORDS.reading}…`}</p>

  if (open) {
    const rec = records.get(open.id) ?? null
    if (rec && open.kind === 'filled') return <FilledBuilder entry={open} rec={rec} onBack={() => setOpen(null)} onRecord={(next) => setRecords((was) => new Map(was ?? []).set(open.id, next))} />
    if (rec) return <WalkedBuilder entry={open} rec={rec} onBack={() => setOpen(null)} />
    return (
      <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <BuilderBar entry={open} rec={null} onBack={() => setOpen(null)} />
        <div style={CARD}>
          <p style={MUTED}>{WORDS.notLoaded}</p>
          <LoadFirstDraft entry={open} busy={loading === open.id} refusal={refusal?.key === open.id ? refusal.words : null} onLoad={() => void loadDraft(open)} />
        </div>
      </div>
    )
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', alignItems: 'center' }}>
        <h2 style={CARD_TITLE}>{WORDS.title}</h2>
        <span style={DEV_CHIP}>{WORDS.devOnly}</span>
      </div>
      <p style={MUTED}>{WORDS.lead}</p>
      <div>
        {DOCUMENT_BUILDERS.map((b, i) => {
          const rec = records.get(b.id) ?? null
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', alignItems: 'center', padding: i === 0 ? '0 0 10px' : '10px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-strong)' }}>{b.name}</div>
                <div style={MUTED}>{b.says}</div>
                <Chips chips={b.kind === 'filled' ? filledRowChips(b, rec, null) : builderStandingChips(b, rec)} />
              </div>
              {builderRowPress(rec) === 'open' ? (
                <button type="button" aria-label={`${WORDS.open} ${b.name}`} style={mainPress(false)} onClick={() => setOpen(b.id)}>
                  {WORDS.open}
                </button>
              ) : (
                <LoadFirstDraft entry={b} busy={loading === b.id} refusal={refusal?.key === b.id ? refusal.words : null} onLoad={() => void loadDraft(b)} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
