// @vitest-environment jsdom
/**
 * Cards and footers for the team (punch list #313) over a fake io and a fake renderer: everyone is listed with
 * whether a card can be made, the press says what it will make and what it holds, a held person's door opens their
 * card, the print file holds a front and a back for each ready person, and a person whose photo will not load
 * fails by name while the rest are still made.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TeamCardIo } from '../../lib/brandKit/cardIo'
import { guessTextWidth } from '../../lib/brandKit/draw'
import { DEFAULT_CROP } from '../../lib/brandKit/person'
import type { KitRenderer } from '../../lib/brandKit/render'
import type { TeamCardRow } from '../../lib/brandKit/team'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { TeamCardsWindow } from './TeamCardsWindow'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/storageSave', () => ({ saveBlobAs: vi.fn() }))

const row = (id: string, name: string, photoPath: string | null, over: Partial<TeamCardRow['facts']> = {}): TeamCardRow => ({
  id,
  role: 'assistant',
  facts: { name, card_name: null, title: 'Estimator', email: `${id}@juniperplumbing.example`, phone: '(512) 555-0100', ...over },
  photoPath,
  crop: DEFAULT_CROP,
})
const TEAM = [row('m', 'Marisol Vega', 'm/photo-1.jpg'), row('d', 'Dale Okafor', 'd/photo-1.jpg'), row('h', 'Hank Brewer', null), row('l', 'Lucia Ferrante', 'l/photo-1.jpg', { phone: null })]

function fakeIo(photo?: TeamCardIo['photo']) {
  return {
    team: vi.fn(async () => TEAM),
    photo: vi.fn(photo ?? (async () => ({ href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 }))),
  } satisfies TeamCardIo
}
function fakeRenderer() {
  return {
    ready: vi.fn(async () => ({ assets: { mark: 'data:image/png;base64,MARK', cardFrontPhoto: 'data:image/jpeg;base64,FRONT' }, measure: guessTextWidth })),
    png: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    pdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  } satisfies KitRenderer
}

afterEach(cleanup)

describe('TeamCardsWindow', () => {
  it('lists the team, says what the press will make and hold, and opens a held person’s card', async () => {
    const onOpenCard = vi.fn()
    renderWithProviders(<TeamCardsWindow io={fakeIo()} renderer={fakeRenderer()} onClose={() => undefined} onOpenCard={onOpenCard} />)
    expect(await screen.findByRole('button', { name: 'Make 3 cards · 1 is held ▸' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Download 3 footers' })).toBeTruthy()
    expect(screen.getByText('No photo')).toBeTruthy()
    expect(screen.getByText('No mobile, line left off')).toBeTruthy()
    expect(screen.getByLabelText('Hank Brewer')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo ▸' }))
    expect(onOpenCard).toHaveBeenCalledWith({ userId: 'h', name: 'Hank Brewer' })
  })

  it('counts again when a person is unticked', async () => {
    renderWithProviders(<TeamCardsWindow io={fakeIo()} renderer={fakeRenderer()} onClose={() => undefined} onOpenCard={() => undefined} />)
    fireEvent.click(await screen.findByLabelText('Dale Okafor'))
    expect(screen.getByRole('button', { name: 'Make 2 cards · 1 is held ▸' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Download 2 footers' })).toBeTruthy()
  })

  it('makes one print file with a front and a back for each ready person', async () => {
    const renderer = fakeRenderer()
    renderWithProviders(<TeamCardsWindow io={fakeIo()} renderer={renderer} onClose={() => undefined} onOpenCard={() => undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Make 3 cards · 1 is held ▸' }))
    await waitFor(() => expect(renderer.pdf).toHaveBeenCalledTimes(1))
    const pages = (renderer.pdf.mock.calls[0] as unknown as [{ svg: string; widthIn: number }[]])[0]
    expect(pages).toHaveLength(6)
    expect(pages[1]?.svg).toContain('Dale Okafor')
    expect(pages[5]?.svg).toContain('Marisol Vega')
    expect(await screen.findByText('Made 3 cards.')).toBeTruthy()
  })

  it('keeps going past a person whose photo will not load, and names them', async () => {
    const renderer = fakeRenderer()
    const io = fakeIo(async (path) => {
      if (path.startsWith('d/')) throw new Error('The photo could not be read.')
      return { href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 }
    })
    renderWithProviders(<TeamCardsWindow io={io} renderer={renderer} onClose={() => undefined} onOpenCard={() => undefined} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Make 3 cards · 1 is held ▸' }))
    await waitFor(() => expect(renderer.pdf).toHaveBeenCalledTimes(1))
    expect((renderer.pdf.mock.calls[0] as unknown as [unknown[]])[0]).toHaveLength(4)
    expect(await screen.findByText('1 card did not come out. It stays here with the reason.')).toBeTruthy()
    expect(screen.getByText(/Dale Okafor: The photo could not be read\./)).toBeTruthy()
  })
})
