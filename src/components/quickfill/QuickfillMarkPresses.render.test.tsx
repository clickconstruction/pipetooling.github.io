// @vitest-environment jsdom
/**
 * The three presses (punch list #176, change 1): Done lit at zero, Worked it lit above zero, Not
 * sure always, which opens one line and sends the words; the header's small pair shows the one
 * lit of Done / Worked it beside Not sure.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { QuickfillMarkPresses } from './QuickfillMarkPresses'

beforeAll(installDomShims)
afterEach(() => cleanup())

describe('QuickfillMarkPresses', () => {
  it('at 50 open on the Roller: Done is dim, Worked it · 50 left · next → is lit and presses worked', () => {
    const onPress = vi.fn()
    renderWithProviders(<QuickfillMarkPresses count={50} nextLabel="next →" layout="bar" stationLabel="Billed Awaiting Payment" onPress={onPress} />)
    const done = screen.getByRole('button', { name: /Done · 0 open · Billed Awaiting Payment/ })
    expect(done).toHaveProperty('disabled', true)
    const worked = screen.getByRole('button', { name: /Worked it · 50 left · Billed Awaiting Payment/ })
    expect(worked.textContent).toContain('Worked it · 50 left · next →')
    fireEvent.click(worked)
    expect(onPress).toHaveBeenCalledWith('worked', '')
  })

  it('at zero: Done · 0 open is lit and presses done', () => {
    const onPress = vi.fn()
    renderWithProviders(<QuickfillMarkPresses count={0} layout="foot" stationLabel="Warnings" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: /Done · 0 open · Warnings/ }))
    expect(onPress).toHaveBeenCalledWith('done', '')
    expect(screen.getByRole('button', { name: /Worked it · Warnings/ })).toHaveProperty('disabled', true)
  })

  it('Not sure opens one line; Send the question presses question with the words; Cancel closes it', () => {
    const onPress = vi.fn()
    renderWithProviders(<QuickfillMarkPresses count={268} layout="stack" stationLabel="Prospects" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: /Not sure what to do · Prospects/ }))
    const box = screen.getByLabelText('What is unclear')
    fireEvent.change(box, { target: { value: 'which ones are mine to call?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the question' }))
    expect(onPress).toHaveBeenCalledWith('question', 'which ones are mine to call?')
    expect(screen.queryByLabelText('What is unclear')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Not sure what to do · Prospects/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('What is unclear')).toBeNull()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('the header pair shows the one lit press beside Not sure', () => {
    renderWithProviders(<QuickfillMarkPresses count={7} layout="small" stationLabel="Physical inbox" onPress={() => {}} />)
    expect(screen.queryByRole('button', { name: /Done · 0 open · Physical inbox/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Worked it · 7 left · Physical inbox/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Not sure what to do · Physical inbox/ })).toBeTruthy()
  })

  it('a station with no count offers Looked', () => {
    const onPress = vi.fn()
    renderWithProviders(<QuickfillMarkPresses count={null} nextLabel="done ✓" layout="bar" stationLabel="Field photos → Drive" onPress={onPress} />)
    fireEvent.click(screen.getByRole('button', { name: /Looked · Field photos/ }))
    expect(onPress).toHaveBeenCalledWith('done', '')
  })

  it('while the station is still counting, Done and Worked it wait and Not sure stays lit (v2.5868)', () => {
    const onPress = vi.fn()
    renderWithProviders(<QuickfillMarkPresses count={null} loading nextLabel="next →" layout="bar" stationLabel="Billed Awaiting Payment" onPress={onPress} />)
    const done = screen.getByRole('button', { name: /^Done · Billed Awaiting Payment/ })
    const worked = screen.getByRole('button', { name: /^Worked it · Billed Awaiting Payment/ })
    expect(done).toHaveProperty('disabled', true)
    expect(worked).toHaveProperty('disabled', true)
    expect(done.textContent).toContain('counting…')
    expect(screen.queryByRole('button', { name: /Looked/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Not sure what to do · Billed Awaiting Payment/ })).toHaveProperty('disabled', false)
  })
})
