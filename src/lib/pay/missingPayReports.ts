/** Draft Payroll → Generate Remaining: who still needs a pay report for the period. */

export type PayReportPeriodStub = { person_name: string; period_start: string; period_end: string }

/** A report counts for the period when its own period touches it at either end. */
export function payStubOverlapsPeriod(stub: PayReportPeriodStub, start: string, end: string): boolean {
  return stub.period_start <= end && stub.period_end >= start
}

/**
 * The people with pay due in the period and no report that overlaps it, in the order given.
 * `costForPersonDate` is the Draft Payroll preview's price for a day — the one the report is
 * built on — so a salaried person whose week is all unpaid time off, or outside their
 * employment window, comes to $0 and is left out. The window's count and the button's list
 * both read this (v2.3979); the list used to price with the Hours grid's flat 8 hours.
 */
export function peopleMissingPayReports(input: {
  people: readonly string[]
  payStubs: readonly PayReportPeriodStub[]
  start: string
  end: string
  days: readonly string[]
  costForPersonDate: (personName: string, workDate: string) => number
}): string[] {
  const { people, payStubs, start, end, days, costForPersonDate } = input
  return people.filter((person) => {
    const stub = payStubs.find((s) => s.person_name === person && payStubOverlapsPeriod(s, start, end))
    const estGross = days.reduce((s, d) => s + costForPersonDate(person, d), 0)
    return estGross > 0 && !stub
  })
}
