// @vitest-environment jsdom
/**
 * Settings → Jobs, bills and liens → Trips (v2.7888): the block reads the distance, saves a whole number of miles in
 * range, and says why a save failed. The io is the block's own seam.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import TripFarMilesSettingsBlock, { type TripFarMilesIo } from './TripFarMilesSettingsBlock'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const makeIo = (over: Partial<TripFarMilesIo> = {}): TripFarMilesIo => ({ read: vi.fn(async () => 150), save: vi.fn(async () => undefined), ...over })
const input = () => screen.getByTestId('trip-far-miles-input') as HTMLInputElement
const save = () => screen.getByTestId('trip-far-miles-save') as HTMLButtonElement

describe('TripFarMilesSettingsBlock', () => {
  it('shows the distance it read, with Save dead until the number changes', async () => {
    renderWithProviders(<TripFarMilesSettingsBlock io={makeIo()} />)
    await waitFor(() => expect(input().value).toBe('150'))
    expect(screen.getByLabelText('Miles from the shop')).toBe(input())
    expect(save().disabled).toBe(true)
    expect(screen.getByText(/Pick 25 to 1,000\./)).toBeTruthy()
    expect(screen.getByText(/the Trips line reads none yet · add one/)).toBeTruthy()
  })

  it('saves a whole number of miles in range, and Save goes dead again on the saved number', async () => {
    const io = makeIo()
    renderWithProviders(<TripFarMilesSettingsBlock io={io} />)
    await waitFor(() => expect(input().value).toBe('150'))
    fireEvent.change(input(), { target: { value: '90' } })
    expect(save().disabled).toBe(false)
    fireEvent.click(save())
    await waitFor(() => expect(io.save).toHaveBeenCalledWith(90))
    await waitFor(() => expect(save().disabled).toBe(true))
    expect(input().value).toBe('90')
  })

  it('takes nothing out of range or with a fraction', async () => {
    const io = makeIo()
    renderWithProviders(<TripFarMilesSettingsBlock io={io} />)
    await waitFor(() => expect(input().value).toBe('150'))
    for (const typed of ['24', '1001', '150.5', '']) {
      fireEvent.change(input(), { target: { value: typed } })
      expect(save().disabled, typed).toBe(true)
    }
    expect(io.save).not.toHaveBeenCalled()
  })

  it('keeps the number typed when the save is refused, with Save live to try again', async () => {
    const io = makeIo({ save: vi.fn(async () => Promise.reject({ code: '42501', message: 'new row violates row-level security policy for table "app_settings"' })) })
    renderWithProviders(<TripFarMilesSettingsBlock io={io} />)
    await waitFor(() => expect(input().value).toBe('150'))
    fireEvent.change(input(), { target: { value: '200' } })
    fireEvent.click(save())
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(save().disabled).toBe(false))
    expect(input().value).toBe('200')
  })
})
