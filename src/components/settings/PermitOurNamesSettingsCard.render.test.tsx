// @vitest-environment jsdom
/**
 * Render smoke for Settings → Company → Our names on plumbing permits (punch list #307): the card folds
 * to its name and what the list holds, opens to the words, the company name that counts already, the
 * names with Take back, and the one field that adds a name. A refusal by the kernel or the database reads
 * its reason. Every name here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { OurNames } from '../../lib/research/ourNames'

const io = vi.hoisted(() => ({ loadOurNames: vi.fn(), changeOurNames: vi.fn(), onOurNamesChanged: vi.fn() }))
vi.mock('../../lib/research/ourNamesIo', () => io)

import { PermitOurNamesSettingsCard } from './PermitOurNamesSettingsCard'

const ours = (over: Partial<OurNames> = {}): OurNames => ({ names: [], companyName: null, ...over })
const open = () => fireEvent.click(screen.getByRole('button', { name: /Our names on plumbing permits/ }))

beforeEach(() => {
  io.loadOurNames.mockReset().mockResolvedValue(ours())
  io.changeOurNames.mockReset()
  io.onOurNamesChanged.mockReset().mockReturnValue(() => {})
})
afterEach(() => cleanup())

describe('PermitOurNamesSettingsCard', () => {
  it('folds to its name and what the list holds', async () => {
    io.loadOurNames.mockResolvedValue(ours({ names: ['Marco Vale'], companyName: 'Blue Heron Plumbing LLC' }))
    const { container } = renderWithProviders(<PermitOurNamesSettingsCard />)
    await waitFor(() => expect(screen.getByText('1 name and the company name on paper bills')).toBeTruthy())
    expect(document.getElementById('settings-company-our-permit-names')?.getAttribute('data-open')).toBe('no')
    expect(container.querySelector('[data-our-permit-names]')).toBeNull()
  })

  it('opens on an empty list that names the press, and says no company name counts', async () => {
    renderWithProviders(<PermitOurNamesSettingsCard />)
    await waitFor(() => expect(screen.getByText('none yet')).toBeTruthy())
    open()
    expect(screen.getByText(/^A city lists one name on a plumbing permit\./)).toBeTruthy()
    expect(screen.getByText('No company name is set for paper bills, so only the names added here count.')).toBeTruthy()
    expect(screen.getByText('No names yet.')).toBeTruthy()
    // The empty state's press puts the cursor in the field.
    fireEvent.click(screen.getAllByRole('button', { name: 'Add the name' })[0]!)
    expect(document.activeElement).toBe(screen.getByLabelText('A name as the city lists it'))
  })

  it('lists the names, says the company name counts already, and adds a typed name', async () => {
    io.loadOurNames.mockResolvedValue(ours({ names: ['Marco Vale'], companyName: 'Blue Heron Plumbing LLC' }))
    io.changeOurNames.mockResolvedValue({ result: { ok: true, names: ['Marco Vale', 'M Vale Plumbing'] }, ours: ours({ names: ['Marco Vale', 'M Vale Plumbing'], companyName: 'Blue Heron Plumbing LLC' }) })
    renderWithProviders(<PermitOurNamesSettingsCard />)
    await waitFor(() => expect(screen.getByText('1 name and the company name on paper bills')).toBeTruthy())
    open()
    expect(screen.getByText('Blue Heron Plumbing LLC counts already. It is the company name on paper bills.')).toBeTruthy()
    expect(screen.getByText('Marco Vale')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('A name as the city lists it'), { target: { value: 'M Vale Plumbing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the name' }))
    await waitFor(() => expect(screen.getByText('M Vale Plumbing')).toBeTruthy())
    expect(io.changeOurNames).toHaveBeenCalledWith({ add: 'M Vale Plumbing' })
    expect((screen.getByLabelText('A name as the city lists it') as HTMLInputElement).value).toBe('')
    expect(await screen.findByText('Added. A plumbing permit under that name now reads as ours.')).toBeTruthy()
  })

  it('takes a name back', async () => {
    io.loadOurNames.mockResolvedValue(ours({ names: ['Marco Vale', 'M Vale Plumbing'] }))
    io.changeOurNames.mockResolvedValue({ result: { ok: true, names: ['M Vale Plumbing'] }, ours: ours({ names: ['M Vale Plumbing'] }) })
    renderWithProviders(<PermitOurNamesSettingsCard />)
    await waitFor(() => expect(screen.getByText('2 names')).toBeTruthy())
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Take back Marco Vale' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Take back Marco Vale' })).toBeNull())
    expect(io.changeOurNames).toHaveBeenCalledWith({ remove: 'Marco Vale' })
    expect(screen.getByRole('button', { name: 'Take back M Vale Plumbing' })).toBeTruthy()
  })

  it('reads the reason when a name is refused, by the list or by the database', async () => {
    io.loadOurNames.mockResolvedValue(ours({ names: ['Marco Vale'] }))
    io.changeOurNames.mockResolvedValueOnce({ result: { ok: false, reason: 'Marco Vale is on the list, and it reads the same as that name.' }, ours: ours({ names: ['Marco Vale'] }) })
    renderWithProviders(<PermitOurNamesSettingsCard />)
    await waitFor(() => expect(screen.getByText('1 name')).toBeTruthy())
    open()
    fireEvent.change(screen.getByLabelText('A name as the city lists it'), { target: { value: 'MARCO VALE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the name' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Marco Vale is on the list, and it reads the same as that name.')
    // The typed name stays for a second try, and typing clears the reason.
    expect((screen.getByLabelText('A name as the city lists it') as HTMLInputElement).value).toBe('MARCO VALE')
    io.changeOurNames.mockRejectedValueOnce(new Error('The network dropped.'))
    fireEvent.change(screen.getByLabelText('A name as the city lists it'), { target: { value: 'Another Name' } })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add the name' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/The network dropped\./)
  })

  it('says why the list could not be read, and reads again on Try again', async () => {
    io.loadOurNames.mockRejectedValueOnce(new Error('The network dropped.'))
    renderWithProviders(<PermitOurNamesSettingsCard />)
    open()
    expect(await screen.findByText(/The network dropped\./)).toBeTruthy()
    io.loadOurNames.mockResolvedValue(ours({ names: ['Marco Vale'] }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Marco Vale')).toBeTruthy()
  })
})
