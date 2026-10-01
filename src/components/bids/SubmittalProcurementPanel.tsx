import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { procurementLogCsv, procurementLogFileName, procurementLogTsv } from '../../lib/submittals/procurementLogExport'
import { loadProcurementSheetAssets, type ProcurementSheetAssets } from '../../lib/submittals/procurementSheetAssets'
import { describeLeadTime, parseLeadTime } from '../../lib/submittals/leadTime'
import { isPlausibleDate, readDateBoxEntry } from '../../lib/dateBoxEntry'
import {
  buildProcurementLog,
  buildProcurementUpdateHtml,
  diffProcurementLog,
  floatText,
  gcProcurementRows,
  procurementSections,
  PROCUREMENT_STAGE_LABELS,
  procurementCounts,
  procurementHeadline,
  procurementUpdateText,
  logDateRead,
  readTypedLogDate,
  shortDate,
  daysAgoWords,
  snapshotRows,

  submittalWord,
  toIsoDate,
  type ProcurementItemSource,
  type ProcurementLens,
  type ProcurementRecord,
  type ProcurementRow,
  type ProcurementSheetLetterhead,
  type ProcurementStage,
  type StageDates,
} from '../../lib/submittals/procurementLog'
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
  onCounts?: (c: { released: number; ordered: number; delivered: number; late: number }) => void
}

const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'middle', fontSize: '0.8125rem', color: 'var(--text-base)' }
// The seven date and count columns (Released · Ordered · Lead · Expected · Required · Float · Delivered): heading and cell centred, one line each.
const thCenter: CSSProperties = { ...th, textAlign: 'center' }
const tdCenter: CSSProperties = { ...td, whiteSpace: 'nowrap', textAlign: 'center' }
// The Item cell: the tag in bold, then the product on the same line, so a long name wraps across one wide cell.
// On a phone the item and its tick fit the screen; the dates scroll beside them.
const itemTd: CSSProperties = { ...td, width: 'min(19rem, 52vw)', minWidth: 'min(19rem, 52vw)', lineHeight: 1.35, overflowWrap: 'anywhere' }
const itemTag: CSSProperties = { fontWeight: 700, color: 'var(--text-strong)', marginRight: '0.45rem' }
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
export function SubmittalProcurementPanel({ bidId, bidLabel, companyName, items, reviewerNames, currentUser, letterhead = null, projectAddress = null, gcName = null, roomUrl = null, busy = false, onCounts }: Props) {
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
  const [bulkOrdered, setBulkOrdered] = useState('')
  const [bulkPo, setBulkPo] = useState('')

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
  const sections = useMemo(() => procurementSections(rows, lens), [rows, lens])
  const lastUpdate = updates[0] ?? null
  const changes = useMemo(() => diffProcurementLog(lastUpdate ? lastUpdate.rows : null, gcRows), [lastUpdate, gcRows])
  const hasStageDates = Object.keys(stageDates).length > 0
  // Today, for the soft line under each date ("2 days ago").
  const today = toIsoDate(new Date())
  useEffect(() => {
    if (!loaded || !onCounts) return
    const c = procurementCounts(rows)
    onCounts({ released: c.released, ordered: c.ordered, delivered: c.delivered, late: c.late })
  }, [loaded, rows, onCounts])

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
    return { ...letter, kind: 'update' as const, updateNumber, sentOn, sinceOn: lastUpdate ? lastUpdate.sentAt.slice(0, 10) : null, rows: gcRows, changes, line: sendLine }
  }

  /** Print the log: the log as it stands — no update number, nothing marked. */
  function printLog() {
    const today = toIsoDate(new Date())
    printHtmlInNewWindow(buildProcurementUpdateHtml({ ...updateInput(today, updates.length + 1), kind: 'print', changes: [], line: '', sinceOn: null }))
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
      printHtmlInNewWindow(buildProcurementUpdateHtml(input))
      await copyText(procurementUpdateText(input))
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not record the update'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const disabled = busy || saving

  /** One line of the log; `underTag` drops the tag on a part line drawn under its tag's heading. */
  function renderRow(r: ProcurementRow, underTag: boolean) {
    const late = r.late
    const changed = changes.some((c) => c.key === r.key)
    return (
      <tr key={r.key} data-testid="procurement-row" data-part={r.partKey ? 'true' : undefined} style={{ background: ticked.has(r.key) ? 'var(--bg-blue-tint)' : changed ? 'var(--bg-amber-100)' : undefined }}>
        <td style={{ ...td, width: 28, textAlign: 'center' }}>
          <input type="checkbox" aria-label={`Pick ${r.tag ?? r.product}${r.partKey ? ` ${r.product}` : ''}`} checked={ticked.has(r.key)} onChange={(e) => setTicked((cur) => { const next = new Set(cur); if (e.target.checked) next.add(r.key); else next.delete(r.key); return next })} data-testid="procurement-tick" />
        </td>
        <td style={{ ...itemTd, ...(underTag && r.partKey ? { paddingLeft: '1.2rem' } : null) }} data-testid="procurement-item">
          {r.isHand ? (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="text" aria-label="Item" placeholder="What it is (no cut sheet)" value={draftOf(r.key, 'label', r.product)} onChange={(e) => setDraft(r.key, 'label', e.target.value)} onBlur={() => void commitText(r, 'label')} maxLength={200} style={{ ...inp, flex: 1, minWidth: 0 }} />
              {r.stage ? <span style={{ ...smallMuted, whiteSpace: 'nowrap' }}>{PROCUREMENT_STAGE_LABELS[r.stage]}</span> : (
                <select aria-label="Stage" value="" onChange={(e) => void write(r, { stage: (e.target.value || null) as ProcurementStage | null })} style={inp}>
                  <option value="">stage…</option>
                  {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => <option key={s} value={s}>{PROCUREMENT_STAGE_LABELS[s]}</option>)}
                </select>
              )}
            </div>
          ) : (
            <>
              <div>{underTag && r.partKey ? null : <b style={itemTag}>{r.tag}</b>}{r.product}</div>
              <div style={smallMuted}>
                {r.supplyHouse ? `${r.supplyHouse} · ` : r.partKey ? 'no house yet · ' : ''}
                {r.stage ? PROCUREMENT_STAGE_LABELS[r.stage] : 'no stage on the takeoff'}
                {r.orderOnly ? <span data-testid="procurement-order-only"> · order only, not on the GC’s copy</span> : null}
                {r.countedWith.length > 0 ? <span data-testid="procurement-counted-with"> · counted with {r.countedWith.join(', ')} on the takeoff</span> : null}
              </div>
            </>
          )}
        </td>
        <td style={{ ...tdCenter, fontWeight: 600 }} data-testid="procurement-qty">{r.quantity != null ? r.quantity : <span style={smallMuted}>—</span>}</td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ color: r.submittal === 'approved' ? 'var(--text-green-700)' : r.submittal === 'revise' || r.submittal === 'rejected' ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>{submittalWord(r)}</span></td>
        <td style={{ ...tdCenter }}>{r.releasedOn ? shortDate(r.releasedOn) : <span style={smallMuted}>—</span>}</td>
        <td style={{ ...tdCenter }}>{dateCell(r, 'ordered_on', r.orderedOn, { label: `${r.tag ?? r.product} ordered on`, disabled: busy })}</td>
        <td style={td}><input type="text" aria-label={`${r.tag ?? r.product} PO`} placeholder="PO" value={draftOf(r.key, 'po', r.poRef)} onChange={(e) => setDraft(r.key, 'po', e.target.value)} onBlur={() => void commitText(r, 'po')} maxLength={60} style={{ ...inp, width: '5.2rem' }} /></td>
        <td style={{ ...tdCenter }}>
          {r.isHand ? (
            <input type="text" aria-label="Lead time" placeholder="2 wk" value={draftOf(r.key, 'lead', describeLeadTime(r.leadTimeDays) ?? '')} onChange={(e) => setDraft(r.key, 'lead', e.target.value)} onBlur={() => void commitText(r, 'lead')} style={{ ...inp, width: '4.6rem' }} />
          ) : (
            describeLeadTime(r.leadTimeDays) ?? <span style={smallMuted}>—</span>
          )}
        </td>
        <td style={{ ...tdCenter }}>
          {dateCell(r, 'expected_on', r.expectedOn, {
            label: `${r.tag ?? r.product} expected on`,
            title: r.expectedSource === 'derived' ? `${shortDate(r.orderedOn)} + ${describeLeadTime(r.leadTimeDays)}; type the house's own date to override` : r.expectedSource === 'house' ? "The house's date; clear it to go back to ordered + lead time" : 'Order date + lead time, or the house’s own date',
            disabled: busy || !!r.deliveredOn,
            background: r.expectedSource === 'house' ? 'var(--bg-amber-100)' : r.expectedSource === 'derived' ? 'var(--bg-muted)' : 'var(--surface)',
            under: r.expectedSource === 'house' ? 'house said' : null,
            empty: r.deliveredOn ? '—' : undefined,
          })}
        </td>
        <td style={{ ...tdCenter }}>{r.requiredOn ? shortDate(r.requiredOn) : <span style={smallMuted}>—</span>}</td>
        <td style={{ ...tdCenter, fontWeight: late ? 700 : 500, color: late ? 'var(--text-red-700)' : r.deliveredOn ? 'var(--text-green-700)' : r.floatDays != null ? 'var(--text-green-700)' : 'var(--text-muted)' }} data-testid="procurement-float">{floatText(r)}</td>
        <td style={{ ...tdCenter }}>{dateCell(r, 'delivered_on', r.deliveredOn, { label: `${r.tag ?? r.product} delivered on`, disabled: busy })}</td>
        <td style={{ ...td, minWidth: 160 }}><input type="text" aria-label={`${r.tag ?? r.product} note`} placeholder="note for the GC" value={draftOf(r.key, 'note', r.note)} onChange={(e) => setDraft(r.key, 'note', e.target.value)} onBlur={() => void commitText(r, 'note')} maxLength={500} style={{ ...inp, width: '100%' }} /></td>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.isHand ? <button type="button" onClick={() => void removeHandRow(r)} disabled={disabled} title="Remove this item" aria-label={`Remove ${r.product || 'item'}`} style={{ ...link, color: 'var(--text-red-600)', textDecoration: 'none', fontSize: '0.95rem' }}>×</button> : null}</td>
    </tr>
    )
  }


  return (
    <div data-testid="submittal-procurement" data-tour="submittals-procure" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div>
          <b style={{ fontSize: '0.9rem' }}>Procurement log</b>
          <span style={{ ...smallMuted, marginLeft: '0.5rem' }} data-testid="procurement-headline">{loaded ? procurementHeadline(rows) : 'Reading…'}</span>
        </div>
        <span style={smallMuted}>
          {hasStageDates ? `Required dates from the job's stage windows` : jobId ? 'No stage windows on the job yet — required dates blank' : 'Not a job yet — required dates blank'}
          {lastUpdate ? ` · last update ${shortDate(lastUpdate.sentAt.slice(0, 10))}${lastUpdate.sentTo ? ` to ${lastUpdate.sentTo}` : ''}` : ' · no update sent yet'}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div role="group" aria-label="Show the log" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }} data-testid="procurement-lens">
          {(Object.keys(LENS_WORDS) as ProcurementLens[]).map((k, i) => (
            <button key={k} type="button" aria-pressed={lens === k} onClick={() => setLens(k)} style={{ padding: '0.3rem 0.8rem', minHeight: 34, border: 'none', borderLeft: i > 0 ? '1px solid var(--border-strong)' : 'none', font: 'inherit', fontSize: '0.8rem', fontWeight: lens === k ? 700 : 500, cursor: 'pointer', background: lens === k ? '#2563eb' : 'var(--surface)', color: lens === k ? 'white' : 'var(--text-base)' }}>
              {LENS_WORDS[k]}
            </button>
          ))}
        </div>
        {lens === 'to_order' && loaded ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }} data-testid="procurement-next">{toOrderLine(sections)}</span> : null}
      </div>

      {ticked.size > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem 0.75rem', alignItems: 'center', padding: '0.5rem 0.7rem', border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', borderRadius: 6 }} data-testid="procurement-bulk">
          <b style={{ fontSize: '0.8125rem', color: 'var(--text-blue-700)' }}>{ticked.size} line{ticked.size === 1 ? '' : 's'} ticked</b>
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

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1140, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 28 }} aria-label="Pick" />
              <th style={th}>Item</th>
              <th style={thCenter}>Qty</th>
              <th style={th}>Submittal</th>
              <th style={thCenter}>Released</th>
              <th style={thCenter}>Ordered</th>
              <th style={th}>PO</th>
              <th style={thCenter}>Lead</th>
              <th style={thCenter}>Expected</th>
              <th style={thCenter}>Required</th>
              <th style={thCenter}>Float</th>
              <th style={thCenter}>Delivered</th>
              <th style={th}>Note</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody data-testid="procurement-rows">
            {rows.length === 0 ? (
              <tr>
                <td style={td} colSpan={14}>
                  <span style={smallMuted}>No rows yet. The submittal's rows appear here once a revision is shared; + Add item for a long-lead item with no cut sheet.</span>
                </td>
              </tr>
            ) : null}
            {sections.map((sec) => {
              // By tag, a tag with one line needs no heading of its own.
              const heading = lens !== 'by_tag' || sec.rows.length > 1 || (sec.rows[0]?.isHand ?? false)
              const keys = sec.rows.map((r) => r.key)
              const allOn = keys.length > 0 && keys.every((k) => ticked.has(k))
              return (
                <Fragment key={sec.key}>
                  {heading ? (
                    <tr data-testid="procurement-section">
                      <td colSpan={14} style={{ ...td, background: 'var(--bg-subtle)', padding: '0.4rem 0.4rem' }}>
                        <label style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" aria-label={`Pick every line under ${sec.title}`} checked={allOn} onChange={(e) => setTicked((cur) => { const next = new Set(cur); for (const k of keys) { if (e.target.checked) next.add(k); else next.delete(k) } return next })} />
                          <b style={{ color: 'var(--text-strong)' }}>{sec.title}</b>
                          <span style={smallMuted}>{sec.note}</span>
                        </label>
                      </td>
                    </tr>
                  ) : null}
                  {sec.rows.map((r) => renderRow(r, lens === 'by_tag' && heading))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={smallMuted}>
        Released = the room's approval. Expected = ordered + lead time until the house says otherwise (amber). Required = the stage's window on the job. <b>Order by</b> = required − lead time for a released row not yet ordered. Amber rows have changed since the last update.
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => { setSendTo((t) => t || reviewerNames.join(', ')); setSendOpen((v) => !v) }} disabled={disabled || rows.length === 0} style={btnPrimary} data-testid="procurement-send">Send update…</button>
        <button type="button" onClick={() => void addHandRow()} disabled={disabled} style={btn}>+ Add item</button>
        <button type="button" onClick={printLog} disabled={rows.length === 0} style={link}>Print the log</button>
        <button type="button" onClick={downloadCsv} disabled={rows.length === 0} style={link} title="The log as a .csv file, one row per item, dates a spreadsheet reads" data-testid="procurement-csv">Download CSV</button>
        <button type="button" onClick={() => void openInGoogleSheets()} disabled={rows.length === 0} style={link} title="Copies the log and opens a new Google Sheet; click A1 and paste" data-testid="procurement-sheets">Open in Google Sheets</button>
        <button type="button" onClick={() => setUpdatesOpen((v) => !v)} style={link}>Updates sent ({updates.length})</button>
      </div>

      {sendOpen ? (
        <div style={{ border: '1px solid var(--border-amber)', background: 'var(--bg-amber-100)', borderRadius: 6, padding: '0.55rem 0.7rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="procurement-send-card">
          <b style={{ fontSize: '0.85rem' }}>Procurement log update {updates.length + 1} · {shortDate(toIsoDate(new Date()))}</b>
          <div style={smallMuted}>{lastUpdate ? `Since ${shortDate(lastUpdate.sentAt.slice(0, 10))}: ${changes.length} ${changes.length === 1 ? 'row' : 'rows'} changed` : 'First update: every row goes.'}</div>
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
              <span>{shortDate(u.sentAt.slice(0, 10))}</span>
              {u.sentTo ? <span style={smallMuted}>to {u.sentTo}</span> : null}
              {u.sentByName ? <span style={smallMuted}>by {u.sentByName}</span> : null}
              <span style={smallMuted}>{u.changes.length} {u.changes.length === 1 ? 'change' : 'changes'}</span>
              {u.line ? <span style={{ ...smallMuted, fontStyle: 'italic' }}>“{u.line}”</span> : null}
              <button type="button" onClick={() => printHtmlInNewWindow(buildProcurementUpdateHtml({ ...letter, kind: 'update', updateNumber: updates.length - i, sentOn: u.sentAt.slice(0, 10), sinceOn: updates[i + 1] ? updates[i + 1]!.sentAt.slice(0, 10) : null, rows: rowsFromSnapshot(u.rows), changes: u.changes, line: u.line }))} style={link}>Open</button>
            </div>
          ))}
        </div>
      ) : null}
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

/** The To order lens's one line: how many lines to order now, and the first order-by date. */
function toOrderLine(sections: ReadonlyArray<{ key: string; rows: ProcurementRow[] }>): string {
  const buy = sections.filter((s) => s.key.startsWith('buy:')).flatMap((s) => s.rows)
  if (buy.length === 0) return 'Nothing is approved and waiting to be ordered.'
  const first = buy.map((r) => r.orderBy).filter((d): d is string => !!d).sort()[0] ?? null
  return `${buy.length} line${buy.length === 1 ? ' is' : 's are'} approved and not ordered.${first ? ` The first must be ordered by ${shortDate(first)}.` : ''}`
}
