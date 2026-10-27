import { useState, type Dispatch, type SetStateAction } from 'react'
import { getDaysInRange } from '../components/people/peopleHoursTabShared'
import { peopleMissingPayReports, type PayReportPeriodStub } from '../lib/pay/missingPayReports'
import {
  afterPayReportRetry,
  bulkPayReportFailuresFor,
  bulkPayReportOutcome,
  type BulkPayReportFailures,
  type PayReportFailure,
  type PayReportRun,
} from '../lib/pay/bulkPayReports'

export type BulkGenerateConfirm = { start: string; end: string; candidates: string[] }

export type UseBulkGeneratePayStubsInput = {
  periodStart: string
  periodEnd: string
  /** The pay roster, in display order. */
  peopleNames: string[]
  payStubs: PayReportPeriodStub[]
  /** The Draft Payroll preview's price for a person's day. */
  costForPersonDate: (personName: string, workDate: string) => number
  /** Makes one person's report for the pay period without opening its preview; resolves to whether it was made, and why not. */
  generateReport: (personName: string) => Promise<PayReportRun>
  setError: (value: string | null) => void
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

export type BulkGeneratePayStubsApi = {
  bulkGeneratingPayStubs: boolean
  /** Draft Payroll "Generate remaining" confirm (replaces the old window.confirm); candidates snapshot at request time. */
  bulkGenerateConfirm: BulkGenerateConfirm | null
  setBulkGenerateConfirm: Dispatch<SetStateAction<BulkGenerateConfirm | null>>
  bulkGenerateMissingPayStubsInModal: () => void
  runBulkGeneratePayStubs: (candidates: string[]) => Promise<void>
  /** The people whose report did not generate on the last run for the period on screen, each with the reason. */
  bulkFailures: PayReportFailure[]
  /** Try one of them again; they leave the list when the report is made. */
  retryBulkFailure: (personName: string) => Promise<void>
  /** Who is being tried again, else null. */
  retryingBulkPerson: string | null
}

/** Draft Payroll → Generate N reports: who is asked about, the confirm, and the run, one person after another. */
export function useBulkGeneratePayStubs({
  periodStart,
  periodEnd,
  peopleNames,
  payStubs,
  costForPersonDate,
  generateReport,
  setError,
  showToast,
}: UseBulkGeneratePayStubsInput): BulkGeneratePayStubsApi {
  const [bulkGeneratingPayStubs, setBulkGeneratingPayStubs] = useState(false)
  const [bulkGenerateConfirm, setBulkGenerateConfirm] = useState<BulkGenerateConfirm | null>(null)
  // The run keeps going past a person whose report fails (punch list #184): who did not generate, for which period.
  const [lastFailures, setLastFailures] = useState<BulkPayReportFailures | null>(null)
  const [retryingBulkPerson, setRetryingBulkPerson] = useState<string | null>(null)

  function bulkGenerateMissingPayStubsInModal() {
    const start = periodStart
    const end = periodEnd
    if (start > end) {
      showToast('Invalid date range.', 'warning')
      return
    }
    // Priced the way the preview and the report are (v2.3979), so the list is the window's own count.
    const candidates = peopleMissingPayReports({
      people: peopleNames,
      payStubs,
      start,
      end,
      days: getDaysInRange(start, end),
      costForPersonDate,
    })
    if (candidates.length === 0) {
      showToast('No missing pay reports with hours for this period.', 'info')
      return
    }
    setBulkGenerateConfirm({ start, end, candidates })
  }

  /** Runs the bulk generation the confirm modal approved (candidates snapshot from request time). */
  async function runBulkGeneratePayStubs(candidates: string[]) {
    setBulkGeneratingPayStubs(true)
    setError(null)
    const start = periodStart
    const end = periodEnd
    setLastFailures(null)
    const results: Array<{ person: string; run: PayReportRun }> = []
    try {
      for (const person of candidates) {
        results.push({ person, run: await generateReport(person) })
      }
    } finally {
      setBulkGeneratingPayStubs(false)
    }
    const { failures, words } = bulkPayReportOutcome(results)
    setLastFailures(failures.length > 0 ? { start, end, failures } : null)
    showToast(words.line, words.tone)
  }

  async function retryBulkFailure(personName: string) {
    if (!lastFailures || retryingBulkPerson) return
    setRetryingBulkPerson(personName)
    try {
      const run = await generateReport(personName)
      setLastFailures((prev) => {
        if (!prev) return prev
        const failures = afterPayReportRetry(prev.failures, personName, run)
        return failures.length > 0 ? { ...prev, failures } : null
      })
      if (run.ok) showToast(`Generated ${personName}'s report.`, 'success')
    } finally {
      setRetryingBulkPerson(null)
    }
  }

  return {
    bulkGeneratingPayStubs,
    bulkGenerateConfirm,
    setBulkGenerateConfirm,
    bulkGenerateMissingPayStubsInModal,
    runBulkGeneratePayStubs,
    bulkFailures: bulkPayReportFailuresFor(lastFailures, periodStart, periodEnd),
    retryBulkFailure,
    retryingBulkPerson,
  }
}
