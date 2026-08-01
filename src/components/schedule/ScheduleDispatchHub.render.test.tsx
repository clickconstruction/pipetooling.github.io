// @vitest-environment jsdom
/**
 * Render tests for the Schedule Dispatch hub shell's phone "new mode" (v2.1240):
 * the floating Old/New pill, the compact header (segmented tabs, + Schedule
 * sheet, ⋯ menu), and the guarantee that every sheet action routes through the
 * SAME page callbacks the desktop toolbar uses. Old mode must keep the classic
 * tab bar + Dispatch Settings button untouched.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { fireEvent, screen } from '@testing-library/react'
import { ScheduleDispatchHub } from './ScheduleDispatchHub'
import { renderWithProviders } from '../../test/renderSmokeMocks'

type HubProps = Parameters<typeof ScheduleDispatchHub>[0]

function makeProps(overrides: Partial<HubProps> = {}): HubProps {
  return {
    weekStart: '2026-07-27',
    visibleDayKeys: ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31'],
    hideWeekend: true,
    onHideWeekendChange: vi.fn(),
    rows: [],
    loading: false,
    jobsError: null,
    summariesError: null,
    hubTab: 'people',
    onHubTabChange: vi.fn(),
    personDayBlocks: new Map(),
    allPeopleRows: [],
    userIdsWithBlocksThisWeek: new Set<string>(),
    salariedUserIds: new Set<string>(),
    getJobDisplayTitle: () => 'Job',
    groupMemberCountByGroupId: new Map(),
    scheduleTodayYmd: '2026-07-27',
    canEdit: true,
    onWeekShift: vi.fn(),
    onThisWeek: vi.fn(),
    onOpenJob: vi.fn(),
    onOpenHubJobDetail: vi.fn(),
    cardPlacementMode: null,
    placementSourceWorkDate: null,
    plusMenuBlockId: null,
    onPlusMenuBlockIdChange: vi.fn(),
    onStartCardPlacement: vi.fn(),
    onCardPlacementCellPick: vi.fn(),
    highlightLinkedGroups: false,
    onHighlightLinkedGroupsChange: vi.fn(),
    linkedGroupAccentByGroupId: new Map(),
    onOpenLinkedGroup: vi.fn(),
    hubWeekBlocks: [],
    hubExpectedManpowerDayKey: null,
    onHubExpectedManpowerDayChange: vi.fn(),
    hubPeopleNameById: new Map(),
    canShowExpectedManpowerPayroll: false,
    hubHourlyWageByUserId: new Map(),
    hubAssignJobPlacement: null,
    onRequestHubAddJob: vi.fn(),
    onHubAssignJobCellPick: vi.fn(),
    onDeleteBlock: vi.fn(),
    hubMultiCellAddActive: false,
    hubMultiCellAddSelectedKeys: new Set<string>(),
    showExpectedManpower: false,
    ...overrides,
  } as HubProps
}

describe('ScheduleDispatchHub phone new mode (v2.1240)', () => {
  it('old mode keeps the classic tab bar and shows the floating layout toggle', () => {
    const onMobileNewModeChange = vi.fn()
    renderWithProviders(
      <ScheduleDispatchHub
        {...makeProps({ showMobileModeToggle: true, mobileNewMode: false, onMobileNewModeChange })}
      />,
    )
    expect(screen.getByText('Dispatch Settings')).toBeTruthy()
    expect(screen.queryByText('+ Schedule')).toBeNull()
    fireEvent.click(screen.getByText('New mode'))
    expect(onMobileNewModeChange).toHaveBeenCalledWith(true)
  })

  it('new mode renders the compact header and hides the classic chrome', () => {
    renderWithProviders(
      <ScheduleDispatchHub {...makeProps({ showMobileModeToggle: true, mobileNewMode: true, onMobileNewModeChange: vi.fn() })} />,
    )
    expect(screen.getByText('+ Schedule')).toBeTruthy()
    expect(screen.getByLabelText('More schedule tools')).toBeTruthy()
    expect(screen.queryByText('Dispatch Settings')).toBeNull()
    const tabs = screen.getAllByRole('tab').map((t) => t.textContent)
    expect(tabs).toEqual(['Day', 'People', 'Jobs'])
  })

  it('+ Schedule sheet routes each mode through the desktop callbacks', () => {
    const onRequestHubAddJob = vi.fn()
    const onRequestHubMultiCellAddMode = vi.fn()
    const onStartLinkedCopyMode = vi.fn()
    const onHubTabChange = vi.fn()
    renderWithProviders(
      <ScheduleDispatchHub
        {...makeProps({
          showMobileModeToggle: true,
          mobileNewMode: true,
          onMobileNewModeChange: vi.fn(),
          hubTab: 'day',
          onHubTabChange,
          onRequestHubAddJob,
          onRequestHubMultiCellAddMode,
          onStartLinkedCopyMode,
        })}
      />,
    )
    fireEvent.click(screen.getByText('+ Schedule'))
    fireEvent.click(screen.getByText('Add one job…'))
    expect(onRequestHubAddJob).toHaveBeenCalledTimes(1)
    // Cell-picking modes hop to the People grid where the cells live.
    fireEvent.click(screen.getByText('+ Schedule'))
    fireEvent.click(screen.getByText('Fill several days at once'))
    expect(onRequestHubMultiCellAddMode).toHaveBeenCalledTimes(1)
    expect(onHubTabChange).toHaveBeenCalledWith('people')
    fireEvent.click(screen.getByText('+ Schedule'))
    fireEvent.click(screen.getByText('Copy as a linked chain'))
    expect(onStartLinkedCopyMode).toHaveBeenCalledTimes(1)
  })

  it('the ⋯ menu carries the Share slot and Dispatch settings', () => {
    renderWithProviders(
      <ScheduleDispatchHub
        {...makeProps({
          showMobileModeToggle: true,
          mobileNewMode: true,
          onMobileNewModeChange: vi.fn(),
          weekNavRightSlot: <button type="button">Share</button>,
        })}
      />,
    )
    fireEvent.click(screen.getByLabelText('More schedule tools'))
    expect(screen.getByText('Share')).toBeTruthy()
    expect(screen.getByText('Dispatch settings…')).toBeTruthy()
  })

  it('desktop (no toggle) renders exactly the classic chrome', () => {
    renderWithProviders(<ScheduleDispatchHub {...makeProps()} />)
    expect(screen.getByText('Dispatch Settings')).toBeTruthy()
    expect(screen.queryByText('Old mode')).toBeNull()
    expect(screen.queryByText('+ Schedule')).toBeNull()
  })
})
