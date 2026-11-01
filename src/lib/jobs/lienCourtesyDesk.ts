import { formatYmdMonthDay } from './billedExpectedPay'
import { courtesyStatus, parseCourtesyRecords, type CourtesyStatus } from './lienCourtesyNotice'
import { filingDeadlineForMonth } from './lienDeadlines'
import type { LienDeskEntry, LienDeskItemRow } from './lienDesk'
import type { LetterTwoStatus } from './lienLetterTwo'

/**
 * The courtesy notice per job, from what the Lien desk already holds (punch list #231, PR 2): letter
 * two's clock on each job with a sent notice, the first packet's records, the job's balance, the
 * affidavit's day, the property's homestead flag and a filed affidavit. The desk's modal and the
 * Accounts Receivable chips both read it, so the row and the chip never disagree. Pure, structural:
 * the desk's data is read through the few fields it needs, so a test hands in plain objects.
 *
 * The affidavit's day comes from the desk's affidavit entry when it lists the job, else from the
 * notice's last month and the property's kind through `filingDeadlineForMonth` — the desk's
 * affidavit list reaches only 30 days out, and the reminder is offered from day 7 after a packet,
 * which is usually earlier.
 */

export type CourtesyDeskSource = {
  todayYmd: string
  letterTwoByJob: Readonly<Record<string, LetterTwoStatus>>
  items: ReadonlyArray<Pick<LienDeskItemRow, 'id' | 'months' | 'fields'>>
  entries: ReadonlyArray<Pick<LienDeskEntry, 'jobId' | 'months' | 'propertyKind' | 'datedFromCreation' | 'datedByHand'>>
  jobsById: Readonly<Record<string, { revenue?: number | string | null; payments_made?: number | string | null; customer_address_id?: string | null } | undefined>>
  addressesById: Readonly<Record<string, { property_kind?: string | null; homestead?: boolean | null } | undefined>>
  affidavits: ReadonlyArray<{ jobId: string; deadline: string; propertyKind: string; lastMonthFromCreation: boolean; lastMonthByHand?: boolean; gates: ReadonlyArray<{ key: string; ok: boolean }> }>
  filingsByJob: Readonly<Record<string, ReadonlyArray<{ kind: string; filed_at: string | null; voided_at: string | null }> | undefined>>
}

export function courtesyByJobFrom(src: CourtesyDeskSource): Record<string, CourtesyStatus> {
  const out: Record<string, CourtesyStatus> = {}
  for (const [jobId, lt] of Object.entries(src.letterTwoByJob)) {
    const first = lt.firstItemId ? src.items.find((i) => i.id === lt.firstItemId) ?? null : null
    const entry = src.entries.find((e) => e.jobId === jobId) ?? null
    const job = src.jobsById[jobId]
    const addr = job?.customer_address_id ? src.addressesById[job.customer_address_id] ?? null : null
    const aff = src.affidavits.find((a) => a.jobId === jobId) ?? null
    const lastMonth = entry?.months[entry.months.length - 1]?.key ?? (first?.months ?? []).slice().sort().pop() ?? ''
    const kind = entry?.propertyKind || aff?.propertyKind || (addr?.property_kind ?? '')
    const filed = (src.filingsByJob[jobId] ?? []).find((f) => f.kind === 'affidavit' && f.filed_at && !f.voided_at) ?? null
    out[jobId] = courtesyStatus({
      letterTwo: lt,
      records: parseCourtesyRecords((first?.fields as { courtesy?: unknown } | null)?.courtesy),
      openBalance: Math.max(0, Number(job?.revenue ?? 0) - Number(job?.payments_made ?? 0)),
      todayYmd: src.todayYmd,
      affidavit: {
        deadline: aff?.deadline || (lastMonth ? filingDeadlineForMonth(`${lastMonth}-15`, kind) : ''),
        filedAt: filed?.filed_at ?? null,
        homestead: Boolean(addr?.homestead) || Boolean(aff?.gates.find((g) => g.key === 'homestead' && !g.ok)),
        hasWorkMonth: aff ? !aff.lastMonthFromCreation || Boolean(aff.lastMonthByHand) : entry ? !entry.datedFromCreation || Boolean(entry.datedByHand) : Boolean(lastMonth),
      },
      formatDay: formatYmdMonthDay,
    })
  }
  return out
}
