/**
 * The row-render context, built once for every Pipeline list (the Stages map's step 13). The four lists used to write
 * these lines out by hand, so the test pins what a hand could get wrong: which keys the context holds, where
 * each one comes from, and that nothing else of the bundle rides along.
 */
import { describe, expect, it } from 'vitest'
import { stagesRowContext, type StagesRowContextHooks, type StagesRowContextProps } from './stagesRowContext'

const FROM_HOOKS = ['openSessionNotesForJob', 'openCustomerProfile', 'openJobHoursStory', 'navigate', 'dispatchTaskModal', 'checklistAddModal'] as const
const FROM_PROPS = [
  'showToast',
  'customers',
  'openEditJobAndCreateCustomerFlow',
  'stagesManHoursByJobId',
  'stagesManHoursLoading',
  'crewByJobId',
  'checklistMarksFor',
  'openChecklistDoor',
  'stagesLaborBreakdownByJobId',
  'expandedJobThreadId',
  'toggleStagesJobThreadExpanded',
  'jobThreadStatsByJobId',
  'jobThreadActivityByJobId',
  'openJobThreadFullscreen',
  'openJobActivityExpand',
  'openNewReportForJob',
  'openJobCalendar',
  'stagesUpcomingByJobId',
  'stagesWorkedByJobId',
  'applyStagesInvoiceFocus',
  'canOpenJobScheduleModal',
  'setScheduleModalJob',
  'openQuickAssignForJob',
  'authRole',
  'loadJobs',
  'jobContractCoverageByJobId',
  'propertyKindByJobId',
  'onPropertyKindSaved',
  'propertyLinkByJobId',
  'onPropertyLinked',
  'onOpenJobContract',
  'legalMatterByJobId',
  'buildWaitByJobId',
  'onOpenCustomerDoor',
  'boardDotByJobId',
  'customerLinesByJobId',
] as const
/** Keys the bundle holds that no row reads from the context: the lists read them from their own props. */
const NOT_IN_CONTEXT = ['stagesEditMode', 'stagesJobFlashId', 'openEdit', 'renderStagesOpenDetailJobName', 'authUser', 'pctCompleteSavingId', 'jobThreadFullscreen', 'hazmatFeeJobIds'] as const

/** One marker per key, so a value can only have come from its own key. */
const marked = (side: string, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, { from: `${side}.${k}` }]))
const props = marked('props', [...FROM_PROPS, ...NOT_IN_CONTEXT, ...FROM_HOOKS]) as unknown as StagesRowContextProps
const hooks = marked('hooks', [...FROM_HOOKS, ...FROM_PROPS]) as unknown as StagesRowContextHooks

describe('stagesRowContext', () => {
  const ctx = stagesRowContext(props, hooks) as unknown as Record<string, { from: string }>

  it('holds the forty-two keys the rows read, and no other', () => {
    expect(Object.keys(ctx).sort()).toEqual([...FROM_HOOKS, ...FROM_PROPS].sort())
    expect(Object.keys(ctx)).toHaveLength(42)
  })

  it('takes the windows and the router from the list’s own hooks, never from the bundle', () => {
    for (const k of FROM_HOOKS) expect(ctx[k]).toEqual({ from: `hooks.${k}` })
  })

  it('takes every other key from the list’s props, each from its own name', () => {
    for (const k of FROM_PROPS) expect(ctx[k]).toEqual({ from: `props.${k}` })
  })

  it('hands each value on as it is, not a copy', () => {
    const p = props as unknown as Record<string, unknown>
    const h = hooks as unknown as Record<string, unknown>
    for (const k of FROM_PROPS) expect(ctx[k]).toBe(p[k])
    for (const k of FROM_HOOKS) expect(ctx[k]).toBe(h[k])
  })

  it('leaves the rest of the bundle out', () => {
    for (const k of NOT_IN_CONTEXT) expect(k in ctx).toBe(false)
  })

  it('keeps a key the list did not get, as undefined', () => {
    const bare = stagesRowContext({} as StagesRowContextProps, {} as StagesRowContextHooks) as unknown as Record<string, unknown>
    expect(Object.keys(bare)).toHaveLength(42)
    expect(bare.openNewReportForJob).toBeUndefined()
    expect(bare.openCustomerProfile).toBeUndefined()
  })
})
