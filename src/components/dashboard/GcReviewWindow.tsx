import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobDetailModal } from '../../contexts/JobDetailModalContext'
import { useBilledMoneyData } from '../../hooks/useBilledMoneyData'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { buildJobsStagesBoardLists } from '../../lib/jobsStagesBoard'
import * as stagesGates from '../../lib/jobs/stagesRoleGates'
import { fetchActiveUsers } from '../../lib/people/fetchActiveUsers'
import { extractContactFromCustomer } from '../../lib/jobs/jobFormCustomerDisplay'
import { sendGcStatementEmail } from '../../lib/sendGcStatementEmail'
import { describeReplyToOutcome } from '../../lib/gcStatementReplyTo'
import { copyGcReviewGroupForEmail, printGcReviewGroups } from '../../lib/jobs/gcReviewShellIo'
import { JobsGcReviewModal } from '../jobs/JobsGcReviewModal'
import type { Database } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRow = { id: string; name: string; email: string | null; role: string }

/**
 * The statement round's window (v2.6096, punch list #178, D's PR 6): GC Review, the SAME modal
 * the Pipeline opens on `?round=1`, over the Needs you card instead, the v2.2751 pattern of
 * `DashboardArDepositsModal`. The billed rows come from the shared jobs cache as the Pipeline's
 * board lists; the customers, the office roster, the last-sent hints and the promised pay dates
 * are read here as the Pipeline reads them; the print and the copy are the shared shell glue.
 * Closing it lands you back on the station; the line re-reads in the host's `onClose`.
 */
export function GcReviewWindow({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const { user, role } = useAuth()
  const { showToast } = useToastContext()
  const { jobs, runFetchJobs } = useJobsListCache()
  const jobFormModal = useJobFormModal()
  const jobDetailModal = useJobDetailModal()
  const office = stagesGates.isStagesOfficeRole(role)
  const { promisedPayDates, loadPromisedPayDates } = useBilledMoneyData({ canSeeBilledExpectedPay: stagesGates.canSeeBilledExpectedPay(role), canMarkPromisedPay: office })
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [lastSentByGcId, setLastSentByGcId] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user?.id) return
    void runFetchJobs(null)
  }, [user?.id, runFetchJobs])

  /** "Last sent" hints for GC Review's Email… (v2.1416); best-effort. */
  const refreshLastSent = useCallback(async () => {
    try {
      const rows = await withSupabaseRetry(async () => supabase.from('gc_statement_emails').select('gc_customer_id, sent_at').order('sent_at', { ascending: false }).limit(500), 'gc statement last-sent hints')
      const map: Record<string, string> = {}
      for (const r of (rows ?? []) as Array<{ gc_customer_id: string; sent_at: string }>) if (!map[r.gc_customer_id]) map[r.gc_customer_id] = r.sent_at
      setLastSentByGcId(map)
    } catch {
      // hints only
    }
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    void (async () => {
      const [cust, usersRes] = await Promise.all([
        withSupabaseRetry(async () => supabase.from('customers').select('id, name, contact_info').is('archived_at', null), 'gc review window customers').catch(() => [] as unknown[]),
        fetchActiveUsers<UserRow>('id, name, email, role', {
          roles: ['assistant', 'controller', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'],
          includeDev: role === 'dev',
        }).catch(() => ({ data: [] as UserRow[] })),
      ])
      if (cancelled) return
      setCustomers((cust ?? []) as unknown as CustomerRow[])
      setUsers(usersRes.data ?? [])
    })()
    void refreshLastSent()
    return () => {
      cancelled = true
    }
  }, [user?.id, role, refreshLastSent])

  const lists = useMemo(() => buildJobsStagesBoardLists(jobs, ''), [jobs])

  if (!user?.id || role == null) return null

  return (
    <JobsGcReviewModal
      open
      onClose={onClose}
      billedActiveRows={lists.billedActiveRows}
      collectionsRows={lists.collectionsRows}
      onPrint={(groups, groupBy) => {
        if (!printGcReviewGroups(groups, groupBy)) showToast('Allow pop-ups to print the report.', 'error')
      }}
      onCopyForEmail={(group, _groupBy, extra) => {
        void copyGcReviewGroupForEmail(group, extra).then(
          () => showToast(`Copied the ${group.gcName} statement — paste it into your email.`, 'success'),
          () => showToast('Could not copy — try again.', 'error'),
        )
      }}
      emailForGc={(gcId) => {
        const c = customers.find((x) => x.id === gcId)
        return c ? extractContactFromCustomer(c).email : ''
      }}
      lastSentByGcId={lastSentByGcId}
      onSendStatement={async (p) => {
        const sent = await sendGcStatementEmail(p)
        if (!sent.ok) return sent
        showToast(`Statement emailed to ${p.toEmail}.${describeReplyToOutcome(p.replyTo ?? null, user.id, sent.replyTo)}`, 'success')
        void refreshLastSent()
        onChanged?.()
        return { ok: true }
      }}
      users={users}
      isDev={role === 'dev'}
      canCertify={office}
      onOpenJob={(jobId) => jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })}
      onOpenJobDetail={(jobId) => jobDetailModal?.openJobDetail({ jobId })}
      promisedPayDates={promisedPayDates}
      canFilePromises={office}
      onPromisesChanged={() => void loadPromisedPayDates()}
    />
  )
}
