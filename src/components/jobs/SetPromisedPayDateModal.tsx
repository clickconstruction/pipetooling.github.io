import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { PAID_METHODS, parsePaymentPromisesRpc, promisesOnJob, voidTakesDateOffBoard, type PaidMethod, type PaymentPromise, type PromiseChannel } from '../../lib/jobs/paymentPromises'
import { clearJobPromisedPayDate, voidJobPaymentPromise } from '../../lib/jobs/paymentChaseIo'
import PromiseRecordList from './PromiseRecordList'

/**
 * Write down their word — the customer's word on paying, one sheet with a switch (punch list #129, v2.5648):
 *
 * - **They'll pay by…** (the promise, "They said…" on a Billed Awaiting Payment row since Their Word PR 2): the
 *   payment date the customer actually named ("the check run is on the 25th"), who said it and how. The promise
 *   overrides the statistical expected-pay estimate on the chip and in the payment forecast, and every date named
 *   stays on record — a changed date is a second promise, not an edit. Clearing returns the row to the estimate; the
 *   promise stays in the record.
 * - **They say they paid…**: how they say they paid, the day they name, the amount when it is not all of it, who said
 *   it and how. It is the same record with a kind of its own (`add_job_payment_claim`): the job stays Billed, the
 *   board's date is untouched, and the office pairs the claim with the deposit when it lands.
 *
 * Under the form, the words on record for the bill, both kinds. "never said that" voids one — a wrong entry. When it
 * is the promise the board shows, the date comes off the board with it.
 */
const CHANNELS: ReadonlyArray<{ key: PromiseChannel; label: string }> = [
  { key: 'phone', label: 'Phone' },
  { key: 'text', label: 'Text' },
  { key: 'email', label: 'Email' },
  { key: 'in_person', label: 'In person' },
]

export type PromiseSheetMode = 'promise' | 'paid'

/** PostgREST's "no such function" — the migration hasn't been pushed yet; fall back to the old writer. */
function isMissingRpc(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : ''
  return /could not find the function|PGRST202/i.test(msg)
}

/** "4200" → 4200, "" → null, anything else → NaN (the Save holds). */
export function parseClaimAmount(raw: string): number | null {
  const s = raw.replace(/[$,\s]/g, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : Number.NaN
}

export default function SetPromisedPayDateModal({
  jobId,
  jobLabel,
  initialYmd,
  initialMode = 'promise',
  initialSaidBy,
  initialChannel,
  quickDays,
  contextLine,
  onClose,
  onSaved,
}: {
  jobId: string
  jobLabel: string
  /** Existing promise to edit, or null when marking fresh. */
  initialYmd: string | null
  /** Which side the sheet opens on (v2.5648); the Pipeline's chip opens on the promise. */
  initialMode?: PromiseSheetMode
  /** From a line in the thread (v2.5649): who the line is from, and how it came. */
  initialSaidBy?: string | null
  initialChannel?: PromiseChannel | null
  /** Days to pick with one tap above the date box (the Money in bar's pen, punch list #191). */
  quickDays?: ReadonlyArray<{ ymd: string; label: string }>
  /** One line under the job saying where its date stands now (the pen). */
  contextLine?: string | null
  onClose: () => void
  /** Fired after a successful save/clear so the board can refresh its promise map. */
  onSaved: () => void
}) {
  const { showToast } = useToastContext()
  const [mode, setMode] = useState<PromiseSheetMode>(initialMode)
  const [ymd, setYmd] = useState(initialYmd ?? '')
  const [saidBy, setSaidBy] = useState(initialSaidBy ?? '')
  const [channel, setChannel] = useState<PromiseChannel>(initialChannel ?? 'phone')
  const [method, setMethod] = useState<PaidMethod>('check_mailed')
  const [paidYmd, setPaidYmd] = useState('')
  const [amountRaw, setAmountRaw] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const confirmDialog = useConfirmDialog()
  const [onRecord, setOnRecord] = useState<PaymentPromise[]>([])
  const [voidingId, setVoidingId] = useState<string | null>(null)
  /** The date the board shows now: the one the modal opened with, until a void takes it off. */
  const [boardYmd, setBoardYmd] = useState<string | null>(initialYmd)

  const loadOnRecord = useCallback(async () => {
    try {
      // The job's own read (v2.5646): the job's people read it where the company-wide one answers them nothing.
      // Before the push the per-job function is not there, so the company-wide read filtered here stands in.
      const perJob = await supabase.rpc('list_job_payment_promises_for' as never, { p_job_id: jobId } as never)
      const { data } = perJob.error && isMissingRpc(perJob.error) ? await supabase.rpc('list_job_payment_promises' as never) : perJob
      setOnRecord(promisesOnJob(parsePaymentPromisesRpc(data as unknown), jobId))
    } catch {
      // the record is an extra — the form works without it
    }
  }, [jobId])
  useEffect(() => {
    void loadOnRecord()
  }, [loadOnRecord])

  const neverSaid = async (promise: PaymentPromise) => {
    const day = formatYmdMonthDay(promise.promisedYmd)
    const claim = promise.kind === 'paid_claim'
    const offBoard = voidTakesDateOffBoard(promise, boardYmd, onRecord)
    const ok = await confirmDialog({
      title: claim ? `They never said they paid ${day}?` : `They never said ${day}?`,
      message: `This takes the ${claim ? 'word' : 'promise'} off the record for ${jobLabel}, so it does not count for or against them.${offBoard ? ' The date comes off the board too.' : ''} Use it for a wrong entry. If they changed the date, save the new date instead.`,
      confirmLabel: 'Never said that',
      danger: true,
    })
    if (!ok) return
    setVoidingId(promise.id)
    try {
      await voidJobPaymentPromise(promise.id)
      if (offBoard) {
        await clearJobPromisedPayDate(jobId)
        setBoardYmd(null)
        setYmd('')
      }
      showToast(offBoard ? `${day} is off the record and off the board.` : `${day} is off the record.`, 'success')
      onSaved()
      await loadOnRecord()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not take the promise off the record'), 'error')
    } finally {
      setVoidingId(null)
    }
  }

  const submit = async (dateOrNull: string | null) => {
    setSaving(true)
    try {
      if (dateOrNull) {
        try {
          const { error } = await supabase.rpc('add_job_payment_promise' as never, {
            p_job_id: jobId,
            p_date: dateOrNull,
            p_said_by: saidBy.trim() || null,
            p_channel: channel,
            p_note: null,
          } as never)
          if (error) throw error
        } catch (e) {
          if (!isMissingRpc(e)) throw e
          const { error } = await supabase.rpc('set_job_promised_pay_date' as never, { p_job_id: jobId, p_date: dateOrNull } as never)
          if (error) throw error
        }
      } else {
        const { error } = await supabase.rpc('set_job_promised_pay_date' as never, { p_job_id: jobId, p_date: null } as never)
        if (error) throw error
      }
      showToast(dateOrNull ? 'Promise saved.' : 'Promised date cleared — the promise stays on record.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not save the promise'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const amount = parseClaimAmount(amountRaw)
  const claimReady = paidYmd !== '' && !Number.isNaN(amount)

  const submitClaim = async () => {
    if (!claimReady) return
    setSaving(true)
    try {
      const { error } = await supabase.rpc('add_job_payment_claim' as never, {
        p_job_id: jobId,
        p_date: paidYmd,
        p_method: method,
        p_amount: amount,
        p_said_by: saidBy.trim() || null,
        p_channel: channel,
        p_note: note.trim() || null,
      } as never)
      if (error) throw error
      showToast('Written down. The job stays billed until the money lands.', 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not write it down'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.45rem 0.6rem',
    fontSize: '0.9rem',
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--surface)',
    color: 'inherit',
  } as const
  const labelStyle = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.6rem 0 4px' } as const
  const segment = (on: boolean) =>
    ({
      padding: '0.3rem 0.7rem',
      fontSize: '0.8125rem',
      border: 'none',
      borderRight: '1px solid var(--border)',
      background: on ? 'var(--text-link)' : 'var(--surface)',
      color: on ? '#fff' : 'var(--text-muted)',
      fontWeight: on ? 600 : 400,
      cursor: 'pointer',
    }) as const

  const whoAndHow = (
    <>
      <label style={labelStyle}>
        Who said it <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
        <input type="text" value={saidBy} onChange={(e) => setSaidBy(e.target.value.slice(0, 120))} placeholder="Tanya, their office" aria-label="Who said it" style={{ ...inputStyle, marginTop: 4 }} />
      </label>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.6rem 0 4px' }}>How</div>
      <div role="radiogroup" aria-label="How they said it" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
        {CHANNELS.map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={channel === c.key} onClick={() => setChannel(c.key)} style={segment(channel === c.key)}>
            {c.label}
          </button>
        ))}
      </div>
    </>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Write down their word — a promised payment date, or that they say they paid"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 770, paddingTop: 'var(--app-top-chrome, 0px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.25rem 1.5rem', borderRadius: 8, width: 'min(440px, calc(100vw - 2rem))', maxHeight: 'min(92vh, 100%)', overflowY: 'auto', boxSizing: 'border-box' }}
      >
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Write down their word</h2>
        <p style={{ margin: '0.35rem 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobLabel}</p>
        {contextLine ? (
          <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.75rem', color: 'var(--text-faint)' }} data-promise-sheet-context>
            {contextLine}
          </p>
        ) : null}
        <div role="radiogroup" aria-label="What they said" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: '0.5rem' }} data-promise-sheet-mode={mode}>
          <button type="button" role="radio" aria-checked={mode === 'promise'} onClick={() => setMode('promise')} style={segment(mode === 'promise')}>
            They'll pay by…
          </button>
          <button type="button" role="radio" aria-checked={mode === 'paid'} onClick={() => setMode('paid')} style={segment(mode === 'paid')}>
            They say they paid…
          </button>
        </div>

        {mode === 'promise' ? (
          <>
            <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              The date the customer said this bill will be paid. It replaces the estimate on the board, and every date they name stays on record
              {boardYmd ? ' — a new date counts the earlier one as broken' : ''}.
            </p>
            {quickDays && quickDays.length > 0 ? (
              <div role="group" aria-label="Quick days" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                {quickDays.map((q) => (
                  <button
                    key={q.ymd}
                    type="button"
                    aria-pressed={ymd === q.ymd}
                    onClick={() => setYmd(q.ymd)}
                    style={{
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.8125rem',
                      borderRadius: 8,
                      border: `1px solid ${ymd === q.ymd ? 'var(--text-link)' : 'var(--border)'}`,
                      background: ymd === q.ymd ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: ymd === q.ymd ? 'var(--text-link)' : 'inherit',
                      fontWeight: ymd === q.ymd ? 700 : 400,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Pay by
              <input type="date" value={ymd} onChange={(e) => setYmd(e.target.value)} aria-label="Promised payment date" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            {whoAndHow}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <div>
                {boardYmd ? (
                  <button
                    type="button"
                    onClick={() => void submit(null)}
                    disabled={saving}
                    title="Take the date off the board. The promise stays on record."
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-red-600)', border: '1px solid var(--border)', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer' }}
                  >
                    Clear date
                  </button>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void submit(ymd || null)}
                  disabled={saving || !ymd}
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: saving || !ymd ? 'not-allowed' : 'pointer', fontWeight: 600 }}
                >
                  {saving ? '…' : 'Save promise'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0.25rem 0 0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              What they said about having paid. The job stays billed until the money lands; the office pairs this with the deposit.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>How they paid, they say</div>
            <div role="radiogroup" aria-label="How they say they paid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {PAID_METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  role="radio"
                  aria-checked={method === m.key}
                  onClick={() => setMethod(m.key)}
                  style={{ ...segment(method === m.key), border: '1px solid var(--border)', borderRadius: 999 }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <label style={labelStyle}>
              When, they say
              <input type="date" value={paidYmd} onChange={(e) => setPaidYmd(e.target.value)} aria-label="The day they say they paid" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={labelStyle}>
              How much <span style={{ color: 'var(--text-faint)' }}>(blank for all of it)</span>
              <input type="text" inputMode="decimal" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value.slice(0, 20))} placeholder="All of it" aria-label="How much they say they paid" style={{ ...inputStyle, marginTop: 4 }} />
              {Number.isNaN(amount) ? <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-red-600)', marginTop: 2 }}>An amount is a number over nothing, or blank.</span> : null}
            </label>
            {whoAndHow}
            <label style={labelStyle}>
              A note <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="Check #1187, she says" aria-label="A note" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem', background: 'none', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitClaim()}
                disabled={saving || !claimReady}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8125rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: saving || !claimReady ? 'not-allowed' : 'pointer', fontWeight: 600 }}
              >
                {saving ? '…' : 'Write it down'}
              </button>
            </div>
          </>
        )}
        <PromiseRecordList promises={onRecord} boardYmd={boardYmd} busyId={voidingId} onNeverSaid={(p) => void neverSaid(p)} />
      </div>
    </div>
  )
}
