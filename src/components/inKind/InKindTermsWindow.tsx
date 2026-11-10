/**
 * The terms of a deal, written down once (punch list #301): what is given, a note, the jobs it pays, and for a deal
 * with a schedule the usual credit a month, the whole monthly bill it comes off, the name that bill goes out under at
 * the bank and its first month. Makes a deal or changes one; an open deal can be ended, and one with nothing on it
 * removed.
 */
import { useEffect, useMemo, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import ConfirmDialog from '../ConfirmDialog'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { liveLines, monthOf } from '../../lib/inKind/inKindLedger'
import {
  deleteInKindArrangement,
  endInKindArrangement,
  loadInKindCandidateJobs,
  saveInKindTerms,
  type InKindLedgerData,
  type InKindLedgerJob,
  type InKindTermsInput,
} from '../../lib/inKind/inKindIo'
import { IN_KIND_CHANGE_TERMS, IN_KIND_SET_UP, candidateJobWords, jobLine, jobsWord, parseAmount, usd } from '../../lib/inKind/inKindWords'
import { bluePress, fieldBox, fieldLabel, noteStrip, pill, quietPress, redText } from './inKindStyles'

export interface InKindTermsIo {
  loadJobs: (customerId: string) => Promise<InKindLedgerJob[]>
  save: (args: { id: string | null; terms: InKindTermsInput; jobIds: string[]; userId: string }) => Promise<string>
  end: (arrangementId: string) => Promise<void>
  remove: (arrangementId: string) => Promise<boolean>
}
const REAL_IO: InKindTermsIo = { loadJobs: loadInKindCandidateJobs, save: saveInKindTerms, end: endInKindArrangement, remove: deleteInKindArrangement }

const jobOpen = (j: InKindLedgerJob): number => Math.max(0, Number(j.revenue ?? 0) - Number(j.payments_made ?? 0))

export default function InKindTermsWindow({
  customerId,
  customerName,
  existing,
  userId,
  onClose,
  onSaved,
  io = REAL_IO,
  zIndex = 1200,
}: {
  customerId: string
  customerName: string
  existing: InKindLedgerData | null
  userId: string
  onClose: () => void
  /** Saved, ended or removed; the owner reads the customer's deals again. */
  onSaved: () => void
  io?: InKindTermsIo
  zIndex?: number
}) {
  const toast = useToastContext()
  const arr = existing?.arrangement ?? null
  const [whatGiven, setWhatGiven] = useState(arr?.what_given ?? '')
  const [note, setNote] = useState(arr?.note ?? '')
  const [monthly, setMonthly] = useState(arr?.monthly_amount != null)
  const [monthlyAmount, setMonthlyAmount] = useState(arr?.monthly_amount != null ? String(arr.monthly_amount) : '')
  const [monthlyDue, setMonthlyDue] = useState(arr?.monthly_due != null ? String(arr.monthly_due) : '')
  const [bankPayee, setBankPayee] = useState(arr?.bank_payee ?? '')
  const [firstMonth, setFirstMonth] = useState((arr?.starts_on ?? monthOf(todayYmdInAppTz())).slice(0, 7))
  const [jobs, setJobs] = useState<InKindLedgerJob[] | null>(null)
  const [jobsFailed, setJobsFailed] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(existing?.jobs.map((j) => j.id) ?? []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'end' | 'remove' | null>(null)

  useEffect(() => {
    let live = true
    io.loadJobs(customerId)
      .then((rows) => {
        if (!live) return
        setJobs(rows)
        // A new deal starts with every billed job that still has money open, since those are the bills it pays.
        if (!existing) setPicked(new Set(rows.filter((j) => j.status === 'billed' && jobOpen(j) > 0.005 && !j.in_kind_arrangement_id).map((j) => j.id)))
      })
      .catch((e: unknown) => {
        if (live) setJobsFailed(formatErrorMessage(e, 'This customer’s jobs could not be read.'))
      })
    return () => {
      live = false
    }
  }, [customerId, existing, io])

  const amount = parseAmount(monthlyAmount)
  const due = monthlyDue.trim() ? parseAmount(monthlyDue) : null
  const monthlyOk = !monthly || (Number.isFinite(amount) && amount > 0 && (due == null || (Number.isFinite(due) && due >= amount)) && /^\d{4}-\d{2}$/.test(firstMonth))
  const ready = whatGiven.trim().length > 0 && monthlyOk && !saving
  // Only a billed job has money on a bill: a job still working is picked, and adds nothing to what is open.
  const pickedOpen = useMemo(() => (jobs ?? []).filter((j) => picked.has(j.id) && j.status === 'billed').reduce((s, j) => s + jobOpen(j), 0), [jobs, picked])
  const hasLiveLines = existing ? liveLines(existing.lines).length > 0 : false

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    if (!ready) return
    setSaving(true)
    setError(null)
    try {
      await io.save({
        id: arr?.id ?? null,
        userId,
        jobIds: [...picked],
        terms: {
          customer_id: customerId,
          what_given: whatGiven,
          note,
          monthly_amount: monthly ? amount : null,
          monthly_due: monthly ? due : null,
          bank_payee: monthly ? bankPayee : '',
          starts_on: monthly ? `${firstMonth}-01` : null,
        },
      })
      toast.showToast(arr ? 'The terms are saved.' : `${customerName} now pays in kind.`, 'success')
      onSaved()
    } catch (e) {
      setError(formatErrorMessage(e, 'The terms were not saved.'))
    } finally {
      setSaving(false)
    }
  }

  const runConfirm = async () => {
    if (!arr || !confirm) return
    setSaving(true)
    try {
      if (confirm === 'end') {
        await io.end(arr.id)
        toast.showToast('The arrangement is ended. Its bills read as ordinary bills again.', 'success')
      } else {
        const gone = await io.remove(arr.id)
        if (!gone) throw new Error('It still has a line on it. Take the line back first.')
        toast.showToast('The arrangement is removed.', 'success')
      }
      setConfirm(null)
      onSaved()
    } catch (e) {
      setConfirm(null)
      setError(formatErrorMessage(e, confirm === 'end' ? 'The arrangement was not ended.' : 'The arrangement was not removed.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveModalShell
      title={arr ? IN_KIND_CHANGE_TERMS : IN_KIND_SET_UP}
      onRequestClose={onClose}
      maxWidthDesktop={600}
      zIndex={zIndex}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {arr && !arr.ended_at ? (
              <button type="button" disabled={saving} onClick={() => setConfirm('end')} style={{ ...quietPress, color: 'var(--text-red-700)' }}>
                End the arrangement
              </button>
            ) : null}
            {arr && !hasLiveLines ? (
              <button type="button" disabled={saving} onClick={() => setConfirm('remove')} style={{ ...quietPress, color: 'var(--text-red-700)' }}>
                Remove it
              </button>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={onClose} style={quietPress}>
              Cancel
            </button>
            <button type="button" onClick={() => void save()} disabled={!ready} style={bluePress(!ready)} data-testid="in-kind-terms-save">
              {saving ? 'Saving the terms…' : arr ? 'Save the terms' : 'Save the arrangement'}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{customerName}</div>
        <div>
          <label htmlFor="in-kind-what" style={fieldLabel}>
            What they give instead of money
          </label>
          <input id="in-kind-what" autoFocus={!arr} maxLength={200} value={whatGiven} onChange={(e) => setWhatGiven(e.target.value)} placeholder="e.g. Rent credit, the shop" style={fieldBox} />
        </div>
        <div>
          <label htmlFor="in-kind-note" style={fieldLabel}>
            The terms, in your words
          </label>
          <textarea id="in-kind-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We pay half the rent. The other half pays down finished work." style={{ ...fieldBox, resize: 'vertical' }} />
        </div>

        <div>
          <div style={fieldLabel}>The jobs it pays</div>
          {jobsFailed ? (
            <div role="alert" style={redText}>
              {jobsFailed}
            </div>
          ) : jobs == null ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Reading this customer’s jobs…</div>
          ) : jobs.length === 0 ? (
            <div style={noteStrip}>This customer has no job yet. The arrangement can be saved now, and its jobs picked here later.</div>
          ) : (
            <>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflowY: 'auto' }}>
                {jobs.map((j) => {
                  const w = candidateJobWords(j, arr?.id ?? null)
                  return (
                    <label key={j.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', opacity: w.locked ? 0.6 : 1, cursor: w.locked ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={picked.has(j.id)} disabled={w.locked} onChange={() => toggle(j.id)} />
                      <span style={{ flex: 1, minWidth: 0, color: 'var(--text-strong)' }}>{jobLine(j)}</span>
                      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{w.words}</span>
                    </label>
                  )
                })}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {jobsWord(picked.size)} picked, {usd(pickedOpen)} open on bills. Their bills will read as scheduled in kind, not late.
              </div>
            </>
          )}
        </div>

        <div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)', cursor: 'pointer' }}>
            <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} />
            It has a credit every month
            <span style={pill(monthly ? 'blue' : 'grey')}>{monthly ? 'Every month' : 'As it comes'}</span>
          </label>
          {!monthly ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>With no monthly credit, a line is added when something is given. Nothing is due on a date.</div> : null}
          {monthly ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <div>
                <label htmlFor="in-kind-monthly" style={fieldLabel}>
                  The usual credit a month
                </label>
                <input id="in-kind-monthly" inputMode="decimal" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} placeholder="0.00" style={fieldBox} />
              </div>
              <div>
                <label htmlFor="in-kind-first-month" style={fieldLabel}>
                  The first month to enter
                </label>
                <input id="in-kind-first-month" type="month" value={firstMonth} onChange={(e) => setFirstMonth(e.target.value)} style={fieldBox} />
              </div>
              <div>
                <label htmlFor="in-kind-due" style={fieldLabel}>
                  The whole monthly bill
                </label>
                <input id="in-kind-due" inputMode="decimal" value={monthlyDue} onChange={(e) => setMonthlyDue(e.target.value)} placeholder="e.g. the rent" style={fieldBox} />
              </div>
              <div>
                <label htmlFor="in-kind-payee" style={fieldLabel}>
                  Its name at the bank
                </label>
                <input id="in-kind-payee" maxLength={200} value={bankPayee} onChange={(e) => setBankPayee(e.target.value)} placeholder="as the bank line reads" style={fieldBox} />
              </div>
              <div style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                The last two are for a credit that comes off a bill we pay, such as rent. With them the app reads what left the bank that month and suggests the credit.
              </div>
            </div>
          ) : null}
          {monthly && !monthlyOk ? <div style={{ ...redText, marginTop: 4 }}>Enter the usual credit and its first month. The whole monthly bill cannot be less than the credit.</div> : null}
        </div>
        {error ? (
          <div role="alert" style={redText}>
            {error}
          </div>
        ) : null}
      </div>
      {confirm === 'end' ? (
        <ConfirmDialog
          title="End this arrangement?"
          body="It takes no more lines. Its open bills read as ordinary bills again, so they can read as late. What was given stays in the ledger."
          confirmLabel="End the arrangement"
          cancelLabel="Keep it open"
          onConfirm={() => void runConfirm()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
      {confirm === 'remove' ? (
        <ConfirmDialog
          title="Remove this arrangement?"
          body="Nothing given stands on it, so it goes whole. Its jobs’ bills read as ordinary bills again."
          confirmLabel="Remove the arrangement"
          cancelLabel="Keep it"
          onConfirm={() => void runConfirm()}
          onCancel={() => setConfirm(null)}
        />
      ) : null}
    </ResponsiveModalShell>
  )
}
