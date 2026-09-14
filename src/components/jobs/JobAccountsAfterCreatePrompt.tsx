/**
 * The job accounts question on a new job (Job accounts at the counter, PR 5 —
 * v2.3440): the moment a hand-made job saves and the contract question is
 * answered, the office says which houses the job will buy from — Ferguson,
 * Reece, Moore — so the ask is filed the day the job is made, not the morning
 * of the first parts run. When another job at the same address already has an
 * open account at a house, the app offers to reuse it instead of asking Curly
 * twice. Office roles only; jobs with no expecting house never see it.
 * Mounted once by JobFormModalProvider, chained after JobContractAfterCreatePrompt.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { normalizeAddressForMatch } from '../../lib/jobs/lienProperty'
import { groupJobAccountStrip, type JobAccountStripEntry, type JobAccountStripRow } from '../../lib/jobs/jobAccountStrip'
import { submitOpenJobAccountRequest } from '../../lib/jobs/openJobAccountDispatchRequest'
import {
  NEW_JOB_NOT_NEEDED_NOTE,
  buildNewJobAccountsPlan,
  reuseNote,
  samePropertyOffers,
  type NewJobAccountsChoice,
  type SamePropertyJob,
} from '../../lib/jobs/jobAccountsNewJob'
import ResponsiveModalShell from '../ResponsiveModalShell'

const TEAL = '#0f766e'
const TEAL_SOFT = '#ccfbf1'

const chip = (on: boolean, tone: 'blue' | 'teal' = 'blue'): React.CSSProperties => ({
  padding: '0.35rem 0.8rem',
  borderRadius: 999,
  border: `1px solid ${on ? (tone === 'teal' ? TEAL : 'var(--text-link)') : 'var(--border-strong)'}`,
  background: on ? (tone === 'teal' ? TEAL_SOFT : 'var(--bg-blue-tint)') : 'var(--surface)',
  color: on ? (tone === 'teal' ? TEAL : 'var(--text-blue-700)') : 'var(--text-700)',
  font: 'inherit',
  fontSize: '0.85rem',
  fontWeight: on ? 600 : 500,
  cursor: 'pointer',
})
const quiet: React.CSSProperties = { background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline dotted' }
const primary: React.CSSProperties = { padding: '0.5rem 1rem', borderRadius: 8, border: 'none', background: 'var(--text-link)', color: 'white', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }

function promptEligibleRole(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

function jobLabelOf(j: { hcp_number: string | null; click_number: string | null; job_name: string | null }): string {
  return `${effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'} · ${(j.job_name ?? '').trim() || '—'}`
}

export default function JobAccountsAfterCreatePrompt({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const { role, user: authUser } = useAuth()
  const { showToast } = useToastContext()
  const eligible = promptEligibleRole(role)
  const [job, setJob] = useState<JobWithDetails | null>(null)
  const [entries, setEntries] = useState<JobAccountStripEntry[] | null>(null)
  const [others, setOthers] = useState<SamePropertyJob[]>([])
  const [picks, setPicks] = useState<Map<string, NewJobAccountsChoice>>(() => new Map())
  const [busy, setBusy] = useState(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    setJob(null)
    setEntries(null)
    setOthers([])
    setPicks(new Map())
    if (!jobId) return
    if (!eligible) {
      onCloseRef.current()
      return
    }
    let cancelled = false
    void (async () => {
      const j = await fetchJobWithDetailsById(jobId).catch(() => null)
      if (cancelled) return
      if (!j) {
        onCloseRef.current()
        return
      }
      const { data: rows, error } = await supabase.rpc('list_job_account_strip', { p_job_ids: [jobId] })
      if (cancelled) return
      const mine = error ? [] : (groupJobAccountStrip((rows ?? []) as JobAccountStripRow[]).get(jobId) ?? [])
      if (mine.filter((e) => e.state === 'none').length === 0) {
        onCloseRef.current()
        return
      }
      // Same property: other jobs whose address starts with this one's street line.
      const street = normalizeAddressForMatch(j.job_address ?? '').split(',')[0]?.trim() ?? ''
      let sameJobs: SamePropertyJob[] = []
      if (street) {
        const { data: cands } = await supabase
          .from('jobs_ledger')
          .select('id, hcp_number, click_number, job_name, job_address')
          .ilike('job_address', `${street}%`)
          .neq('id', jobId)
          .limit(12)
        if (cancelled) return
        const list = (cands ?? []) as Array<{ id: string; hcp_number: string | null; click_number: string | null; job_name: string | null; job_address: string | null }>
        if (list.length > 0) {
          const { data: otherRows } = await supabase.rpc('list_job_account_strip', { p_job_ids: list.map((c) => c.id) })
          if (cancelled) return
          const byJob = groupJobAccountStrip((otherRows ?? []) as JobAccountStripRow[])
          sameJobs = list.map((c) => ({ id: c.id, label: jobLabelOf(c), address: c.job_address, entries: byJob.get(c.id) ?? [] }))
        }
      }
      setJob(j)
      setEntries(mine)
      setOthers(sameJobs)
    })()
    return () => {
      cancelled = true
    }
  }, [jobId, eligible])

  const offers = useMemo(() => (job && entries ? samePropertyOffers(job.job_address, entries, others) : []), [job, entries, others])
  // Default: reuse every offer; ask nothing until picked.
  useEffect(() => {
    if (offers.length === 0) return
    setPicks((prev) => {
      const next = new Map(prev)
      for (const o of offers) if (!next.has(o.houseId)) next.set(o.houseId, 'reuse')
      return next
    })
  }, [offers])

  if (!jobId || !job || !entries) return null

  const label = jobLabelOf(job)
  const askable = entries.filter((e) => e.state === 'none')
  const plan = buildNewJobAccountsPlan(entries, offers, picks)
  const nothingPicked = plan.ask.length === 0 && plan.reuse.length === 0

  const toggle = (houseId: string, choice: NewJobAccountsChoice) =>
    setPicks((prev) => {
      const next = new Map(prev)
      if (next.get(houseId) === choice) next.set(houseId, 'skip')
      else next.set(houseId, choice)
      return next
    })

  async function save() {
    if (busy || nothingPicked) return
    setBusy(true)
    try {
      if (plan.reuse.length > 0) {
        const { error } = await supabase.from('job_supply_house_accounts').upsert(
          plan.reuse.map((o) => ({
            job_id: job!.id,
            supply_house_id: o.houseId,
            status: 'open',
            account_ref: o.accountRef,
            opened_via: o.openedVia,
            rep_contact_id: o.repContactId,
            note: reuseNote(o.fromJobLabel),
          })),
          { onConflict: 'job_id,supply_house_id', ignoreDuplicates: true },
        )
        if (error) throw error
      }
      if (plan.ask.length > 0) {
        const res = await submitOpenJobAccountRequest(authUser?.id, showToast, {
          jobId: job!.id,
          jobLabel: label,
          jobAddress: job!.job_address,
          houses: plan.ask.map((e) => ({ id: e.houseId, name: e.houseName, repName: e.rep?.name ?? null, repPhone: e.rep?.phone ?? null })),
          fromCounter: false,
          note: 'New job — open before the first parts run',
        })
        if (!res) return
      }
      if (plan.reuse.length > 0) {
        showToast(`${plan.reuse.map((o) => o.houseName).join(', ')} account${plan.reuse.length === 1 ? '' : 's'} carried over from ${plan.reuse[0]!.fromJobLabel}.`, 'success')
      }
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function noneNeeded() {
    if (busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('job_supply_house_accounts').upsert(
        askable.map((e) => ({ job_id: job!.id, supply_house_id: e.houseId, status: 'not_needed', note: NEW_JOB_NOT_NEEDED_NOTE })),
        { onConflict: 'job_id,supply_house_id', ignoreDuplicates: true },
      )
      if (error) throw error
      showToast('Marked not needed — no job account signals for this job.', 'success')
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ResponsiveModalShell title={`Job accounts for ${label}?`} onRequestClose={onClose} maxWidthDesktop={520}>
      <div style={{ display: 'grid', gap: '0.7rem', fontSize: '0.85rem' }} data-job-accounts-new-job-prompt={job.id}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Which houses will this job buy from? The ask goes to Dispatch today, so the account is open before the first parts run.
          {job.job_address ? <> · <span style={{ color: 'var(--text-strong)' }}>{job.job_address}</span></> : null}
        </div>
        {offers.length > 0 ? (
          <div style={{ display: 'grid', gap: '0.4rem', padding: '0.55rem 0.7rem', borderRadius: 8, background: TEAL_SOFT, border: `1px solid ${TEAL}55` }}>
            <div style={{ fontSize: '0.8rem', color: TEAL }}>
              <b>Same property.</b> {offers[0]!.fromJobLabel} already has an account here — carry it over instead of asking twice.
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {offers.map((o) => {
                const on = picks.get(o.houseId) === 'reuse'
                return (
                  <button key={o.houseId} type="button" aria-pressed={on} onClick={() => toggle(o.houseId, 'reuse')} style={chip(on, 'teal')} title={o.accountRef ? `ref ${o.accountRef}` : 'the house keys it on the address'}>
                    Same {o.houseName} account{o.accountRef ? ` · ${o.accountRef}` : ''}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ask Dispatch to open</div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }} role="group" aria-label="Supply houses to ask">
            {askable.map((e) => {
              const reused = picks.get(e.houseId) === 'reuse' && offers.some((o) => o.houseId === e.houseId)
              const on = picks.get(e.houseId) === 'ask'
              return (
                <button key={e.houseId} type="button" aria-pressed={on} disabled={reused} onClick={() => toggle(e.houseId, 'ask')} style={{ ...chip(on), opacity: reused ? 0.45 : 1, cursor: reused ? 'not-allowed' : 'pointer' }} title={reused ? 'Carried over from the same property' : e.rep ? `${e.rep.name} opens them` : undefined}>
                  {e.houseName}
                </button>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
          <span style={{ display: 'flex', gap: '0.8rem' }}>
            <button type="button" disabled={busy} onClick={() => void noneNeeded()} style={quiet} data-testid="job-accounts-prompt-none">None needed</button>
            <button type="button" disabled={busy} onClick={onClose} style={{ ...quiet, textDecoration: 'none' }}>Later</button>
          </span>
          <button type="button" disabled={busy || nothingPicked} onClick={() => void save()} style={{ ...primary, opacity: nothingPicked ? 0.5 : 1, cursor: nothingPicked ? 'not-allowed' : 'pointer' }} data-testid="job-accounts-prompt-save">
            {busy ? 'Saving…' : plan.ask.length > 0 && plan.reuse.length > 0 ? 'Carry over and ask' : plan.reuse.length > 0 ? 'Carry over' : 'Send to Dispatch'}
          </button>
        </div>
      </div>
    </ResponsiveModalShell>
  )
}
