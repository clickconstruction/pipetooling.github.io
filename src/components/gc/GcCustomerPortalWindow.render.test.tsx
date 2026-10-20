// @vitest-environment jsdom
/**
 * Render smokes for the customer's portal window (Messages, cut 8d): their page on a GC job as they see it, read from
 * their own portal as a staff look, beside *Ready for <name>?* with its fix presses and the tags of *Show where each
 * piece comes from*; their link made only on the office's press; and a choice among their GC jobs. The reads are
 * mocked at the loader; the customer and the jobs are made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/portal/customerPortalPreviewIo', () => ({ activePortalToken: vi.fn(), loadPortalPreview: vi.fn(), makePortalLink: vi.fn() }))

import { activePortalToken, loadPortalPreview, makePortalLink } from '../../lib/portal/customerPortalPreviewIo'
import { parsePortalPayload, type PortalPayload } from '../../lib/portal/portalPayload'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { GcCustomerPortalWindow } from './GcCustomerPortalWindow'

const page = (over: Record<string, unknown> = {}) => ({
  contract: 412000,
  contractSignedOn: '2026-09-19',
  architect: 'Marsh & Vale Architects',
  payDays: 30,
  changes: [],
  payApps: [],
  week: { on: todayYmdInAppTz(), line: 'Permits are in.', lineEs: null, photosUrl: null },
  people: [{ role: 'super', name: 'Wendi' }],
  moves: [],
  switches: { photos: false, forecast: false, spanish: false },
  ...over,
})
const job = (projectId: string, name: string, over: Record<string, unknown> = {}) => ({ projectId, name, changeOrders: [], canAccept: false, accepted: null, page: page(over) })
const payloadOf = (gcJobs: unknown[]): PortalPayload =>
  parsePortalPayload({ customerName: 'Clinic Owner LLC', company: { name: 'Click Construction', phone: '(210) 555-0100', email: 'office@example.com' }, bills: [], gcJobs })!

const CUSTOMER = { id: 'cust-1', name: 'Clinic Owner LLC', contact: 'Priya Shah' }
const onFix = vi.fn()

beforeEach(() => {
  onFix.mockReset()
  vi.mocked(activePortalToken).mockReset().mockResolvedValue('tok-1234567890abcdef')
  vi.mocked(loadPortalPreview).mockReset().mockResolvedValue(payloadOf([job('p-clinic', 'Clinic on Main')]))
  vi.mocked(makePortalLink).mockReset()
})

const open = () => renderWithProviders(<GcCustomerPortalWindow customer={CUSTOMER} onFix={onFix} onClose={vi.fn()} />)
const panel = async () => within(await screen.findByRole('complementary', { name: 'Ready for Priya?' }))

describe('the customer’s portal window', () => {
  it('opens their page as they see it, beside Ready for Priya?', async () => {
    open()
    const side = await panel()
    expect(screen.getByRole('dialog', { name: 'Clinic Owner LLC’s portal' })).toBeTruthy()
    expect(screen.getByTestId('portal-gc-page').textContent).toContain('Clinic on Main')
    expect(side.getByText('2 things to fix')).toBeTruthy()
    expect(side.getByText("This week's line has no Spanish yet. Priya would read English there.")).toBeTruthy()
    expect(loadPortalPreview).toHaveBeenCalledWith('tok-1234567890abcdef')
  })

  it('goes to the page that feeds a piece, from a fix press and from a card’s tag', async () => {
    open()
    const side = await panel()
    const schedule = side.getByText('No milestones. The tab would be empty.').closest('li') as HTMLElement
    fireEvent.click(within(schedule).getByRole('button', { name: 'fix ›' }))
    expect(onFix).toHaveBeenCalledWith('schedule', 'p-clinic')
    expect(document.querySelector('[data-source-tag]')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show where each piece comes from' }))
    fireEvent.click(screen.getByRole('button', { name: 'From the daily log · change ›' }))
    expect(onFix).toHaveBeenLastCalledWith('log', 'p-clinic')
  })

  it('makes their link only when the office presses for it', async () => {
    vi.mocked(activePortalToken).mockResolvedValue(null)
    vi.mocked(makePortalLink).mockResolvedValue('tok-new-0123456789')
    open()
    expect(await screen.findByText('Clinic Owner LLC has no portal link yet. Our contract’s email makes one, or make it here.')).toBeTruthy()
    expect(makePortalLink).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Make their link' }))
    await waitFor(() => expect(makePortalLink).toHaveBeenCalledWith('cust-1'))
    expect(await screen.findByTestId('portal-gc-page')).toBeTruthy()
    expect(loadPortalPreview).toHaveBeenCalledWith('tok-new-0123456789')
  })

  it('picks among their GC jobs', async () => {
    vi.mocked(loadPortalPreview).mockResolvedValue(payloadOf([job('p-clinic', 'Clinic on Main'), job('p-annex', 'Clinic Annex', { people: [] })]))
    open()
    await panel()
    fireEvent.change(screen.getByRole('combobox', { name: 'Job' }), { target: { value: 'p-annex' } })
    expect(screen.getByTestId('portal-gc-page').textContent).toContain('Clinic Annex')
  })
})
