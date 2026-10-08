// @vitest-environment jsdom
/**
 * The Dispatch hub's mode banners and the multi-cell bar (v2.4979, the SCHEDULE_DISPATCH map's
 * step 5), on the real components: each banner draws only its own mode, hides while the phone
 * board is up, says what the click will do, and calls back the page's handlers; the bar shows only
 * while cells are being picked with the picker shut, and waits for a cell.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import {
  ScheduleDispatchModeBanners,
  ScheduleDispatchMultiCellBar,
  type ScheduleDispatchModeBannersProps,
  type ScheduleDispatchMultiCellBarProps,
} from './ScheduleDispatchModeBanners'

/** Monday to Friday; the block sits on the Wednesday. */
const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']
const BLOCK = {
  id: 'blk-1',
  job_id: 'job-1004',
  bid_id: null,
  assignee_user_id: 'u-dana',
  work_date: '2026-10-07',
  time_start: '08:00:00',
  time_end: '16:00:00',
} as unknown as JobScheduleBlockRow
const WINDOW = scheduleFormatWindow('08:00:00', '16:00:00')
const title = (anchorId: string) => (anchorId === 'job-1004' ? 'J1004 · Ridgeway Builders' : `? ${anchorId}`)

function bannerProps(over: Partial<ScheduleDispatchModeBannersProps> = {}): ScheduleDispatchModeBannersProps {
  return {
    cardPlacementMode: null,
    linkedCopyMode: null,
    linkedCopyApplyBusy: false,
    hubAssignJobPlacement: null,
    phoneBoardActive: false,
    placementSourceBlock: null,
    visibleDayKeys: WEEK,
    getHubJobDisplayTitle: title,
    onCardPlacementPickCell: vi.fn(async () => {}),
    setCardPlacementMode: vi.fn(),
    setPlusMenuBlockId: vi.fn(),
    setLinkedCopyMode: vi.fn(),
    onLinkedCopySetStage: vi.fn(),
    onCancelHubAssignJobPlacement: vi.fn(),
    ...over,
  }
}

const banners = (over: Partial<ScheduleDispatchModeBannersProps> = {}) => {
  const props = bannerProps(over)
  return { props, ...renderWithProviders(<ScheduleDispatchModeBanners {...props} />) }
}
/** A banner's whole sentence, spaces folded. */
const sentence = (start: RegExp) => screen.getByText(start).textContent!.replace(/\s+/g, ' ').trim()

describe('ScheduleDispatchModeBanners', () => {
  it('draws nothing with no mode on', () => {
    banners()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('every banner hides while the phone board is up', () => {
    const all = {
      cardPlacementMode: { sourceBlockId: 'blk-1', variant: 'move' as const },
      placementSourceBlock: BLOCK,
      linkedCopyMode: { stage: 1 as const, selectedBlockIds: new Set<string>() },
      hubAssignJobPlacement: { jobId: 'job-1004' },
    }
    const { rerender } = banners({ ...all, phoneBoardActive: true })
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/Moving/)).toBeNull()

    rerender(<ScheduleDispatchModeBanners {...bannerProps({ ...all, phoneBoardActive: false })} />)
    expect(screen.getByText(/Moving/)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 of 2')
    expect(screen.getByText(/Placing schedule for/)).toBeTruthy()
  })

  it('moving: names the block and its window, a chip per day, the block’s own day disabled; a chip moves it there', () => {
    const { props } = banners({ cardPlacementMode: { sourceBlockId: 'blk-1', variant: 'move' }, placementSourceBlock: BLOCK })
    expect(sentence(/Moving/)).toBe(`Moving J1004 · Ridgeway Builders (${WINDOW}). Tap a day, or a person's cell.`)

    const chips = within(screen.getByRole('group', { name: 'Move to day' })).getAllByRole('button')
    expect(chips).toHaveLength(5)
    const here = chips.filter((c) => (c as HTMLButtonElement).disabled)
    expect(here.map((c) => c.getAttribute('aria-label'))).toEqual(['Wed 10/7 (where it is now)'])

    fireEvent.click(screen.getByRole('button', { name: 'Move to Fri 10/9' }))
    expect(props.onCardPlacementPickCell).toHaveBeenCalledWith('u-dana', '2026-10-09')
  })

  it('moving a block that is off the board: “this block” and no day chips', () => {
    banners({ cardPlacementMode: { sourceBlockId: 'gone', variant: 'move' } })
    expect(sentence(/Moving/)).toBe("Moving this block. Tap a day, or a person's cell.")
    expect(screen.queryByRole('group', { name: 'Move to day' })).toBeNull()
  })

  it('copying: a linked copy names its day and a solo one does not; Cancel clears the placement and the + menu', () => {
    const { props, rerender } = banners({ cardPlacementMode: { sourceBlockId: 'blk-1', variant: 'linked' }, placementSourceBlock: BLOCK })
    expect(sentence(/Adding a/)).toBe(
      `Adding a linked copy from ${WINDOW}. Click a team member's day cell on 2026-10-07. Press Esc to cancel.`,
    )

    rerender(<ScheduleDispatchModeBanners {...props} cardPlacementMode={{ sourceBlockId: 'blk-1', variant: 'unlinked' }} />)
    expect(sentence(/Adding a/)).toBe(`Adding a solo copy from ${WINDOW}. Click a team member's day cell. Press Esc to cancel.`)

    rerender(<ScheduleDispatchModeBanners {...props} placementSourceBlock={null} />)
    expect(sentence(/Adding a/)).toBe("Adding a linked copy from this block. Click a team member's day cell on that day. Press Esc to cancel.")

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.setCardPlacementMode).toHaveBeenCalledWith(null)
    expect(props.setPlusMenuBlockId).toHaveBeenCalledWith(null)
  })

  it('linked copy, step 1: Next waits for a block, then goes to step 2; Cancel ends it', () => {
    const { props, rerender } = banners({ linkedCopyMode: { stage: 1, selectedBlockIds: new Set() } })
    expect(screen.getByRole('status').textContent).toContain('(0 selected)')
    expect((screen.getByRole('button', { name: 'Next: pick people' }) as HTMLButtonElement).disabled).toBe(true)

    rerender(<ScheduleDispatchModeBanners {...props} linkedCopyMode={{ stage: 1, selectedBlockIds: new Set(['a', 'b']) }} />)
    expect(screen.getByRole('status').textContent).toContain('(2 selected)')
    fireEvent.click(screen.getByRole('button', { name: 'Next: pick people' }))
    expect(props.onLinkedCopySetStage).toHaveBeenCalledWith(2)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.setLinkedCopyMode).toHaveBeenCalledWith(null)
  })

  it('linked copy, step 2: counts the copies, says when it is applying, Back goes to step 1 and Done ends it', () => {
    const { props, rerender } = banners({ linkedCopyMode: { stage: 2, selectedBlockIds: new Set(['a']) } })
    const status = () => screen.getByRole('status').textContent!.replace(/\s+/g, ' ')
    expect(status()).toContain('2 of 2 — Click the people to apply 1 linked copy to. Each copy lands')

    rerender(<ScheduleDispatchModeBanners {...props} linkedCopyApplyBusy linkedCopyMode={{ stage: 2, selectedBlockIds: new Set(['a', 'b', 'c']) }} />)
    expect(status()).toContain('apply 3 linked copies to (applying…).')

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(props.onLinkedCopySetStage).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(props.setLinkedCopyMode).toHaveBeenCalledWith(null)
    expect(props.onLinkedCopySetStage).toHaveBeenCalledTimes(1)
  })

  it('assign placement names the job, and Cancel hands back to the page', () => {
    const { props } = banners({ hubAssignJobPlacement: { jobId: 'job-1004' } })
    expect(sentence(/Placing schedule for/)).toBe(
      "Placing schedule for J1004 · Ridgeway Builders. Click a person's day cell. Press Esc to cancel.",
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCancelHubAssignJobPlacement).toHaveBeenCalledTimes(1)
  })
})

describe('ScheduleDispatchMultiCellBar', () => {
  function bar(over: Partial<ScheduleDispatchMultiCellBarProps> = {}) {
    const props: ScheduleDispatchMultiCellBarProps = {
      hubMultiCellAddActive: true,
      hubAssignJobPickerOpen: false,
      hubMultiCellAddSelection: new Set(),
      onRequestHubMultiCellAddChooseJob: vi.fn(),
      ...over,
    }
    return { props, ...renderWithProviders(<ScheduleDispatchMultiCellBar {...props} />) }
  }
  const chooseJob = () => screen.queryByRole('button', { name: /Choose job for multi-cell add/ }) as HTMLButtonElement | null

  it('shows only while cells are being picked, and steps aside while the picker is open', () => {
    const { props, rerender } = bar({ hubMultiCellAddActive: false })
    expect(chooseJob()).toBeNull()
    rerender(<ScheduleDispatchMultiCellBar {...props} hubMultiCellAddActive hubAssignJobPickerOpen />)
    expect(chooseJob()).toBeNull()
    rerender(<ScheduleDispatchMultiCellBar {...props} hubMultiCellAddActive />)
    expect(chooseJob()).not.toBeNull()
  })

  it('waits for a cell, then counts the cells and opens the picker', () => {
    const { props, rerender } = bar()
    expect(chooseJob()!.disabled).toBe(true)
    expect(chooseJob()!.textContent).toBe('Choose job for multi-cell add')

    rerender(<ScheduleDispatchMultiCellBar {...props} hubMultiCellAddSelection={new Set(['u-dana|2026-10-07', 'u-dana|2026-10-08', 'u-lee|2026-10-07'])} />)
    expect(chooseJob()!.disabled).toBe(false)
    expect(chooseJob()!.textContent).toBe('Choose job for multi-cell add (3)')
    fireEvent.click(chooseJob()!)
    expect(props.onRequestHubMultiCellAddChooseJob).toHaveBeenCalledTimes(1)
  })
})
