// @vitest-environment jsdom
/**
 * Render tests for the Schedule Dispatch hub shell's phone layout (v2.1240;
 * the Old/New toggle was removed in v2.1242 — the compact header is the sole
 * phone rendering): segmented tabs, + Schedule sheet, ⋯ menu, and the
 * guarantee that every sheet action routes through the SAME page callbacks
 * the desktop toolbar uses. Desktop keeps the classic chrome untouched.
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

describe('ScheduleDispatchHub phone layout (v2.1240, toggle removed v2.1242)', () => {
  it('phone layout renders the compact header and hides the classic chrome', () => {
    renderWithProviders(<ScheduleDispatchHub {...makeProps({ mobileNewMode: true })} />)
    expect(screen.getByText('+ Schedule')).toBeTruthy()
    expect(screen.getByLabelText('More schedule tools')).toBeTruthy()
    expect(screen.queryByText('Dispatch Settings')).toBeNull()
    expect(screen.queryByText('Old mode')).toBeNull()
    expect(screen.queryByText('New mode')).toBeNull()
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
          mobileNewMode: true,
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
          mobileNewMode: true,
          weekNavRightSlot: <button type="button">Share</button>,
        })}
      />,
    )
    fireEvent.click(screen.getByLabelText('More schedule tools'))
    expect(screen.getByText('Share')).toBeTruthy()
    expect(screen.getByText('Dispatch settings…')).toBeTruthy()
  })

  it('desktop keeps the classic tabs but settings live in the shared ⋯ menu (v2.1243)', () => {
    renderWithProviders(<ScheduleDispatchHub {...makeProps()} />)
    expect(screen.queryByText('Old mode')).toBeNull()
    expect(screen.queryByText('+ Schedule')).toBeNull()
    // The standalone Dispatch Settings button is gone at every width.
    expect(screen.queryByText('Dispatch Settings')).toBeNull()
    fireEvent.click(screen.getByLabelText('More schedule tools'))
    expect(screen.getByText('Dispatch settings…')).toBeTruthy()
    // Visible hours only appears while the Day view has registered its control.
    expect(screen.queryByText('Visible hours…')).toBeNull()
  })

  it('Day view registers Visible hours into the ⋯ menu (v2.1243)', async () => {
    renderWithProviders(<ScheduleDispatchHub {...makeProps({ hubTab: 'day' })} />)
    fireEvent.click(screen.getByLabelText('More schedule tools'))
    expect(await screen.findByText('Visible hours…')).toBeTruthy()
  })
})
