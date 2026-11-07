// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomShims } from '../../test/renderSmokeMocks'
import { parseLicenseType } from '../../lib/logbook/logbook'

const io = vi.hoisted(() => ({ saveLicenseTarget: vi.fn(async () => undefined) }))
vi.mock('../../lib/logbook/licenseTargetIo', () => io)

import LicenseTargetWindow from './LicenseTargetWindow'

beforeAll(() => {
  installDomShims()
})
beforeEach(() => {
  io.saveLicenseTarget.mockClear()
})

describe('LicenseTargetWindow', () => {
  it('prefills the board’s number for a picked class, asks for the source of the hours before the clock, and saves the row', async () => {
    const onSaved = vi.fn()
    render(<LicenseTargetWindow personName="Jordan Price" userId="u1" trade="plumbing" holds={parseLicenseType('Plumber Apprentice #191717')} current={null} onClose={() => {}} onSaved={onSaved} />)
    expect(screen.getByText('Jordan’s plumbing goal')).toBeTruthy()
    expect(screen.getByTestId('license-target-summary').textContent).toBe('Saves as the ladder’s rule, no hours before the clock.')
    fireEvent.change(screen.getByTestId('license-target-class'), { target: { value: 'journeyman' } })
    expect((screen.getByTestId('license-target-amount') as HTMLInputElement).value).toBe('8000')
    fireEvent.change(screen.getByTestId('license-target-amount'), { target: { value: '7000' } })
    fireEvent.change(screen.getByTestId('license-target-opening'), { target: { value: '1200' } })
    expect(screen.getByTestId('license-target-summary').textContent).toBe('Say where the hours before the clock came from.')
    expect((screen.getByTestId('license-target-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('license-target-source'), { target: { value: 'Hours at Rio Plumbing' } })
    expect(screen.getByTestId('license-target-summary').textContent).toBe('Saves as working toward journeyman plumber, 7,000 hours, with 1,200 hours before the clock.')
    fireEvent.click(screen.getByRole('button', { name: 'Save the goal' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(io.saveLicenseTarget).toHaveBeenCalledWith('u1', { trade: 'plumbing', targetClass: 'journeyman', targetAmount: 7000, openingAmount: 1200, openingSource: 'Hours at Rio Plumbing' })
  })

  it('opens on the row already set and names the next license when the ladder has no rule', () => {
    render(
      <LicenseTargetWindow
        personName="Bryan Hall"
        userId="u2"
        trade="electrical"
        holds={parseLicenseType('Journeyman Electrician #4')}
        current={{ trade: 'electrical', targetClass: 'master', targetAmount: 12000, openingAmount: 0, openingSource: '' }}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    )
    expect(screen.getByText('Bryan’s electrical goal')).toBeTruthy()
    expect((screen.getByTestId('license-target-class') as HTMLSelectElement).value).toBe('master')
    expect(screen.getByRole('option', { name: 'Pick the license' })).toBeTruthy()
    expect(screen.getByTestId('license-target-summary').textContent).toBe('Saves as working toward master electrician, 12,000 hours, no hours before the clock.')
  })
})
