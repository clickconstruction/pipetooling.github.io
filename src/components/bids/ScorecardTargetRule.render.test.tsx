// @vitest-environment jsdom
/**
 * Punch list #360 PR 3: the score's target in the Bid Board's Pricing rules. The owner sees the number, changes it
 * and saves; the press is dead until the number changes and refuses a number that is not a target. Everyone else
 * reads it. The door to the Scores tab draws for the people who have that tab.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HURDLE_TARGET_WORDS as W } from '../../lib/scorecard/hurdle'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import ScorecardTargetRule, { type ScorecardTargetIo } from './ScorecardTargetRule'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const io = (over: Partial<ScorecardTargetIo> = {}): ScorecardTargetIo => ({ load: vi.fn(async () => ({ targetProfitPerHourUsd: 25 })), save: vi.fn(async () => {}), ...over })

afterEach(cleanup)

describe('ScorecardTargetRule', () => {
  it('the owner changes the target and saves it; the press is dead until the number changes', async () => {
    const fake = io()
    renderWithProviders(<ScorecardTargetRule role="master_technician" canSeeScores io={fake} />)
    const input = (await screen.findByLabelText(W.inputLabel)) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('25'))
    const press = screen.getByRole('button', { name: W.save }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '2000' } })
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('The target is dollars of profit on each paid field hour, from 0 to 1,000.')
    fireEvent.change(input, { target: { value: '30' } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(fake.save).toHaveBeenCalledWith({ targetProfitPerHourUsd: 30 }))
    expect(await screen.findByText('The score’s target is $30/h.')).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: W.save }) as HTMLButtonElement).disabled).toBe(true))
    expect(screen.getByRole('link', { name: W.scoresDoor }).getAttribute('href')).toBe('/people?tab=scores')
  })

  it('an estimator reads the target and has no press or door', async () => {
    renderWithProviders(<ScorecardTargetRule role="estimator" io={io()} />)
    await waitFor(() => expect(screen.getByTestId('scorecard-target-read').textContent).toBe('$25/h profit on each paid field hour, on top of break-even. The owner sets the target.'))
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('a refused save says why and keeps the number typed', async () => {
    const fake = io({ save: vi.fn(async () => { throw new Error('new row violates row-level security policy') }) })
    renderWithProviders(<ScorecardTargetRule role="dev" io={fake} />)
    const input = (await screen.findByLabelText(W.inputLabel)) as HTMLInputElement
    await waitFor(() => expect(input.value).toBe('25'))
    fireEvent.change(input, { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: W.save }))
    expect(await screen.findByText(/row-level security/)).toBeTruthy()
    expect(input.value).toBe('40')
  })
})
