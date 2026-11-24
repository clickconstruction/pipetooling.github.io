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
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { FilledBuilder } from '../documentBuilder/FilledBuilder'
import { BuilderGcSendCard } from '../documentBuilder/BuilderGcSendCard'
import { WalkedBuilder as WalkedEditor } from '../documentBuilder/WalkedBuilder'
import { BuilderSideProvider } from '../documentBuilder/builderSideContext'
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
import { BUILDER_SIDE_PARAM, builderSideFromSearch, withBuilderSide, type BuilderSide } from '../../lib/documentBuilder/builderSide'
import { parsePaperDef } from '../../lib/documentBuilder/definition'
import { loadFirstDraft, readDocumentBuilders } from '../../lib/documentBuilder/documentBuildersIo'
import { firstDraftOf } from '../../lib/documentBuilder/firstDrafts'
import { filledRowChips, type SheetCounts } from '../../lib/documentBuilder/sheetScreen'
import { readSheetCounts } from '../../lib/documentBuilder/sheetsIo'
import { builderRowPress, builderStandingChips, builderUnreadWords, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { GC_COMPANY } from '../../lib/gc/company'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { formatErrorMessage } from '../../utils/errorHandling'

type Props = {
  /** Every builder the reader can read, by its name. For a smoke. */
  read?: typeof readDocumentBuilders
  /** Writes a builder's first draft. For a smoke. */
  load?: typeof loadFirstDraft
  /** How many of a filled builder's jobs have a published sheet, for its row. For a smoke. */
  readCounts?: typeof readSheetCounts
}

/** A filled builder's count on its row: the numbers once read, or why they were not. Absent while the read is out. */
type RowCounts = { counts: SheetCounts } | { why: string }

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
 * A walked builder, open, over the draft the database holds: the editor, where a dev types on what a GC would walk
 * (`WalkedBuilder`, step 7). Only the draft's shape is checked here (`parsePaperDef`): the editor saves every key
 * with no check, so a draft that breaks a rule of the paper must still open, or the save would shut its own editor.
 * A broken rule is the Publish press's to list (`walkedPublishPress`). A draft that is not shaped like a paper is
 * never half drawn: the page lists what is wrong with it instead.
 */
function WalkedBuilder({ entry, rec, onBack, onRecord, side, onSide }: { entry: DocumentBuilderEntry; rec: BuilderRecord; onBack: () => void; onRecord: (rec: BuilderRecord) => void; side: BuilderSide; onSide: (side: BuilderSide) => void }) {
  const parsed = parsePaperDef(rec.draft)
  if (parsed.ok) {
    return (
      <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
        {/* Step 9: on the Share side, under the link, the send of the published builder to GCs. The side is the address's. */}
        <BuilderSideProvider side={side} onSide={onSide}>
          <WalkedEditor entry={entry} rec={rec} def={parsed.def} onBack={onBack} onRecord={onRecord} share={<BuilderGcSendCard builderKey={entry.id} revision={rec.revision} unread={builderUnreadWords(rec)} />} />
        </BuilderSideProvider>
        <p style={FINE}>
          {`${parsed.def.title} on job ${parsed.def.job}, for ${parsed.def.protectedParty}. Nobody is asked to sign. The disclaimer, the breach lines, the site lines and the meanings are placeholders until an attorney has read them. No clause wording is on this page.`}
        </p>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <BuilderBar entry={entry} rec={rec} onBack={onBack} />
      <div style={CARD}>
        <h2 style={CARD_TITLE}>{`${entry.name} cannot be shown`}</h2>
        <p style={MUTED}>The contents the database holds for this builder do not read as a paper. Nothing was changed.</p>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-base)' }}>
          {parsed.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </div>
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

/**
 * The tab, inside the one element `index.css` knows it by: `.documentBuilderTab` makes every press in it 44 px tall
 * on a phone. The element draws nothing of its own.
 */
export default function DocumentsBuilderTab(props: Props) {
  return (
    <div className="documentBuilderTab" style={{ display: 'contents' }}>
      <BuilderTab {...props} />
    </div>
  )
}

function BuilderTab({ read = readDocumentBuilders, load = loadFirstDraft, readCounts = readSheetCounts }: Props) {
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

  // The list's count for each filled builder that has a row: read each time the list is shown, so a sheet published
  // inside a builder is counted on the way back. A count that does not read leaves the row as it is, with the reason.
  const [counts, setCounts] = useState<Record<string, RowCounts>>({})
  const listShown = open == null && records != null
  useEffect(() => {
    if (!listShown || !records) return
    let cancelled = false
    for (const b of DOCUMENT_BUILDERS) {
      if (b.kind !== 'filled' || !records.get(b.id)) continue
      void readCounts(b.id)
        .then((got) => {
          if (!cancelled) setCounts((was) => ({ ...was, [b.id]: { counts: got } }))
        })
        .catch((e: unknown) => {
          if (!cancelled) setCounts((was) => ({ ...was, [b.id]: { why: formatErrorMessage(e, 'The read failed.') } }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [listShown, records, readCounts])

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
    // The side belongs to the builder that was open: the list and a newly opened builder start without one.
    next.delete(BUILDER_SIDE_PARAM)
    setSearchParams(next)
  }
  /** Edit or Share on an open walked builder, each its own step in the browser's history. */
  const setSide = (side: BuilderSide) => setSearchParams(withBuilderSide(searchParams, side))

  if (failure) return <OfflineRetryPanel failure={failure} onRetry={() => setTries((n) => n + 1)} surface="documents-builder" idempotent busy={reading} />
  if (!records) return <p style={MUTED}>{`${WORDS.reading}…`}</p>

  if (open) {
    const rec = records.get(open.id) ?? null
    if (rec && open.kind === 'filled') return <FilledBuilder entry={open} rec={rec} onBack={() => setOpen(null)} onRecord={(next) => setRecords((was) => new Map(was ?? []).set(open.id, next))} />
    if (rec) return <WalkedBuilder entry={open} rec={rec} onBack={() => setOpen(null)} onRecord={(next) => setRecords((was) => new Map(was ?? []).set(open.id, next))} side={builderSideFromSearch(location.search)} onSide={setSide} />
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
          const count = counts[b.id]
          return (
            <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '6px 12px', alignItems: 'center', padding: i === 0 ? '0 0 10px' : '10px 0', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-strong)' }}>{b.name}</div>
                <div style={MUTED}>{b.says}</div>
                <Chips chips={b.kind === 'filled' ? filledRowChips(b, rec, count && 'counts' in count ? count.counts : null) : builderStandingChips(b, rec)} />
                {b.kind === 'filled' && rec && count && 'why' in count ? <p role="status" style={FINE}>{`Its jobs were not counted. ${count.why}`}</p> : null}
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
