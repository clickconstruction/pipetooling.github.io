import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../jobsStagesBoard'
import type { JobNextLineInput, JobNextStage } from './jobNextLine'
import { paySpeedPayer } from './billToParty'
import { billedPayModel } from './billedDuePay'
import { contractRowChipForJob } from './contractRowChip'
import { effectiveInvoiceEstBillDate } from './invoiceBilling'
import type { JobContractCoverage } from './jobContractCoverage'
import { calendarSourceFor } from './payCalendar'
import { paceInputFor, sentFromHereOf } from './payPace'
import { phoneBillWords } from './phoneBillWords'
import { progressPaymentForJob } from './progressPaymentForJob'
import { stagesBillSentPctAlert } from './stagesBillSentPctAlert'
import { uncollectiblePhoneLine } from './uncollectible'
import { jobIsScheduledInKind } from '../inKind/inKindLedger'
import { deriveStagesBillingActivityDetail } from '../stagesJobReferenceDates'

type Lookup<T> = { get(id: string): T | undefined }
type ContractChipFacts = Parameters<typeof contractRowChipForJob>[1]

/**
 * What the phone board holds about its jobs when it words a row's Next line: the board's own side maps and a few
 * lookups, as `JobsStagesTab` has them. Nothing here is read from the network.
 */
export type PhoneNextInputSources = {
  /** Today in the company's time zone. */
  todayYmd: string
  crewByJobId: Lookup<NonNullable<Parameters<typeof progressPaymentForJob>[1]>>
  billedPaySpeeds: Parameters<typeof billedPayModel>[1]
  promisedPayDates: Record<string, NonNullable<Parameters<typeof billedPayModel>[3]>> | null | undefined
  billedPaceContext: Parameters<typeof paceInputFor>[0]
  payCalendars: Parameters<typeof calendarSourceFor>[0]
  /** The day a payer accepted a bill, by invoice id. */
  acceptedByInvoice: Lookup<string> | null | undefined
  followupQuietByJobId: Lookup<number>
  bankReturnedByJobId: Lookup<NonNullable<JobNextLineInput['bankReturned']>>
  /** False for a role that does not see contracts: the row then carries no contract fact at all. */
  canSeeJobContracts: boolean
  jobContractCoverageByJobId: Lookup<JobContractCoverage>
  stagesUpcomingByJobId: Record<string, NonNullable<JobNextLineInput['upcoming']>>
  stagesWorkedByJobId: Record<string, NonNullable<ContractChipFacts['weekSoFar']>>
  uncollectibleFactsFor: (job: JobWithDetails) => Parameters<typeof uncollectiblePhoneLine>[0] | null
  lienRunwayFor: (job: JobWithDetails, inv: Extract<StageRow, { inv: unknown }>['inv'] | null) => JobNextLineInput['lienRunway']
  /** The Lien desk's next act for the job, or null. */
  lienStateFor: (jobId: string) => NonNullable<JobNextLineInput['lienDesk']> | null
}

/**
 * The phone rows' input for one job (the Stages map's step 18): everything `jobNextLine` reads to word the row's Next
 * line and its chips, gathered from the board's side maps. Lifted whole out of `JobsStagesTab`, where it had no test.
 */
export function phoneNextLineInput(job: JobWithDetails, row: StageRow | null, stage: JobNextStage, sources: PhoneNextInputSources): JobNextLineInput {
  const {
    todayYmd,
    crewByJobId,
    billedPaySpeeds,
    promisedPayDates,
    billedPaceContext,
    payCalendars,
    acceptedByInvoice,
    followupQuietByJobId,
    bankReturnedByJobId,
    canSeeJobContracts,
    jobContractCoverageByJobId,
    stagesUpcomingByJobId,
    stagesWorkedByJobId,
    uncollectibleFactsFor,
    lienRunwayFor,
    lienStateFor,
  } = sources
  const crew = crewByJobId.get(job.id) ?? null
  const { model, view } = progressPaymentForJob(job, crew)
  const inv = row && row.kind !== 'job' ? row.inv : null
  const payer = inv ? paySpeedPayer(job, inv) : null
  const expectedPay =
    (stage === 'billed' || stage === 'collections') && inv && payer && !jobIsScheduledInKind(job)
      ? billedPayModel(
          { billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: payer.id, payerName: payer.name, acceptedYmd: acceptedByInvoice?.get(inv.id) ?? null },
          billedPaySpeeds,
          todayYmd,
          promisedPayDates?.[job.id] ?? null,
          paceInputFor(billedPaceContext, { payerId: payer.id, jobId: job.id, sentFromHere: sentFromHereOf(inv) }, billedPaySpeeds),
          calendarSourceFor(payCalendars, { payerId: payer.id, jobId: job.id, invoiceId: inv.id }),
        )
      : null
  const bDetail = deriveStagesBillingActivityDetail(job)
  return {
    stage,
    view,
    money: model,
    billSentAlert: stagesBillSentPctAlert(job),
    quietDays: followupQuietByJobId.get(job.id) ?? null,
    expectedPay,
    bankReturned: bankReturnedByJobId.get(job.id) ?? null,
    contract: canSeeJobContracts ? (jobContractCoverageByJobId.get(job.id) ?? null) : undefined,
    contractAsk: canSeeJobContracts
      ? (() => {
          // v2.4342: the phone chip asks when the desktop row's chip does (`contractRowChip`).
          const chip = contractRowChipForJob(job, {
            coverage: jobContractCoverageByJobId.get(job.id),
            upcoming: stagesUpcomingByJobId[job.id] ?? null,
            weekSoFar: stagesWorkedByJobId[job.id] ?? null,
            todayYmd,
          })
          return chip.show && chip.tone === 'ask' && chip.phoneLabel ? { label: chip.phoneLabel, title: chip.title } : null
        })()
      : null,
    upcoming: stagesUpcomingByJobId[job.id] ?? null,
    crew,
    // v2.4760: a Billed / Collections bill row reads the bill's own day, not the latest event.
    billDisplay: phoneBillWords({ stage, inv, detail: bDetail, todayYmd }),
    // v2.4792: a job the office gave up on reads its reason and wears the UNCOLLECTIBLE chip.
    uncollectible: (() => {
      const facts = stage === 'collections' ? uncollectibleFactsFor(job) : null
      return facts ? { line: uncollectiblePhoneLine(facts) } : null
    })(),
    createdAt: job.created_at ?? null,
    todayYmd,
    lienRunway: stage === 'billed' || stage === 'collections' ? lienRunwayFor(job, inv) : null,
    // Punch list #335, row 5: the desk's next act for the job, so the chip names the step the billed row names.
    lienDesk: (() => {
      if (stage !== 'billed' && stage !== 'collections') return null
      const chip = lienStateFor(job.id)
      return chip ? { act: chip.act, paper: chip.paper, dueOn: chip.dueOn } : null
    })(),
  }

}
