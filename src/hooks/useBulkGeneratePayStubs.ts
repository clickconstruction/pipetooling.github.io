import { useState, type Dispatch, type SetStateAction } from 'react'
import { getDaysInRange } from '../components/people/peopleHoursTabShared'
import { peopleMissingPayReports, type PayReportPeriodStub } from '../lib/pay/missingPayReports'

export type BulkGenerateConfirm = { start: string; end: string; candidates: string[] }

export type UseBulkGeneratePayStubsInput = {
  periodStart: string
  periodEnd: string
  /** The pay roster, in display order. */
  peopleNames: string[]
  payStubs: PayReportPeriodStub[]
  /** The Draft Payroll preview's price for a person's day. */
  costForPersonDate: (personName: string, workDate: string) => number
  /** Makes one person's report for the pay period without opening its preview; resolves to whether it was made. */
  generateReport: (personName: string) => Promise<boolean>
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
}

/** Draft Payroll → Generate Remaining: who is asked about, the confirm, and the run, one person after another. */
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
    let ok = 0
    try {
      for (const person of candidates) {
        const success = await generateReport(person)
        if (success) ok += 1
      }
    } finally {
      setBulkGeneratingPayStubs(false)
    }
    if (ok === candidates.length) {
      showToast(`Generated ${ok} pay report(s).`, 'success')
    } else {
      showToast(`Generated ${ok} of ${candidates.length} pay report(s). Some failed; check the error message above.`, 'warning')
    }
  }

  return { bulkGeneratingPayStubs, bulkGenerateConfirm, setBulkGenerateConfirm, bulkGenerateMissingPayStubsInModal, runBulkGeneratePayStubs }
}
