import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import {
  POSITIVE_OFFSET_TYPES,
  buildPartnerJournal,
  mergeNotesIntoDisplay,
  mergePendingIntoJournal,
  netPosition,
  pendingOffsetSignedAmount,
  summarizePendingOffsets,
  type JournalAdditionalLine,
  type JournalDeduction,
  type JournalPayment,
  type JournalPendingOffset,
  type JournalRow,
  type JournalStub,
  type LedgerNote,
} from '../../lib/partnerLedger/partnerLedgerJournal'

/**
 * Partnerships → Ledger tab (PARTNERSHIPS_PLAN.md PR 3): the append-only
 * journal behind the statements — every posting (labor, additions, deductions,
 * payouts) oldest-first with a running balance, plus offsets still pending.
 * Pure view over the pay_stubs family via the dev's payroll-access RLS; the
 * shaping lives in the partnerLedgerJournal kernel.
 */

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

type NoteDraft = { note_date: string; memo: string; partner_visible: boolean }

export function PartnershipLedgerTab({ personId, partnershipId }: { personId: string; partnershipId: string }) {
  const [rows, setRows] = useState<JournalRow[] | null>(null)
  const [balance, setBalance] = useState(0)
  const [pending, setPending] = useState<{ count: number; net: number }>({ count: 0, net: 0 })
  const [pendingRows, setPendingRows] = useState<JournalPendingOffset[]>([])
  const [failed, setFailed] = useState(false)
  const [notes, setNotes] = useState<LedgerNote[]>([])
  const [notesUnavailable, setNotesUnavailable] = useState(false)
  const [editingNote, setEditingNote] = useState<string | 'new' | null>(null)
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null)
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

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
      .select('id, type, amount, occurred_date, description, pay_stub_id')
      .eq('person_id', personId)
    type OffsetRow = JournalPendingOffset & { id: string; pay_stub_id: string | null }
    const offsets = ((offRes.data ?? []) as OffsetRow[]) || []

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
  const displayRows = mergeNotesIntoDisplay(mergePendingIntoJournal(rows, pendingRows), notes)

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
            Tip: drag a note’s grey triangle onto a ledger row to load that row’s date here.
          </span>
          {noteError ? <span style={{ flexBasis: '100%', fontSize: '0.75rem', color: 'var(--text-red-600)' }}>{noteError}</span> : null}
        </div>
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
                const dropStyle = dragOverDate === r.date && noteDraft ? { borderTop: '2px solid var(--text-amber-700)' } : {}
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
                if (r.kind === 'pending') {
                  return (
                    <tr key={i} {...dropDateHandlers(r.date)}>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{r.date}</td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>{r.label}</td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: r.amount >= 0 ? '#16a34a' : 'var(--text-red-600)', whiteSpace: 'nowrap', opacity: 0.85 }}>
                        {r.amount >= 0 ? '+' : '−'}{money(r.amount)}
                      </td>
                      <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>—</td>
                    </tr>
                  )
                }
                return (
                  <tr key={i} {...dropDateHandlers(r.date)}>
                    <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ ...dropStyle, padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)' }}>
                      {r.label}
                      {r.detail ? <span style={{ color: 'var(--text-muted)' }}> · {r.detail}</span> : null}
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
      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.6rem 0 0' }}>
        Newest first; each row’s balance is the running balance after that posting. Charges count at the date they
        happened — statements list them later as the paper record. Append-only: reversals are new rows, never edits.
      </p>
    </div>
  )
}
