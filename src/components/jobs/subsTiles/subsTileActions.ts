/**
 * What a tile queue may do (v2.2963). Every entry is a write the Work board
 * already performs — the queues add no write path of their own.
 */
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { StageWindowLike, StageWindowSpan } from '../../../lib/subs/stageWindow'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import type { AskAnswer } from '../../../../supabase/functions/_shared/stageAsk'
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { SubLaborPaymentTarget } from '../../../types/laborJob'
import type { SubSheetStage } from '../../../lib/subSheetStage'
import type { WorkOrderAssemblerInitial } from '../WorkOrderAssemblerModal'

export type SubsTileActions = {
  /** The board changed under the modal — reload it. */
  changed: () => void
  openAssembler: (initial: WorkOrderAssemblerInitial) => void
  withdraw: (order: StepCommitmentRow) => Promise<void>
  /** Withdraw without the board's confirm — the caller already asked. */
  withdrawQuiet: (order: StepCommitmentRow) => Promise<boolean>
  nudge: (order: StepCommitmentRow) => Promise<void>
  markSignedOnPaper: (order: StepCommitmentRow) => Promise<void>
  print: (order: StepCommitmentRow) => void
  saveWindow: (jobId: string, stageId: string, span: StageWindowSpan, commitmentId: string | null) => Promise<boolean>
  removeWindow: (w: StageWindowLike, stageName: string) => Promise<void>
  answerGcAsk: (w: StageWindowLike, answer: AskAnswer, commitmentId: string | null) => Promise<void>
  /** Link a sheet to a Pipeline job without the board's confirm — the row's own button already said "Link and send". */
  linkSheetToJobQuiet: (sheetId: string, job: JobWithDetails) => Promise<boolean>
  newJobForSheet: (row: WorkOrderBoardRow) => void
  /** Push an offer's good-through date out by N days. */
  extendOffer: (order: StepCommitmentRow, days: number) => Promise<boolean>
  openSheet?: (sheetId: string) => void
  setSheetStage?: (sheetId: string, stage: SubSheetStage) => Promise<boolean> | boolean | void
  openMakePayment?: (target: SubLaborPaymentTarget, defaultAmount: string) => void
  /** Bill Customer for the job, pre-filled — refuses with a toast when the job has no billing customer. */
  billCustomer: (jobId: string) => void
  openAddInspection: () => void
}

/** A sub's contact card from the roster — the row shows the phone and the quick send needs the email. */
export type RosterContact = { email: string | null; phone: string | null }

/** What a row reads once the office has acted on it, and how to take it back. */
export type HandledMark = { label: string; undo?: (() => void | Promise<void>) | null }
