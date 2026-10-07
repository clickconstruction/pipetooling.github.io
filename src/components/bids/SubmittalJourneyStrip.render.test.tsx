// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SubmittalJourneyStrip } from './SubmittalJourneyStrip'
import { submittalJourney } from '../../lib/submittals/submittalJourney'

describe('SubmittalJourneyStrip', () => {
  it('draws the eight pills with their state, the next line with its button, and the first-open offer', () => {
    const onAction = vi.fn()
    const onGoToStage = vi.fn()
    const onWalkThrough = vi.fn()
    const onDismissOffer = vi.fn()
    const journey = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 1, status: 'draft', isNewest: true, rows: 14, owesReason: 2, sheetsNeeded: 10, packageBuilt: false }, room: null, decisions: null })
    render(<SubmittalJourneyStrip journey={journey} busy={false} onAction={onAction} onGoToStage={onGoToStage} onWalkThrough={onWalkThrough} offerWalkThrough onDismissOffer={onDismissOffer} />)

    const pills = screen.getAllByTestId('journey-stage')
    expect(pills.map((p) => p.getAttribute('data-status'))).toEqual(['done', 'done', 'current', 'later', 'later', 'later', 'later', 'later'])
    expect(screen.getByRole('button', { name: '3 Reasons & sheets · you are here' })).toBeTruthy()
    // v2.4126 · four words over the pills, each lit by its pills.
    const groups = screen.getAllByTestId('journey-group')
    expect(groups.map((g) => `${g.getAttribute('aria-label')}:${g.getAttribute('data-status')}:${g.querySelectorAll('[data-testid="journey-stage"]').length}`)).toEqual(['Build:current:3', 'Send:later:2', 'Their answer:later:2', 'Order:later:1'])
    expect(screen.getByTestId('journey-next').textContent).toMatch(/^Next: 2 rows still owe a reason\. 10 rows still need a cut sheet\./)

    fireEvent.click(screen.getByRole('button', { name: 'Drop a vendor PDF' }))
    expect(onAction).toHaveBeenCalledWith('drop_vendor_pdf')

    fireEvent.click(screen.getByRole('button', { name: '5 Share · later' }))
    expect(onGoToStage).toHaveBeenCalledWith(expect.objectContaining({ key: 'share', anchor: 'submittals-share' }))

    expect(screen.getByTestId('journey-offer').textContent).toMatch(/New here\?/)
    // The offer carries the only walkthrough button on the strip; the title's Help menu holds the other.
    expect(screen.getAllByRole('button', { name: 'Walk me through it ▶' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Walk me through it ▶' }))
    expect(onWalkThrough).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismissOffer).toHaveBeenCalledTimes(1)
    // v2.4189 · no onSeeGc → no door.
    expect(screen.queryByTestId('see-gc')).toBeNull()
  })

  it('v2.4189 · See what the GC sees opens the window; the button says so and keeps its name (2026-10-02)', () => {
    const onSeeGc = vi.fn()
    const journey = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 1, status: 'draft', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: false }, room: null, decisions: null })
    render(<SubmittalJourneyStrip journey={journey} busy={false} onAction={() => {}} onGoToStage={() => {}} onWalkThrough={() => {}} offerWalkThrough={false} onDismissOffer={() => {}} onSeeGc={onSeeGc} />)
    const see = screen.getByTestId('see-gc')
    expect(see.textContent).toBe('See what the GC sees')
    expect(see.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(see)
    expect(onSeeGc).toHaveBeenCalledTimes(1)
  })

  it('a waiting stage reads amber, its button is quiet, and a done journey has no button', () => {
    const waiting = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 2, status: 'shared', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: true }, room: { status: 'open', opens: 5, identified: ['Dana Whitfield'] }, decisions: null })
    const { unmount } = render(<SubmittalJourneyStrip journey={waiting} busy={false} onAction={() => {}} onGoToStage={() => {}} onWalkThrough={() => {}} offerWalkThrough={false} onDismissOffer={() => {}} />)
    expect(screen.getByRole('button', { name: '6 Their call · waiting on the reviewer' })).toBeTruthy()
    expect(screen.getByTestId('journey-next').textContent).toMatch(/^Waiting: Rev 2 is with the GC\. The link was opened 5 times\. Dana Whitfield is on it\./)
    expect(screen.getByRole('button', { name: 'Copy the room link' })).toBeTruthy()
    expect(screen.queryByTestId('journey-offer')).toBeNull()
    unmount()

    const done = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 2, status: 'shared', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: true }, room: { status: 'open', opens: 9, identified: [] }, decisions: { decided: 14, approved: 14, open: 0, sentBack: 0, byName: ['Dana Whitfield'] } })
    render(<SubmittalJourneyStrip journey={done} busy={false} onAction={() => {}} onGoToStage={() => {}} onWalkThrough={() => {}} offerWalkThrough={false} onDismissOffer={() => {}} />)
    expect(screen.getByTestId('journey-next').textContent).toBe('Done: Dana Whitfield approved every row. Next is the order log, Step 8.')
    expect(screen.getAllByRole('button').map((b) => b.textContent)).not.toContain('Share')
  })
  it('2026-10-04 · a pill that goes from lit back to grey keeps its own outline: no shorthand is mixed with a border colour', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const props = { busy: false, onAction: () => {}, onGoToStage: () => {}, onWalkThrough: () => {}, offerWalkThrough: false, onDismissOffer: () => {} }
      // A draft with rows: pills 1 and 2 done, pill 3 lit.
      const lit = submittalJourney({ scheduleTags: 12, picks: 14, rev: { number: 1, status: 'draft', isNewest: true, rows: 14, owesReason: 2, sheetsNeeded: 10, packageBuilt: false }, room: null, decisions: null })
      const { rerender } = render(<SubmittalJourneyStrip journey={lit} {...props} />)
      const pill3 = () => screen.getAllByTestId('journey-stage')[2] as HTMLElement
      expect(pill3().style.borderColor).toBe('rgb(37, 99, 235)')
      // The same strip on a bid with no revision yet: pills 2 and 3 go back to grey.
      rerender(<SubmittalJourneyStrip journey={submittalJourney({ scheduleTags: 0, picks: 0, rev: null, room: null, decisions: null })} {...props} />)
      expect(pill3().getAttribute('data-status')).toBe('later')
      expect(pill3().style.borderColor).toBe('var(--border-strong)')
      expect(pill3().style.borderStyle).toBe('solid')
      const mixed = errors.mock.calls.filter((c) => String(c[0]).includes('conflicting property'))
      expect(mixed).toEqual([])
    } finally {
      errors.mockRestore()
    }
  })
})
