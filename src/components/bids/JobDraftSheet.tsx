/**
 * Send to Dispatch (punch list #129 follow-up, v2.5659, the owner's call of 2026-10-20): the estimator's door from a won
 * bid. An estimator may not open a job, so they send Dispatch a short draft of it — the name, the address, the GC that
 * won it, the figure it starts at, the trade, a wanted-by day and a note — and the Dispatch inbox's **Open the job**
 * opens New Job with it laid over the bid's import. The assistant adds the team and the schedule and saves. It opens
 * with what New Job's import would choose (`draftFromBid`), so the two agree, and sends through the bid's existing
 * hand-off (`askDispatchToOpenJob`), which still refuses when the bid already has a job or Dispatch already has it.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { notifyDispatchRequestsChanged } from '../../lib/dispatchRequestHelpers'
import { askDispatchToOpenJob, type AskDispatchOutcome } from '../../lib/bids/openJobFromBidDispatchRequest'
import { draftCarryFor, draftProblem, type JobDraft } from '../../lib/bids/jobDraft'
import { supabaseJobDraftIo, type JobDraftIo, type JobDraftStart } from '../../lib/bids/jobDraftIo'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { formatErrorMessage } from '../../utils/errorHandling'
import ResponsiveModalShell from '../ResponsiveModalShell'

export interface JobDraftSheetProps {
  bidId: string
  onClose: () => void
  /** After the request is filed (or Dispatch already had it): the caller reads the request again. */
  onSent?: (outcome: AskDispatchOutcome) => void
  /** For a smoke: the reads, and the send. */
  io?: JobDraftIo
  send?: typeof askDispatchToOpenJob
}

const labelStyle: CSSProperties = { display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.6rem 0 4px' }
const inputStyle: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.4rem 0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)' }
const quiet: CSSProperties = { margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }

export function JobDraftSheet({ bidId, onClose, onSent, io = supabaseJobDraftIo, send = askDispatchToOpenJob }: JobDraftSheetProps) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [start, setStart] = useState<JobDraftStart | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [draft, setDraft] = useState<JobDraft | null>(null)
  const [carryText, setCarryText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let live = true
    io.load(bidId).then(
      (s) => {
        if (!live) return
        if (!s) return setProblem('That bid could not be read.')
        setStart(s)
        setDraft(s.draft)
        setCarryText(s.draft.carry != null ? String(s.draft.carry) : '')
      },
      (e: unknown) => live && setProblem(formatErrorMessage(e, 'That bid could not be read.')),
    )
    return () => {
      live = false
    }
  }, [bidId, io])

  const carry = useMemo(() => {
    const n = Number(carryText.replace(/[$,\s]/g, ''))
    return carryText.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
  }, [carryText])
  const full = draft ? { ...draft, carry } : null
  const waits = full && start ? draftProblem(full, start.options) : null

  const set = (patch: Partial<JobDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const pickGc = (key: string) => {
    if (!start) return
    const opt = start.options.find((o) => o.key === key) ?? null
    set({ gcKey: opt?.key ?? null, gcName: opt?.name ?? null })
    const figure = draftCarryFor(start.bid, opt)
    setCarryText(figure != null ? String(figure) : '')
  }

  const submit = async () => {
    if (!full || waits || sending) return
    setSending(true)
    try {
      const outcome = await send(user?.id, showToast, bidId, { draft: full })
      if (outcome !== 'failed') {
        notifyDispatchRequestsChanged()
        onSent?.(outcome)
        onClose()
      }
    } finally {
      setSending(false)
    }
  }

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      {waits ? (
        <span role="status" style={{ ...quiet, marginRight: 'auto' }} data-job-draft-waits>
          {waits}
        </span>
      ) : null}
      <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.8rem', fontFamily: 'inherit', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-700)' }}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!full || !!waits || sending}
        style={{ padding: '0.4rem 0.8rem', fontFamily: 'inherit', fontWeight: 600, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, cursor: !full || waits || sending ? 'not-allowed' : 'pointer', opacity: !full || waits || sending ? 0.6 : 1 }}
      >
        {sending ? 'Sending…' : 'Send to Dispatch'}
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title="Send to Dispatch" onRequestClose={onClose} maxWidthDesktop={480} footer={footer}>
      <div data-job-draft-sheet={bidId} style={{ padding: '0.25rem 0 0.5rem' }}>
        <p style={quiet}>Dispatch opens the job from this and puts it on the schedule. Change anything the bid has wrong.</p>
        {problem ? (
          <p role="alert" style={{ ...quiet, color: 'var(--text-red-700)', marginTop: '0.6rem' }}>
            {problem}
          </p>
        ) : !start || !draft ? (
          <p style={{ ...quiet, marginTop: '0.6rem' }}>Reading the bid…</p>
        ) : (
          <>
            <label style={labelStyle}>
              Job name
              <input type="text" value={draft.jobName} onChange={(e) => set({ jobName: e.target.value.slice(0, 200) })} aria-label="Job name" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={labelStyle}>
              Address
              <input type="text" value={draft.address} onChange={(e) => set({ address: e.target.value.slice(0, 300) })} aria-label="Address" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            {start.options.length > 1 ? (
              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={labelStyle}>The GC that won it</legend>
                {start.options.map((o) => (
                  <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', padding: '2px 0' }}>
                    <input type="radio" name={`job-draft-gc-${bidId}`} checked={draft.gcKey === o.key} onChange={() => pickGc(o.key)} />
                    {o.name}
                    {o.value != null ? <span style={quiet}>· sent ${formatCurrency(o.value)}</span> : null}
                  </label>
                ))}
              </fieldset>
            ) : draft.gcName ? (
              <p style={{ ...quiet, marginTop: '0.6rem' }}>
                GC: <strong style={{ color: 'var(--text-base)' }}>{draft.gcName}</strong>
              </p>
            ) : null}
            <label style={labelStyle}>
              The job starts at <span style={{ color: 'var(--text-faint)' }}>(blank starts it at $0)</span>
              <input type="text" inputMode="decimal" value={carryText} onChange={(e) => setCarryText(e.target.value.slice(0, 20))} aria-label="The job starts at" placeholder="0" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={labelStyle}>
              Trade
              <select value={draft.serviceTypeId ?? ''} onChange={(e) => set({ serviceTypeId: e.target.value || null })} aria-label="Trade" style={{ ...inputStyle, marginTop: 4 }}>
                <option value="">Dispatch picks</option>
                {start.serviceTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              Wanted by <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
              <input type="date" value={draft.wantedBy ?? ''} onChange={(e) => set({ wantedBy: e.target.value || null })} aria-label="Wanted by" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <label style={labelStyle}>
              A note for Dispatch <span style={{ color: 'var(--text-faint)' }}>(optional)</span>
              <textarea value={draft.note ?? ''} onChange={(e) => set({ note: e.target.value.slice(0, 1000) || null })} aria-label="A note for Dispatch" rows={3} placeholder="The slab pour is the 3rd. The super is Jim." style={{ ...inputStyle, marginTop: 4, resize: 'vertical' }} />
            </label>
          </>
        )}
      </div>
    </ResponsiveModalShell>
  )
}
