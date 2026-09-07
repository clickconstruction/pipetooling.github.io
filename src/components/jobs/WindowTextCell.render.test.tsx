// @vitest-environment jsdom
/**
 * Render smokes for the text Window cell (v2.2963): the dates link, the GC
 * chip in each state, the caption, and the open-ask shape (our dates struck
 * through, Accept / Answer… on line 2, the reason on line 3).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WindowTextCell } from './WindowTextCell'

const win = { start: '2026-09-22', end: '2026-10-02' }

describe('WindowTextCell', () => {
  it('shows the dates as a link, the office caption with Change, and the Offer chip that offers', () => {
    const onOpenDates = vi.fn()
    const onChange = vi.fn()
    const onOffer = vi.fn()
    render(<WindowTextCell window={win} windowBy="office" gc={{ state: 'offer', gcName: 'Summit General' }} onOpenDates={onOpenDates} onChange={onChange} onOfferToGc={onOffer} />)
    const dates = screen.getByRole('button', { name: 'Window Sep 22 – Oct 2' })
    expect(dates.textContent).toBe('Sep 22 – Oct 2')
    expect(dates.style.textDecoration).toContain('underline')
    fireEvent.click(dates)
    expect(onOpenDates).toHaveBeenCalledTimes(1)
    expect(screen.getByText('set by the office')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Offer to GC ›' }))
    expect(onOffer).toHaveBeenCalledTimes(1)
  })

  it('strikes our dates through on an open GC ask and puts their dates, Accept, Answer… and the reason beneath', () => {
    const onAccept = vi.fn()
    const onAnswer = vi.fn()
    render(<WindowTextCell window={win} windowBy="office" ask={{ span: { start: '2026-09-29', end: '2026-10-10' }, note: 'framing slipped' }} gc={{ state: 'asked', gcName: 'Summit General' }} onAccept={onAccept} onAnswer={onAnswer} />)
    const dates = screen.getByRole('button', { name: 'Window Sep 22 – Oct 2, the GC asked for other dates' })
    expect(dates.style.textDecoration).toContain('line-through')
    expect(screen.getByText('Sep 29 – Oct 10 ·')).toBeTruthy()
    expect(screen.getByText('“framing slipped”')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'GC asked ›' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    fireEvent.click(screen.getByRole('button', { name: 'Answer…' }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('set by the office')).toBeNull()
  })

  it('leads with the pick in green, greys a passed window, and names the GC on the shown chip', () => {
    render(<WindowTextCell window={{ start: '2026-09-01', end: '2026-09-05' }} passed windowBy="gc" pick={{ start: '2026-09-04', end: '2026-09-05' }} pickBy="sub" gc={{ state: 'shown', gcName: 'Kane' }} />)
    expect(screen.getByRole('button', { name: 'Window Sep 1 – Sep 5, passed' }).textContent).toBe('Sep 1 – Sep 5 · passed')
    expect(screen.getByText('picked Sep 4 – Sep 5')).toBeTruthy()
    expect(screen.getByText('· as Kane asked')).toBeTruthy()
    expect(screen.getByRole('button', { name: "On Kane's portal ›" })).toBeTruthy()
  })

  it('with no window draws the caller\'s control and a GC off chip that is not a button', () => {
    render(<WindowTextCell window={null} gc={{ state: 'off', gcName: null }} setWindow={<button type="button">Set a window…</button>} />)
    expect(screen.getByRole('button', { name: 'Set a window…' })).toBeTruthy()
    expect(screen.getByText('GC off')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /GC off/ })).toBeNull()
  })
})
