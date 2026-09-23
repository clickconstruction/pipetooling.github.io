import type { JobWithDetails } from '../../types/jobWithDetails'
import type { StageRow } from '../../lib/jobsStagesBoard'
import type { JobNextChip, JobNextLine, PhoneRowFilter } from '../../lib/jobs/jobNextLine'

/**
 * What the tab hands the card lists to render a stage as phone rows (punch list #30, PR 2a)
 * instead of cards. Absent = cards, as before.
 */
export type StagesPhoneRowsMode = {
  filter: PhoneRowFilter
  nextLineFor: (job: JobWithDetails, row: StageRow | null) => JobNextLine
  /** 'sheet' = the row confirms the swipe itself (the stage has no window); 'own' = the action opens one. */
  advanceConfirm: 'sheet' | 'own'
  advanceConsequence: (job: JobWithDetails, row: StageRow | null) => string
  /** A tap on the chip, for the actions the list cannot answer itself. */
  onChip: (job: JobWithDetails, chip: JobNextChip, row: StageRow | null) => void
}
