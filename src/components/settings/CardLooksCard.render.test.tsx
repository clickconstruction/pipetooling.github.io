// @vitest-environment jsdom
/**
 * Card and footer looks (punch list #313) over fake ios: the owner and a dev see every look with whether it is offered,
 * how many people use it and which is the default; switching a look on or picking another default saves the setting;
 * the default cannot be switched off; a refused save puts the switch back and says why, a database refusal by its
 * reason; anyone else sees no card (v2.7139: a dev alone before, which kept the owner from his own card).
 * Under the looks the card sizes are offered the same way, and saving one setting never sends the other.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LooksAdminIo } from '../../lib/brandKit/cardIo'
import { guessTextWidth } from '../../lib/brandKit/draw'
import type { CardLooksSetting } from '../../lib/brandKit/looks'
import type { KitRenderer } from '../../lib/brandKit/render'
import type { CardSizesSetting } from '../../lib/brandKit/sizes'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { checkSupabaseError } from '../../utils/errorHandling'
import { CardLooksCard } from './CardLooksCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

const TWO: CardLooksSetting = { approved: ['classic', 'navy-orange'], default: 'classic' }

const TWO_SIZES: CardSizesSetting = { approved: ['standard', 'photo'], default: 'standard' }

function fakeIo(setting: CardLooksSetting = TWO, sizes: CardSizesSetting = TWO_SIZES) {
  return {
    looks: vi.fn(async () => setting),
    saveLooks: vi.fn(async () => undefined),
    sizes: vi.fn(async () => sizes),
    saveSizes: vi.fn(async () => undefined),
    picks: vi.fn(async () => [
      { look: null, size: null },
      { look: null, size: 'photo' },
      { look: 'navy-orange', size: 'text' },
      { look: 'navy-yellow', size: null },
    ]),
  } satisfies LooksAdminIo
}
const cardIo = {
  load: vi.fn(async () => ({ facts: { name: 'Robert', card_name: null, title: null, email: 'robert@example.com', phone: null }, photoPath: null, crop: { fx: 0.5, fy: 0.4, zoom: 1 }, columnsOn: true, look: null, lookOn: true, size: null, sizeOn: true })),
  photo: vi.fn(async () => ({ href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 })),
}
function fakeRenderer() {
  return {
    ready: vi.fn(async () => ({ assets: { mark: 'data:image/png;base64,MARK', cardFrontPhoto: 'data:image/jpeg;base64,FRONT' }, measure: guessTextWidth })),
    png: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    pdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  } satisfies KitRenderer
}
const row = (id: string) => document.querySelector(`[data-card-look="${id}"]`) as HTMLElement
const sizeRow = (id: string) => document.querySelector(`[data-card-size="${id}"]`) as HTMLElement

afterEach(cleanup)

describe('CardLooksCard', () => {
  it('lists every look with whether it is offered, who uses it and the default', async () => {
    renderWithProviders(<CardLooksCard role="dev" io={fakeIo()} cardIo={cardIo} renderer={fakeRenderer()} />)
    await screen.findByText('Card and footer looks')
    await waitFor(() => expect(row('classic')).toBeTruthy())
    // two with no pick and the one on a look that is off count on the default
    expect(row('classic').textContent).toContain('3 people use it.')
    expect(row('navy-orange').textContent).toContain('1 person uses it.')
    expect(row('navy-yellow').textContent).toContain('Not offered')
    expect(screen.getByRole('switch', { name: 'Offered: Classic' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('switch', { name: 'Offered: Navy and yellow' })).toHaveProperty('checked', false)
  })

  it('switches a look on and saves the setting', async () => {
    const io = fakeIo()
    renderWithProviders(<CardLooksCard role="dev" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Offered: Navy and yellow' }))
    await waitFor(() => expect(io.saveLooks).toHaveBeenCalledWith({ approved: ['classic', 'navy-orange', 'navy-yellow'], default: 'classic' }))
    expect(row('navy-yellow').textContent).toContain('1 person uses it.')
  })

  it('makes another look the default, switching it on', async () => {
    const io = fakeIo()
    renderWithProviders(<CardLooksCard role="dev" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    await screen.findByRole('switch', { name: 'Offered: Navy and yellow' })
    const radios = screen.getAllByRole('radio')
    fireEvent.click(radios[2]!)
    await waitFor(() => expect(io.saveLooks).toHaveBeenCalledWith({ approved: ['classic', 'navy-orange', 'navy-yellow'], default: 'navy-yellow' }))
  })

  it('puts the switch back and says why when the save is refused', async () => {
    const io = fakeIo()
    io.saveLooks.mockRejectedValueOnce(new Error('The looks were not saved. Only the owner or a dev may change them.'))
    renderWithProviders(<CardLooksCard role="dev" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    const sw = await screen.findByRole('switch', { name: 'Offered: Navy and yellow' })
    fireEvent.click(sw)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Only the owner or a dev may change them')
    expect(sw).toHaveProperty('checked', false)
  })

  it('lists every card size with whether it is offered, who uses it and the default', async () => {
    renderWithProviders(<CardLooksCard role="dev" io={fakeIo()} cardIo={cardIo} renderer={fakeRenderer()} />)
    await screen.findByText('Card sizes')
    // two with no pick and the one on a size that is off count on the default
    expect(sizeRow('standard').textContent).toContain('3 people use it.')
    expect(sizeRow('photo').textContent).toContain('1 person uses it.')
    expect(sizeRow('text').textContent).toContain('Not offered')
    expect(screen.getByRole('switch', { name: 'Offered: Standard' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('switch', { name: 'Offered: Larger text' })).toHaveProperty('checked', false)
    // each size is drawn as the card's back, with the dev's own name
    await waitFor(() => expect(sizeRow('text').innerHTML).toContain('font-size="66.0"'))
  })

  it('switches a size on and saves the sizes alone', async () => {
    const io = fakeIo()
    renderWithProviders(<CardLooksCard role="dev" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Offered: Larger text' }))
    await waitFor(() => expect(io.saveSizes).toHaveBeenCalledWith({ approved: ['standard', 'photo', 'text'], default: 'standard' }))
    expect(io.saveLooks).not.toHaveBeenCalled()
    expect(sizeRow('text').textContent).toContain('1 person uses it.')
  })

  it('makes another size the default, and puts it back when the save is refused', async () => {
    const io = fakeIo()
    io.saveSizes.mockRejectedValueOnce(new Error('The card sizes were not saved. Only the owner or a dev may change them.'))
    renderWithProviders(<CardLooksCard role="dev" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    await screen.findByText('Card sizes')
    const radios = sizeRow('text').querySelectorAll('input[type="radio"]')
    fireEvent.click(radios[0]!)
    await waitFor(() => expect(io.saveSizes).toHaveBeenCalledWith({ approved: ['standard', 'photo', 'text'], default: 'text' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Only the owner or a dev may change them')
    expect(screen.getByRole('switch', { name: 'Offered: Larger text' })).toHaveProperty('checked', false)
  })

  it('shows the owner the card, and his switch saves (v2.7139)', async () => {
    const io = fakeIo()
    renderWithProviders(<CardLooksCard role="master_technician" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    await screen.findByText('Card and footer looks')
    fireEvent.click(await screen.findByRole('switch', { name: 'Offered: Navy and yellow' }))
    await waitFor(() => expect(io.saveLooks).toHaveBeenCalledWith({ approved: ['classic', 'navy-orange', 'navy-yellow'], default: 'classic' }))
    fireEvent.click(await screen.findByRole('switch', { name: 'Offered: Larger text' }))
    await waitFor(() => expect(io.saveSizes).toHaveBeenCalledWith({ approved: ['standard', 'photo', 'text'], default: 'standard' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says the database’s reason when it refuses the save, and puts the switch back', async () => {
    const io = fakeIo()
    // The shape PostgREST answers a row-level-security refusal with, as checkSupabaseError throws it.
    io.saveLooks.mockImplementationOnce(async () => {
      checkSupabaseError({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "app_settings"' }, status: 403 }, 'save the looks')
    })
    renderWithProviders(<CardLooksCard role="master_technician" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    const sw = await screen.findByRole('switch', { name: 'Offered: Navy and yellow' })
    fireEvent.click(sw)
    expect((await screen.findByRole('alert')).textContent).toContain('You don\'t have permission to save the looks.')
    expect(sw).toHaveProperty('checked', false)
  })

  it.each(['assistant', 'controller', 'estimator', 'superintendent', 'subcontractor'] as const)('shows %s no card and reads nothing', (role) => {
    const io = fakeIo()
    const { container } = renderWithProviders(<CardLooksCard role={role} io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    expect(container.querySelector('[data-card-looks]')).toBeNull()
    expect(io.looks).not.toHaveBeenCalled()
  })
})
