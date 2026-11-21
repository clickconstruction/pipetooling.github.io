/**
 * A filled builder, open (punch list #404, step 3): one page with blanks that each job fills. The first is insurance
 * requirements for subs. The sheet is the editor: every piece of words on it is a field, and its mark says where the
 * words come from. **This job** and **The standing sheet** are the same sheet: the second changes the usual for every
 * job. The left side lists what differs on a job with the way back, or where a change to the usual goes.
 *
 * What is typed is saved as a draft a moment after the typing rests. Nothing reaches anyone outside until a publish.
 * A job's sheet goes out laid over the usual's published copy, never over a draft of it. The usual's publish is a
 * batch: it goes to every job that is ready, names each it held with the reason, and keeps going past one that
 * fails.
 *
 * Every rule is `lib/documentBuilder/sheet.ts` and `sheetScreen.ts`; the reads and writes are `sheetsIo.ts`. No amount
 * is offered anywhere: a person types every one.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import OfflineRetryPanel from '../OfflineRetryPanel'
import { batchOutcomeWords } from '../../lib/batchWords'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { DOCUMENT_BUILDER_WORDS as WORDS, type BuilderChip, type BuilderChipTone, type DocumentBuilderEntry } from '../../lib/documentBuilder/builders'
import type { Landed } from '../../lib/documentBuilder/documentBuildersIo'
import {
  differsLine,
  layOver,
  parseResolvedSheet,
  parseSheetDef,
  pruneJobSheet,
  sheetDiffers,
  startJobSheet,
  usualFromJobExtra,
  usualFromJobField,
  usualHasCover,
  usualOffer,
  withJobCoverOff,
  withoutJobExtra,
  withoutJobWords,
  type JobSheet,
  type ResolvedSheet,
  type SheetDef,
} from '../../lib/documentBuilder/sheet'
import { SHEET_SENT_KIND, sheetPrintHtml, sheetPrintTitle } from '../../lib/documentBuilder/sheetPrint'
import {
  jobPublishPress,
  readPress,
  sheetBarChips,
  sheetCaption,
  sheetNote,
  sheetStamp,
  usualPlanChip,
  usualPlanFor,
  usualPublishPress,
  type JobSheetState,
} from '../../lib/documentBuilder/sheetScreen'
import * as defaultIo from '../../lib/documentBuilder/sheetsIo'
import type { GcJob, SheetRecord } from '../../lib/documentBuilder/sheetsIo'
import { isBuilderRead, sameContents, type BuilderRecord } from '../../lib/documentBuilder/standing'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../../lib/offlineRecoveryState'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { BUILDER_LINK_CARD_IO, BuilderLinkCard, type BuilderLinkCardIo } from './BuilderLinkCard'
import { SheetPaperEdit, SheetPaperRead } from './SheetPaper'
import { SHEET_SEND_IO, SheetSendCard, type SheetSendIo } from './SheetSendCard'

/** The reads and writes the builder makes. A smoke hands its own in. */
export type FilledBuilderIo = Pick<typeof defaultIo, 'readGcJobs' | 'readBuilderSheets' | 'saveBuilderDraft' | 'publishBuilder' | 'markBuilderRead' | 'startSheet' | 'saveSheetDraft' | 'publishSheet'> & {
  /** Prints a page and files the copy. False when the print window was blocked. */
  print: typeof printAndFile
  /** The link card's own reads and presses. */
  link: BuilderLinkCardIo
  /** The send list's own reads and presses. */
  sends: SheetSendIo
}

const IO: FilledBuilderIo = { ...defaultIo, print: printAndFile, link: BUILDER_LINK_CARD_IO, sends: SHEET_SEND_IO }

type Props = {
  entry: DocumentBuilderEntry
  rec: BuilderRecord
  onBack: () => void
  /** The builder's row changed: a draft saved, a publish, a read mark. */
  onRecord: (rec: BuilderRecord) => void
  io?: FilledBuilderIo
}

/** How long the typing rests before a draft is saved. */
const SAVE_AFTER_MS = 700

/** Where the drafts stand on the bar. `failed` holds from a save that did not land until a later one does. */
type SaveState = 'saved' | 'saving' | 'failed'
const SAVE_WORDS: Record<SaveState, string> = { saved: 'Draft saved', saving: 'Saving the draft…', failed: 'Draft not saved' }
/** One draft's save. It answers whether the draft landed. */
type Save = () => Promise<boolean>

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', display: 'grid', gap: 10, minWidth: 0 }
const CARD_TITLE: CSSProperties = { margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }
const MUTED: CSSProperties = { margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }
const FINE: CSSProperties = { margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }
const REFUSAL: CSSProperties = { margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-red-700)' }
const CAP: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const CHIP: CSSProperties = { display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '1px 8px', fontSize: '0.72rem', fontWeight: 600 }
const CHIP_TONES: Record<BuilderChipTone, CSSProperties> = {
  ok: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  wait: { background: 'var(--bg-muted)', color: 'var(--text-700)' },
  warn: { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' },
}
const SMALL_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', borderRadius: 8, padding: '3px 10px', fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 600, minHeight: 32, cursor: 'pointer' }
const SECOND_PRESS: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 9, padding: '7px 12px', fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 38, cursor: 'pointer' }
const INPUT: CSSProperties = { width: '100%', color: 'var(--text-base)', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '7px 9px', fontFamily: 'inherit', fontSize: '1rem', minWidth: 0 }
const LABEL: CSSProperties = { display: 'grid', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-700)' }
const LEGEND: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px 8px', fontSize: '0.75rem', justifySelf: 'start', background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 7px' }
const ROW: CSSProperties = { display: 'grid', gap: 6, padding: '8px 0', borderTop: '1px solid var(--border)' }
const BTNS: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }

function mainPress(dead: boolean): CSSProperties {
  return { border: 0, background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : 'white', borderRadius: 9, padding: '9px 14px', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 700, minHeight: 40, cursor: dead ? 'not-allowed' : 'pointer' }
}

function Chip({ chip }: { chip: BuilderChip }) {
  return <span style={{ ...CHIP, ...CHIP_TONES[chip.tone], whiteSpace: 'normal' }}>{chip.words}</span>
}

/**
 * The marks' legend: the same three looks the fields wear, on a light ground of its own as the sheet has. The marks are
 * pinned light, and *Your usual* has no fill, so on the card's dark surface its dark words could not be read.
 */
function Legend({ marks }: { marks: Array<['usual' | 'own' | 'blank', string]> }) {
  return (
    <div data-theme="light" style={LEGEND}>
      {marks.map(([mark, words]) => (
        <span key={mark} className="documentBuilderField" data-mark={mark} style={{ cursor: 'default', padding: '1px 7px' }}>
          {words}
        </span>
      ))}
    </div>
  )
}

/** A job's sheet on the screen: where it stands, and the page subs see, as it was published. */
type LocalSheet = JobSheetState & { page: ResolvedSheet | null }

function stateFrom(rec: SheetRecord): LocalSheet {
  return { id: rec.id, own: rec.draft, published: rec.published, revision: rec.revision, usualRevision: rec.usualRevision, page: parseResolvedSheet(rec.publishedSheet) }
}

export function FilledBuilder({ entry, rec, onBack, onRecord, io = IO }: Props) {
  const draftParsed = useMemo(() => parseSheetDef(rec.draft), [rec.draft])
  const publishedDef = useMemo(() => {
    const parsed = parseSheetDef(rec.published)
    return parsed.ok ? parsed.def : null
  }, [rec.published])

  const [usual, setUsualState] = useState<SheetDef | null>(draftParsed.ok ? draftParsed.def : null)
  const [jobs, setJobs] = useState<GcJob[] | null>(null)
  const [sheets, setSheetsState] = useState<Map<string, LocalSheet>>(new Map())
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [reading, setReading] = useState(true)
  const [tries, setTries] = useState(0)
  const [mode, setMode] = useState<'job' | 'usual'>('job')
  const [jobId, setJobId] = useState<string | null>(null)
  const [marks, setMarks] = useState(true)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [readOpen, setReadOpen] = useState(false)
  const [readName, setReadName] = useState('')
  const [outcome, setOutcome] = useState<{ line: string; tone: 'success' | 'warning' | 'error'; head: string | null; failed: Array<{ name: string; why: string }> } | null>(null)

  // The newest values, for a save that runs a moment after the typing that asked for it.
  const usualRef = useRef(usual)
  const sheetsRef = useRef(sheets)
  const recRef = useRef(rec)
  recRef.current = rec
  const setUsual = (next: SheetDef) => {
    usualRef.current = next
    setUsualState(next)
  }
  const setSheets = (next: Map<string, LocalSheet>) => {
    sheetsRef.current = next
    setSheetsState(next)
  }

  useEffect(() => {
    let cancelled = false
    setReading(true)
    void Promise.all([io.readGcJobs(), io.readBuilderSheets(entry.id)])
      .then(([gotJobs, gotSheets]) => {
        if (cancelled) return
        setJobs(gotJobs)
        const next = new Map<string, LocalSheet>()
        for (const [projectId, s] of gotSheets) next.set(projectId, stateFrom(s))
        sheetsRef.current = next
        setSheetsState(next)
        setJobId((was) => was ?? gotJobs[0]?.projectId ?? null)
        setFailure(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setFailure(recoveryFailureFromError(e, 'The jobs and their sheets did not read.'))
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [io, entry.id, tries])

  // ---- Saving: a draft is saved a moment after the typing rests, one save after another for each thing saved.
  const here = useRef(true)
  const pending = useRef(new Map<string, { timer: number; run: Save }>())
  const chains = useRef(new Map<string, Promise<void>>())
  /** The drafts whose last save did not land, with no save asked for since. Leaving the builder sends each again. */
  const unsaved = useRef(new Map<string, Save>())
  const enqueue = useCallback((key: string, run: Save) => {
    unsaved.current.delete(key)
    const next = (chains.current.get(key) ?? Promise.resolve()).then(async () => {
      if (await run()) unsaved.current.delete(key)
      else unsaved.current.set(key, run)
      if (here.current) setSaveState(unsaved.current.size > 0 ? 'failed' : pending.current.size === 0 ? 'saved' : 'saving')
    })
    chains.current.set(key, next)
    return next
  }, [])
  const flush = useCallback(async () => {
    for (const [key, p] of [...pending.current]) {
      window.clearTimeout(p.timer)
      pending.current.delete(key)
      void enqueue(key, p.run)
    }
    for (const [key, run] of [...unsaved.current]) void enqueue(key, run)
    await Promise.all([...chains.current.values()])
  }, [enqueue])
  const queue = useCallback(
    (key: string, run: Save) => {
      const was = pending.current.get(key)
      if (was) window.clearTimeout(was.timer)
      setSaveState((state) => (state === 'failed' ? state : 'saving'))
      const timer = window.setTimeout(() => {
        pending.current.delete(key)
        void enqueue(key, run)
      }, SAVE_AFTER_MS)
      pending.current.set(key, { timer, run })
    },
    [enqueue],
  )
  useEffect(() => {
    here.current = true
    return () => {
      here.current = false
      // Leaving the builder saves what was typed last.
      void flush()
    }
  }, [flush])

  /** Says why a save did not land, and answers whether it did. The bar's words are set where the save was queued. */
  const said = (res: Landed<unknown>) => {
    if (!res.ok && here.current) setRefusal(res.error)
    return res.ok
  }

  const saveUsual = async () => {
    const def = usualRef.current
    if (!def) return true
    const res = await io.saveBuilderDraft(entry.id, def)
    // The saved row goes up to the tab even after the builder is left: the tab opens the builder from it next time.
    if (res.ok) onRecord(res.value)
    return said(res)
  }
  /** A job's own part saved. A job with no row yet gets its row here. */
  const saveJob = async (projectId: string) => {
    const s = sheetsRef.current.get(projectId)
    if (!s) return true
    const res = s.id ? await io.saveSheetDraft(s.id, s.own) : await io.startSheet(entry.id, projectId, s.own)
    if (res.ok && !s.id) {
      const now = sheetsRef.current.get(projectId)
      if (now) setSheets(new Map(sheetsRef.current).set(projectId, { ...now, id: res.value.id }))
    }
    return said(res)
  }

  const changeUsual = (next: SheetDef) => {
    setRefusal(null)
    setOutcome(null)
    setUsual(next)
    queue('usual', saveUsual)
  }

  // ---- The job on the screen.
  const job = jobs?.find((j) => j.projectId === jobId) ?? null
  /** What a job's sheet is laid over: the usual as published, or its draft while nothing is published yet. */
  const under = publishedDef ?? usual
  const jobState: LocalSheet | null = useMemo(() => {
    if (!job) return null
    return sheets.get(job.projectId) ?? { id: null, own: startJobSheet({ name: job.name, place: job.place, insured: job.ownerName ? [job.ownerName] : [] }), published: null, revision: 0, usualRevision: null, page: null }
  }, [job, sheets])

  const changeJob = (next: JobSheet) => {
    if (!job || !jobState) return
    setRefusal(null)
    setSheets(new Map(sheetsRef.current).set(job.projectId, { ...jobState, own: next }))
    queue(job.projectId, () => saveJob(job.projectId))
  }

  if (!usual || !draftParsed.ok) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <Bar entry={entry} onBack={onBack} />
        <div style={CARD}>
          <h2 style={{ ...CARD_TITLE, fontSize: '1.05rem' }}>{`${entry.name} cannot be shown`}</h2>
          <p style={MUTED}>The contents the database holds for this builder do not read as a sheet. Nothing was changed.</p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: 4, fontSize: '0.8rem' }}>{(draftParsed.ok ? [] : draftParsed.problems).map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </div>
    )
  }
  if (failure) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <Bar entry={entry} onBack={onBack} />
        <OfflineRetryPanel failure={failure} onRetry={() => setTries((n) => n + 1)} surface="documents-builder-sheets" idempotent busy={reading} />
      </div>
    )
  }
  if (!jobs || !under) {
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <Bar entry={entry} onBack={onBack} />
        <p style={MUTED}>Reading the jobs and their sheets…</p>
      </div>
    )
  }

  const usualDirty = rec.revision === 0 || !sameContents(usual, rec.published)
  const plan = usualPlanFor(jobs, sheets)
  const press = mode === 'usual' ? usualPublishPress(usual, rec, plan) : jobState ? jobPublishPress(jobState, { def: under, revision: rec.revision }) : { label: 'Nothing to publish', dead: true, why: [] }
  const read = readPress(entry, rec)
  const differs = jobState ? sheetDiffers(under, jobState.own) : []

  const publishJob = async () => {
    if (!job || !jobState || busy) return
    setBusy(true)
    setRefusal(null)
    await flush()
    let s = sheetsRef.current.get(job.projectId) ?? jobState
    if (!s.id) {
      const made = await io.startSheet(entry.id, job.projectId, s.own)
      if (!made.ok) {
        setBusy(false)
        setRefusal(made.error)
        return
      }
      s = { ...s, id: made.value.id }
    }
    const own = pruneJobSheet(under, s.own)
    const res = await io.publishSheet(s.id as string, s.revision, own, layOver(under, own), recRef.current.revision)
    setBusy(false)
    if (!res.ok) {
      setSheets(new Map(sheetsRef.current).set(job.projectId, s))
      setRefusal(res.error)
      return
    }
    setSheets(new Map(sheetsRef.current).set(job.projectId, stateFrom(res.value)))
  }

  const publishUsual = async () => {
    if (busy) return
    setBusy(true)
    setRefusal(null)
    setOutcome(null)
    await flush()
    const def = usualRef.current ?? usual
    const going = usualPlanFor(jobs, sheetsRef.current)
    const res = await io.publishBuilder(entry.id, recRef.current.revision, def)
    if (!res.ok) {
      setBusy(false)
      setRefusal(res.error)
      return
    }
    onRecord(res.value)
    // The usual goes to every job that is ready. One that fails is named, and the rest still go.
    const failed: Array<{ name: string; why: string }> = []
    let done = 0
    let next = new Map(sheetsRef.current)
    for (const row of going) {
      const s = next.get(row.id)
      if (!row.gets || !s?.id || !s.published) continue
      const own = pruneJobSheet(def, s.published)
      const out = await io.publishSheet(s.id, s.revision, own, layOver(def, own), res.value.revision)
      if (out.ok) {
        done += 1
        next = new Map(next).set(row.id, stateFrom(out.value))
      } else failed.push({ name: row.name, why: out.error })
    }
    if (!here.current) return
    setSheets(next)
    setBusy(false)
    const words = batchOutcomeWords({ verb: 'publish', past: 'published to', done, failed: failed.length, noun: 'job' })
    const held = going.filter((r) => !r.gets).length
    setOutcome({ line: done + failed.length === 0 ? 'Published your usual.' : `${words.line}${held > 0 ? ` Held ${held}.` : ''}`, tone: done + failed.length === 0 ? 'success' : words.tone, head: words.head, failed })
  }

  const markRead = async () => {
    if (busy || !readName.trim()) return
    setBusy(true)
    setRefusal(null)
    const res = await io.markBuilderRead(entry.id, rec.revision, readName, todayYmdInAppTz())
    setBusy(false)
    if (!res.ok) {
      setRefusal(res.error)
      return
    }
    onRecord(res.value)
    setReadOpen(false)
    setReadName('')
  }

  /** The page subs see now: the one that was published, never the draft on the screen. */
  const pageNow = jobState && jobState.revision > 0 ? jobState.page : null
  const printSheet = () => {
    if (!job || !jobState || !pageNow) return
    const stamp = `Revision ${jobState.revision} · ${job.name}`
    const ok = io.print(sheetPrintHtml(pageNow, stamp), { kind: SHEET_SENT_KIND, title: sheetPrintTitle(pageNow), source: jobState.id ? { table: 'document_builder_sheets', id: jobState.id } : undefined })
    if (!ok) setRefusal('The print window was blocked. Allow pop-ups for this site, then print again.')
  }

  const stamp = sheetStamp(mode, jobState && job ? { ...jobState, name: job.name } : null, rec.revision)

  return (
    <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
      <Bar entry={entry} onBack={onBack}>
        {sheetBarChips(mode, jobState, rec, under).map((c) => (
          <Chip key={c.words} chip={c} />
        ))}
        {read.read ? (
          <Chip chip={{ tone: 'ok', words: read.words }} />
        ) : read.canMark ? (
          <button type="button" aria-expanded={readOpen} onClick={() => setReadOpen((o) => !o)} style={{ ...CHIP, ...CHIP_TONES.warn, border: 0, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 2, minHeight: 24 }}>
            {read.words}
          </button>
        ) : (
          <Chip chip={{ tone: 'warn', words: read.words }} />
        )}
        <span style={{ flex: '1 1 auto' }} />
        <span style={saveState === 'failed' ? { ...FINE, fontWeight: 600, color: 'var(--text-red-700)' } : FINE} aria-live="polite">
          {SAVE_WORDS[saveState]}
        </span>
        <button type="button" disabled={press.dead || busy} style={mainPress(press.dead || busy)} onClick={() => void (mode === 'usual' ? publishUsual() : publishJob())}>
          {press.label}
        </button>
      </Bar>

      {readOpen && !read.read ? (
        <div style={{ ...CARD, background: 'var(--bg-amber-tint)', borderColor: 'var(--text-amber-700)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px', alignItems: 'end' }}>
            <label style={{ ...LABEL, flex: '1 1 220px', maxWidth: 320 }}>
              <span>{read.formLabel}</span>
              <input type="text" value={readName} onChange={(e) => setReadName(e.target.value)} style={INPUT} />
            </label>
            <button type="button" disabled={busy || !readName.trim()} style={mainPress(busy || !readName.trim())} onClick={() => void markRead()}>
              {read.pressLabel}
            </button>
            <button type="button" style={SECOND_PRESS} onClick={() => setReadOpen(false)}>
              Cancel
            </button>
          </div>
          <p style={FINE}>Kept with the revision. A new revision is unread again until someone marks it.</p>
        </div>
      ) : null}

      {refusal ? (
        <p role="alert" style={REFUSAL}>
          {refusal}
        </p>
      ) : null}
      {press.dead && press.why.length > 0 ? (
        <div style={CARD}>
          <h3 style={CARD_TITLE}>Before this can be published</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: 4, fontSize: '0.8rem', color: 'var(--text-base)' }}>
            {press.why.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 12, minWidth: 0 }}>
          <label style={LABEL}>
            <span>Job</span>
            <select value={jobId ?? ''} disabled={mode === 'usual' || jobs.length === 0} onChange={(e) => setJobId(e.target.value || null)} style={INPUT}>
              {jobs.length === 0 ? <option value="">No job you run as the GC yet</option> : null}
              {jobs.map((j) => (
                <option key={j.projectId} value={j.projectId}>
                  {`${j.name}${(sheets.get(j.projectId)?.revision ?? 0) > 0 ? '' : ', no sheet yet'}`}
                </option>
              ))}
            </select>
          </label>
          <div role="group" aria-label="Which sheet" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 9, overflow: 'hidden', background: 'var(--surface)', justifySelf: 'start' }}>
            {(
              [
                ['job', 'This job'],
                ['usual', 'The standing sheet'],
              ] as const
            ).map(([m, words]) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={{ border: 0, background: mode === m ? '#2563eb' : 'none', color: mode === m ? 'white' : 'var(--text-700)', padding: '6px 14px', minHeight: 36, fontFamily: 'inherit', fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer' }}>
                {words}
              </button>
            ))}
          </div>
          <span style={MUTED}>{sheetNote(mode, jobState, { revision: rec.revision, dirty: usualDirty })}</span>

          {mode === 'usual' ? (
            <>
              <div style={CARD}>
                <h3 style={CARD_TITLE}>Your usual sheet</h3>
                <p style={MUTED}>Every job starts on these words and amounts. A job then changes only what differs.</p>
                <Legend
                  marks={[
                    ['usual', 'Your usual'],
                    ['blank', 'Filled from each job'],
                  ]}
                />
              </div>
              <div style={CARD}>
                <h3 style={CARD_TITLE}>{usualDirty ? 'Where this change goes' : 'Every job is on your usual'}</h3>
                {plan.length === 0 ? <p style={MUTED}>No job you run as the GC yet. A job shows here once it is on the GC projects page.</p> : null}
                <div>
                  {plan.map((row) => (
                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) minmax(0, auto)', gap: '4px 10px', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '0.84rem' }}>
                      <span>{row.name}</span>
                      <Chip chip={usualPlanChip(row, usualDirty, sheets.get(row.id)?.revision ?? 0)} />
                    </div>
                  ))}
                </div>
                {outcome ? (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <Chip chip={{ tone: outcome.tone === 'success' ? 'ok' : 'warn', words: outcome.line }} />
                    {outcome.head ? <p style={REFUSAL}>{outcome.head}</p> : null}
                    {outcome.failed.map((f) => (
                      <p key={f.name} style={MUTED}>{`${f.name}: ${f.why}`}</p>
                    ))}
                  </div>
                ) : null}
                <p style={FINE}>A field a job has changed keeps the job's own words. A held job gets your usual when you publish that job.</p>
              </div>
            </>
          ) : jobState && job ? (
            <>
              <div style={CARD}>
                <h3 style={CARD_TITLE}>{differsLine(differs.length)}</h3>
                <Legend
                  marks={[
                    ['usual', 'Your usual'],
                    ['blank', 'Filled from the job'],
                    ['own', 'Changed for this job'],
                  ]}
                />
                {differs.length === 0 ? <p style={MUTED}>Only its names and its place are its own. Press any words on the sheet to change them for this job.</p> : null}
                {differs.map((d) => {
                  if (d.kind === 'field') {
                    const offer = usualOffer(usual, jobState.own, d.path)
                    return (
                      <div key={d.path} style={ROW}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.84rem' }}>{d.name}</div>
                          <div style={MUTED}>{`Your usual: ${d.usual}`}</div>
                        </div>
                        <div style={BTNS}>
                          <button type="button" aria-label={`Back to the usual for ${d.name}`} style={SMALL_PRESS} onClick={() => changeJob(withoutJobWords(jobState.own, d.path))}>
                            Back to the usual
                          </button>
                          {offer.kind === 'in-usual' ? (
                            <span style={FINE}>In your usual now. Publish the usual to send it to the other jobs.</span>
                          ) : offer.kind === 'held' ? (
                            <span style={FINE}>{offer.why}</span>
                          ) : (
                            <button type="button" aria-label={`Make this the usual for ${d.name}`} style={SMALL_PRESS} onClick={() => changeUsual(usualFromJobField(usual, jobState.own, d.path))}>
                              Make this the usual
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  }
                  if (d.kind === 'off') {
                    return (
                      <div key={`off-${d.coverKey}`} style={ROW}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.84rem' }}>{d.name}</div>
                          <div style={MUTED}>Not asked on this job.</div>
                        </div>
                        <div style={BTNS}>
                          <button type="button" aria-label={`Put ${d.name} back`} style={SMALL_PRESS} onClick={() => changeJob(withJobCoverOff(jobState.own, d.coverKey, false))}>
                            Put it back
                          </button>
                        </div>
                      </div>
                    )
                  }
                  const line = jobState.own.extra.find((x) => x.key === d.extraKey)
                  const inUsual = line ? usualHasCover(usual, line) : false
                  return (
                    <div key={`extra-${d.extraKey}`} style={ROW}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.84rem' }}>{d.name}</div>
                        <div style={MUTED}>Added for this job.</div>
                      </div>
                      <div style={BTNS}>
                        <button type="button" aria-label={`Take ${d.name} off`} style={SMALL_PRESS} onClick={() => changeJob(withoutJobExtra(jobState.own, d.extraKey))}>
                          Take it off
                        </button>
                        {inUsual ? (
                          <span style={FINE}>In your usual now. Publish the usual to send it to the other jobs.</span>
                        ) : (
                          <button type="button" aria-label={`Make ${d.name} the usual`} style={SMALL_PRESS} onClick={() => changeUsual(usualFromJobExtra(usual, jobState.own, d.extraKey))}>
                            Make this the usual
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Each job has its own card: a card kept across a job switch showed the last job's link, live, under this one. */}
              <BuilderLinkCard
                key={`link-${job.projectId}`}
                builderKey={entry.id}
                sheetId={jobState.id}
                published={jobState.revision > 0 && jobState.id != null}
                io={io.link}
                words={{
                  title: "This sheet's link",
                  notPublished: "Publish this job's sheet first. A link then opens it.",
                  on: 'Anyone with the link can read and print this one sheet. A sub sends it on to their insurance agent.',
                  off: 'The link is off. Nobody can open this sheet by link. A sub you sent it to still finds it on their page.',
                }}
              />
              <div style={CARD}>
                <h3 style={CARD_TITLE}>Print this job's sheet</h3>
                {pageNow ? (
                  <>
                    <div style={BTNS}>
                      <button type="button" style={SECOND_PRESS} onClick={printSheet}>
                        Print the sheet
                      </button>
                    </div>
                    <p style={MUTED}>{`It prints revision ${jobState.revision}, the one subs see. The copy is kept under Sent copies on Documents.`}</p>
                  </>
                ) : (
                  <p style={MUTED}>Publish this job's sheet first. It then prints as subs see it.</p>
                )}
              </div>
              <SheetSendCard key={`send-${job.projectId}`} builderKey={entry.id} projectId={job.projectId} sheetId={jobState.id} revision={jobState.revision} unread={isBuilderRead(rec) ? '' : 'Your insurance agent has not checked your usual sheet.'} io={io.sends} />
            </>
          ) : (
            <div style={CARD}>
              <p style={MUTED}>No job you run as the GC yet. A job shows here once it is on the GC projects page. The standing sheet can be set up now.</p>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
          <div style={{ ...BTNS, justifyContent: 'space-between' }}>
            <div style={CAP}>{sheetCaption(mode, marks)}</div>
            <button type="button" role="switch" aria-checked={marks} onClick={() => setMarks((m) => !m)} style={{ ...SMALL_PRESS, color: 'var(--text-strong)' }}>
              {marks ? 'Marks are on' : 'Marks are off, as a sub sees it'}
            </button>
          </div>
          {mode === 'usual' ? (
            marks ? (
              <SheetPaperEdit mode="usual" def={usual} stamp={stamp} onUsual={changeUsual} />
            ) : (
              <SheetPaperRead sheet={layOver(usual, startJobSheet({ name: "the job's name", place: "the job's address", insured: ["The property's owner, from each job"] }))} stamp={stamp} />
            )
          ) : jobState ? (
            marks ? (
              <SheetPaperEdit mode="job" def={under} job={jobState.own} stamp={stamp} onJob={changeJob} />
            ) : (
              <SheetPaperRead sheet={layOver(under, jobState.own)} stamp={stamp} />
            )
          ) : null}
          <p style={FINE}>Placeholder words. No amount is set for you. Your insurance agent and your attorney set the real words and amounts.</p>
        </div>
      </div>
    </div>
  )
}

function Bar({ entry, onBack, children }: { entry: DocumentBuilderEntry; onBack: () => void; children?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', alignItems: 'center' }}>
      <button type="button" style={SMALL_PRESS} onClick={onBack}>
        {`‹ ${WORDS.back}`}
      </button>
      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>{entry.name}</span>
      {children}
    </div>
  )
}
