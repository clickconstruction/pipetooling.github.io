import type { LienDeskData, LienDeskGc, LienDeskJob } from '../../hooks/useLienDeskData'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { payLinkDisplay } from '../billing/payLink'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { CourtesyFacts, CourtesyStatus } from './lienCourtesyNotice'
import type { LienDeskItemRow } from './lienDesk'
import { describeNoticeMonths, parseLienDeskDraftFields } from './lienNoticeDraft'
import type { PayPageRow } from './lienNoticePayPage'
import { lienOfferFromItem } from './lienPayOffer'
import { sendsTrackingOwed } from './lienSendTracking'

/** What `lienSentPacketFacts` reads: the desk's data, the job on the pane, and the bills behind its notice. */
export type LienSentPacketInput = {
  data: LienDeskData | null | undefined
  jobId: string
  /** The entry's sent notice: the Sent pile's own item, or a drafting row's `sentItem` (v2.6624). */
  sentItem: LienDeskItemRow | null | undefined
  /** The filing the entry's own item was recorded on, when the first packet names none. */
  entrySentFilingId: string | null | undefined
  courtesyByJob: Readonly<Record<string, CourtesyStatus>>
  /** The notice's pay page rows: one per unpaid bill. */
  payRows: ReadonlyArray<PayPageRow>
  job: LienDeskJob | undefined
  address: { county?: string | null } | null | undefined
  gc: LienDeskGc | undefined
  todayYmd: string
  /** The phone the courtesy notice names; asked only when the notice has facts to send. */
  phone: () => string
  /** What the sent bills still owe (`selected.openBalance`). */
  openBalance: number
}

/** The sent packet's facts for one job, as the Sent footer and a drafting footer's doors read them. */
export type LienSentPacketFacts = ReturnType<typeof lienSentPacketFacts>

/**
 * The sent notice's facts (v2.3760; out of `LienDesk.tsx` as they stood, v2.7591), for any row whose job has one
 * inside thirty days (v2.6624, punch list #248): where letter two stands, the first packet's item, the owner's
 * call, the courtesy notice and the facts it sends with, the recorded packet and its sends that still owe a
 * tracking number, and what the sent bills still owe.
 *
 * `jobBalance` is the entry's open balance, never below zero (v2.7530): *GC paid*, the still-owed words and the
 * footer's doors read the bills, as the claim does.
 */
export function lienSentPacketFacts({ data, jobId, sentItem, entrySentFilingId, courtesyByJob, payRows, job, address, gc, todayYmd, phone, openBalance }: LienSentPacketInput) {
  const lt = data?.letterTwoByJob[jobId]
  // The first packet's item carries the GC's okay and the owner's call; the entry's item may be a later letter two.
  // The packet that went: letter two's first item, else the entry's sent notice — the Sent pile's `item`, or a drafting row's `sentItem` (v2.6624).
  const first = (lt?.firstItemId ? data?.items.find((i) => i.id === lt.firstItemId) : null) ?? sentItem ?? null
  const call = data?.ownerCallByJob[jobId] ?? null
  // The courtesy notice (punch list #231): where it stands, the amount it names (what the enclosed bills still owe, else the notice's claim), and the facts the window sends with.
  const courtesy = courtesyByJob[jobId] ?? null
  const courtesyDraft = first ? parseLienDeskDraftFields(first.fields) : null
  const stillOwed = payRows.reduce((s, r) => s + r.openAmount, 0)
  const courtesyClaim = payRows.length && stillOwed > 0 ? stillOwed : Math.max(0, Number(courtesyDraft?.notice.claimAmount ?? 0) || 0)
  const courtesyFacts: CourtesyFacts | null =
    first && courtesyDraft && courtesy?.lienDay
      ? {
          jobNumber: job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : '',
          jobName: (job?.job_name ?? '').trim(),
          propertyAddress: (job?.job_address ?? '').trim(),
          county: (address?.county ?? '').trim(),
          gcName: gc?.name || courtesyDraft.notice.originalContractorName,
          claimantName: courtesyDraft.notice.claimantName,
          claim: courtesyClaim,
          monthsWords: describeNoticeMonths(first.months ?? []),
          noticeSentOn: first.sent_at ? calendarYmdInAppTzFromIso(first.sent_at) : todayYmd,
          lienDay: courtesy.lienDay,
          payLinks: payRows.filter((r) => r.payable && r.openAmount > 0).map((r) => ({ address: payLinkDisplay(r.invoiceId), amount: r.openAmount })),
          contactPerson: courtesyDraft.notice.contactPerson,
          phone: phone(),
          offer: lienOfferFromItem(first),
        }
      : null
  const sentFiling = (data?.filingsByJob[jobId] ?? []).find((f) => f.id === (first?.sent_filing_id ?? entrySentFilingId)) ?? null
  const trackingOwed = sentFiling ? sendsTrackingOwed(sentFiling.sends) : []
  // What the sent bills still owe (v2.7530): *GC paid*, the still-owed words and the two doors below read the bills, as the
  // claim above them does. Until then they read the job's whole price less payments, and counted work never billed.
  const jobBalance = Math.max(0, openBalance)
  return { lt, first, call, courtesy, courtesyDraft, stillOwed, courtesyClaim, courtesyFacts, sentFiling, trackingOwed, jobBalance }
}
