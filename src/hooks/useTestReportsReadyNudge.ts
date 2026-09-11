import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { testReportSendBlockers, testReportShortLabel, type TestReportData } from '../lib/jobs/testReport'
import { testReportDataFromRow, type TestReportRow } from '../lib/jobs/testReportRow'

/**
 * The Dashboard's "N test reports ready to send" (v2.3301, dial A): every
 * draft `job_test_reports` row the caller can read, split into complete
 * (nothing but the recipient missing) and incomplete (a verdict or findings
 * still owed). RLS scopes the rows; the office roles are the callers.
 */
export type TestReportsReady = {
  ready: number
  incomplete: number
  /** Newest complete draft first, else the newest incomplete one — the card opens it. */
  first: { reportId: string; jobId: string; jobLabel: string; reportLabel: string } | null
  /** Up to three job labels for the detail line. */
  jobLabels: string[]
}

type DraftRow = TestReportRow & { jobs_ledger: { hcp_number: string | null; job_name: string | null } | null }

export function summarizeTestReportDrafts(rows: DraftRow[]): TestReportsReady {
  const complete: DraftRow[] = []
  const partial: DraftRow[] = []
  for (const r of rows) {
    const data: TestReportData = testReportDataFromRow(r)
    const blockers = testReportSendBlockers(data, { toEmail: 'office@example.com', hasPayLink: true })
    ;(blockers.length === 0 ? complete : partial).push(r)
  }
  const labelOf = (r: DraftRow) => {
    const n = (r.jobs_ledger?.hcp_number ?? '').trim()
    const name = (r.jobs_ledger?.job_name ?? '').trim()
    return [n ? `J${n}` : null, name].filter(Boolean).join(' ') || 'a job'
  }
  const firstRow = complete[0] ?? partial[0] ?? null
  return {
    ready: complete.length,
    incomplete: partial.length,
    first: firstRow
      ? { reportId: firstRow.id, jobId: firstRow.job_id, jobLabel: labelOf(firstRow), reportLabel: testReportShortLabel(firstRow.test_type as TestReportData['testType'], (firstRow.system as TestReportData['system']) ?? null) }
      : null,
    jobLabels: [...complete, ...partial].slice(0, 3).map(labelOf),
  }
}

export function useTestReportsReadyNudge(enabled: boolean): { drafts: TestReportsReady | null; reload: () => void } {
  const [drafts, setDrafts] = useState<TestReportsReady | null>(null)
  const [nonce, setNonce] = useState(0)

  const load = useCallback(async () => {
    if (!enabled) {
      setDrafts(null)
      return
    }
    try {
      const { data, error } = await supabase
        .from('job_test_reports')
        .select('*, jobs_ledger:job_id(hcp_number, job_name)')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      setDrafts(summarizeTestReportDrafts((data ?? []) as unknown as DraftRow[]))
    } catch {
      setDrafts(null)
    }
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load, nonce])

  return { drafts, reload: () => setNonce((n) => n + 1) }
}
