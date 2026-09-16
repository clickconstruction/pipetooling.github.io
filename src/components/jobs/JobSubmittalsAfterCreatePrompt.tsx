/**
 * The won question (Submittals stage 4c, v2.3490): the moment a job is made from a won
 * bid — after the contract and job-accounts questions — the office says what happens to
 * the submittal: *Build Rev 1 from the picks · I have the vendor's PDF · Later · Not
 * needed on this job*. Rev 1 is built from the compare's picks and linked to the job;
 * "not needed" is written on the bid and read by the Dashboard's card and the tab.
 * No reviewer is asked for here — they are not known yet. A bid that already carries a
 * revision is back-filled with the job and the prompt closes itself; so does a job with
 * no bid, or a bid with nothing to build from. Office roles and estimators, like the
 * job-accounts question. Mounted once by JobFormModalProvider, chained third.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { backfillSubmittalJob, createFirstRevisionFromPicks, loadPicksForBid, setSubmittalsNotNeeded, type BidPicks } from '../../lib/submittals/firstRevisionClient'
import { wonQuestionState, wonQuestionSubline } from '../../lib/submittals/wonQuestion'
import ResponsiveModalShell from '../ResponsiveModalShell'

const quiet: React.CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline dotted' }
const primary: React.CSSProperties = { padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: 'var(--text-link)', color: 'white', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }
const secondary: React.CSSProperties = { padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer' }

function promptEligibleRole(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role) || role === 'estimator'
}

type PromptJob = { id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null; bid_id: string | null }
type PromptBid = { id: string; bid_number: string | null; project_name: string | null; submittals_not_needed_at: string | null }

export default function JobSubmittalsAfterCreatePrompt({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { role, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const navigate = useNavigate()
  const eligible = promptEligibleRole(role)
  const [job, setJob] = useState<PromptJob | null>(null)
  const [bid, setBid] = useState<PromptBid | null>(null)
  const [picks, setPicks] = useState<BidPicks | null>(null)
  const [busy, setBusy] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setJob(null)
    setBid(null)
    setPicks(null)
    if (!jobId) return
    if (!eligible) {
      onCloseRef.current()
      return
    }
    let cancelled = false
    void (async () => {
      const { data: idRows } = await supabase.rpc('job_account_job_identity', { p_job_id: jobId })
      if (cancelled) return
      const j = ((idRows ?? []) as PromptJob[])[0] ?? null
      if (!j?.bid_id) {
        onCloseRef.current()
        return
      }
      const [{ data: bidRow }, { count }, p] = await Promise.all([
        supabase.from('bids').select('id, bid_number, project_name, submittals_not_needed_at').eq('id', j.bid_id).maybeSingle(),
        supabase.from('bid_submittals').select('id', { count: 'exact', head: true }).eq('bid_id', j.bid_id),
        loadPicksForBid(supabase, j.bid_id),
      ])
      if (cancelled) return
      const b = (bidRow as PromptBid | null) ?? null
      const state = wonQuestionState({ bidId: j.bid_id, revisionCount: count ?? 0, pickedCount: p.picks.length, specifiedCount: p.specified.length, notNeededAt: b?.submittals_not_needed_at ?? null })
      if (state === 'has-revision') {
        // The job exists now — every revision that carried no job takes it.
        await backfillSubmittalJob(supabase, j.bid_id, j.id)
        if (!cancelled) onCloseRef.current()
        return
      }
      if (state !== 'ask') {
        onCloseRef.current()
        return
      }
      setJob(j)
      setBid(b)
      setPicks(p)
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, eligible])

  if (!jobId || !job || !picks) return null
  const bidId = job.bid_id as string
  const label = `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · ${(job.job_name ?? '').trim() || bid?.project_name || '—'}`
  const bidLabel = bid?.bid_number ? `B${bid.bid_number}` : 'the bid'
  const tabHref = `/bids?tab=submittals&bidId=${bidId}`

  async function build(withPdf: boolean) {
    setBusy(true)
    try {
      const { rows } = await createFirstRevisionFromPicks(supabase, { bidId, userId: authUser?.id ?? null, jobLedgerId: job!.id, picks: picks! })
      showToast(withPdf ? `Rev 1 built · ${rows} row${rows === 1 ? '' : 's'} — drop the vendor's PDF on the tab.` : `Rev 1 built · ${rows} row${rows === 1 ? '' : 's'} from the picks.`, 'success')
      onClose()
      navigate(tabHref)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not build the submittal.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function notNeeded() {
    setBusy(true)
    try {
      await setSubmittalsNotNeeded(supabase, bidId, authUser?.id ?? null, true)
      showToast('Marked not needed — no submittal card for this job.', 'success')
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveModalShell title={`Submittals for ${label}?`} onRequestClose={onClose} maxWidthDesktop={520}>
      <div style={{ display: 'grid', gap: '0.7rem', fontSize: '0.85rem' }} data-job-submittals-prompt={job.id}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: 1.45 }}>
          The GC usually asks for the submittal in the first week. Rev 1 is built from what Pricing already knows on {bidLabel} — <span style={{ color: 'var(--text-strong)' }}>{wonQuestionSubline({ pickedCount: picks.picks.length, specifiedCount: picks.specified.length })}</span> — with the reasons and lead times you gave at the pick. The reviewer is named later, when the GC's chain reaches you.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => void build(false)} style={{ ...primary, opacity: busy ? 0.6 : 1 }} data-testid="submittals-prompt-build">
            {busy ? 'Building…' : 'Build Rev 1 from the picks'}
          </button>
          <button type="button" disabled={busy} onClick={() => void build(true)} style={{ ...secondary, opacity: busy ? 0.6 : 1 }} data-testid="submittals-prompt-pdf" title="Builds Rev 1 the same way and opens the tab, where the PDF drops onto the rows">
            I have the vendor&apos;s PDF
          </button>
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy} onClick={() => void notNeeded()} style={quiet} data-testid="submittals-prompt-none">Not needed on this job</button>
          <button type="button" disabled={busy} onClick={onClose} style={{ ...quiet, textDecoration: 'none' }}>Later</button>
        </div>
      </div>
    </ResponsiveModalShell>
  )
}
