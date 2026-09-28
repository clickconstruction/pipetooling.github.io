// @vitest-environment jsdom
/**
 * Render smoke for the Bids lens bar: one pill per lens, the open one filled, a click hands
 * the lens key back, badges and the lead-in words draw where the lens says, and children sit
 * beside the bar.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BidsLensBar } from './BidsLensBar'
import { followupLenses, robotLenses } from '../../lib/bids/bidsLenses'

afterEach(() => cleanup())

describe('BidsLensBar', () => {
  it('draws the Followup pills in order, with "Old:" before By builder', () => {
    render(<BidsLensBar lenses={followupLenses({ role: 'estimator', jobAccountsMissing: 0 })} activeKey="call-queue" onSelect={() => {}} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Call queue new', 'By builder', 'By status', 'Why we lost', 'Waiting to hear', 'Job accounts'])
    const old = screen.getByText('Old:')
    expect(old.nextElementSibling?.textContent).toBe('By builder')
  })

  it('fills the open pill and no other', () => {
    render(<BidsLensBar lenses={followupLenses({ role: 'estimator', jobAccountsMissing: 0 })} activeKey="why-we-lost" onSelect={() => {}} />)
    const open = screen.getByRole('button', { name: 'Why we lost' })
    expect(open.style.fontWeight).toBe('700')
    expect(open.style.color).toBe('white')
    const other = screen.getByRole('button', { name: 'By status' })
    expect(other.style.fontWeight).toBe('400')
    expect(other.style.background).toBe('transparent')
  })

  it('hands the lens key back on a click', () => {
    const onSelect = vi.fn()
    render(<BidsLensBar lenses={followupLenses({ role: 'estimator', jobAccountsMissing: 0 })} activeKey="call-queue" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Waiting to hear' }))
    expect(onSelect).toHaveBeenCalledWith('waiting-to-hear')
  })

  it('draws the Job accounts count and keeps its test id and tooltip', () => {
    render(<BidsLensBar lenses={followupLenses({ role: 'estimator', jobAccountsMissing: 7 })} activeKey="call-queue" onSelect={() => {}} />)
    const pill = screen.getByTestId('followup-job-accounts-tab')
    expect(pill.textContent).toBe('Job accounts 7')
    expect(pill.getAttribute('title')).toMatch(/missing a supply-house account/)
  })

  it('a superintendent gets By builder alone', () => {
    render(<BidsLensBar lenses={followupLenses({ role: 'superintendent', jobAccountsMissing: 7 })} activeKey="builder-review" onSelect={() => {}} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['By builder'])
    expect(screen.queryByText('Old:')).toBeNull()
  })

  it('draws the Robots pills with the DEV mark on the dev ones', () => {
    render(<BidsLensBar lenses={robotLenses({ role: 'dev', activeTab: 'robot-queue', mirrorCount: 12, auditsPending: 3 })} activeKey="robot-queue" onSelect={() => {}} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Robot Board · 12', 'Audits · 3', 'Scoreboard', 'Queue DEV', 'Console DEV'])
    expect(screen.getByRole('button', { name: 'Queue DEV' }).style.fontWeight).toBe('700')
  })

  it('draws children beside the bar', () => {
    render(
      <BidsLensBar lenses={followupLenses({ role: 'estimator', jobAccountsMissing: 0 })} activeKey="call-queue" onSelect={() => {}}>
        <span>the caption</span>
      </BidsLensBar>,
    )
    expect(screen.getByText('the caption')).toBeTruthy()
  })
})
