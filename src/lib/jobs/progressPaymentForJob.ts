/**
 * The Progress & payment cell's two models for one board row (v2.3419): the
 * money model the legend reads and the view the bar draws. One call per row,
 * from the fields the Pipeline row already loads plus the crew feed.
 */
import { buildStagesMoneyBarModel, type StagesMoneyBarModel } from '../stagesMoneyBar'
import { jobBilledUnpaidDollars } from './invoiceBilling'
import { buildPipelineStageBar, type PipelineStageBarFixture } from './pipelineStageBar'
import { buildProgressPaymentView, type ProgressPaymentView } from './progressPaymentCell'
import type { JobCrewPosition } from './jobCrewPosition'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { StagePlanInvoice, StagePlanPayment } from './stagePlan'

export type ProgressPaymentJobLike = {
  id: string
  revenue: number | string | null
  payments_made: number | string | null
  pct_complete: number | null
  status?: string | null
  fixtures: ReadonlyArray<PipelineStageBarFixture>
  invoices: ReadonlyArray<StagePlanInvoice & { status: string; amount?: number | string | null }>
  payments: ReadonlyArray<StagePlanPayment & { amount?: number | string | null }>
}

export function progressPaymentForJob(job: ProgressPaymentJobLike, crew: JobCrewPosition | null | undefined, todayYmd: string = todayYmdInAppTz()): { model: StagesMoneyBarModel; view: ProgressPaymentView } {
  const model = buildStagesMoneyBarModel({
    totalBill: job.revenue != null ? Number(job.revenue) : null,
    paymentsMade: job.payments_made != null ? Number(job.payments_made) : null,
    pctComplete: job.pct_complete ?? null,
    billedUnpaid: jobBilledUnpaidDollars(job as Parameters<typeof jobBilledUnpaidDollars>[0]),
  })
  const stageBar = buildPipelineStageBar({ fixtures: job.fixtures, invoices: job.invoices, payments: job.payments, pctComplete: job.pct_complete ?? null, todayYmd })
  const view = buildProgressPaymentView({
    money: model,
    stageBar,
    fixtures: job.fixtures.map((f) => ({ id: f.id, name: f.name, count: f.count, line_unit_price: f.line_unit_price, sequence_order: f.sequence_order, invoice_id: f.invoice_id })),
    invoices: job.invoices.map((i) => ({ id: i.id, status: i.status })),
    crew,
    pctComplete: job.pct_complete ?? null,
    status: job.status ?? null,
    todayYmd,
  })
  return { model, view }
}
