import { Link } from 'react-router-dom'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { printAndFile } from '../../lib/sent/sentCopiesIo'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { procurementLogCsv, procurementLogFileName, procurementLogTsv } from '../../lib/submittals/procurementLogExport'
import { loadProcurementSheetAssets, type ProcurementSheetAssets } from '../../lib/submittals/procurementSheetAssets'
import { describeLeadTime, parseLeadTime } from '../../lib/submittals/leadTime'
import { splitPartLabel } from '../../lib/submittals/itemParts'
import { setLineFacts } from '../../lib/submittals/itemPartsIo'
import { tagBlock, type TagGuide } from '../../lib/submittals/procurementTagBlocks'
import { isPlausibleDate, readDateBoxEntry } from '../../lib/dateBoxEntry'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import {
  ANSWER_DOOR_WORDS,
  answerDoor,
  buildProcurementLog,
  buildProcurementUpdateHtml,
  diffProcurementLog,
  floatText,
  gcProcurementRows,
  procurementSections,
  PROCUREMENT_STAGE_LABELS,
  procurementCounts,
  procurementUpdateText,
  lineStatus,
  logDateRead,
  foldByHouse,
  houseFoldNote,
  logIsDraft,
  orderBlockers,
  rowsForBlocker,
  BLOCKER_WORDS,
  readTypedLogDate,
  shortDate,
  daysAgoWords,
  snapshotRows,

  submittalWord,
  toIsoDate,
  type BlockerKind,
  type LineStatus,
  type ProcurementItemSource,
  type ProcurementLens,
  type ProcurementRecord,
  type ProcurementRow,
  type ProcurementSheetLetterhead,
  type ProcurementStage,
  type StageDates,
} from '../../lib/submittals/procurementLog'
import { blockersPress, procurementNextLine, procurementSteps, rowsForStep, sendUpdateLabel, sharedHouse, stepOnlyWords, stepShares, type ProcurementStepKey, type ProcurementStepTone } from '../../lib/submittals/procurementBoard'
import { loadProcurementRecords, loadProcurementUpdates, loadStageDatesForBid, loadTagStagesForBid, type ProcurementUpdate } from '../../lib/submittals/procurementLogIo'

type Props = {
  bidId: string
  /** "B482 Shipley Do-Nuts (San Antonio)" */
  bidLabel: string
  companyName: string
  /** The newest revision's rows as the log reads them (see `procurementItemsFrom`). */
  items: ReadonlyArray<ProcurementItemSource>
  /** The room's identified reviewers — the default "To". */
  reviewerNames: ReadonlyArray<string>
  currentUser: { id: string | null; name: string }
  /** The sheet's company block (v2.4122) — the test report's settings; null prints the name alone. */
  letterhead?: Omit<ProcurementSheetLetterhead, 'logoDataUrl'> | null
  projectAddress?: string | null
  /** The GC the printed sheet is addressed to. */
  gcName?: string | null
  /** The bid's review-room link; the sheet carries it with a code. */
  roomUrl?: string | null
  busy?: boolean
  /** The strip's Procure pill reads these. */
  onCounts?: (c: { released: number; ordered: number; delivered: number; late: number; /** v2.4581 · each line once, by its step. */ steps: Record<ProcurementStepKey, number> }) => void
  /** A tap on a line's item opens its row's Edit window, on that part (2026-10-02, Grace: no scrolling back and forth). */
  onOpenItem?: (line: { itemId: string; partKey: string | null; /** the house cell was what was tapped */ house?: boolean }) => void
  /** A line the GC still holds opens its row's Their answer window, on that part (2026-10-02). Not given: no door. */
  onAnswerItem?: (line: { itemId: string; partKey: string | null }) => void
  /** The supply houses the tick bar can set on many lines at once (2026-10-02). */
  houses?: ReadonlyArray<{ id: string; name: string }>
  /** The rows' parts changed from the log (house, lead time, stage): the caller reads them again. */
  onLinesChanged?: () => void
  /** v2.4581 · the Next line's *Enter their approval…* door (the approve-all window). Not given: no door. */
  onEnterApproval?: () => void
}

const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'middle', fontSize: '0.8125rem', color: 'var(--text-base)' }
// The seven date and count columns (Released · Ordered · Lead · Expected · Required · Float · Delivered): heading and cell centred, one line each.
const thCenter: CSSProperties = { ...th, textAlign: 'center' }
const tdCenter: CSSProperties = { ...td, whiteSpace: 'nowrap', textAlign: 'center' }
// The Item cell: the tag in bold, then the product on the same line, so a long name wraps across one wide cell.
// On a phone the item and its tick fit the screen; the dates scroll beside them.
const itemTd: CSSProperties = { ...td, minWidth: 'min(14rem, 46vw)', lineHeight: 1.35, overflowWrap: 'anywhere' }
// 2026-10-02 · the line's dates open under it: each box with its name over it.
const editorField: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }
const editorLabel: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const COLS = 8
// The table's least width; a log narrower than this draws a card per line instead.
const TABLE_MIN_WIDTH = 760
// The count in a blocker's sentence is a link to its lines (Wendi, 2026-10-02).
const blockerLink: CSSProperties = { background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 700, color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: '2px', cursor: 'pointer' }
const STEP_TONE_COLOR: Record<ProcurementStepTone, string> = { back: 'var(--text-amber-700)', go: 'var(--text-blue-700)', late: 'var(--text-red-700)', quiet: 'var(--text-muted)' }
// The share bar under the steps: grey, light blue, blue, green.
const STEP_SHARE_COLOR: Record<ProcurementStepKey, string> = { gc: 'var(--border-strong)', to_order: '#93c5fd', on_order: '#2563eb', on_site: '#16a34a' }
const jobWindowHref = (jobId: string) => `/jobs?jobDetail=${jobId}`
const STATUS_COLOR: Record<LineStatus['tone'], string> = { done: 'var(--text-green-700)', late: 'var(--text-red-700)', ordered: 'var(--text-strong)', act: 'var(--text-blue-700)', back: 'var(--text-amber-700)', waiting: 'var(--text-muted)', none: 'var(--text-muted)' }
const itemTag: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', marginRight: '0.45rem' }

/** One indent step on the By tag lens: a part 1.5rem in under its fixture, a part inside an assembly 3rem (2026-10-02). */
const STEP_REM = 1.5
const indentPad = (guides: ReadonlyArray<TagGuide> | undefined) => (guides && guides.length > 0 ? `calc(${guides.length * STEP_REM}rem + 0.5rem)` : undefined)

/**
 * The tree's connectors in a cell (the cell is `position: relative`): ├ └ │ by column, as a folder
 * list draws them, so a part reads as belonging to the fixture or assembly above it. `through`
 * draws only the verticals, for a row that sits between two lines of a block (a divider, the open
 * dates of a line).
 */
function Rails({ guides, through = false }: { guides: ReadonlyArray<TagGuide>; through?: boolean }) {
  return (
    <>
      {guides.map((g, k) => {
        const kind = through ? (g === 'blank' ? null : g === 'end' && k === guides.length - 1 ? null : 'pass') : g === 'blank' ? null : g
        return kind ? <span key={k} aria-hidden="true" className={`procure-rail procure-rail--${kind}`} style={{ left: `${0.75 + k * STEP_REM}rem` }} data-testid="procurement-rail" data-rail={kind} /> : null
      })}
    </>
  )
}
const btn: CSSProperties = { padding: '0.35rem 0.75rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
const inp: CSSProperties = { padding: '0.2rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box', font: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }

type DateField = 'ordered_on' | 'expected_on' | 'delivered_on'

const LENS_KEY = 'submittals_procure_lens'
const LENS_WORDS: Record<ProcurementLens, string> = { to_order: 'To order', by_tag: 'By tag', by_house: 'By house' }
function readLens(): ProcurementLens {
  try {
    const v = localStorage.getItem(LENS_KEY)
    return v === 'by_tag' || v === 'by_house' || v === 'to_order' ? v : 'to_order'
  } catch {
    return 'to_order'
  }
}
type Draft = Partial<Record<'po' | 'note' | 'label' | 'lead' | DateField, string>>

/**
 * Submittals → Procure (v2.4083): the procurement log. Released reads from the room's
 * decision, required from the job's stage windows through the takeoff's stage; the
 * estimator types the order date and PO, the house's arrival date when it differs,
 * the delivered date and a note. Send update records a dated snapshot with what
 * changed, opens the sheet to print, and copies the text for the email.
 */
export function SubmittalProcurementPanel({ bidId, bidLabel, companyName, items, reviewerNames, currentUser, letterhead = null, projectAddress = null, gcName = null, roomUrl = null, busy = false, onCounts, onOpenItem, onAnswerItem, houses = [], onLinesChanged, onEnterApproval }: Props) {
  const { showToast } = useToastContext()
  const confirmDialog = useConfirmDialog()
  const [records, setRecords] = useState<ProcurementRecord[]>([])
  const [updates, setUpdates] = useState<ProcurementUpdate[]>([])
  const [tagStage, setTagStage] = useState<Record<string, ProcurementStage | undefined>>({})
  const [stageDates, setStageDates] = useState<StageDates>({})
  const [jobId, setJobId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendLine, setSendLine] = useState('')
  const [updatesOpen, setUpdatesOpen] = useState(false)
  const [sheetAssets, setSheetAssets] = useState<ProcurementSheetAssets>({ logoDataUrl: null, roomQrSvg: null })
  // 2026-10-01 · the log three ways (remembered on the device), and lines ticked to mark at once.
  const [lens, setLensState] = useState<ProcurementLens>(() => readLens())
  const setLens = (next: ProcurementLens) => {
    setLensState(next)
    try {
      localStorage.setItem(LENS_KEY, next)
    } catch {
      // No storage on this device: the switch still works for the visit.
    }
  }
  const [ticked, setTicked] = useState<Set<string>>(() => new Set())
  // 2026-10-02 · lines whose dates are open under them; houses opened in To order's fold; a card per part on a phone.
  const [openLines, setOpenLines] = useState<Set<string>>(() => new Set())
  const [openHouses, setOpenHouses] = useState<Set<string>>(() => new Set())
  const narrowScreen = useNarrowViewport640()
  // Cards whenever the log itself is narrower than its table needs: a phone, a tablet, a side pane.
  const [rootWidth, setRootWidth] = useState<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  // A callback ref: the log's box may appear after the first render.
  const rootRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!el) return
    // Measured at once (a hidden tab never runs the observer), then whenever the box changes.
    const inner = (box: HTMLElement) => box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft || '0') - parseFloat(getComputedStyle(box).paddingRight || '0')
    if (el.clientWidth > 0) setRootWidth(inner(el))
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setRootWidth(inner(el)))
    ro.observe(el)
    observer.current = ro
  }, [])
  const narrow = narrowScreen || (rootWidth != null && rootWidth < TABLE_MIN_WIDTH)
  const [bulkOrdered, setBulkOrdered] = useState('')
  const [bulkPo, setBulkPo] = useState('')
  // 2026-10-02 · the office's facts for every ticked line: house, lead time, stage.
  const [bulkHouse, setBulkHouse] = useState('')
  const [bulkLead, setBulkLead] = useState('')
  const [bulkStage, setBulkStage] = useState('')
  // 2026-10-02 · the blocker whose lines are the only ones showing; none = the whole log.
  const [onlyPicked, setOnlyPicked] = useState<BlockerKind | null>(null)
  // v2.4581 · the step whose lines are the only ones showing; the ⋯ menu; the Set… form under the missing facts.
  const [stepPicked, setStepPicked] = useState<ProcurementStepKey | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [setter, setSetter] = useState<BlockerKind | null>(null)
  const [setterValue, setSetterValue] = useState('')
  const onlyRef = useRef<HTMLDivElement | null>(null)

  const tagsKey = items.map((i) => i.tag).join('|')

  // The records as last read, for a write queued behind the one that made the row's record.
  const recordsRef = useRef<ProcurementRecord[]>([])
  const writeQueue = useRef<Promise<void>>(Promise.resolve())
  // The date box a click is landing in (`row key:field`) when it was not already in use: that click opens the calendar.
  const clickedInto = useRef<string | null>(null)
  const applyRecords = useCallback((recs: ProcurementRecord[]) => {
    recordsRef.current = recs
    setRecords(recs)
  }, [])

  const reloadRecords = useCallback(async () => {
    applyRecords(await loadProcurementRecords(supabase, bidId))
  }, [bidId, applyRecords])
  const reloadUpdates = useCallback(async () => {
    setUpdates(await loadProcurementUpdates(supabase, bidId))
  }, [bidId])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    void Promise.all([loadProcurementRecords(supabase, bidId), loadProcurementUpdates(supabase, bidId), loadTagStagesForBid(supabase, bidId, tagsKey ? tagsKey.split('|') : []), loadStageDatesForBid(supabase, bidId)])
      .then(([recs, ups, stages, dates]) => {
        if (cancelled) return
        applyRecords(recs)
        setUpdates(ups)
        setTagStage(stages)
        setStageDates(dates.stageDates)
        setJobId(dates.jobId)
        setLoaded(true)
      })
      .catch((e) => {
        if (cancelled) return
        showToast(formatErrorMessage(e, 'Could not read the procurement log'), 'error')
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [bidId, tagsKey, showToast, applyRecords])

  // The logo and the room's code, fetched ahead so every print stays inside its click (see procurementSheetAssets.ts).
  useEffect(() => {
    let cancelled = false
    void loadProcurementSheetAssets(roomUrl).then((a) => {
      if (!cancelled) setSheetAssets(a)
    })
    return () => {
      cancelled = true
    }
  }, [roomUrl])

  const rows = useMemo(() => buildProcurementLog({ items, records, tagStage, stageDates }), [items, records, tagStage, stageDates])
  // What the GC's copies carry: every line but the parts bought as order only.
  const gcRows = useMemo(() => gcProcurementRows(rows), [rows])
  const blockers = useMemo(() => orderBlockers(rows), [rows])
  // The lines on screen: every line, or the ones a picked blocker names. Counts, the update and the print read every line.
  const shown = useMemo(() => (stepPicked ? { rows: rowsForStep(rows, stepPicked), only: null as BlockerKind | null } : rowsForBlocker(rows, blockers, onlyPicked)), [rows, blockers, onlyPicked, stepPicked])
  const steps = useMemo(() => procurementSteps(rows), [rows])
  const only = shown.only
  const sections = useMemo(() => procurementSections(shown.rows, lens), [shown, lens])
  const lastUpdate = updates[0] ?? null
  const changes = useMemo(() => diffProcurementLog(lastUpdate ? lastUpdate.rows : null, gcRows), [lastUpdate, gcRows])
  const hasStageDates = Object.keys(stageDates).length > 0
  // Today, for the soft line under each date ("2 days ago").
  const today = toIsoDate(new Date())
  useEffect(() => {
    if (!loaded || !onCounts) return
    const c = procurementCounts(rows)
    onCounts({ released: c.released, ordered: c.ordered, delivered: c.delivered, late: c.late, steps: Object.fromEntries(steps.map((s) => [s.key, s.count])) as Record<ProcurementStepKey, number> })
  }, [loaded, rows, steps, onCounts])

  function draftOf(key: string, field: keyof Draft, stored: string): string {
    const d = drafts[key]?.[field]
    return d == null ? stored : d
  }
  function setDraft(key: string, field: keyof Draft, v: string) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: v } }))
  }
  function clearDraft(key: string, field: keyof Draft) {
    setDrafts((prev) => {
      const d = { ...prev[key] }
      delete d[field]
      return { ...prev, [key]: d }
    })
  }

  /**
   * One row per tag (or hand row id): insert on first write, update after. Writes run one at
   * a time, so the second box filled on a new row updates the record the first one made.
   */
  function write(row: ProcurementRow, patch: Partial<{ ordered_on: string | null; po_ref: string; expected_on: string | null; delivered_on: string | null; note: string; label: string; lead_time_days: number | null; stage: ProcurementStage | null }>): Promise<void> {
    const run = async () => {
      setSaving(true)
      try {
        const recordId = row.recordId ?? (row.partKey ? recordsRef.current.find((r) => r.partKey === row.partKey)?.id ?? null : row.tag ? recordsRef.current.find((r) => r.tag === row.tag && !r.partKey)?.id ?? null : null)
        if (recordId) {
          const { error } = await supabase.from('bid_procurement_items').update(patch).eq('id', recordId)
          if (error) throw error
        } else {
          const maxSort = recordsRef.current.reduce((m, r) => Math.max(m, r.sortOrder), -1)
          const { error } = await supabase.from('bid_procurement_items').insert({ bid_id: bidId, tag: row.tag, ...(row.partKey ? { part_key: row.partKey } : {}), sort_order: maxSort + 1, ...patch } as never)
          if (error) throw error
        }
        await reloadRecords()
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not save the log'), 'error')
      } finally {
        setSaving(false)
      }
    }
    const next = writeQueue.current.then(run)
    writeQueue.current = next
    return next
  }

  /** What the row's record holds for a date box (Expected shows a derived date the record does not hold). */
  function storedDate(row: ProcurementRow, field: DateField): string | null {
    return field === 'ordered_on' ? row.orderedOn : field === 'expected_on' ? (row.expectedSource === 'house' ? row.expectedOn : null) : row.deliveredOn
  }

  /** A pick from the calendar is a whole date (or the calendar's Clear), so it saves at once. */
  function pickDate(row: ProcurementRow, field: DateField, value: string) {
    const entry = readDateBoxEntry(value, storedDate(row, field))
    clearDraft(row.key, field)
    if (entry.kind === 'save') void write(row, { [field]: entry.value } as Record<string, string | null>)
  }

  /**
   * Leaving a date box, or Enter in it. What was typed saves if it reads as a date ("9/23"
   * takes the nearest year); an emptied box clears the date; anything else is dropped, the
   * box goes back to what is saved, and a line says why. So a half-typed date is never written.
   */
  function commitTypedDate(row: ProcurementRow, field: DateField, shown: string | null) {
    const raw = drafts[row.key]?.[field]
    if (raw == null) return
    clearDraft(row.key, field)
    if (raw.trim() === logDateRead(shown, today)) return
    const entry = readTypedLogDate(raw, today)
    if (entry.kind === 'bad') {
      showToast(`“${raw.trim()}” does not read as a date, so it was not saved. Type the month and the day, like 9/23.`, 'info')
      return
    }
    const value = entry.kind === 'date' ? entry.iso : null
    if (value !== storedDate(row, field)) void write(row, { [field]: value } as Record<string, string | null>)
  }

  /** Opens the browser's calendar for a date box: it belongs to the unseen date input beside the text box. */
  function openCalendar(textBox: HTMLInputElement) {
    const pick = textBox.parentElement?.querySelector<HTMLInputElement>('.procurement-date-pick')
    try {
      pick?.showPicker?.()
    } catch {
      // No calendar in this browser, or the box is disabled: the text box still takes a typed date.
    }
  }

  /**
   * One date cell: a text box as narrow as a month and a day ("09/23"; the year shows only when
   * a typed month and day would not reach it). A click into it opens the browser's calendar; a
   * typed date ("9/23", "9/23/27") saves when the box is left or on Enter. Under it in soft
   * text, how far the date is from today ("2 days ago", "in 12 days").
   */
  function dateCell(row: ProcurementRow, field: DateField, shown: string | null, o: { label: string; disabled: boolean; title?: string; background?: string; under?: string | null; empty?: string }) {
    const box = `${row.key}:${field}`
    // A year outside the log's window (0001, typed short before v2.4239) is shown in full, so two digits cannot hide it.
    const odd = shown != null && !isPlausibleDate(shown)
    // Soft lines under the box: what the date is ("house said"), then how far it is from today.
    const under = odd ? ['check the year'] : [o.under, daysAgoWords(shown, today)].filter((x): x is string => !!x)
    const text = draftOf(row.key, field, logDateRead(shown, today))
    return (
      <>
        {/* As wide as what it holds: five characters for a month and a day, more only while a year is typed or has to be said. */}
        <div className="procurement-date-slot" style={{ width: `calc(${Math.max(5, text.length)}ch + 1rem)`, margin: '0 auto' }} title={o.title ?? 'Click for the calendar, or type the date, like 9/23'}>
          <input
            type="text"
            className="procurement-date"
            aria-label={o.label}
            placeholder={o.empty ?? 'mm/dd'}
            autoComplete="off"
            value={text}
            disabled={o.disabled}
            onChange={(e) => setDraft(row.key, field, e.target.value)}
            onPointerDown={(e) => {
              // A click into the box opens the calendar; a click in a box already in use only places the caret.
              clickedInto.current = document.activeElement === e.currentTarget ? null : box
            }}
            onClick={(e) => {
              if (clickedInto.current === box) openCalendar(e.currentTarget)
              clickedInto.current = null
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTypedDate(row, field, shown)
              else if (e.key === 'Escape' && drafts[row.key]?.[field] != null) {
                e.stopPropagation()
                clearDraft(row.key, field)
              }
            }}
            onBlur={() => commitTypedDate(row, field, shown)}
            style={{ ...inp, background: o.background ?? 'var(--surface)', ...(odd ? { color: 'var(--text-red-700)' } : null) }}
          />
          <input type="date" className="procurement-date-pick" tabIndex={-1} aria-hidden="true" data-testid="procurement-date-pick" value={shown != null && !odd ? shown : ''} disabled={o.disabled} onChange={(e) => pickDate(row, field, e.target.value)} />
        </div>
        {under.map((line) => (
          <div key={line} style={{ ...smallMuted, ...(odd ? { color: 'var(--text-red-700)' } : null) }} data-testid="procurement-date-under">{line}</div>
        ))}
      </>
    )
  }

  async function commitText(row: ProcurementRow, field: 'po' | 'note' | 'label' | 'lead') {
    const raw = drafts[row.key]?.[field]
    clearDraft(row.key, field)
    if (raw == null) return
    if (field === 'po') {
      const po = raw.trim().slice(0, 60)
      if (po !== row.poRef) await write(row, { po_ref: po })
    } else if (field === 'note') {
      const note = raw.trim().slice(0, 500)
      if (note !== row.note) await write(row, { note })
    } else if (field === 'label') {
      const label = raw.trim().slice(0, 200)
      if (label !== row.product) await write(row, { label })
    } else {
      const days = raw.trim() === '' ? null : parseLeadTime(raw)
      if (raw.trim() !== '' && days == null) {
        showToast('Lead time reads like "2 wk", "10 days" or "in stock".', 'info')
        return
      }
      if (days !== row.leadTimeDays) await write(row, { lead_time_days: days })
    }
  }

  /** Mark every ticked line ordered on one day with one PO — one order to one house, many parts (2026-10-01). */
  async function markTicked(field: 'ordered_on' | 'delivered_on') {
    const chosen = rows.filter((r) => ticked.has(r.key))
    if (chosen.length === 0) return
    let on = today
    if (field === 'ordered_on' && bulkOrdered.trim()) {
      const entry = readTypedLogDate(bulkOrdered, today)
      if (entry.kind !== 'date') {
        showToast(`“${bulkOrdered.trim()}” does not read as a date. Type the month and the day, like 9/23.`, 'info')
        return
      }
      on = entry.iso
    }
    const po = bulkPo.trim().slice(0, 60)
    for (const r of chosen) await write(r, field === 'ordered_on' ? { ordered_on: on, ...(po ? { po_ref: po } : {}) } : { delivered_on: on })
    setTicked(new Set())
    setBulkOrdered('')
    setBulkPo('')
    showToast(`${chosen.length} line${chosen.length === 1 ? '' : 's'} marked ${field === 'ordered_on' ? `ordered ${shortDate(on)}${po ? ` on ${po}` : ''}` : `delivered ${shortDate(on)}`}.`, 'success')
  }

  /** Write a house, lead time or stage onto lines that have a row behind them, and say what was set. */
  async function saveFacts(chosen: ReadonlyArray<ProcurementRow>, patch: { supply_house_id?: string | null; lead_time_days?: number | null; stage?: string | null }): Promise<boolean> {
    if (chosen.length === 0 || Object.keys(patch).length === 0) return false
    setSaving(true)
    try {
      const n = await setLineFacts(supabase, chosen.map((r) => ({ itemId: r.itemId!, partKey: r.partKey ?? null })), patch)
      onLinesChanged?.()
      const what = [patch.supply_house_id ? houses.find((h) => h.id === patch.supply_house_id)?.name ?? 'the house' : '', patch.lead_time_days != null ? describeLeadTime(patch.lead_time_days) : '', patch.stage ? PROCUREMENT_STAGE_LABELS[patch.stage as ProcurementStage] : ''].filter(Boolean).join(', ')
      showToast(`${what} set on ${n} line${n === 1 ? '' : 's'}.`, 'success')
      return true
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not set them'), 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  /** A typed lead time as days; null (with a line saying why) when it does not read. */
  function readLead(text: string): number | null {
    const days = parseLeadTime(text)
    if (days == null) showToast(`“${text.trim()}” does not read as a lead time. Type it like 3 wk or 10 days.`, 'info')
    return days
  }

  /** Set the house, lead time and stage on every ticked line that has a row behind it (2026-10-02). */
  async function setTickedFacts() {
    const chosen = rows.filter((r) => ticked.has(r.key) && r.itemId)
    const patch: { supply_house_id?: string | null; lead_time_days?: number | null; stage?: string | null } = {}
    if (bulkHouse) patch.supply_house_id = bulkHouse
    if (bulkLead.trim()) {
      const days = readLead(bulkLead)
      if (days == null) return
      patch.lead_time_days = days
    }
    if (bulkStage) patch.stage = bulkStage
    if (!(await saveFacts(chosen, patch))) return
    setTicked(new Set())
    setBulkHouse('')
    setBulkLead('')
    setBulkStage('')
  }

  /** v2.4581 · Set… on a missing fact: one lead time, stage or house on every line the blocker names. */
  async function setOnBlocker(kind: BlockerKind) {
    const keys = new Set(kind === 'lead' ? blockers.noLead : kind === 'house' ? blockers.noHouse : blockers.noStage)
    const chosen = rows.filter((r) => keys.has(r.key) && r.itemId)
    const value = setterValue.trim()
    if (!value) return
    let patch: { supply_house_id?: string; lead_time_days?: number; stage?: string }
    if (kind === 'lead') {
      const days = readLead(value)
      if (days == null) return
      patch = { lead_time_days: days }
    } else patch = kind === 'house' ? { supply_house_id: value } : { stage: value }
    if (!(await saveFacts(chosen, patch))) return
    setSetter(null)
    setSetterValue('')
  }

  // The last line a picked blocker named was fixed: nothing is picked any more.
  useEffect(() => {
    if (onlyPicked && !only) setOnlyPicked(null)
  }, [onlyPicked, only])

  /** Show only the lines a blocker names (its count is the link), or every line again. */
  function showOnly(kind: BlockerKind | null) {
    setStepPicked(null)
    setOnlyPicked(kind)
    if (kind) window.setTimeout(() => onlyRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 0)
  }

  /** v2.4581 · a step shows only its lines; pressed again, every line. */
  function pickStep(key: ProcurementStepKey) {
    setOnlyPicked(null)
    setStepPicked((cur) => (cur === key ? null : key))
  }

  async function addHandRow() {
    setSaving(true)
    try {
      const maxSort = records.reduce((m, r) => Math.max(m, r.sortOrder), -1)
      const { error } = await supabase.from('bid_procurement_items').insert({ bid_id: bidId, tag: null, label: '', sort_order: maxSort + 1 })
      if (error) throw error
      await reloadRecords()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not add the item'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function removeHandRow(row: ProcurementRow) {
    if (!row.recordId) return
    const ok = await confirmDialog({ title: 'Remove this item?', message: `${row.product || 'The item'} leaves the log. Updates already sent keep it.`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    setSaving(true)
    try {
      const { error } = await supabase.from('bid_procurement_items').delete().eq('id', row.recordId)
      if (error) throw error
      await reloadRecords()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not remove the item'), 'error')
    } finally {
      setSaving(false)
    }
  }

  /** The letter's fixed part: who it is from, who it is to, where it lives (v2.4122). */
  const letter = {
    bidLabel,
    companyName,
    stageDates,
    letterhead: letterhead ? { ...letterhead, logoDataUrl: sheetAssets.logoDataUrl } : null,
    projectAddress,
    gcName,
    preparedBy: currentUser.name,
    roomUrl,
    roomQrSvg: sheetAssets.roomQrSvg,
  }

  function updateInput(sentOn: string, updateNumber: number) {
    return { ...letter, kind: 'update' as const, updateNumber, sentOn, sinceOn: lastUpdate ? calendarYmdInAppTzFromIso(lastUpdate.sentAt) : null, rows: gcRows, changes, line: sendLine }
  }

  /** Print the log: the log as it stands — no update number, nothing marked. */
  function printLog() {
    const today = toIsoDate(new Date())
    // A print counts as a send (docs/SENT_COPIES.md): the log as it printed is filed under the bid.
    printAndFile(buildProcurementUpdateHtml({ ...updateInput(today, updates.length + 1), kind: 'print', changes: [], line: '', sinceOn: null }), { kind: 'procurement_log', title: `Procurement log · ${bidLabel}`, recipientName: gcName ?? '', bidId })
  }

  /** v2.4113 · the log as a file: the printed sheet's columns, dates a sheet reads. */
  function downloadCsv() {
    const blob = new Blob([`\uFEFF${procurementLogCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = procurementLogFileName(bidLabel, toIsoDate(new Date()))
    a.click()
    URL.revokeObjectURL(url)
  }

  /** v2.4113 · copy the rows as tab-separated text, open a new Google Sheet, paste — the Cover Letter's copy-then-open shape. */
  async function openInGoogleSheets() {
    const text = procurementLogTsv(rows)
    let copied = false
    try {
      await navigator.clipboard.writeText(text)
      copied = true
    } catch {
      copied = false
    }
    openInExternalBrowser('https://sheets.new')
    showToast(copied ? 'Log copied — a new Google Sheet is opening; click cell A1 and paste.' : 'Could not copy; download the CSV instead and open it in Sheets.', copied ? 'success' : 'error')
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Update copied — paste it into your email to the GC.', 'success')
    } catch {
      showToast('Could not copy; the sheet is open to print.', 'info')
    }
  }

  async function sendAndRecord() {
    const today = toIsoDate(new Date())
    const input = updateInput(today, updates.length + 1)
    setSaving(true)
    try {
      const { error } = await supabase.from('bid_procurement_updates').insert({ bid_id: bidId, sent_by: currentUser.id, sent_by_name: currentUser.name, sent_to: sendTo.trim().slice(0, 300), line: sendLine.trim().slice(0, 1000), rows: snapshotRows(gcRows) as unknown as never, changes: changes as unknown as never })
      if (error) throw error
      await reloadUpdates()
      setSendOpen(false)
      setSendLine('')
      printAndFile(buildProcurementUpdateHtml(input), { kind: 'procurement_update', title: `Procurement update ${input.updateNumber} · ${bidLabel}`, recipientName: sendTo.trim() || (gcName ?? ''), bidId })
      await copyText(procurementUpdateText(input))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not record the update'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const disabled = busy || saving

  /** One line of the log; `underTag` drops the tag on a part line drawn under its tag's heading. */
  function renderRow(r: ProcurementRow, underTag: boolean, guides?: ReadonlyArray<TagGuide>) {
    const open = openLines.has(r.key)
    const status = lineStatus(r)
    const name = r.tag ?? r.product
    const { head, words } = splitPartLabel(r.product)
    const toggle = () => setOpenLines((cur) => { const next = new Set(cur); if (next.has(r.key)) next.delete(r.key); else next.add(r.key); return next })
    const part = (
      <>
        <span style={{ display: 'flex', gap: '0 0.4rem', alignItems: 'baseline', minWidth: 0, flexWrap: narrow ? 'wrap' : undefined }}>
          {underTag && r.partKey ? null : <b style={{ ...itemTag, flexShrink: 0, maxWidth: narrow ? '100%' : '45%' }}>{r.tag}</b>}
          <b className="procure-item-name" style={{ fontWeight: 600, color: 'var(--text-strong)', flexShrink: 0, maxWidth: '100%', overflowWrap: narrow ? 'anywhere' : undefined }}>{head}</b>
          {words ? <span style={{ ...smallMuted, fontSize: '0.78rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', minWidth: 0 }}>{words}</span> : null}
        </span>
        {(() => {
          // The quiet line under a part: what it replaced, where it came from, what else to know.
          const bits: Array<{ key: string; node: JSX.Element }> = []
          if (r.pricedLabel) bits.push({ key: 'priced', node: <span style={{ color: 'var(--text-blue-700)', fontWeight: 600 }} data-testid="procurement-priced">in place of the priced {splitPartLabel(r.pricedLabel).head}</span> })
          else if (r.addedByHand) bits.push({ key: 'hand', node: <span data-testid="procurement-added-by-hand">added by hand</span> })
          // Away from its fixture (To order, By house, a one-line fixture), a part names its assembly (2026-10-02).
          if (r.assembly && !guides?.length) bits.push({ key: 'assembly', node: <span data-testid="procurement-in-assembly">in {r.assembly}</span> })
          if (r.orderOnly && !underTag) bits.push({ key: 'oo', node: <span data-testid="procurement-order-only">order only, not on the GC’s copy</span> })
          // 2026-10-02 · a row the newest revision no longer holds: approved on an earlier one, still to order.
          if (r.standsOnRev != null) bits.push({ key: 'stands', node: <span data-testid="procurement-stands-on">{r.submittal === 'approved' ? `approved on Rev ${r.standsOnRev}` : `on Rev ${r.standsOnRev} · no call from the GC`}</span> })
          if (r.countedWith.length > 0) bits.push({ key: 'counted', node: <span data-testid="procurement-counted-with">counted with {r.countedWith.join(', ')} on the takeoff</span> })
          return bits.length > 0 ? (
            <span style={{ ...smallMuted, display: 'block' }}>
              {bits.map((b, i) => <Fragment key={b.key}>{i > 0 ? ' · ' : ''}{b.node}</Fragment>)}
            </span>
          ) : null
        })()}
      </>
    )
    const tick = <input type="checkbox" aria-label={`Pick ${r.tag ?? r.product}${r.partKey ? ` ${r.product}` : ''}`} checked={ticked.has(r.key)} onChange={(e) => setTicked((cur) => { const next = new Set(cur); if (e.target.checked) next.add(r.key); else next.delete(r.key); return next })} data-testid="procurement-tick" />
    const item = r.isHand ? (
      <input type="text" aria-label="Item" placeholder="What it is (no cut sheet)" value={draftOf(r.key, 'label', r.product)} onChange={(e) => setDraft(r.key, 'label', e.target.value)} onBlur={() => void commitText(r, 'label')} maxLength={200} style={{ ...inp, width: '100%' }} />
    ) : onOpenItem && r.itemId ? (
      // The line opens its row's Edit window: the house, lead time and stage are changed there (v2.4354).
      <button type="button" className="procure-item-open" onClick={() => onOpenItem({ itemId: r.itemId!, partKey: r.partKey ?? null })} title={`Open ${r.tag ?? 'the row'} to change ${r.partKey ? 'this part’s' : 'its'} house, lead time or stage`} data-testid="procurement-open-row">
        {part}
      </button>
    ) : (
      part
    )
    const qty = r.quantity != null ? r.quantity : <span style={smallMuted}>—</span>
    const houseText = r.supplyHouse ? <span className="procure-house-name">{r.supplyHouse}</span> : r.isHand ? <span style={smallMuted}>—</span> : <span className="procure-house-name" style={{ color: 'var(--text-amber-700)', fontSize: '0.78rem' }}>no house</span>
    // The house opens the row's Edit window on this part, its house box ready (Grace, 2026-10-02: swap a house).
    const house = onOpenItem && r.itemId ? (
      <button type="button" className="procure-item-open" onClick={() => onOpenItem({ itemId: r.itemId!, partKey: r.partKey ?? null, house: true })} title={`Change the house for ${r.partKey ? head : name}`} aria-label={`Change the house for ${name}${r.partKey ? ` ${head}` : ''}`} data-testid="procurement-house-open" style={narrow ? { display: 'inline', width: 'auto', margin: 0, padding: 0 } : undefined}>
        {houseText}
      </button>
    ) : (
      houseText
    )
    const stage = r.isHand && !r.stage ? (
      <select aria-label="Stage" value="" onChange={(e) => void write(r, { stage: (e.target.value || null) as ProcurementStage | null })} style={inp}>
        <option value="">stage…</option>
        {(['rough_in', 'top_out', 'trim_set'] as const).map((st) => <option key={st} value={st}>{PROCUREMENT_STAGE_LABELS[st]}</option>)}
      </select>
    ) : r.stage ? PROCUREMENT_STAGE_LABELS[r.stage] : <span style={smallMuted}>{narrow ? 'no stage' : '—'}</span>
    const lead = r.isHand ? (
      <input type="text" aria-label="Lead time" placeholder="2 wk" value={draftOf(r.key, 'lead', describeLeadTime(r.leadTimeDays) ?? '')} onChange={(e) => setDraft(r.key, 'lead', e.target.value)} onBlur={() => void commitText(r, 'lead')} style={{ ...inp, width: '4.6rem' }} />
    ) : (
      describeLeadTime(r.leadTimeDays) ?? <span style={smallMuted}>{narrow ? 'no lead time' : '—'}</span>
    )
    // One status where seven date columns were (2026-10-02); a tap opens the line's dates.
    const statusButton = (
      <button type="button" className="procure-status" aria-expanded={open} aria-label={`${name}${r.partKey ? ` ${head}` : ''} dates`} onClick={toggle} data-testid="procurement-status" data-tone={status.tone}>
        {status.text ? (
          <span style={{ display: 'block', fontWeight: 600, color: STATUS_COLOR[status.tone] }}>{status.text}</span>
        ) : (
          <span style={{ display: 'block', color: 'var(--text-faint)' }}>{open ? 'Close' : 'Dates…'}</span>
        )}
        {status.sub ? <span style={{ ...smallMuted, display: 'block' }}>{status.sub}</span> : null}
      </button>
    )
    // A line the GC's answer still holds: the door to the window that records it, under the status (2026-10-02).
    const door = onAnswerItem && r.itemId ? answerDoor(r) : null
    const answerButton = door ? (
      <button type="button" onClick={() => onAnswerItem!({ itemId: r.itemId!, partKey: r.partKey ?? null })} disabled={busy} title="Record what they said about this part. Nobody is emailed." aria-label={`${door === 'enter' ? 'Enter' : 'Change'} their answer on ${name}${r.partKey ? ` ${head}` : ''}`} style={{ ...link, display: 'block', marginTop: '0.2rem', textAlign: 'left' }} data-testid="procurement-answer-door" data-door={door}>
        {ANSWER_DOOR_WORDS[door]}
      </button>
    ) : null
    const remove = r.isHand ? <button type="button" onClick={() => void removeHandRow(r)} disabled={disabled} title="Remove this item" aria-label={`Remove ${r.product || 'item'}`} style={{ ...link, color: 'var(--text-red-600)', textDecoration: 'none', fontSize: '0.95rem' }}>×</button> : null
    const editor = (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1.1rem', alignItems: 'flex-start' }}>
                <div style={editorField}>
                  <span style={editorLabel}>Ordered</span>
                  {dateCell(r, 'ordered_on', r.orderedOn, { label: `${name} ordered on`, disabled: busy })}
                </div>
                <label style={editorField}>
                  <span style={editorLabel}>PO</span>
                  <input type="text" aria-label={`${name} PO`} placeholder="PO" value={draftOf(r.key, 'po', r.poRef)} onChange={(e) => setDraft(r.key, 'po', e.target.value)} onBlur={() => void commitText(r, 'po')} maxLength={60} style={{ ...inp, width: '8rem' }} />
                </label>
                <div style={editorField}>
                  <span style={editorLabel}>Expected</span>
                  {dateCell(r, 'expected_on', r.expectedOn, {
                    label: `${name} expected on`,
                    title: r.expectedSource === 'derived' ? `${shortDate(r.orderedOn)} + ${describeLeadTime(r.leadTimeDays)}; type the house's own date to override` : r.expectedSource === 'house' ? "The house's date; clear it to go back to ordered + lead time" : 'Order date + lead time, or the house’s own date',
                    disabled: busy || !!r.deliveredOn,
                    background: r.expectedSource === 'house' ? 'var(--bg-amber-100)' : r.expectedSource === 'derived' ? 'var(--bg-muted)' : 'var(--surface)',
                    under: r.expectedSource === 'house' ? 'house said' : null,
                    empty: r.deliveredOn ? '—' : undefined,
                  })}
                </div>
                <div style={editorField}>
                  <span style={editorLabel}>Delivered</span>
                  {dateCell(r, 'delivered_on', r.deliveredOn, { label: `${name} delivered on`, disabled: busy })}
                </div>
                <label style={{ ...editorField, flex: '1 1 14rem' }}>
                  <span style={editorLabel}>Note for the GC</span>
                  <input type="text" aria-label={`${name} note`} placeholder="note for the GC" value={draftOf(r.key, 'note', r.note)} onChange={(e) => setDraft(r.key, 'note', e.target.value)} onBlur={() => void commitText(r, 'note')} maxLength={500} style={{ ...inp, width: '100%' }} />
                </label>
                <div style={{ ...editorField, gap: '0.15rem' }}>
                  <span style={editorLabel}>The GC and the job</span>
                  <span style={{ fontSize: '0.78rem' }}>{submittalWord(r)}{r.releasedOn ? ` · released ${shortDate(r.releasedOn)}` : ''}</span>
                  <span style={{ fontSize: '0.78rem' }}>
                    {r.requiredOn ? `Needed ${shortDate(r.requiredOn)} · ` : 'No required date · '}
                    <span data-testid="procurement-float" style={{ fontWeight: r.late ? 700 : 500, color: r.late ? 'var(--text-red-700)' : r.deliveredOn || r.floatDays != null ? 'var(--text-green-700)' : 'var(--text-muted)' }}>{floatText(r) || 'no float yet'}</span>
                  </span>
                </div>
              </div>
    )
    const lineBackground = ticked.has(r.key) ? 'var(--bg-blue-tint)' : undefined
    if (narrow) {
      // 2026-10-02 · on a phone each part is a short card: nothing scrolls sideways.
      return (
        <Fragment key={r.key}>
          <div data-testid="procurement-row" data-part={r.partKey ? 'true' : undefined} data-order-only={r.orderOnly ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr)', gap: '0.15rem 0.5rem', alignItems: 'start', padding: '0.55rem 0.35rem', borderBottom: '1px solid var(--bg-muted)', background: lineBackground, opacity: r.orderOnly ? 0.72 : undefined }}>
            <span style={{ paddingTop: '0.15rem' }}>{tick}</span>
            {/* On a card the tree is the indent alone: a part a step in under its fixture or assembly. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0, paddingLeft: guides && guides.length > 0 ? `${(guides.length - 1) * 0.9 + 0.6}rem` : undefined, borderLeft: guides && guides.length > 0 ? '2px solid var(--border)' : undefined }}>
              <div data-testid="procurement-item" data-level={guides?.length ?? undefined} title={r.product} style={{ lineHeight: 1.35, minWidth: 0 }}>{item}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.1rem 0.45rem', alignItems: 'center', fontSize: '0.8rem' }}>
                <b data-testid="procurement-qty">{qty}</b>
                <span aria-hidden="true" style={smallMuted}>·</span>
                <span data-testid="procurement-house">{house}</span>
                <span aria-hidden="true" style={smallMuted}>·</span>
                <span data-testid="procurement-stage">{stage}</span>
                <span aria-hidden="true" style={smallMuted}>·</span>
                <span>{lead}</span>
                {remove}
              </div>
              {statusButton}
              {answerButton}
            </div>
          </div>
          {open ? (
            <div data-testid="procurement-editor" style={{ background: 'var(--bg-blue-tint)', padding: '0.55rem 0.6rem 0.65rem', borderBottom: '1px solid var(--bg-muted)' }}>
              {editor}
            </div>
          ) : null}
        </Fragment>
      )
    }
    return (
      <Fragment key={r.key}>
        <tr data-testid="procurement-row" data-part={r.partKey ? 'true' : undefined} data-order-only={r.orderOnly ? 'true' : undefined} style={{ background: lineBackground, opacity: r.orderOnly ? 0.72 : undefined }}>
          <td style={{ ...td, width: 28, textAlign: 'center' }}>{tick}</td>
          <td style={{ ...itemTd, ...(guides && guides.length > 0 ? { position: 'relative', paddingLeft: indentPad(guides) } : underTag && r.partKey ? { paddingLeft: '1.2rem' } : null) }} data-testid="procurement-item" data-level={guides?.length ?? undefined} title={r.product}>
            {guides && guides.length > 0 ? <Rails guides={guides} /> : null}
            {item}
          </td>
          <td style={{ ...tdCenter, fontWeight: 600 }} data-testid="procurement-qty">{qty}</td>
          <td style={{ ...td, whiteSpace: 'nowrap' }} data-testid="procurement-house">{house}</td>
          <td style={{ ...td, whiteSpace: 'nowrap' }} data-testid="procurement-stage">{stage}</td>
          <td style={{ ...td, whiteSpace: 'nowrap' }}>{lead}</td>
          <td style={{ ...td, minWidth: '12.5rem', width: '13.5rem' }}>
            {statusButton}
            {answerButton}
          </td>
          <td style={{ ...td, whiteSpace: 'nowrap' }}>{remove}</td>
        </tr>
        {open ? (
          <tr data-testid="procurement-editor">
            {guides && guides.length > 0 ? <td style={{ ...td, width: 28, background: 'var(--bg-blue-tint)' }} /> : null}
            <td colSpan={guides && guides.length > 0 ? COLS - 1 : COLS} style={{ ...td, background: 'var(--bg-blue-tint)', padding: '0.5rem 0.6rem 0.6rem 2.2rem', ...(guides && guides.length > 0 ? { position: 'relative', paddingLeft: indentPad(guides) } : null) }}>
              {guides && guides.length > 0 ? <Rails guides={guides} through /> : null}
              {editor}
            </td>
          </tr>
        ) : null}
      </Fragment>
    )
  }


  return (
    <div ref={rootRef} data-testid="submittal-procurement" data-tour="submittals-procure" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem 0.75rem', flexWrap: 'wrap', alignItems: 'center' }} data-testid="procurement-top">
        <b style={{ fontSize: '0.9rem' }}>Procurement log</b>
        <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
          <span style={smallMuted} data-testid="procurement-last-update">
            {lastUpdate ? `Last update ${shortDate(calendarYmdInAppTzFromIso(lastUpdate.sentAt))}${lastUpdate.sentTo ? ` to ${lastUpdate.sentTo}` : ''}` : 'No update sent yet. The first one sends every row.'}
          </span>
          <button type="button" onClick={() => { setSendTo((t) => t || reviewerNames.join(', ')); setSendOpen((v) => !v) }} disabled={disabled || rows.length === 0} style={btnPrimary} data-testid="procurement-send">{sendUpdateLabel(lastUpdate != null, changes.length)}</button>
          <button type="button" onClick={() => void addHandRow()} disabled={disabled} style={btn}>+ Add item</button>
          <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More" title="Print, CSV, Google Sheets, updates sent" onClick={() => setMenuOpen((v) => !v)} onKeyDown={(e) => { if (e.key === 'Escape' && menuOpen) { e.stopPropagation(); setMenuOpen(false) } }} style={{ ...btn, padding: '0.35rem 0.6rem', fontWeight: 700 }} data-testid="procurement-more">⋯</button>
          {menuOpen ? (
            <>
              {/* A press anywhere else closes the menu. */}
              <span aria-hidden="true" onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <span role="menu" aria-label="More for the log" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setMenuOpen(false) } }} style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 21, display: 'flex', flexDirection: 'column', minWidth: '13rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, boxShadow: '0 6px 18px rgba(0, 0, 0, 0.14)', padding: '0.25rem' }} data-testid="procurement-menu">
                {([
                  ['Print the log', printLog, rows.length === 0, undefined, 'procurement-print'],
                  ['Download CSV', downloadCsv, rows.length === 0, 'The log as a .csv file, one row per item, dates a spreadsheet reads', 'procurement-csv'],
                  ['Open in Google Sheets', () => void openInGoogleSheets(), rows.length === 0, 'Copies the log and opens a new Google Sheet; click A1 and paste', 'procurement-sheets'],
                  [`Updates sent (${updates.length})`, () => setUpdatesOpen((v) => !v), false, undefined, 'procurement-updates-open'],
                ] as const).map(([label, run, off, title, testid]) => (
                  <button key={testid} type="button" role="menuitem" disabled={off} title={title} onClick={() => { setMenuOpen(false); run() }} style={{ ...btn, border: 'none', textAlign: 'left', padding: '0.4rem 0.6rem' }} data-testid={testid}>{label}</button>
                ))}
              </span>
            </>
          ) : null}
        </span>
      </div>

      {sendOpen ? (
        <div style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-amber-100)', borderRadius: 6, padding: '0.55rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="procurement-send-card">
          <b style={{ fontSize: '0.85rem' }}>Procurement log update {updates.length + 1} · {shortDate(toIsoDate(new Date()))}</b>
          <div style={smallMuted}>{lastUpdate ? `Since ${shortDate(calendarYmdInAppTzFromIso(lastUpdate.sentAt))}: ${changes.length} ${changes.length === 1 ? 'row' : 'rows'} changed` : 'First update: every row goes.'}</div>
          {changes.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem' }} data-testid="procurement-changes">
              {changes.map((c) => <li key={c.key}><b>{c.tag ?? c.product}</b>{c.tag ? ` ${c.product}` : ''}: {c.text}</li>)}
            </ul>
          ) : lastUpdate ? <span style={smallMuted}>Nothing has changed since the last update; the sheet goes out as it stands.</span> : null}
          <label style={{ fontSize: '0.8125rem' }}>
            To <input type="text" value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="who gets it (for the record)" maxLength={300} style={{ ...inp, width: 'min(100%, 28rem)', marginLeft: 6 }} />
          </label>
          <textarea aria-label="A line for the GC" value={sendLine} onChange={(e) => setSendLine(e.target.value)} rows={2} maxLength={1000} placeholder="A line for the GC (optional) — e.g. BFP-1: can Rough In wait for the RPZ, or do we stub and set it later?" style={{ ...inp, width: '100%', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => void sendAndRecord()} disabled={disabled} style={btnPrimary} data-testid="procurement-record">Record, print and copy</button>
            <button type="button" onClick={() => setSendOpen(false)} style={link}>Cancel</button>
            <span style={smallMuted}>Records the update, opens the sheet to print or save as PDF, and copies the text to paste into your email.</span>
          </div>
        </div>
      ) : null}

      {updatesOpen ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }} data-testid="procurement-updates">
          {updates.length === 0 ? <span style={smallMuted}>No update sent yet.</span> : null}
          {updates.map((u, i) => (
            <div key={u.id} style={{ fontSize: '0.8125rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <b>Update {updates.length - i}</b>
              <span>{shortDate(calendarYmdInAppTzFromIso(u.sentAt))}</span>
              {u.sentTo ? <span style={smallMuted}>to {u.sentTo}</span> : null}
              {u.sentByName ? <span style={smallMuted}>by {u.sentByName}</span> : null}
              <span style={smallMuted}>{u.changes.length} {u.changes.length === 1 ? 'change' : 'changes'}</span>
              {u.line ? <span style={{ ...smallMuted, fontStyle: 'italic' }}>“{u.line}”</span> : null}
              <button type="button" onClick={() => printAndFile(buildProcurementUpdateHtml({ ...letter, kind: 'update', updateNumber: updates.length - i, sentOn: calendarYmdInAppTzFromIso(u.sentAt), sinceOn: updates[i + 1] ? calendarYmdInAppTzFromIso(updates[i + 1]!.sentAt) : null, rows: rowsFromSnapshot(u.rows), changes: u.changes, line: u.line }), { kind: 'procurement_update', title: `Procurement update ${updates.length - i} · ${bidLabel}, printed again`, recipientName: u.sentTo ?? '', bidId })} style={link}>Open</button>
            </div>
          ))}
        </div>
      ) : null}

      {loaded ? (
        <>
          {/* v2.4581 · where every part stands, each line counted once; a step pressed shows only its lines. */}
          <div role="group" aria-label="Where the parts stand" style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '0.4rem' }} data-testid="procurement-steps">
            {steps.map((st, i) => (
              <button key={st.key} type="button" aria-pressed={stepPicked === st.key} title={stepPicked === st.key ? 'Show every line again' : `Show only the lines ${st.key === 'gc' ? 'waiting on the GC' : st.label.toLowerCase()}`} onClick={() => pickStep(st.key)} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', padding: '0.45rem 0.7rem', border: `1px solid ${stepPicked === st.key ? '#2563eb' : 'var(--border)'}`, borderRadius: 8, background: stepPicked === st.key ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-base)', font: 'inherit', textAlign: 'left', cursor: 'pointer', minWidth: 0 }} data-testid={`procurement-step-${st.key}`}>
                {i > 0 && !narrow ? <span aria-hidden="true" style={{ position: 'absolute', left: '-0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem', pointerEvents: 'none' }}>›</span> : null}
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>{st.label}</span>
                <b style={{ fontSize: '1.35rem', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: st.count === 0 ? 'var(--text-muted)' : 'var(--text-strong)', fontWeight: st.count === 0 ? 500 : 700 }}>{st.count}</b>
                <span style={{ fontSize: '0.75rem', minHeight: '1.1em', color: STEP_TONE_COLOR[st.tone], fontWeight: st.tone === 'quiet' ? 400 : 600 }}>{st.note}</span>
              </button>
            ))}
          </div>
          <div aria-hidden="true" title={`${steps[3]?.count ?? 0} of ${rows.length} part${rows.length === 1 ? '' : 's'} on site`} style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--bg-muted)' }} data-testid="procurement-share">
            {stepShares(steps).map((sh) => <span key={sh.key} style={{ width: `${sh.percent}%`, background: STEP_SHARE_COLOR[sh.key] }} />)}
          </div>
          {rows.length > 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }} data-testid="procurement-next">
              <b>Next:</b> {procurementNextLine(rows, today).join(' ')}
              {onEnterApproval ? (
                <>
                  {' '}<span style={smallMuted}>Approved outside the app?</span>{' '}
                  <button type="button" disabled={busy} onClick={onEnterApproval} style={link} data-testid="procurement-enter-approval">Enter their approval…</button>
                </>
              ) : null}
            </div>
          ) : null}
        </>
      ) : <span style={smallMuted}>Reading…</span>}

      {loaded && logIsDraft(rows) ? (
        // 2026-10-02 · said once, not "Not shared" on every line.
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-strong)', background: 'var(--bg-muted)', borderRadius: 6, padding: '0.4rem 0.6rem' }} data-testid="procurement-draft">
          This version is a draft, so nothing is released yet. The GC releases each part when they approve it.{rows.some((r) => r.noGc) ? ' Order-only fixtures wait for nobody: they are ready to order now.' : ''}
        </div>
      ) : null}

      {loaded && (blockers.noLead.length > 0 || blockers.noHouse.length > 0 || blockers.noStage.length > 0 || blockers.noProduct.length > 0) ? (() => {
        // v2.4581 · one line, not a box: grey until a part that can be ordered lacks a lead time or a stage.
        const press = blockersPress(rows, blockers)
        const kinds = ([
          ['lead', blockers.noLead],
          ['house', blockers.noHouse],
          ['stage', blockers.noStage],
        ] as const).filter(([, keys]) => keys.length > 0)
        const item: CSSProperties = { display: 'inline-flex', gap: '0.4rem', alignItems: 'baseline', fontSize: '0.8125rem' }
        const setBtn: CSSProperties = { ...link, fontSize: '0.8125rem', fontWeight: 700 }
        const setterKeys = setter ? (setter === 'lead' ? blockers.noLead : setter === 'house' ? blockers.noHouse : blockers.noStage) : []
        const n = setterKeys.length
        return (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 1rem', alignItems: 'baseline', padding: '0.4rem 0.7rem', background: press ? 'var(--bg-amber-tint)' : 'var(--bg-muted)', borderLeft: `3px solid ${press ? 'var(--text-amber-700)' : 'var(--border-strong)'}`, borderRadius: 4 }} data-testid="procurement-blockers" data-press={press ? 'true' : undefined}>
              <b style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>Before you can order</b>
              {!hasStageDates ? (
                <span style={item} data-testid="procurement-blocker-dates">
                  <span>{jobId ? 'The job has no stage dates' : 'The bid is not a job yet, so no part has a needed date'}</span>
                  {jobId ? <Link to={jobWindowHref(jobId)} style={setBtn}>Open the job</Link> : null}
                </span>
              ) : null}
              {kinds.map(([k, keys]) => {
                const count = keys.length
                const on = only === k
                return (
                  <span key={k} style={item} data-testid={`procurement-blocker-${k}`}>
                    <span>
                      {/* The count is the link: it shows which parts these are. */}
                      <button type="button" aria-pressed={on} aria-label={on ? 'Show every line' : `Show the ${count === 1 ? 'part' : `${count} parts`} with ${BLOCKER_WORDS[k]}`} title={on ? 'Show every line again' : `See which ${count === 1 ? 'part this is' : `${count} parts these are`}`} onClick={() => showOnly(on ? null : k)} style={blockerLink} data-testid={`procurement-blocker-show-${k}`}>{count} part{count === 1 ? '' : 's'}</button>
                      {' '}{count === 1 ? 'has' : 'have'} {BLOCKER_WORDS[k]}
                    </span>
                    <button type="button" aria-expanded={setter === k} onClick={() => { setSetterValue(''); setSetter((cur) => (cur === k ? null : k)) }} style={setBtn} data-testid={`procurement-blocker-set-${k}`}>Set…</button>
                  </span>
                )
              })}
              {blockers.noProduct.map((p) => (
                <span key={p.key} style={item} data-testid="procurement-blocker-product">
                  <span><b>{p.tag}</b> has no product</span>
                  {onOpenItem && p.itemId ? <button type="button" onClick={() => onOpenItem({ itemId: p.itemId!, partKey: null })} style={setBtn}>Open it</button> : null}
                </span>
              ))}
              <span style={{ ...smallMuted, flexBasis: '100%' }}>Without a lead time and a stage, the log cannot say when to order a part or when the GC must answer.</span>
            </div>
            {setter && n > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', padding: '0.45rem 0.7rem', border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', borderRadius: 6 }} data-testid="procurement-setter">
                <b style={{ fontSize: '0.8125rem', color: 'var(--text-blue-700)' }}>{setter === 'lead' ? 'Lead time' : setter === 'house' ? 'House' : 'Stage'} for {n} part{n === 1 ? '' : 's'}</b>
                {setter === 'lead' ? (
                  <input type="text" aria-label="Lead time" placeholder="3 wk" autoFocus value={setterValue} onChange={(e) => setSetterValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void setOnBlocker('lead') }} style={{ ...inp, width: '6rem' }} />
                ) : setter === 'house' ? (
                  <select aria-label="House" value={setterValue} onChange={(e) => setSetterValue(e.target.value)} style={{ ...inp, maxWidth: '14rem' }}>
                    <option value="">pick a house</option>
                    {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                ) : (
                  <span role="group" aria-label="Stage" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
                    {(['rough_in', 'top_out', 'trim_set'] as const).map((sk, i) => (
                      <button key={sk} type="button" aria-pressed={setterValue === sk} onClick={() => setSetterValue(sk)} style={{ padding: '0.25rem 0.7rem', border: 'none', borderLeft: i > 0 ? '1px solid var(--border-strong)' : 'none', font: 'inherit', fontSize: '0.8rem', fontWeight: setterValue === sk ? 700 : 500, cursor: 'pointer', background: setterValue === sk ? '#2563eb' : 'var(--surface)', color: setterValue === sk ? 'white' : 'var(--text-base)' }}>{PROCUREMENT_STAGE_LABELS[sk]}</button>
                    ))}
                  </span>
                )}
                <button type="button" disabled={disabled || !setterValue.trim()} onClick={() => void setOnBlocker(setter)} style={btnPrimary} data-testid="procurement-setter-set">Set on {n}</button>
                <button type="button" onClick={() => setSetter(null)} style={link}>Cancel</button>
                <span style={smallMuted}>Or tick lines below to set them a few at a time.</span>
              </div>
            ) : null}
          </>
        )
      })() : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Show the log" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} data-testid="procurement-lens">
          {(Object.keys(LENS_WORDS) as ProcurementLens[]).map((k, i) => (
            <button key={k} type="button" aria-pressed={lens === k} onClick={() => setLens(k)} style={{ padding: '0.3rem 0.8rem', minHeight: 34, border: 'none', borderLeft: i > 0 ? '1px solid var(--border-strong)' : 'none', font: 'inherit', fontSize: '0.8rem', fontWeight: lens === k ? 700 : 500, cursor: 'pointer', background: lens === k ? '#2563eb' : 'var(--surface)', color: lens === k ? 'white' : 'var(--text-base)' }}>
              {LENS_WORDS[k]}
            </button>
          ))}
        </div>
        {loaded && sharedHouse(rows) ? <span style={smallMuted} data-testid="procurement-shared">Every part comes from {sharedHouse(rows)}.</span> : null}
      </div>

      {ticked.size > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem 0.75rem', alignItems: 'center', padding: '0.5rem 0.7rem', border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', borderRadius: 6 }} data-testid="procurement-bulk">
          <b style={{ fontSize: '0.8125rem', color: 'var(--text-blue-700)' }}>{ticked.size} line{ticked.size === 1 ? '' : 's'} ticked</b>
          {/* 2026-10-02 · set the office's facts on every ticked line: one house, one lead time, one stage. */}
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.4rem 0.6rem', alignItems: 'center', width: '100%' }} data-testid="procurement-bulk-facts">
            <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
              House
              <select aria-label="House, for every ticked line" value={bulkHouse} onChange={(e) => setBulkHouse(e.target.value)} style={{ ...inp, maxWidth: '12rem' }}>
                <option value="">keep</option>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
              Lead time
              <input type="text" aria-label="Lead time, for every ticked line" placeholder="3 wk" value={bulkLead} onChange={(e) => setBulkLead(e.target.value)} style={{ ...inp, width: '5rem' }} />
            </label>
            <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
              Stage
              <select aria-label="Stage, for every ticked line" value={bulkStage} onChange={(e) => setBulkStage(e.target.value)} style={inp}>
                <option value="">keep</option>
                {(['rough_in', 'top_out', 'trim_set'] as const).map((st) => <option key={st} value={st}>{PROCUREMENT_STAGE_LABELS[st]}</option>)}
              </select>
            </label>
            <button type="button" disabled={disabled || (!bulkHouse && !bulkLead.trim() && !bulkStage)} onClick={() => void setTickedFacts()} style={btnPrimary} data-testid="procurement-bulk-set">Set on {ticked.size} line{ticked.size === 1 ? '' : 's'}</button>
          </span>
          <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
            Ordered
            <input type="text" aria-label="Ordered on, for every ticked line" placeholder={logDateRead(today, today)} value={bulkOrdered} onChange={(e) => setBulkOrdered(e.target.value)} style={{ ...inp, width: '4.6rem', textAlign: 'center' }} />
          </label>
          <label style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center', fontSize: '0.8rem' }}>
            PO
            <input type="text" aria-label="PO, for every ticked line" placeholder="PO number" value={bulkPo} onChange={(e) => setBulkPo(e.target.value)} maxLength={60} style={{ ...inp, width: '8rem' }} />
          </label>
          <span style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <button type="button" disabled={disabled} onClick={() => setTicked(new Set())} style={btn}>Clear</button>
            <button type="button" disabled={disabled} onClick={() => void markTicked('delivered_on')} style={btn} data-testid="procurement-bulk-delivered">Mark {ticked.size} delivered today</button>
            <button type="button" disabled={disabled} onClick={() => void markTicked('ordered_on')} style={btnPrimary} data-testid="procurement-bulk-ordered">Mark {ticked.size} ordered</button>
          </span>
        </div>
      ) : null}

      {stepPicked ? (
        // v2.4581 · the log is showing one step's lines only.
        <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', padding: '0.4rem 0.7rem', border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-strong)' }} data-testid="procurement-only">
          <span><b>{stepOnlyWords(stepPicked, shown.rows.length).lead}</b> {stepOnlyWords(stepPicked, shown.rows.length).rest}</span>
          <button type="button" onClick={() => setStepPicked(null)} style={{ ...btn, flexShrink: 0 }}>Show every line</button>
        </div>
      ) : only ? (
        // 2026-10-02 · the log is showing one blocker's lines only; this says so, and brings the rest back.
        <div ref={onlyRef} role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: 'wrap', padding: '0.4rem 0.7rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--text-strong)' }} data-testid="procurement-only">
          <span><b>{shown.rows.length} part{shown.rows.length === 1 ? '' : 's'} with {BLOCKER_WORDS[only]}.</b> The other lines are hidden.</span>
          <button type="button" onClick={() => showOnly(null)} style={{ ...btn, flexShrink: 0 }}>Show every line</button>
        </div>
      ) : null}

      {(() => {
        // A heading, a divider or a house's fold: a table row on a wide screen, a block on a phone.
        const block = (key: string, testid: string, style: CSSProperties, content: ReactNode) =>
          narrow ? (
            <div key={key} data-testid={testid} style={{ padding: '0.4rem 0.35rem', borderBottom: '1px solid var(--bg-muted)', ...style }}>{content}</div>
          ) : (
            <tr key={key} data-testid={testid}><td colSpan={COLS} style={{ ...td, padding: '0.4rem 0.4rem', ...style }}>{content}</td></tr>
          )
        // A row inside a By tag tree (an assembly's name, a block's divider): it starts at the Part column so the connectors line up.
        const treeRow = (key: string, testid: string, guides: ReadonlyArray<TagGuide>, through: boolean, style: CSSProperties, content: ReactNode, first: ReactNode = null) =>
          narrow ? (
            <div key={key} data-testid={testid} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.35rem 0.35rem', paddingLeft: `calc(0.35rem + ${first ? 0 : 28}px + ${guides.length > 0 ? (guides.length - 1) * 0.9 + 0.6 : 0}rem)`, borderBottom: '1px solid var(--bg-muted)', ...style }}>{first}{content}</div>
          ) : (
            <tr key={key} data-testid={testid}>
              <td style={{ ...td, width: 28, textAlign: 'center', padding: style.padding ?? td.padding }}>{first}</td>
              <td colSpan={COLS - 1} style={{ ...td, position: 'relative', ...style, paddingLeft: indentPad(guides) }}>
                <Rails guides={guides} through={through} />
                {content}
              </td>
            </tr>
          )
        const tickAll = (keys: string[], label: string) => (
          <input type="checkbox" aria-label={label} checked={keys.length > 0 && keys.every((k) => ticked.has(k))} onChange={(e) => setTicked((cur) => { const next = new Set(cur); for (const k of keys) { if (e.target.checked) next.add(k); else next.delete(k) } return next })} />
        )
        const body = (
          <>
            {rows.length === 0 ? block('empty', 'procurement-empty', {}, <span style={smallMuted}>No rows yet. The submittal's rows appear here once a revision is shared; + Add item for a long-lead item with no cut sheet.</span>) : null}
            {sections.map((sec) => {
              // By tag, a tag with one line needs no heading of its own.
              const heading = lens !== 'by_tag' || sec.rows.length > 1 || (sec.rows[0]?.isHand ?? false)
              const keys = sec.rows.map((r) => r.key)
              // 2026-10-02 · To order folds the lines waiting on the GC to one line per house; a blocker's short list is never folded.
              const folds = lens === 'to_order' && sec.key === 'waiting' && !only && !stepPicked ? foldByHouse(sec.rows) : null
              // By tag, a fixture's lines as a tree: its parts one step in, an assembly's own step only when it mixes (v2.4384).
              const tree = lens === 'by_tag' && heading ? tagBlock(sec.rows) : null
              return (
                <Fragment key={sec.key}>
                  {heading
                    ? block(`${sec.key}:head`, 'procurement-section', { background: 'var(--bg-subtle)' }, (
                        <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', flexWrap: 'wrap' }}>
                          {tickAll(keys, `Pick every line under ${sec.title}`)}
                          <b style={{ color: 'var(--text-strong)' }}>{sec.title}</b>
                          <span style={smallMuted}>{sec.note}</span>
                          {tree?.from && !tree.single ? <span style={{ ...smallMuted, color: 'var(--text-base)' }} data-testid="procurement-section-from">from {tree.from}</span> : null}
                          {sec.warn ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-amber-700)', background: 'var(--bg-amber-100)', borderRadius: 999, padding: '0.05rem 0.5rem' }} data-testid="procurement-section-warn">{sec.warn}</span> : null}
                        </label>
                      ))
                    : null}
                  {tree
                    ? tree.lines.map((l) => {
                        if (l.kind === 'assembly') {
                          return treeRow(l.key, 'procurement-assembly', l.guides, false, { fontSize: '0.8rem' }, (
                            <span><b style={{ color: 'var(--text-strong)' }}>{l.name}</b> <span style={smallMuted}>· {l.keys.length} part{l.keys.length === 1 ? '' : 's'}</span></span>
                          ), tickAll(l.keys, `Pick every part of ${l.name}`))
                        }
                        return (
                          <Fragment key={l.row.key}>
                            {l.orderOnlyStarts
                              ? treeRow(`${l.row.key}:oo`, 'procurement-order-only-divider', l.guides, true, { padding: '0.25rem 0.4rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }, <>Ordered, not on the GC’s copy · {l.orderOnlyCount} part{l.orderOnlyCount === 1 ? '' : 's'}</>)
                              : null}
                            {renderRow(l.row, true, l.guides)}
                          </Fragment>
                        )
                      })
                    : folds
                    ? folds.map((f) => {
                        const fopen = openHouses.has(f.key)
                        const fkeys = f.rows.map((r) => r.key)
                        return (
                          <Fragment key={f.key}>
                            {block(f.key, 'procurement-house-fold', {}, (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: narrow ? 0 : '1.2rem' }}>
                                {tickAll(fkeys, `Pick every line at ${f.house ?? 'no house yet'}`)}
                                <button type="button" className="procure-fold" aria-expanded={fopen} onClick={() => setOpenHouses((cur) => { const next = new Set(cur); if (next.has(f.key)) next.delete(f.key); else next.add(f.key); return next })}>
                                  <b style={{ color: f.house ? 'var(--text-strong)' : 'var(--text-amber-700)' }}>{f.house ?? 'No house yet'}</b>
                                  <span style={smallMuted}>{houseFoldNote(f)}</span>
                                  <span aria-hidden="true" style={{ ...smallMuted, marginLeft: 'auto' }}>{fopen ? 'Hide' : 'Show'}</span>
                                </button>
                              </span>
                            ))}
                            {fopen ? f.rows.map((r) => renderRow(r, false)) : null}
                          </Fragment>
                        )
                      })
                    : sec.rows.map((r, i) => (
                        <Fragment key={r.key}>
                          {sec.orderOnlyFrom != null && i === sec.orderOnlyFrom
                            ? block(`${sec.key}:oo`, 'procurement-order-only-divider', { padding: narrow ? '0.3rem 0.35rem' : '0.25rem 0.4rem 0.25rem 2.2rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }, <>Ordered, not on the GC’s copy · {sec.rows.length - sec.orderOnlyFrom} part{sec.rows.length - sec.orderOnlyFrom === 1 ? '' : 's'}</>)
                            : null}
                          {renderRow(r, lens === 'by_tag' && heading)}
                        </Fragment>
                      ))}
                </Fragment>
              )
            })}
          </>
        )
        return narrow ? (
          <div data-testid="procurement-rows" style={{ borderTop: '1px solid var(--border)' }}>{body}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: TABLE_MIN_WIDTH, fontVariantNumeric: 'tabular-nums' }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 28 }} aria-label="Pick" />
                  <th style={th}>Part</th>
                  <th style={thCenter}>Qty</th>
                  <th style={th}>House</th>
                  <th style={th}>Stage</th>
                  <th style={th}>Lead</th>
                  <th style={th}>Status</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody data-testid="procurement-rows">{body}</tbody>
            </table>
          </div>
        )
      })()}
      <div style={smallMuted}>
        Tap a status to type its dates. Released = the room's approval. Expected = ordered + lead time until the house says otherwise (amber). Needed = the stage's window on the job. <b>Order by</b> = needed − lead time for a released part not yet ordered.
      </div>

    </div>
  )
}

/** A sent update's rows, back into the shape the sheet prints (statuses and dates as they were). */
function rowsFromSnapshot(snap: ProcurementUpdate['rows']): ProcurementRow[] {
  return snap.map((s) => ({
    key: s.key,
    tag: s.tag,
    isHand: s.tag == null,
    recordId: null,
    countedWith: [],
    product: s.product,
    supplyHouse: null,
    stage: null,
    submittal: s.releasedOn ? 'approved' : s.status === 'sent_back' ? 'revise' : s.status === 'awaiting' ? 'open' : 'none',
    submittalAt: s.releasedOn,
    releasedOn: s.releasedOn,
    orderedOn: s.orderedOn,
    poRef: s.poRef,
    leadTimeDays: null,
    expectedOn: s.expectedOn,
    expectedSource: s.expectedSource,
    requiredOn: s.requiredOn,
    floatDays: s.floatDays,
    orderBy: null,
    deliveredOn: s.deliveredOn,
    note: s.note,
    status: s.status,
    late: s.floatDays != null && s.floatDays < 0,
  }))
}
