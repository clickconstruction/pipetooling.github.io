// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SubmittalJourneyStrip } from './SubmittalJourneyStrip'
import { submittalJourney } from '../../lib/submittals/submittalJourney'

describe('SubmittalJourneyStrip', () => {
  it('draws the seven pills with their state, the next line with its button, and the first-open offer', () => {
    const onAction = vi.fn()
    const onGoToStage = vi.fn()
    const onWalkThrough = vi.fn()
    const onDismissOffer = vi.fn()
    const journey = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 1, status: 'draft', isNewest: true, rows: 14, owesReason: 2, sheetsNeeded: 10, packageBuilt: false }, room: null, decisions: null })
    render(<SubmittalJourneyStrip journey={journey} busy={false} onAction={onAction} onGoToStage={onGoToStage} onWalkThrough={onWalkThrough} offerWalkThrough onDismissOffer={onDismissOffer} />)

    const pills = screen.getAllByTestId('journey-stage')
    expect(pills.map((p) => p.getAttribute('data-status'))).toEqual(['done', 'done', 'current', 'later', 'later', 'later', 'later'])
    expect(screen.getByRole('button', { name: '3 Reasons & sheets · you are here' })).toBeTruthy()
    expect(screen.getByTestId('journey-next').textContent).toMatch(/^Next: 2 rows still owe a reason · 10 rows still need a cut sheet\./)

    fireEvent.click(screen.getByRole('button', { name: 'Drop a vendor PDF' }))
    expect(onAction).toHaveBeenCalledWith('drop_vendor_pdf')

    fireEvent.click(screen.getByRole('button', { name: '5 Share · later' }))
    expect(onGoToStage).toHaveBeenCalledWith(expect.objectContaining({ key: 'share', anchor: 'submittals-share' }))

    expect(screen.getByTestId('journey-offer').textContent).toMatch(/New here\?/)
    fireEvent.click(screen.getAllByRole('button', { name: 'Walk me through it ▶' })[1] as HTMLElement)
    expect(onWalkThrough).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismissOffer).toHaveBeenCalledTimes(1)
  })

  it('a waiting stage reads amber, its button is quiet, and a done journey has no button', () => {
    const waiting = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 2, status: 'shared', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: true }, room: { status: 'open', opens: 5, identified: ['Dana Whitfield'] }, decisions: null })
    const { unmount } = render(<SubmittalJourneyStrip journey={waiting} busy={false} onAction={() => {}} onGoToStage={() => {}} onWalkThrough={() => {}} offerWalkThrough={false} onDismissOffer={() => {}} />)
    expect(screen.getByRole('button', { name: '6 Their call · waiting on the reviewer' })).toBeTruthy()
    expect(screen.getByTestId('journey-next').textContent).toMatch(/^Waiting: Rev 2 is in the room · opened 5× · Dana Whitfield on it\./)
    expect(screen.getByRole('button', { name: 'Copy the room link' })).toBeTruthy()
    expect(screen.queryByTestId('journey-offer')).toBeNull()
    unmount()

    const done = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 2, status: 'shared', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: true }, room: { status: 'open', opens: 9, identified: [] }, decisions: { decided: 14, approved: 14, open: 0, sentBack: 0, byName: ['Dana Whitfield'] } })
    render(<SubmittalJourneyStrip journey={done} busy={false} onAction={() => {}} onGoToStage={() => {}} onWalkThrough={() => {}} offerWalkThrough={false} onDismissOffer={() => {}} />)
    expect(screen.getByTestId('journey-next').textContent).toBe('Done: Every row approved by Dana Whitfield. Nothing left to do here.')
    expect(screen.getAllByRole('button').map((b) => b.textContent)).not.toContain('Share')
  })
})
