import type { StagesRowRenderContext } from './jobsStagesRowShared'
import type { StagesTableShared } from './stagesTableShared'

/** What a list adds to the row context from its own hooks: the app's windows and the router. */
export type StagesRowContextHooks = Pick<
  StagesRowRenderContext,
  'openSessionNotesForJob' | 'openCustomerProfile' | 'openJobHoursStory' | 'navigate' | 'dispatchTaskModal' | 'checklistAddModal'
>

/** A list's props as the row context reads them: the shared bundle, and the section's own New report opener. */
export type StagesRowContextProps = StagesTableShared & Pick<StagesRowRenderContext, 'openNewReportForJob'>

/**
 * The row-render context every Pipeline list hands its rows (the Stages map's step 13), built once here where the two
 * tables and the two card lists each wrote it out by hand. It names its keys one by one, so the context holds what the
 * rows read and none of the rest of the bundle.
 */
export function stagesRowContext(props: StagesRowContextProps, hooks: StagesRowContextHooks): StagesRowRenderContext {
  return {
    openSessionNotesForJob: hooks.openSessionNotesForJob,
    openCustomerProfile: hooks.openCustomerProfile,
    openJobHoursStory: hooks.openJobHoursStory,
    showToast: props.showToast,
    customers: props.customers,
    openEditJobAndCreateCustomerFlow: props.openEditJobAndCreateCustomerFlow,
    stagesManHoursByJobId: props.stagesManHoursByJobId,
    stagesManHoursLoading: props.stagesManHoursLoading,
    crewByJobId: props.crewByJobId,
    checklistMarksFor: props.checklistMarksFor,
    openChecklistDoor: props.openChecklistDoor,
    stagesLaborBreakdownByJobId: props.stagesLaborBreakdownByJobId,
    expandedJobThreadId: props.expandedJobThreadId,
    toggleStagesJobThreadExpanded: props.toggleStagesJobThreadExpanded,
    jobThreadStatsByJobId: props.jobThreadStatsByJobId,
    jobThreadActivityByJobId: props.jobThreadActivityByJobId,
    openJobThreadFullscreen: props.openJobThreadFullscreen,
    openJobActivityExpand: props.openJobActivityExpand,
    openNewReportForJob: props.openNewReportForJob,
    openJobCalendar: props.openJobCalendar,
    stagesUpcomingByJobId: props.stagesUpcomingByJobId,
    stagesWorkedByJobId: props.stagesWorkedByJobId,
    applyStagesInvoiceFocus: props.applyStagesInvoiceFocus,
    canOpenJobScheduleModal: props.canOpenJobScheduleModal,
    setScheduleModalJob: props.setScheduleModalJob,
    openQuickAssignForJob: props.openQuickAssignForJob,
    navigate: hooks.navigate,
    authRole: props.authRole,
    dispatchTaskModal: hooks.dispatchTaskModal,
    checklistAddModal: hooks.checklistAddModal,
    loadJobs: props.loadJobs,
    jobContractCoverageByJobId: props.jobContractCoverageByJobId,
    propertyKindByJobId: props.propertyKindByJobId,
    onPropertyKindSaved: props.onPropertyKindSaved,
    propertyLinkByJobId: props.propertyLinkByJobId,
    onPropertyLinked: props.onPropertyLinked,
    onOpenJobContract: props.onOpenJobContract,
    legalMatterByJobId: props.legalMatterByJobId,
    onOpenCustomerDoor: props.onOpenCustomerDoor,
    boardDotByJobId: props.boardDotByJobId,
    customerLinesByJobId: props.customerLinesByJobId,
  }
}
