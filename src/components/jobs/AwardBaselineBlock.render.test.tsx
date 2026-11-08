// @vitest-environment jsdom
/**
 * The Hours baseline at award block (punch list #234, PR 1a): three sources in order, the first
 * usable one checked, a dead one disabled with its reason, the typed box picking Typed on focus,
 * and the frozen line naming what Create Job will write. The kernel's suite holds the pick rules.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AwardBaselineBlock } from './AwardBaselineBlock'
import { awardBaselineOptions, awardBaselinePick, type AwardBaselineInput, type AwardBaselineSource } from '../../lib/jobs/awardBaseline'

const thinBid = { has_estimate: true, labor_hours: 71, labor_rate: 42, labor_usd: 2_982, materials_usd: 0, completeness: { rows_total: 31, rows_with_hours: 9, rate_set: true, usable: false } }
const book = { n: 12, medianHoursPerThousand: 4.2, p25: 3.5, p75: 5.1, impliedHours: 470.4, billed: 10, scope: 'similar' as const }

function Host({ input }: { input: Omit<AwardBaselineInput, 'typedHours'> }) {
  const [pick, setPick] = useState<AwardBaselineSource | null>(null)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const n = parseFloat(typed)
  const options = awardBaselineOptions({ ...input, typedHours: Number.isFinite(n) && n > 0 ? n : null })
  const effective = pick && options.find((o) => o.source === pick)?.usable ? pick : pick === 'typed' ? 'typed' : awardBaselinePick(options)
  return <AwardBaselineBlock options={options} pick={effective} onPick={setPick} typedHours={typed} onTypedHours={setTyped} note={note} onNote={setNote} loading={false} />
}

afterEach(cleanup)

describe('AwardBaselineBlock', () => {
  it('checks the first usable source, disables a dead one with its reason, and names what Create Job freezes', () => {
    render(<Host input={{ breakdown: thinBid, bidLabel: 'B917', book, priceUsd: 112_000, rateUsd: 45 }} />)
    const bid = screen.getByTestId('award-option-bid') as HTMLButtonElement
    expect(bid.disabled).toBe(true)
    expect(bid.getAttribute('aria-checked')).toBe('false')
    expect(bid.textContent).toContain('Not usable: hours on 9 of 31 rows. Fill the Labor rows on B917 and this becomes the pick.')
    const bookOpt = screen.getByTestId('award-option-book')
    expect(bookOpt.getAttribute('aria-checked')).toBe('true')
    expect(bookOpt.textContent).toContain('≈ 470 h · from the book, assumed')
    expect(screen.getByTestId('award-frozen-line').textContent).toBe('Create Job freezes 470 h assumed')
  })

  it('typing hours picks Typed and the frozen line follows; the note box appears under it', () => {
    render(<Host input={{ breakdown: null, bidLabel: null, book, priceUsd: 112_000, rateUsd: 45 }} />)
    const box = screen.getByTestId('award-typed-hours') as HTMLInputElement
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: '220' } })
    expect(screen.getByTestId('award-option-typed').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('award-frozen-line').textContent).toBe('Create Job freezes 220 h typed')
    expect(screen.getByTestId('award-typed-note')).toBeTruthy()
    // Back to the book by its press.
    fireEvent.click(screen.getByTestId('award-option-book'))
    expect(screen.getByTestId('award-frozen-line').textContent).toBe('Create Job freezes 470 h assumed')
  })

  it('with nothing usable the line says what happens instead of freezing a blank', () => {
    render(<Host input={{ breakdown: null, bidLabel: null, book: { ...book, n: 1, impliedHours: null }, priceUsd: 50_000, rateUsd: 45 }} />)
    expect(screen.getByTestId('award-option-typed').getAttribute('aria-checked')).toBe('true')
    expect(screen.getByTestId('award-frozen-line').textContent).toBe('Create Job freezes nothing yet. Type hours above, or the Quickfill deck line catches the project later.')
  })
})
