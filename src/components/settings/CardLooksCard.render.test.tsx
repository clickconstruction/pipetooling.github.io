// @vitest-environment jsdom
/**
 * Card and footer looks (punch list #313) over fake ios: a dev sees every look with whether it is offered, how many
 * people use it and which is the default; switching a look on or picking another default saves the setting; the
 * default cannot be switched off; a refused save puts the switch back and says why; anyone but a dev sees no card.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LooksAdminIo } from '../../lib/brandKit/cardIo'
import { guessTextWidth } from '../../lib/brandKit/draw'
import type { CardLooksSetting } from '../../lib/brandKit/looks'
import type { KitRenderer } from '../../lib/brandKit/render'
import { renderWithProviders } from '../../test/renderSmokeMocks'
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

function fakeIo(setting: CardLooksSetting = TWO) {
  return {
    looks: vi.fn(async () => setting),
    saveLooks: vi.fn(async () => undefined),
    picks: vi.fn(async () => [null, null, 'navy-orange', 'navy-yellow']),
  } satisfies LooksAdminIo
}
const cardIo = {
  load: vi.fn(async () => ({ facts: { name: 'Robert', card_name: null, title: null, email: 'robert@example.com', phone: null }, photoPath: null, crop: { fx: 0.5, fy: 0.4, zoom: 1 }, columnsOn: true, look: null, lookOn: true })),
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
    io.saveLooks.mockRejectedValueOnce(new Error('The looks were not saved. Only a dev may change them.'))
    renderWithProviders(<CardLooksCard role="dev" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    const sw = await screen.findByRole('switch', { name: 'Offered: Navy and yellow' })
    fireEvent.click(sw)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Only a dev may change them')
    expect(sw).toHaveProperty('checked', false)
  })

  it('shows nobody but a dev the card', () => {
    const io = fakeIo()
    const { container } = renderWithProviders(<CardLooksCard role="master_technician" io={io} cardIo={cardIo} renderer={fakeRenderer()} />)
    expect(container.querySelector('[data-card-looks]')).toBeNull()
    expect(io.looks).not.toHaveBeenCalled()
  })
})
