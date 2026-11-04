// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installDomShims } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({
  saveLicense: vi.fn(async () => 'lic-1'),
  notifyDispatchLicenseExpiry: vi.fn(async () => null),
  fetchTdlrRows: vi.fn(async () => [
    { license_type: 'A/C Technician', license_subtype: 'REG', license_number: '158729', owner_name: 'PRICE, JORDAN', license_expiration_date_mmddccyy: '12/29/2027' },
  ]),
}))
vi.mock('../../lib/logbook/licenseSaveIo', () => io)

import LicenseEditWindow from './LicenseEditWindow'

beforeAll(() => {
  installDomShims()
})

beforeEach(() => {
  io.saveLicense.mockClear()
  io.fetchTdlrRows.mockClear()
})

describe('LicenseEditWindow', () => {
  it('checks TDLR, takes its date and saves the license in its one form', async () => {
    const onSaved = vi.fn()
    render(<LicenseEditWindow personName="Jordan Price" target={{ id: 'lic-1', raw: 'AC Tech #158729', expiryYmd: '2026-12-29', note: null }} onClose={() => {}} onSaved={onSaved} />)
    expect(screen.getByText('Saves as AC Tech #158729')).toBeTruthy()
    fireEvent.click(screen.getByTestId('license-check-tdlr'))
    expect(await screen.findByText(/PRICE, JORDAN/)).toBeTruthy()
    expect(io.fetchTdlrRows).toHaveBeenCalledWith('158729')
    fireEvent.click(screen.getByRole('button', { name: 'Use this date' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save the license' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(null))
    expect(io.saveLicense).toHaveBeenCalledWith({ id: 'lic-1', personName: 'Jordan Price', licenseType: 'AC Tech #158729', expiryYmd: '2027-12-29', note: '' })
  })

  it('adds a plumbing license from a level and a number, and points to TSBPE for the record', async () => {
    render(<LicenseEditWindow personName="Jordan Price" target={{ id: null, raw: '', expiryYmd: null, note: null }} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('Open the TSBPE search')).toBeTruthy()
    const save = screen.getByRole('button', { name: 'Add the license' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('191717'), { target: { value: '#191717' } })
    expect(screen.getByText('Set the expiry date.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Expires'), { target: { value: '2027-08-31' } })
    expect(screen.getByText('Saves as Plumber Apprentice #191717')).toBeTruthy()
    fireEvent.click(save)
    await vi.waitFor(() => expect(io.saveLicense).toHaveBeenCalledWith({ id: null, personName: 'Jordan Price', licenseType: 'Plumber Apprentice #191717', expiryYmd: '2027-08-31', note: '' }))
  })
})
