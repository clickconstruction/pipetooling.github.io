/**
 * Add a line (punch list #301): one thing given instead of money. Three boxes, the amount, the date and a memo of the
 * details, and what it counts as: overhead, or a job's material. Under them the window says where the line goes,
 * read from the database's own dry run, so the screen never shows a split the save would not make.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { type InKindAddResult } from '../../lib/inKind/inKindLedger'
import { addInKindLine, searchInKindCostJobs, type InKindCostJob, type InKindLedgerData, type InKindLineInput } from '../../lib/inKind/inKindIo'
import {
  IN_KIND_ADD_LINE,
  IN_KIND_AMOUNT_LABEL,
  IN_KIND_A_JOB,
  IN_KIND_A_JOB_WHY,
  IN_KIND_COUNTS_LABEL,
  IN_KIND_DATE_LABEL,
  IN_KIND_MEMO_LABEL,
  IN_KIND_MEMO_PLACEHOLDER,
  IN_KIND_OVERHEAD,
  IN_KIND_OVERHEAD_WHY,
  IN_KIND_WINDOW_NOTE,
  addLinePress,
  addedWords,
  heldWords,
  jobLine,
  parseAmount,
  placedWords,
  unappliedWords,
  usd,
} from '../../lib/inKind/inKindWords'
import { amberStrip, bluePress, choiceBox, fieldBox, fieldLabel, noteStrip, quietPress, redText } from './inKindStyles'

export interface InKindAddLineIo {
  addLine: (input: InKindLineInput, dryRun: boolean) => Promise<InKindAddResult>
  searchJobs: (text: string) => Promise<Array<InKindCostJob & { job_address: string | null }>>
}
const REAL_IO: InKindAddLineIo = { addLine: addInKindLine, searchJobs: searchInKindCostJobs }

export default function InKindAddLineWindow({
  data,
  onClose,
  onAdded,
  io = REAL_IO,
  zIndex = 1200,
}: {
  data: InKindLedgerData
  onClose: () => void
  onAdded: () => void
  io?: InKindAddLineIo
  zIndex?: number
}) {
  const toast = useToastContext()
  const { arrangement } = data
  const [amountRaw, setAmountRaw] = useState('')
  const [givenOn, setGivenOn] = useState(() => todayYmdInAppTz())
  const [memo, setMemo] = useState('')
  const [onJob, setOnJob] = useState(false)
  const [costJob, setCostJob] = useState<(InKindCostJob & { job_address?: string | null }) | null>(null)
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<Array<InKindCostJob & { job_address: string | null }>>([])
  const [searchFailed, setSearchFailed] = useState<string | null>(null)
  const [plan, setPlan] = useState<InKindAddResult | null>(null)
  const [planFailed, setPlanFailed] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const amount = parseAmount(amountRaw)
  const amountOk = Number.isFinite(amount) && amount > 0
  const memoOk = memo.trim().length > 0
  const jobOk = !onJob || Boolean(costJob)
  const ready = amountOk && memoOk && Boolean(givenOn) && jobOk && !saving

  // Where it goes: the database's own answer, asked a moment after the amount or the date settles.
  useEffect(() => {
    if (!amountOk || !givenOn) {
      setPlan(null)
      setPlanFailed(null)
      return
    }
    const mine = ++seq.current
    const t = window.setTimeout(() => {
      io.addLine({ arrangementId: arrangement.id, givenOn, amount, memo: memo.trim() || 'Preview', costJobId: null, forMonth: null }, true)
        .then((r) => {
          if (mine !== seq.current) return
          setPlan(r)
          setPlanFailed(null)
        })
        .catch((e: unknown) => {
          if (mine !== seq.current) return
          setPlan(null)
          setPlanFailed(formatErrorMessage(e, 'Where it goes could not be read.'))
        })
    }, 350)
    return () => window.clearTimeout(t)
    // The memo is not part of where a line goes; reading it again on every letter would only flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountOk, amount, givenOn, arrangement.id, io])

  // The job to count it on.
  useEffect(() => {
    if (!onJob || costJob || search.trim().length < 2) {
      setFound([])
      return
    }
    let live = true
    const t = window.setTimeout(() => {
      io.searchJobs(search)
        .then((rows) => {
          if (!live) return
          setFound(rows)
          setSearchFailed(null)
        })
        .catch((e: unknown) => {
          if (!live) return
          setFound([])
          setSearchFailed(formatErrorMessage(e, 'The jobs could not be searched.'))
        })
    }, 250)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [onJob, costJob, search, io])

  const unapplied = useMemo(() => (plan ? unappliedWords(plan.unapplied, plan.applied.reduce((s, a) => s + a.amount, 0)) : null), [plan])

  const save = async () => {
    if (!ready) return
    setSaving(true)
    setError(null)
    try {
      const r = await io.addLine({ arrangementId: arrangement.id, givenOn, amount, memo: memo.trim(), costJobId: onJob ? (costJob?.id ?? null) : null, forMonth: null }, false)
      toast.showToast(addedWords(r, amount), 'success')
      onAdded()
    } catch (e) {
      setError(formatErrorMessage(e, 'The line was not saved.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveModalShell
      title={IN_KIND_ADD_LINE}
      onRequestClose={onClose}
      maxWidthDesktop={540}
      zIndex={zIndex}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onClose} style={quietPress}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={!ready} style={bluePress(!ready)} data-testid="in-kind-add-line-save">
            {saving ? 'Adding the line…' : addLinePress(amountOk ? amount : 0)}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {arrangement.partner_name} · {arrangement.what_given}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label htmlFor="in-kind-amount" style={fieldLabel}>
              {IN_KIND_AMOUNT_LABEL}
            </label>
            <input
              id="in-kind-amount"
              inputMode="decimal"
              autoFocus
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
              placeholder="0.00"
              style={{ ...fieldBox, borderColor: amountRaw && !amountOk ? 'var(--text-red-700)' : 'var(--border-strong)' }}
            />
          </div>
          <div>
            <label htmlFor="in-kind-date" style={fieldLabel}>
              {IN_KIND_DATE_LABEL}
            </label>
            <input id="in-kind-date" type="date" value={givenOn} max={todayYmdInAppTz()} onChange={(e) => setGivenOn(e.target.value)} style={fieldBox} />
          </div>
        </div>
        <div>
          <label htmlFor="in-kind-memo" style={fieldLabel}>
            {IN_KIND_MEMO_LABEL}
          </label>
          <textarea id="in-kind-memo" rows={2} maxLength={500} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder={IN_KIND_MEMO_PLACEHOLDER} style={{ ...fieldBox, resize: 'vertical' }} />
        </div>
        <div>
          <div style={fieldLabel}>{IN_KIND_COUNTS_LABEL}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <button type="button" aria-pressed={!onJob} onClick={() => setOnJob(false)} style={choiceBox(!onJob)}>
              <span>
                <b style={{ color: 'var(--text-strong)' }}>{IN_KIND_OVERHEAD}</b>
                <br />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{IN_KIND_OVERHEAD_WHY}</span>
              </span>
            </button>
            <button type="button" aria-pressed={onJob} onClick={() => setOnJob(true)} style={choiceBox(onJob)}>
              <span>
                <b style={{ color: 'var(--text-strong)' }}>{IN_KIND_A_JOB}</b>
                <br />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{IN_KIND_A_JOB_WHY}</span>
              </span>
            </button>
          </div>
          {onJob ? (
            <div style={{ marginTop: 8 }}>
              {costJob ? (
                <div style={{ ...noteStrip, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <span>
                    <b>{jobLine(costJob)}</b>
                    {amountOk ? <> counts {usd(amount)} as its material.</> : null}
                  </span>
                  <button type="button" onClick={() => setCostJob(null)} style={quietPress}>
                    Pick another
                  </button>
                </div>
              ) : (
                <>
                  <label htmlFor="in-kind-job-search" style={{ ...fieldLabel, fontWeight: 500 }}>
                    Find the job by its number, name or address
                  </label>
                  <input id="in-kind-job-search" value={search} onChange={(e) => setSearch(e.target.value)} style={fieldBox} />
                  {searchFailed ? <div style={{ ...redText, marginTop: 4 }}>{searchFailed}</div> : null}
                  {found.length > 0 ? (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 6, overflow: 'hidden' }}>
                      {found.map((j) => (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => setCostJob(j)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', font: 'inherit', fontSize: '0.8125rem', color: 'var(--text-strong)', cursor: 'pointer' }}
                        >
                          {jobLine(j)}
                          {j.job_address ? <span style={{ color: 'var(--text-muted)' }}> · {j.job_address}</span> : null}
                        </button>
                      ))}
                    </div>
                  ) : search.trim().length >= 2 && !searchFailed ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Keep typing to find the job.</div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>

        {plan && (plan.applied.length > 0 || plan.held.length > 0 || unapplied) ? (
          <div data-testid="in-kind-where-it-goes">
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
        {planFailed ? <div style={redText}>{planFailed}</div> : null}
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
