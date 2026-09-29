import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { printHtmlInNewWindow } from '../../lib/bidDocuments/htmlDoc'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { procurementLogCsv, procurementLogFileName, procurementLogTsv } from '../../lib/submittals/procurementLogExport'
import { describeLeadTime, parseLeadTime } from '../../lib/submittals/leadTime'
import {
  buildProcurementLog,
  buildProcurementUpdateHtml,
  diffProcurementLog,
  floatText,
  PROCUREMENT_STAGE_LABELS,
  procurementCounts,
  procurementHeadline,
  procurementUpdateText,
  shortDate,
  snapshotRows,

  submittalWord,
  toIsoDate,
  type ProcurementItemSource,
  type ProcurementRecord,
  type ProcurementRow,
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
  busy?: boolean
  /** The strip's Procure pill reads these. */
  onCounts?: (c: { released: number; ordered: number; delivered: number; late: number }) => void
}

const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const th: CSSProperties = { textAlign: 'left', fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--bg-muted)', verticalAlign: 'middle', fontSize: '0.8125rem', color: 'var(--text-base)' }
const btn: CSSProperties = { padding: '0.35rem 0.75rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 500 }
const btnPrimary: CSSProperties = { ...btn, background: '#2563eb', borderColor: '#2563eb', color: 'white', fontWeight: 600 }
const link: CSSProperties = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-blue-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
const inp: CSSProperties = { padding: '0.2rem 0.35rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', boxSizing: 'border-box', font: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }
const dateInp: CSSProperties = { ...inp, width: '8.6rem' }

type Draft = Partial<Record<'po' | 'note' | 'label' | 'lead', string>>

/**
 * Submittals → Procure (v2.4083): the procurement log. Released reads from the room's
 * decision, required from the job's stage windows through the takeoff's stage; the
 * estimator types the order date and PO, the house's arrival date when it differs,
 * the delivered date and a note. Send update records a dated snapshot with what
 * changed, opens the sheet to print, and copies the text for the email.
 */
export function SubmittalProcurementPanel({ bidId, bidLabel, companyName, items, reviewerNames, currentUser, busy = false, onCounts }: Props) {
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

  const tagsKey = items.map((i) => i.tag).join('|')

  const reloadRecords = useCallback(async () => {
    setRecords(await loadProcurementRecords(supabase, bidId))
  }, [bidId])
  const reloadUpdates = useCallback(async () => {
    setUpdates(await loadProcurementUpdates(supabase, bidId))
  }, [bidId])

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    void Promise.all([loadProcurementRecords(supabase, bidId), loadProcurementUpdates(supabase, bidId), loadTagStagesForBid(supabase, bidId, tagsKey ? tagsKey.split('|') : []), loadStageDatesForBid(supabase, bidId)])
      .then(([recs, ups, stages, dates]) => {
        if (cancelled) return
        setRecords(recs)
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
  }, [bidId, tagsKey, showToast])

  const rows = useMemo(() => buildProcurementLog({ items, records, tagStage, stageDates }), [items, records, tagStage, stageDates])
  const lastUpdate = updates[0] ?? null
  const changes = useMemo(() => diffProcurementLog(lastUpdate ? lastUpdate.rows : null, rows), [lastUpdate, rows])
  const hasStageDates = Object.keys(stageDates).length > 0
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

  /** One row per tag (or hand row id): insert on first write, update after. */
  async function write(row: ProcurementRow, patch: Partial<{ ordered_on: string | null; po_ref: string; expected_on: string | null; delivered_on: string | null; note: string; label: string; lead_time_days: number | null; stage: ProcurementStage | null }>) {
    setSaving(true)
    try {
      if (row.recordId) {
        const { error } = await supabase.from('bid_procurement_items').update(patch).eq('id', row.recordId)
        if (error) throw error
      } else {
        const maxSort = records.reduce((m, r) => Math.max(m, r.sortOrder), -1)
        const { error } = await supabase.from('bid_procurement_items').insert({ bid_id: bidId, tag: row.tag, sort_order: maxSort + 1, ...patch })
        if (error) throw error
      }
      await reloadRecords()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the log'), 'error')
    } finally {
      setSaving(false)
    }
  }

  function dateChanged(row: ProcurementRow, field: 'ordered_on' | 'expected_on' | 'delivered_on', value: string) {
    const v = value.trim() ? value.trim() : null
    const cur = field === 'ordered_on' ? row.orderedOn : field === 'expected_on' ? (row.expectedSource === 'house' ? row.expectedOn : null) : row.deliveredOn
    if (v === cur) return
    void write(row, { [field]: v } as Record<string, string | null>)
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

  function updateInput(sentOn: string, updateNumber: number) {
    return { bidLabel, companyName, updateNumber, sentOn, sinceOn: lastUpdate ? lastUpdate.sentAt.slice(0, 10) : null, rows, changes, line: sendLine, stageDates }
  }

  function printLog() {
    const today = toIsoDate(new Date())
    printHtmlInNewWindow(buildProcurementUpdateHtml({ ...updateInput(today, updates.length + 1), changes: [], line: '', sinceOn: null }))
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
      const { error } = await supabase.from('bid_procurement_updates').insert({ bid_id: bidId, sent_by: currentUser.id, sent_by_name: currentUser.name, sent_to: sendTo.trim().slice(0, 300), line: sendLine.trim().slice(0, 1000), rows: snapshotRows(rows) as unknown as never, changes: changes as unknown as never })
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

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1080, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <th style={th}>Tag</th>
              <th style={th}>Product</th>
              <th style={th}>Submittal</th>
              <th style={th}>Released</th>
              <th style={th}>Ordered</th>
              <th style={th}>PO</th>
              <th style={th}>Lead</th>
              <th style={th}>Expected</th>
              <th style={th}>Required</th>
              <th style={th}>Float</th>
              <th style={th}>Delivered</th>
              <th style={th}>Note</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody data-testid="procurement-rows">
            {rows.length === 0 ? (
              <tr>
                <td style={td} colSpan={13}>
                  <span style={smallMuted}>No rows yet. The submittal's rows appear here once a revision is shared; + Add item for a long-lead item with no cut sheet.</span>
                </td>
              </tr>
            ) : null}
            {rows.map((r) => {
              const late = r.late
              const changed = changes.some((c) => c.key === r.key)
              return (
                <tr key={r.key} data-testid="procurement-row" style={{ background: changed ? 'var(--bg-amber-100)' : undefined }}>
                  <td style={{ ...td, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.tag ?? '+'}</td>
                  <td style={{ ...td, minWidth: 180 }}>
                    {r.isHand ? (
                      <input type="text" aria-label="Item" placeholder="What it is (no cut sheet)" value={draftOf(r.key, 'label', r.product)} onChange={(e) => setDraft(r.key, 'label', e.target.value)} onBlur={() => void commitText(r, 'label')} maxLength={200} style={{ ...inp, width: '100%' }} />
                    ) : (
                      <>
                        {r.product}
                        {r.supplyHouse ? <div style={smallMuted}>{r.supplyHouse}</div> : null}
                        {r.countedWith.length > 0 ? <div style={smallMuted} data-testid="procurement-counted-with">counted with {r.countedWith.join(', ')} on the takeoff</div> : null}
                      </>
                    )}
                    {r.stage ? <div style={smallMuted}>{PROCUREMENT_STAGE_LABELS[r.stage]}</div> : r.isHand ? (
                      <select aria-label="Stage" value={r.stage ?? ''} onChange={(e) => void write(r, { stage: (e.target.value || null) as ProcurementStage | null })} style={{ ...inp, marginTop: 2 }}>
                        <option value="">stage…</option>
                        {(['rough_in', 'top_out', 'trim_set'] as const).map((s) => <option key={s} value={s}>{PROCUREMENT_STAGE_LABELS[s]}</option>)}
                      </select>
                    ) : <div style={smallMuted}>no stage on the takeoff</div>}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}><span style={{ color: r.submittal === 'approved' ? 'var(--text-green-700)' : r.submittal === 'revise' || r.submittal === 'rejected' ? 'var(--text-amber-700)' : 'var(--text-muted)' }}>{submittalWord(r)}</span></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.releasedOn ? shortDate(r.releasedOn) : <span style={smallMuted}>—</span>}</td>
                  <td style={td}><input type="date" aria-label={`${r.tag ?? r.product} ordered on`} value={r.orderedOn ?? ''} onChange={(e) => dateChanged(r, 'ordered_on', e.target.value)} disabled={disabled} style={dateInp} /></td>
                  <td style={td}><input type="text" aria-label={`${r.tag ?? r.product} PO`} placeholder="PO" value={draftOf(r.key, 'po', r.poRef)} onChange={(e) => setDraft(r.key, 'po', e.target.value)} onBlur={() => void commitText(r, 'po')} maxLength={60} style={{ ...inp, width: '5.2rem' }} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {r.isHand ? (
                      <input type="text" aria-label="Lead time" placeholder="2 wk" value={draftOf(r.key, 'lead', describeLeadTime(r.leadTimeDays) ?? '')} onChange={(e) => setDraft(r.key, 'lead', e.target.value)} onBlur={() => void commitText(r, 'lead')} style={{ ...inp, width: '4.6rem' }} />
                    ) : (
                      describeLeadTime(r.leadTimeDays) ?? <span style={smallMuted}>—</span>
                    )}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <input
                      type="date"
                      aria-label={`${r.tag ?? r.product} expected on`}
                      title={r.expectedSource === 'derived' ? `${shortDate(r.orderedOn)} + ${describeLeadTime(r.leadTimeDays)}; type the house's own date to override` : r.expectedSource === 'house' ? "The house's date; clear it to go back to ordered + lead time" : 'Order date + lead time, or the house’s own date'}
                      value={r.expectedOn ?? ''}
                      onChange={(e) => dateChanged(r, 'expected_on', e.target.value)}
                      disabled={disabled || !!r.deliveredOn}
                      style={{ ...dateInp, background: r.expectedSource === 'house' ? 'var(--bg-amber-100)' : r.expectedSource === 'derived' ? 'var(--bg-muted)' : 'var(--surface)' }}
                    />
                    {r.expectedSource === 'house' ? <div style={smallMuted}>house said</div> : null}
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.requiredOn ? shortDate(r.requiredOn) : <span style={smallMuted}>—</span>}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: late ? 700 : 500, color: late ? 'var(--text-red-700)' : r.deliveredOn ? 'var(--text-green-700)' : r.floatDays != null ? 'var(--text-green-700)' : 'var(--text-muted)' }} data-testid="procurement-float">{floatText(r)}</td>
                  <td style={td}><input type="date" aria-label={`${r.tag ?? r.product} delivered on`} value={r.deliveredOn ?? ''} onChange={(e) => dateChanged(r, 'delivered_on', e.target.value)} disabled={disabled} style={dateInp} /></td>
                  <td style={{ ...td, minWidth: 160 }}><input type="text" aria-label={`${r.tag ?? r.product} note`} placeholder="note for the GC" value={draftOf(r.key, 'note', r.note)} onChange={(e) => setDraft(r.key, 'note', e.target.value)} onBlur={() => void commitText(r, 'note')} maxLength={500} style={{ ...inp, width: '100%' }} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.isHand ? <button type="button" onClick={() => void removeHandRow(r)} disabled={disabled} title="Remove this item" aria-label={`Remove ${r.product || 'item'}`} style={{ ...link, color: 'var(--text-red-600)', textDecoration: 'none', fontSize: '0.95rem' }}>×</button> : null}</td>
                </tr>
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
              <button type="button" onClick={() => printHtmlInNewWindow(buildProcurementUpdateHtml({ bidLabel, companyName, updateNumber: updates.length - i, sentOn: u.sentAt.slice(0, 10), sinceOn: updates[i + 1] ? updates[i + 1]!.sentAt.slice(0, 10) : null, rows: rowsFromSnapshot(u.rows), changes: u.changes, line: u.line, stageDates }))} style={link}>Open</button>
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
