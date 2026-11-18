/**
 * Props for rendering the Pipeline's phone card list (`JobsStagesCardList`) in a render test:
 * no jobs, every handler a stub. Its own render test and the nested-window cases
 * (`components/nestedWindows.render.test.tsx`) share it.
 */
import { vi } from 'vitest'
import type { JobsStagesTableProps } from '../components/jobs/JobsStagesTable'
import type { StagesTableShared } from '../components/jobs/stagesTableShared'
import { makeStagesTableShared } from './stagesTableShared'

export function makeStagesCardListProps(section: Partial<Omit<JobsStagesTableProps, 'shared'>> = {}, shared: Partial<StagesTableShared> = {}): JobsStagesTableProps {
  return {
    jobList: [],
    actionLabel: 'Move to Working',
    onAction: vi.fn(),
    showTimeOpen: true,
    onSendBack: undefined,
    onSendBackSimple: undefined,
    showPctComplete: false,
    ...section,
    shared: makeStagesTableShared({ checklistMarksFor: () => null, ...shared }),
  }
}
