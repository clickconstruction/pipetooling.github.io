/**
 * A month's credit in one press (punch list #301, PR 3). The window opens with the answer picked and the bank's own
 * lines shown as the reason. The other true answers are one tap away. The split across bills is the database's dry
 * run, the memo is written, and the press names the month and the amount. Nothing is entered by itself.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { inKindTotals, lastDayOfMonth, monthMemo, monthName, monthYear, noCreditMemo, type InKindAddResult } from '../../lib/inKind/inKindLedger'
import { monthChoices, monthNotOver, type MonthChoiceKey } from '../../lib/inKind/inKindMonthChoices'
import type { BankPaidLine } from '../../lib/inKind/inKindBank'
import { addInKindLine, type InKindLedgerData, type InKindLineInput } from '../../lib/inKind/inKindIo'
import {
  IN_KIND_DATE_LABEL,
  IN_KIND_MEMO_LABEL,
  IN_KIND_WINDOW_NOTE,
  dayShort,
  heldWords,
  jobLine,
  monthEarlyWords,
  monthSavePress,
  monthSavedWords,
  parseAmount,
  placedWords,
  unappliedWords,
  usd,
} from '../../lib/inKind/inKindWords'
import { amberStrip, bluePress, choiceBox, fieldBox, fieldLabel, noteStrip, pill, quietPress, redText } from './inKindStyles'

export interface InKindMonthIo {
  addLine: (input: InKindLineInput, dryRun: boolean) => Promise<InKindAddResult>
}
const REAL_IO: InKindMonthIo = { addLine: addInKindLine }

export default function InKindMonthWindow({
  data,
  month,
  bankLines,
  onClose,
  onEntered,
  io = REAL_IO,
  zIndex = 1100,
}: {
  data: InKindLedgerData
  /** YYYY-MM-01 */
  month: string
  /** The bank's lines to the deal's payee in this month; null when the bank was not read. */
  bankLines: BankPaidLine[] | null
  onClose: () => void
  onEntered: () => void
  io?: InKindMonthIo
  zIndex?: number
}) {
  const toast = useToastContext()
  const { arrangement, jobs, lines, payments } = data
  const totals = useMemo(() => inKindTotals(jobs, lines, payments), [jobs, lines, payments])
  const bankPaid = useMemo(() => (bankLines == null ? null : Math.round(bankLines.reduce((s, l) => s + l.amount, 0) * 100) / 100), [bankLines])
  // Ahead of the bank: the month is not over and nothing has left the bank in it, so the usual credit leads.
  const early = useMemo(() => monthNotOver(month, todayYmdInAppTz()) && (bankLines == null || bankLines.length === 0), [month, bankLines])
  const choices = useMemo(
    () => monthChoices({ monthlyAmount: arrangement.monthly_amount ?? 0, monthlyDue: arrangement.monthly_due, bankPaid, left: totals.left, early }),
    [arrangement.monthly_amount, arrangement.monthly_due, bankPaid, totals.left, early],
  )
  const [picked, setPicked] = useState<MonthChoiceKey>(() => choices[0]?.key ?? 'other')
  const [otherRaw, setOtherRaw] = useState('')
  const lastBankDay = bankLines && bankLines.length > 0 ? bankLines[bankLines.length - 1]!.day : null
  const [givenOn, setGivenOn] = useState(() => {
    const today = todayYmdInAppTz()
    const end = lastDayOfMonth(month)
    return lastBankDay ?? (today < end ? today : end)
  })
  const choice = choices.find((c) => c.key === picked) ?? choices[0]!
  const amount = picked === 'other' ? parseAmount(otherRaw) : choice.amount
  const amountOk = picked === 'none' ? true : Number.isFinite(amount) && amount > 0
  const [memo, setMemo] = useState(() => monthMemo(arrangement.what_given, month))
  const memoTouched = useRef(false)
  const [plan, setPlan] = useState<InKindAddResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  // The memo follows the answer until a person types their own.
  useEffect(() => {
    if (memoTouched.current) return
    setMemo(picked === 'none' ? noCreditMemo(month) : monthMemo(arrangement.what_given, month))
  }, [picked, month, arrangement.what_given])

  useEffect(() => {
    if (picked === 'none' || !amountOk || !givenOn) {
      setPlan(null)
      return
    }
    const mine = ++seq.current
    const t = window.setTimeout(() => {
      io.addLine({ arrangementId: arrangement.id, givenOn, amount, memo: 'Preview', costJobId: null, forMonth: null }, true)
        .then((r) => {
          if (mine === seq.current) setPlan(r)
        })
        .catch(() => {
          if (mine === seq.current) setPlan(null)
        })
    }, 250)
    return () => window.clearTimeout(t)
  }, [picked, amountOk, amount, givenOn, arrangement.id, io])

  const ready = amountOk && memo.trim().length > 0 && Boolean(givenOn) && !saving
  const saveAmount = picked === 'none' ? 0 : amountOk ? amount : 0
  const unapplied = plan ? unappliedWords(plan.unapplied, plan.applied.reduce((s, a) => s + a.amount, 0)) : null

  const save = async () => {
    if (!ready) return
    setSaving(true)
    setError(null)
    try {
      const r = await io.addLine({ arrangementId: arrangement.id, givenOn, amount: saveAmount, memo: memo.trim(), costJobId: null, forMonth: month }, false)
      toast.showToast(monthSavedWords(month, saveAmount, r), 'success')
      onEntered()
    } catch (e) {
      setError(formatErrorMessage(e, `${monthName(month)}’s credit was not recorded.`))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveModalShell
      title={`${monthName(month)}’s credit`}
      onRequestClose={onClose}
      maxWidthDesktop={560}
      zIndex={zIndex}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onClose} style={quietPress}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={!ready} style={bluePress(!ready)} data-testid="in-kind-month-save">
            {saving ? 'Recording…' : monthSavePress(month, saveAmount)}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {arrangement.partner_name} · {arrangement.what_given} · {monthYear(month)}
        </div>
        <div style={noteStrip} data-testid="in-kind-month-bank">
          <b>What the bank shows.</b>{' '}
          {bankLines == null
            ? 'The bank was not read for this arrangement. Pick the amount below.'
            : bankLines.length === 0
              ? early
                ? `Nothing has left the bank to ${arrangement.bank_payee || 'them'} in ${monthName(month)} yet.`
                : `Nothing left the bank to ${arrangement.bank_payee || 'them'} in ${monthName(month)}.`
              : bankLines.map((l) => `${dayShort(l.day)}, ${l.name}, ${usd(l.amount)} left the account.`).join(' ')}
        </div>
        {early ? (
          <div style={amberStrip} data-testid="in-kind-month-early">
            {monthEarlyWords(month)}
          </div>
        ) : null}
        <div>
          <div style={fieldLabel}>This month’s credit</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {choices.map((c) => (
              <button key={c.key} type="button" aria-pressed={picked === c.key} onClick={() => setPicked(c.key)} style={choiceBox(picked === c.key)}>
                <span>
                  <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums' }}>{c.title}</b>{' '}
                  {c.fromBank ? <span style={pill('blue')}>the bank says this one</span> : null}
                  {c.why ? (
                    <>
                      <br />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.why}</span>
                    </>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
          {picked === 'other' ? (
            <div style={{ marginTop: 8 }}>
              <label htmlFor="in-kind-month-other" style={fieldLabel}>
                The amount
              </label>
              <input id="in-kind-month-other" inputMode="decimal" autoFocus value={otherRaw} onChange={(e) => setOtherRaw(e.target.value)} placeholder="0.00" style={fieldBox} />
            </div>
          ) : null}
        </div>

        {plan && picked !== 'none' && (plan.applied.length > 0 || plan.held.length > 0 || unapplied) ? (
          <div data-testid="in-kind-month-where">
            <div style={fieldLabel}>Where it goes, oldest bill first</div>
            {plan.applied.map((a) => (
              <div key={`${a.job_id}:${a.invoice_id ?? 'job'}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                <span>
                  {jobLine(a)}
                  <br />
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{placedWords(a)}</span>
                </span>
                <b style={{ color: 'var(--text-strong)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{usd(a.amount)}</b>
              </div>
            ))}
            {plan.held.map((h) => (
              <div key={`held:${h.invoice_id ?? h.job_id}`} style={{ ...amberStrip, marginTop: 6 }}>
                {heldWords(h)}
              </div>
            ))}
            {unapplied ? <div style={{ ...noteStrip, marginTop: 6 }}>{unapplied}</div> : null}
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label htmlFor="in-kind-month-memo" style={fieldLabel}>
              {IN_KIND_MEMO_LABEL}
            </label>
            <input
              id="in-kind-month-memo"
              maxLength={500}
              value={memo}
              onChange={(e) => {
                memoTouched.current = true
                setMemo(e.target.value)
              }}
              style={fieldBox}
            />
          </div>
          <div>
            <label htmlFor="in-kind-month-date" style={fieldLabel}>
              {IN_KIND_DATE_LABEL}
            </label>
            <input id="in-kind-month-date" type="date" value={givenOn} max={todayYmdInAppTz()} onChange={(e) => setGivenOn(e.target.value)} style={fieldBox} />
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{IN_KIND_WINDOW_NOTE}</div>
        {error ? (
          <div role="alert" style={redText}>
            {error}
          </div>
        ) : null}
      </div>
    </ResponsiveModalShell>
  )
}
