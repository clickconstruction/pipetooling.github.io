// @vitest-environment jsdom
/**
 * Render smoke for the stage calendar (v2.2963): two months for a window that
 * crosses Sep → Oct, the flagged days, the side panel's facts and the moves.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StageCalendarModal } from './StageCalendarModal'

describe('StageCalendarModal', () => {
  it('draws the months the window touches, flags the days, and wires the side panel', () => {
    const onAccept = vi.fn()
    const onAnswer = vi.fn()
    const onWithdraw = vi.fn()
    const onChange = vi.fn()
    const onClose = vi.fn()
    render(
      <StageCalendarModal
        open
        onClose={onClose}
        title="Top-out · #880 · Knight Contracting"
        subtitle="150 E Sonterra Blvd · Behar Kraja · WO-880-02"
        todayYmd="2026-09-07"
        window={{ start: '2026-09-22', end: '2026-10-02' }}
        windowBy="office"
        pick={null}
        pickBy={null}
        ask={{ span: { start: '2026-09-29', end: '2026-10-10' }, note: 'framing slipped', askedOn: '2026-09-05' }}
        gc={{ state: 'asked', gcName: 'Summit General', shownSince: null }}
        subName="Behar Kraja"
        subLine="offer out since 2026-09-04 · no pick yet"
        offDays={['2026-09-24']}
        siblings={[
          { key: 'a', name: 'Rough-in', subName: 'Behar Kraja', span: { start: '2026-09-08', end: '2026-09-19' }, pick: { start: '2026-09-09', end: '2026-09-10' }, current: false },
          { key: 'b', name: 'Top-out', subName: 'Behar Kraja', span: { start: '2026-09-22', end: '2026-10-02' }, pick: null, current: true },
        ]}
        onChange={onChange}
        onAccept={onAccept}
        onAnswer={onAnswer}
        onWithdraw={onWithdraw}
      />,
    )
    expect(screen.getByRole('dialog', { name: 'Top-out · #880 · Knight Contracting' })).toBeTruthy()
    expect(screen.getByRole('grid', { name: 'September 2026' })).toBeTruthy()
    expect(screen.getByRole('grid', { name: 'October 2026' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: '2026-09-07, today' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: '2026-09-29, in the window, the GC asked' })).toBeTruthy()
    expect(screen.getByRole('gridcell', { name: '2026-09-24, in the window, day off' })).toBeTruthy()
    // Facts and moves on the side.
    expect(screen.getByText(/9 working days/)).toBeTruthy()
    expect(screen.getByText(/framing slipped/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Accept Sep 29 – Oct 10' }))
    fireEvent.click(screen.getByRole('button', { name: 'Answer with…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take it off their portal' }))
    fireEvent.click(screen.getByRole('button', { name: 'Change our window…' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onWithdraw).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Rough-in · Behar Kraja')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed and one month for a window inside it', () => {
    const { container, rerender } = render(<StageCalendarModal open={false} onClose={vi.fn()} title="t" subtitle={null} todayYmd="2026-09-07" window={{ start: '2026-09-01', end: '2026-09-05' }} windowBy="office" pick={null} pickBy={null} ask={null} gc={{ state: 'off', gcName: null, shownSince: null }} subName={null} subLine={null} offDays={[]} siblings={[]} />)
    expect(container.firstChild).toBeNull()
    rerender(<StageCalendarModal open onClose={vi.fn()} title="t" subtitle={null} todayYmd="2026-09-07" window={{ start: '2026-09-01', end: '2026-09-05' }} windowBy="office" pick={null} pickBy={null} ask={null} gc={{ state: 'off', gcName: null, shownSince: null }} subName={null} subLine={null} offDays={[]} siblings={[]} />)
    expect(screen.getAllByRole('grid').length).toBe(1)
    expect(screen.getByText(/off for this job/)).toBeTruthy()
  })
})
