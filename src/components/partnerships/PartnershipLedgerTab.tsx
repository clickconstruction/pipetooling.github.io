import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import {
  DRAFT_NOTE_PREVIEW_ID,
  POSITIVE_OFFSET_TYPES,
  buildPartnerJournal,
  mergeNotesIntoDisplay,
  mergePendingIntoJournal,
  netPosition,
  pendingOffsetSignedAmount,
  summarizePendingOffsets,
  withDraftNotePreview,
  type JournalAdditionalLine,
  type JournalDeduction,
  type JournalPayment,
  type JournalPendingOffset,
  type JournalRow,
  type JournalStub,
  type LedgerDisplayRow,
  type LedgerNote,
} from '../../lib/partnerLedger/partnerLedgerJournal'
import { buildPartnerPayReportHtml, type PartnerPayReportDay } from '../../lib/partnerLedger/partnerPayReportHtml'
import { PayStubViewModal } from '../pay/PayStubViewModal'
import { PersonOffsetFormModal, type PersonOffsetEditingRow } from '../pay/PersonOffsetFormModal'

/**
 * Partnerships → Ledger tab (PARTNERSHIPS_PLAN.md PR 3): the append-only
 * journal behind the statements — every posting (labor, additions, deductions,
 * payouts) oldest-first with a running balance, plus offsets still pending.
 * Pure view over the pay_stubs family via the dev's payroll-access RLS; the
 * shaping lives in the partnerLedgerJournal kernel.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type NoteDraft = { note_date: string; memo: string; partner_visible: boolean }

/** Signed money in the ledger's green/red convention, for detail cards. */
function AmountText({ amount }: { amount: number }) {
  return (
    <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: amount >= 0 ? '#16a34a' : 'var(--text-red-600)' }}>
      {amount >= 0 ? '+' : '−'}
      {money(amount)}
    </span>
  )
}

/** Offset types the drill-in lets a dev edit in place; machine-posted types
 * (profit_share, utility_overage) get a read-only card instead. */
const EDITABLE_OFFSET_TYPES = new Set(['backcharge', 'damage', 'employee_credit'])

type LedgerOffsetRow = JournalPendingOffset & { id: string; pay_stub_id: string | null; person_name: string }
type InfoCard = { title: string; lines: Array<[string, React.ReactNode]>; note: string }

export function PartnershipLedgerTab({ personId, partnershipId, personName }: { personId: string; partnershipId: string; personName: string }) {
  const [rows, setRows] = useState<JournalRow[] | null>(null)
  const [balance, setBalance] = useState(0)
  const [pending, setPending] = useState<{ count: number; net: number }>({ count: 0, net: 0 })
  const [pendingRows, setPendingRows] = useState<JournalPendingOffset[]>([])
  const [failed, setFailed] = useState(false)
  const [stubsById, setStubsById] = useState<Map<string, JournalStub>>(new Map())
  const [offsetsById, setOffsetsById] = useState<Map<string, LedgerOffsetRow>>(new Map())
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [payReport, setPayReport] = useState<{ title: string; html: string } | null>(null)
  const [payReportBusy, setPayReportBusy] = useState<string | null>(null)
  const [editOffset, setEditOffset] = useState<PersonOffsetEditingRow | null>(null)
  const [infoCard, setInfoCard] = useState<InfoCard | null>(null)
  const [drillError, setDrillError] = useState<string | null>(null)
  const [notes, setNotes] = useState<LedgerNote[]>([])
  const [notesUnavailable, setNotesUnavailable] = useState(false)
  const [editingNote, setEditingNote] = useState<string | 'new' | null>(null)
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null)
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const memoInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    const stubsRes = await supabase
      .from('pay_stubs')
      .select('id, period_start, period_end, hours_total, gross_pay')
      .eq('person_id', personId)
      .order('period_start', { ascending: true })
    if (stubsRes.error) {
      setFailed(true)
      setRows([])
      return
    }
    setFailed(false)
    const stubs = (stubsRes.data ?? []) as JournalStub[]
    setStubsById(new Map(stubs.map((s) => [s.id, s])))
    const ids = stubs.map((s) => s.id)
    let additional: JournalAdditionalLine[] = []
    let deductions: (JournalDeduction & { person_offset_id: string | null })[] = []
    let payments: JournalPayment[] = []
    if (ids.length > 0) {
      const [aRes, dRes, pRes] = await Promise.all([
        supabase.from('pay_stub_additional_lines').select('pay_stub_id, description, line_total').in('pay_stub_id', ids),
        supabase.from('pay_stub_deductions').select('pay_stub_id, description, amount, person_offset_id').in('pay_stub_id', ids),
        supabase.from('pay_stub_payments').select('pay_stub_id, amount, paid_at, memo').in('pay_stub_id', ids),
      ])
      additional = (aRes.data ?? []) as JournalAdditionalLine[]
      deductions = (dRes.data ?? []) as (JournalDeduction & { person_offset_id: string | null })[]
      payments = (pRes.data ?? []) as JournalPayment[]
    }
    const offRes = await supabase
      .from('person_offsets')
      .select('id, type, amount, occurred_date, description, pay_stub_id, person_name')
      .eq('person_id', personId)
    const offsets = ((offRes.data ?? []) as LedgerOffsetRow[]) || []
    setOffsetsById(new Map(offsets.map((o) => [o.id, o])))

    // Charges-at-date: every charge-type offset books at its occurred_date,
    // attached to a statement or not. Statement deductions that merely mirror
    // one of those offsets are excluded so nothing counts twice; deductions
    // from positive-type offsets (e.g. profit-share reversals) and manual
    // deductions keep booking on the statement week.
    const chargeOffsets = offsets.filter((o) => !POSITIVE_OFFSET_TYPES.has(o.type))
    const chargeOffsetIds = new Set(chargeOffsets.map((o) => o.id))
    const journal = buildPartnerJournal({
      stubs,
      additional,
      deductions: deductions
        .filter((d) => d.person_offset_id == null || !chargeOffsetIds.has(d.person_offset_id))
        .map(({ pay_stub_id, description, amount }) => ({ pay_stub_id, description, amount })),
      payments,
      charges: chargeOffsets.map((o) => ({
        date: o.occurred_date,
        label: o.description || o.type,
        amount: pendingOffsetSignedAmount(o),
        offset_id: o.id,
      })),
    })
    setRows(journal.rows)
    setBalance(journal.balance)
    const posPending = offsets.filter((o) => POSITIVE_OFFSET_TYPES.has(o.type) && o.pay_stub_id == null)
    setPending(summarizePendingOffsets(posPending))
    setPendingRows([...posPending].sort((a, b) => b.occurred_date.localeCompare(a.occurred_date)))

    // Ledger notes — fail-soft until the notes migration is applied.
    const notesRes = await supabase
      .from('partnership_ledger_notes')
      .select('id, note_date, memo, partner_visible')
      .eq('partnership_id', partnershipId)
    if (notesRes.error) {
      setNotesUnavailable(true)
      setNotes([])
    } else {
      setNotesUnavailable(false)
      setNotes((notesRes.data ?? []) as LedgerNote[])
    }
  }, [personId, partnershipId])

  useEffect(() => {
    setRows(null)
    void load()
  }, [load])

  useEffect(() => {
    if (!infoCard) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoCard(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [infoCard])

  function openComposer(date?: string) {
    setEditingNote('new')
    setNoteDraft({ note_date: date ?? denverCalendarDayKey(Date.now()), memo: '', partner_visible: false })
    setNoteError(null)
  }
  function openEditor(note: LedgerNote) {
    setEditingNote(note.id)
    setNoteDraft({ note_date: note.note_date, memo: note.memo, partner_visible: note.partner_visible })
    setNoteError(null)
  }
  function closeEditor() {
    setEditingNote(null)
    setNoteDraft(null)
    setNoteError(null)
  }
  async function saveNote() {
    if (!noteDraft || !editingNote) return
    const memo = noteDraft.memo.trim()
    if (!memo) {
      setNoteError('Memo is required')
      return
    }
    setNoteBusy(true)
    setNoteError(null)
    const { error } =
      editingNote === 'new'
        ? await supabase.from('partnership_ledger_notes').insert({
            partnership_id: partnershipId,
            note_date: noteDraft.note_date,
            memo,
            partner_visible: noteDraft.partner_visible,
          })
        : await supabase
            .from('partnership_ledger_notes')
            .update({ note_date: noteDraft.note_date, memo, partner_visible: noteDraft.partner_visible, updated_at: new Date().toISOString() })
            .eq('id', editingNote)
    if (error) {
      setNoteError(error.message)
    } else {
      closeEditor()
      await load()
    }
    setNoteBusy(false)
  }
  async function deleteNote() {
    if (!editingNote || editingNote === 'new') return
    setNoteBusy(true)
    const { error } = await supabase.from('partnership_ledger_notes').delete().eq('id', editingNote)
    if (error) setNoteError(error.message)
    else {
      closeEditor()
      await load()
    }
    setNoteBusy(false)
  }

  // ── Row drill-ins ─────────────────────────────────────────────────────────
  // Labor → the week's pay report; charges → the offset editor (or a read-only
  // card for machine-posted types); payouts and statement lines → a detail
  // card. Suppressed while the note composer is open (rows are date targets).

  const statementWeekLabel = (stubId: string | null): string => {
    const s = stubId ? stubsById.get(stubId) : undefined
    return s ? `week of ${s.period_start}` : '—'
  }

  async function openPayReport(stubId: string) {
    const stub = stubsById.get(stubId)
    if (!stub || payReportBusy) return
    setPayReportBusy(stubId)
    setDrillError(null)
    const [daysRes, addRes, dedRes, payRes] = await Promise.all([
      supabase
        .from('pay_stub_days')
        .select('work_date, hours_at_time, rate_at_time, paid_amount')
        .eq('pay_stub_id', stubId)
        .order('work_date', { ascending: true }),
      supabase.from('pay_stub_additional_lines').select('description, line_total').eq('pay_stub_id', stubId),
      supabase.from('pay_stub_deductions').select('description, amount').eq('pay_stub_id', stubId),
      supabase.from('pay_stub_payments').select('paid_at, amount, memo').eq('pay_stub_id', stubId).order('paid_at', { ascending: true }),
    ])
    setPayReportBusy(null)
    if (daysRes.error || addRes.error || dedRes.error || payRes.error) {
      setDrillError('Couldn’t load that week’s pay report — try again.')
      return
    }
    // The generator writes one day row per rate segment (including empty
    // zero-hour days); merge same-day same-rate rows and drop the empties so
    // the report reads one line per worked stretch.
    const merged = new Map<string, PartnerPayReportDay>()
    for (const d of (daysRes.data ?? []) as Array<{ work_date: string; hours_at_time: number; rate_at_time: number; paid_amount: number }>) {
      if (d.hours_at_time === 0 && d.paid_amount === 0) continue
      const key = `${d.work_date}|${d.rate_at_time}`
      const prev = merged.get(key)
      if (prev) {
        prev.hours = Math.round((prev.hours + d.hours_at_time) * 100) / 100
        prev.paid = Math.round((prev.paid + d.paid_amount) * 100) / 100
      } else {
        merged.set(key, { work_date: d.work_date, hours: d.hours_at_time, rate: d.rate_at_time, paid: d.paid_amount })
      }
    }
    const html = buildPartnerPayReportHtml({
      personName,
      periodStart: stub.period_start,
      periodEnd: stub.period_end,
      hoursTotal: stub.hours_total,
      grossPay: stub.gross_pay,
      days: [...merged.values()],
      additionalLines: (addRes.data ?? []) as Array<{ description: string; line_total: number }>,
      deductions: (dedRes.data ?? []) as Array<{ description: string; amount: number }>,
      payments: (payRes.data ?? []) as Array<{ paid_at: string; amount: number; memo: string | null }>,
      generatedYmd: denverCalendarDayKey(Date.now()),
    })
    setPayReport({ title: `Pay report — ${personName} (${stub.period_start} – ${stub.period_end})`, html })
  }

  function openOffsetDrillIn(offsetId: string) {
    const o = offsetsById.get(offsetId)
    if (!o) return
    if (EDITABLE_OFFSET_TYPES.has(o.type)) {
      setEditOffset({
        id: o.id,
        person_name: o.person_name,
        type: o.type,
        amount: o.amount,
        description: o.description,
        occurred_date: o.occurred_date,
      })
      return
    }
    const signed = pendingOffsetSignedAmount(o)
    setInfoCard({
      title: o.type === 'profit_share' ? 'Profit share' : 'Posted charge',
      lines: [
        ['Date', o.occurred_date],
        ['Amount', <AmountText key="a" amount={signed} />],
        ['Description', o.description || o.type],
        ['On statement', o.pay_stub_id ? statementWeekLabel(o.pay_stub_id) : 'not yet — still pending'],
      ],
      note:
        o.type === 'profit_share'
          ? 'Posted by the profit-share engine — reverse or repost it from Job review rather than editing it here.'
          : 'Posted automatically by statement generation — adjust it with a new offset rather than editing.',
    })
  }

  function openDrillIn(r: LedgerDisplayRow) {
    setDrillError(null)
    if (r.kind === 'note') return
    if (r.kind === 'labor' && r.pay_stub_id) {
      void openPayReport(r.pay_stub_id)
      return
    }
    if (r.kind === 'pending' || ((r.kind === 'addition' || r.kind === 'deduction') && r.offset_id)) {
      if (r.offset_id) openOffsetDrillIn(r.offset_id)
      return
    }
    if (r.kind === 'payout') {
      setInfoCard({
        title: 'Payout',
        lines: [
          ['Paid', r.date],
          ['Amount', <AmountText key="a" amount={r.amount} />],
          ['Memo', r.detail || '—'],
          ['On statement', statementWeekLabel(r.pay_stub_id)],
        ],
        note: 'Payouts are recorded and corrected from the statement’s Record-payment flow — this card is the quick look.',
      })
      return
    }
    // Additions / deductions living on a statement (no backing offset).
    setInfoCard({
      title: r.kind === 'addition' ? 'Statement line' : 'Statement deduction',
      lines: [
        ['Description', r.label],
        ['Amount', <AmountText key="a" amount={r.amount} />],
        ['On statement', statementWeekLabel(r.pay_stub_id)],
      ],
      note: 'Additions and deductions live on their statement — edit them where the statement was drafted.',
    })
  }

  const drillTitle = (r: LedgerDisplayRow): string =>
    r.kind === 'labor'
      ? 'click to open the pay report'
      : r.kind !== 'note' && r.offset_id && EDITABLE_OFFSET_TYPES.has(offsetsById.get(r.offset_id)?.type ?? '')
        ? 'click to view or edit this charge'
        : 'click for details'

  // Hover + click affordances for posting/pending rows — only when the note
  // composer is closed (open composer keeps click-to-place semantics).
  const drillHandlers = (r: LedgerDisplayRow, key: string) =>
    noteDraft
      ? {}
      : {
          onClick: () => openDrillIn(r),
          onMouseEnter: () => setHoverKey(key),
          onMouseLeave: () => setHoverKey((k) => (k === key ? null : k)),
          title: drillTitle(r),
          style: { cursor: 'pointer', background: hoverKey === key ? 'var(--bg-muted)' : undefined },
        }

  if (rows == null) {
    return <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>Loading…</p>
  }
  if (failed) {
    return (
      <p style={{ fontSize: '0.875rem', color: 'var(--text-700)', margin: '0.5rem 0 0' }}>
        Couldn’t load the ledger — check payroll access and that the PR 3 migration is pushed.
      </p>
    )
  }

  const net = netPosition(balance, pending.net)
  // While the composer is open, a ghost preview of the draft rides along in
  // the display list — it sits exactly where the note will land and moves as
  // the draft's date changes.
  const displayRows = mergeNotesIntoDisplay(
    mergePendingIntoJournal(rows, pendingRows),
    withDraftNotePreview(notes, editingNote, noteDraft),
  )

  const dropDateHandlers = (date: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!noteDraft) return
      e.preventDefault()
      setDragOverDate(date)
    },
    onDragLeave: () => setDragOverDate((d) => (d === date ? null : d)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDragOverDate(null)
      if (noteDraft) setNoteDraft({ ...noteDraft, note_date: date })
    },
  })

  // Click-to-place: with the composer open, posting/pending rows double as
  // date targets — click one to load its date and keep typing.
  const pickDateHandlers = (date: string) =>
    noteDraft
      ? {
          onClick: () => {
            setNoteDraft({ ...noteDraft, note_date: date })
            memoInputRef.current?.focus()
          },
          onMouseEnter: () => setHoverDate(date),
          onMouseLeave: () => setHoverDate((d) => (d === date ? null : d)),
          title: 'click to place your note above this date',
          style: { cursor: 'copy' },
        }
      : {}

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap', margin: '0.25rem 0 0.5rem' }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: net < 0 ? 'var(--text-red-600)' : undefined }}>
          {net < 0 ? '−' : ''}{money(net)}
        </span>
        {pending.count === 0 ? (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>current balance (all postings − payouts)</span>
        ) : null}
        {!notesUnavailable ? (
          <button
            type="button"
            onClick={() => (editingNote ? closeEditor() : openComposer())}
            style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.3rem 0.75rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}
          >
            + note
          </button>
        ) : null}
      </div>

      {noteDraft ? (
        <div style={{ border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.75rem', margin: '0 0 0.7rem', display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
          <input
            type="date"
            value={noteDraft.note_date}
            onChange={(e) => setNoteDraft({ ...noteDraft, note_date: e.target.value })}
            style={{ font: 'inherit', fontSize: '0.82rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
          />
          <input
            ref={memoInputRef}
            autoFocus
            type="text"
            placeholder="Memo — what happened?"
            value={noteDraft.memo}
            onChange={(e) => setNoteDraft({ ...noteDraft, memo: e.target.value })}
            style={{ flex: '1 1 240px', minWidth: 0, font: 'inherit', fontSize: '0.82rem', padding: '0.3rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit' }}
          />
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={noteDraft.partner_visible} onChange={(e) => setNoteDraft({ ...noteDraft, partner_visible: e.target.checked })} />
            Partner can see
          </label>
          <button
            type="button"
            disabled={noteBusy}
            onClick={() => void saveNote()}
            style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 650, padding: '0.3rem 0.75rem', borderRadius: 6, border: 'none', background: '#2563eb', color: 'var(--surface)', cursor: 'pointer', opacity: noteBusy ? 0.6 : 1 }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={closeEditor}
            style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.55rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            Cancel
          </button>
          {editingNote !== 'new' ? (
            <button
              type="button"
              disabled={noteBusy}
              onClick={() => void deleteNote()}
              style={{ font: 'inherit', fontSize: '0.78rem', padding: '0.3rem 0.55rem', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--text-red-600)', cursor: 'pointer' }}
            >
              Delete
            </button>
          ) : null}
          <span style={{ flexBasis: '100%', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Tip: click any ledger row to place your note above that date — the dashed draft row shows where it lands. Dragging a note’s grey triangle onto a row works too.
          </span>
          {noteError ? <span style={{ flexBasis: '100%', fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{noteError}</span> : null}
        </div>
      ) : null}

      {drillError ? (
        <p style={{ fontSize: '0.78rem', color: 'var(--text-red-600)', margin: '0 0 0.5rem' }}>{drillError}</p>
      ) : null}

      {displayRows.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          Nothing posted yet — generate the first statement from the Statements tab.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                {['Date', 'Posting', 'Amount', 'Balance'].map((h, i) => (
                  <th key={h} style={{ textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.5rem', borderBottom: '2px solid var(--border)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Balance is computed oldest→newest; display newest-first so the
                  top row is today and its balance equals the headline. Pending
                  rows interleave by date but never carry a balance. */}
              {[...displayRows].reverse().map((r, i) => {
                const dropStyle =
                  (dragOverDate === r.date || hoverDate === r.date) && noteDraft
                    ? { borderTop: '2px solid var(--text-amber-700)' }
                    : {}
                if (r.kind === 'note' && r.note.id === DRAFT_NOTE_PREVIEW_ID) {
                  // Ghost preview of the open draft — shows where the note
                  // will land; nothing exists in the database until Save.
                  return (
                    <tr
                      key="draft-preview"
                      onClick={() => memoInputRef.current?.focus()}
                      title="your note will land here — Save to keep it"
                      style={{ cursor: 'text', opacity: 0.75 }}
                    >
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px dashed var(--border-strong)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date}</td>
                      <td colSpan={2} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px dashed var(--border-strong)', fontStyle: 'italic', color: r.label ? 'var(--text-700)' : 'var(--text-muted)' }}>
                        {r.label || '(your note)'}
                        {r.note.partner_visible ? (
                          <span style={{ marginLeft: '0.5rem', fontStyle: 'normal', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', color: '#16a34a', border: '1px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }}>
                            partner sees
                          </span>
                        ) : null}
                        <span style={{ marginLeft: '0.5rem', fontStyle: 'normal', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)', borderRadius: 999, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }}>
                          draft
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px dashed var(--border-strong)' }} />
                    </tr>
                  )
                }
                if (r.kind === 'note') {
                  return (
                    <tr
                      key={`note-${r.note.id}`}
                      onClick={() => openEditor(r.note)}
                      title="click to edit this note"
                      style={{ cursor: 'pointer', background: 'var(--bg-muted)' }}
                      {...dropDateHandlers(r.date)}
                    >
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date}</td>
                      <td colSpan={2} style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontStyle: 'italic', color: 'var(--text-700)' }}>
                        {r.label}
                        {r.note.partner_visible ? (
                          <span style={{ marginLeft: '0.5rem', fontStyle: 'normal', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.05em', color: '#16a34a', border: '1px solid var(--border)', borderRadius: 999, padding: '0.05rem 0.45rem', whiteSpace: 'nowrap' }}>
                            partner sees
                          </span>
                        ) : null}
                      </td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right' }}>
                        <span
                          draggable
                          title="drag onto a row to pick its date"
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditor(r.note)
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', r.note.id)
                            if (editingNote !== r.note.id) openEditor(r.note)
                          }}
                          style={{ display: 'inline-block', width: 0, height: 0, cursor: 'grab', borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: '11px solid var(--text-muted)' }}
                        />
                      </td>
                    </tr>
                  )
                }
                const rowKey = `${r.kind}-${i}`
                const chevron = !noteDraft ? (
                  <span
                    aria-hidden
                    style={{ float: 'right', marginLeft: '0.5rem', color: 'var(--text-muted)', opacity: hoverKey === rowKey ? 1 : 0 }}
                  >
                    {r.kind === 'labor' && payReportBusy != null && payReportBusy === r.pay_stub_id ? '…' : '›'}
                  </span>
                ) : null
                if (r.kind === 'pending') {
                  return (
                    <tr key={i} {...dropDateHandlers(r.date)} {...pickDateHandlers(r.date)} {...drillHandlers(r, rowKey)}>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date}</td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                        {r.label}
                        {chevron}
                      </td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', whiteSpace: 'nowrap', opacity: 0.85 }}>
                        {r.amount >= 0 ? '+' : '−'}{money(r.amount)}
                      </td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>—</td>
                    </tr>
                  )
                }
                return (
                  <tr key={i} {...dropDateHandlers(r.date)} {...pickDateHandlers(r.date)} {...drillHandlers(r, rowKey)}>
                    <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                      {r.label}
                      {r.detail ? <span style={{ color: 'var(--text-muted)' }}> · {r.detail}</span> : null}
                      {chevron}
                    </td>
                    <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', whiteSpace: 'nowrap' }}>
                      {r.amount >= 0 ? '+' : '−'}{money(r.amount)}
                    </td>
                    <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {r.balance < 0 ? '−' : ''}{money(r.balance)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {payReport ? (
        <PayStubViewModal title={payReport.title} html={payReport.html} zIndex={1200} onClose={() => setPayReport(null)} />
      ) : null}

      <PersonOffsetFormModal
        open={editOffset != null}
        onClose={() => setEditOffset(null)}
        zIndex={1200}
        editingOffset={editOffset}
        personNameOptions={editOffset ? [editOffset.person_name] : []}
        onSaved={() => {
          setEditOffset(null)
          void load()
        }}
        onError={setDrillError}
      />

      {infoCard ? (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInfoCard(null)
          }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{ background: 'var(--surface)', borderRadius: 8, width: '100%', maxWidth: 420, boxShadow: '0 10px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}
          >
            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, flex: 1 }}>{infoCard.title}</h3>
              <button
                type="button"
                onClick={() => setInfoCard(null)}
                style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
              {infoCard.lines.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem', margin: '0.3rem 0' }}>
                  <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{k}</span>
                  <span style={{ textAlign: 'right' }}>{v}</span>
                </div>
              ))}
              <p style={{ background: 'var(--bg-muted)', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.9rem 0 0' }}>
                {infoCard.note}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
