// @vitest-environment jsdom
/**
 * Your card and footer (punch list #313) over a fake io and a fake renderer: a person sees the name on the card and
 * the title read back, the footer and the card drawn from them, and the presses lit once there is a photo; with no
 * photo the presses are dead and the card says why; Save lights on a change and writes the row; a download asks the
 * renderer for the picture at the footer's own size; before the columns land the card says it arrives with the next
 * update; a subcontractor sees no card, and the office opens the same card for a teammate.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardIo, CardLoad } from '../../lib/brandKit/cardIo'
import { guessTextWidth } from '../../lib/brandKit/draw'
import type { CardLooksSetting } from '../../lib/brandKit/looks'
import type { KitRenderer } from '../../lib/brandKit/render'
import type { CardSizesSetting } from '../../lib/brandKit/sizes'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { YourCardCard } from './YourCardCard'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/storageSave', () => ({ saveBlobAs: vi.fn() }))

const MARISOL: CardLoad = {
  facts: { name: 'Marisol', card_name: 'Marisol Vega', title: 'Office Manager', email: 'marisol@juniperplumbing.example', phone: '(512) 555-0142' },
  photoPath: 'u-marisol/photo-1.jpg',
  crop: { fx: 0.5, fy: 0.4, zoom: 1 },
  columnsOn: true,
  look: null,
  lookOn: true,
  size: null,
  sizeOn: true,
}

const ONE_LOOK: CardLooksSetting = { approved: ['classic'], default: 'classic' }
const THREE_LOOKS: CardLooksSetting = { approved: ['classic', 'navy-orange', 'navy-yellow'], default: 'classic' }

const ONE_SIZE: CardSizesSetting = { approved: ['standard'], default: 'standard' }
const THREE_SIZES: CardSizesSetting = { approved: ['standard', 'photo', 'text'], default: 'standard' }

function fakeIo(load: CardLoad, looks: CardLooksSetting = ONE_LOOK, sizes: CardSizesSetting = ONE_SIZE) {
  return {
    load: vi.fn(async () => load),
    photo: vi.fn(async () => ({ href: 'data:image/jpeg;base64,AAAA', w: 400, h: 600 })),
    savePhoto: vi.fn(async () => 'u-marisol/photo-2.jpg'),
    saveCrop: vi.fn(async () => undefined),
    removePhoto: vi.fn(async () => ({ fileGone: true })),
    saveFacts: vi.fn(async () => undefined),
    looks: vi.fn(async () => looks),
    saveLook: vi.fn(async () => undefined),
    sizes: vi.fn(async () => sizes),
    saveSize: vi.fn(async () => undefined),
  } satisfies CardIo
}

function fakeRenderer() {
  return {
    ready: vi.fn(async () => ({ assets: { mark: 'data:image/png;base64,MARK', cardFrontPhoto: 'data:image/jpeg;base64,FRONT' }, measure: guessTextWidth })),
    png: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
    pdf: vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' })),
  } satisfies KitRenderer
}

const footer = () => document.querySelector('[data-your-card-footer]')?.innerHTML ?? ''
const back = () => document.querySelector('[data-your-card-back]')?.innerHTML ?? ''

afterEach(cleanup)

describe('YourCardCard', () => {
  it('draws the footer and the card from the person’s facts, and lights the presses once there is a photo', async () => {
    const io = fakeIo(MARISOL)
    const renderer = fakeRenderer()
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={io} renderer={renderer} />)
    expect((await screen.findByLabelText('Name on the card')) as HTMLInputElement).toHaveProperty('value', 'Marisol Vega')
    expect(screen.getByLabelText('Title') as HTMLInputElement).toHaveProperty('value', 'Office Manager')
    await waitFor(() => expect(footer()).toContain('Marisol Vega'))
    expect(footer()).toContain('Office Manager')
    expect(footer()).toContain('(512) 555-0142')
    expect(back()).toContain('marisol@juniperplumbing.example')
    expect(back()).toContain(PORTAL_PHONE)
    expect(screen.getByRole('button', { name: 'Download the picture' })).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: 'Change the photo' })).toBeTruthy()
  })

  it('redraws as the name is typed, and Save the card writes the row', async () => {
    const io = fakeIo(MARISOL)
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={io} renderer={fakeRenderer()} />)
    const name = (await screen.findByLabelText('Name on the card')) as HTMLInputElement
    const save = screen.getByRole('button', { name: 'Save the card' })
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(name, { target: { value: 'Marisol V. Vega' } })
    await waitFor(() => expect(footer()).toContain('Marisol V. Vega'))
    expect(save).toHaveProperty('disabled', false)
    fireEvent.click(save)
    await waitFor(() => expect(io.saveFacts).toHaveBeenCalledWith('u-marisol', { card_name: 'Marisol V. Vega', title: 'Office Manager' }))
  })

  it('makes the picture at the footer’s own size', async () => {
    const renderer = fakeRenderer()
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo(MARISOL)} renderer={renderer} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Download the picture' }))
    await waitFor(() => expect(renderer.png).toHaveBeenCalledTimes(1))
    const [svg, w, h] = renderer.png.mock.calls[0] as unknown as [string, number, number]
    expect([w, h]).toEqual([2709, 625])
    expect(svg).toContain('width="2709"')
    fireEvent.click(screen.getByRole('button', { name: 'Download the print file' }))
    await waitFor(() => expect(renderer.pdf).toHaveBeenCalledTimes(1))
    const pages = (renderer.pdf.mock.calls[0] as unknown as [{ widthIn: number; heightIn: number }[]])[0]
    expect(pages.map((p) => [p.widthIn, p.heightIn])).toEqual([[4.25, 2.75], [4.25, 2.75]])
  })

  it('holds the presses and says why when there is no photo', async () => {
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo({ ...MARISOL, photoPath: null })} renderer={fakeRenderer()} />)
    expect(await screen.findByRole('button', { name: 'Add a photo' })).toBeTruthy()
    await waitFor(() => expect(footer()).toContain('No photo yet'))
    expect(screen.getByRole('button', { name: 'Download the picture' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Download the print file' })).toHaveProperty('disabled', true)
    expect(screen.getByText('Add a photo to make your footer and your card.')).toBeTruthy()
  })

  it('says the card arrives with the next update before its columns land', async () => {
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo({ ...MARISOL, columnsOn: false })} renderer={fakeRenderer()} />)
    expect(await screen.findByText('Your card and footer arrive with the next update.')).toBeTruthy()
    expect(screen.queryByLabelText('Name on the card')).toBeNull()
  })

  it('offers no pick while the owner offers one look', async () => {
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo(MARISOL)} renderer={fakeRenderer()} />)
    await waitFor(() => expect(footer()).toContain('Marisol Vega'))
    expect(document.querySelector('[data-your-card-looks]')).toBeNull()
    expect(document.querySelector('[data-your-card-sizes]')).toBeNull()
    expect(footer()).toContain('fill="#000000"')
  })

  it('offers the card sizes the owner switched on, draws the back in the pick, saves it, and leaves the footer alone', async () => {
    const io = fakeIo(MARISOL, ONE_LOOK, THREE_SIZES)
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={io} renderer={fakeRenderer()} />)
    const larger = await screen.findByRole('radio', { name: /Larger photo/ })
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Standard/ })).toHaveProperty('ariaChecked', 'true')
    // the standard card sets the name at 52 and the photo's ring at 140
    expect(back()).toContain('font-size="52.0"')
    const before = footer()
    fireEvent.click(larger)
    await waitFor(() => expect(io.saveSize).toHaveBeenCalledWith('u-marisol', 'photo'))
    await waitFor(() => expect(back()).toContain('font-size="62.0"'))
    expect(back()).not.toContain('font-size="52.0"')
    expect(footer()).toBe(before)
    expect(larger).toHaveProperty('ariaChecked', 'true')
  })

  it('prints the card in the size picked', async () => {
    const renderer = fakeRenderer()
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo({ ...MARISOL, size: 'text' }, ONE_LOOK, THREE_SIZES)} renderer={renderer} />)
    await waitFor(() => expect(back()).toContain('font-size="66.0"'))
    fireEvent.click(screen.getByRole('button', { name: 'Download the print file' }))
    await waitFor(() => expect(renderer.pdf).toHaveBeenCalledTimes(1))
    const pages = (renderer.pdf.mock.calls[0] as unknown as [{ svg: string }[]])[0]
    expect(pages[1]?.svg).toContain('font-size="66.0"')
  })

  it('draws a size the owner has since switched off in the default, and offers no size before its column lands', async () => {
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo({ ...MARISOL, size: 'text' }, ONE_LOOK, { approved: ['standard', 'photo'], default: 'standard' })} renderer={fakeRenderer()} />)
    await screen.findByRole('radio', { name: /Larger photo/ })
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(back()).toContain('font-size="52.0"')
    cleanup()
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo({ ...MARISOL, sizeOn: false }, ONE_LOOK, THREE_SIZES)} renderer={fakeRenderer()} />)
    await waitFor(() => expect(footer()).toContain('Marisol Vega'))
    expect(document.querySelector('[data-your-card-sizes]')).toBeNull()
  })

  it('puts the size back and says why when the save is refused', async () => {
    const io = fakeIo(MARISOL, ONE_LOOK, THREE_SIZES)
    io.saveSize.mockRejectedValueOnce(new Error('The card size was not saved. You may not have leave to change this account.'))
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={io} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('radio', { name: /Larger text/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('The card size was not saved')
    expect(screen.getByRole('radio', { name: /Standard/ })).toHaveProperty('ariaChecked', 'true')
    expect(back()).toContain('font-size="52.0"')
  })

  it('offers the looks the owner switched on, draws the card in the pick, and saves it', async () => {
    const io = fakeIo(MARISOL, THREE_LOOKS)
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={io} renderer={fakeRenderer()} />)
    const navy = await screen.findByRole('radio', { name: /Navy and yellow/ })
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /Classic/ })).toHaveProperty('ariaChecked', 'true')
    fireEvent.click(navy)
    await waitFor(() => expect(io.saveLook).toHaveBeenCalledWith('u-marisol', 'navy-yellow'))
    await waitFor(() => expect(back()).toContain('fill="#f6c700"'))
    expect(footer()).toContain('fill="#16283c"')
    expect(navy).toHaveProperty('ariaChecked', 'true')
  })

  it('draws a pick the owner has since switched off in the default', async () => {
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={fakeIo({ ...MARISOL, look: 'navy-yellow' }, { approved: ['classic', 'navy-orange'], default: 'classic' })} renderer={fakeRenderer()} />)
    await screen.findByRole('radio', { name: /Navy and orange/ })
    expect(screen.getAllByRole('radio')).toHaveLength(2)
    expect(footer()).toContain('fill="#000000"')
  })

  it('puts the pick back and says why when the save is refused', async () => {
    const io = fakeIo(MARISOL, THREE_LOOKS)
    io.saveLook.mockRejectedValueOnce(new Error('The look was not saved. You may not have leave to change this account.'))
    renderWithProviders(<YourCardCard role="assistant" userId="u-marisol" io={io} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('radio', { name: /Navy and orange/ }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Classic/ })).toHaveProperty('ariaChecked', 'true')
    expect(footer()).toContain('fill="#000000"')
  })

  // Punch list #443, row 8: the take-back of Save the photo, for a dev on a test person alone.
  const ZZ: CardLoad = { ...MARISOL, facts: { ...MARISOL.facts, name: 'ZZ Test Learner', card_name: null }, photoPath: 'u-zz/photo-1.jpg' }

  it('offers nobody but a dev the removal of a photo', async () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'helpers'] as const) {
      renderWithProviders(<YourCardCard role={role} userId="u-zz" teammate="ZZ Test Learner" io={fakeIo(ZZ)} renderer={fakeRenderer()} />)
      await screen.findByRole('button', { name: 'Change the photo' })
      expect(screen.queryByRole('button', { name: 'Remove the photo…' })).toBeNull()
      expect(document.querySelector('[data-your-card-remove-photo]')).toBeNull()
      cleanup()
    }
  })

  it('lets a dev remove a test person’s photo, after a confirm that names the act', async () => {
    const io = fakeIo(ZZ)
    renderWithProviders(<YourCardCard role="dev" userId="u-zz" teammate="ZZ Test Learner" io={io} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the photo…' }))
    const yes = await screen.findByRole('button', { name: 'Remove the photo' })
    expect(screen.getByText('Remove the photo of ZZ Test Learner?')).toBeTruthy()
    expect(screen.getByText('The photo comes off the card and the footer, and its file is deleted. It cannot be brought back.')).toBeTruthy()
    expect(io.removePhoto).not.toHaveBeenCalled()
    fireEvent.click(yes)
    // The person is read again before the write, and the photo that read names is the one removed.
    await waitFor(() => expect(io.removePhoto).toHaveBeenCalledWith('u-zz', 'u-zz/photo-1.jpg'))
    expect(io.load).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('The photo was removed.')).toBeTruthy()
    // The card reads as one with no photo: the press adds one, and the removal is gone with the photo.
    expect(await screen.findByRole('button', { name: 'Add a photo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove the photo…' })).toBeNull()
  })

  it('removes nothing when the confirm is cancelled', async () => {
    const io = fakeIo(ZZ)
    renderWithProviders(<YourCardCard role="dev" userId="u-zz" teammate="ZZ Test Learner" io={io} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the photo…' }))
    await screen.findByRole('button', { name: 'Remove the photo' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove the photo' })).toBeNull())
    expect(io.removePhoto).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Change the photo' })).toBeTruthy()
  })

  it('keeps a real person’s photo for a dev too: a dead press, and the reason under it', async () => {
    const io = fakeIo(MARISOL)
    renderWithProviders(<YourCardCard role="dev" userId="u-marisol" teammate="Marisol" io={io} renderer={fakeRenderer()} />)
    const press = (await screen.findByRole('button', { name: 'Remove the photo…' })) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(document.querySelector('[data-your-card-remove-photo]')?.textContent).toContain('Only a test person’s photo can be removed. Their name must start with ZZ.')
    fireEvent.click(press)
    expect(screen.queryByRole('button', { name: 'Remove the photo' })).toBeNull()
    expect(io.removePhoto).not.toHaveBeenCalled()
  })

  it('offers a dev no removal where there is no photo', async () => {
    renderWithProviders(<YourCardCard role="dev" userId="u-zz" teammate="ZZ Test Learner" io={fakeIo({ ...ZZ, photoPath: null })} renderer={fakeRenderer()} />)
    await screen.findByRole('button', { name: 'Add a photo' })
    expect(screen.queryByRole('button', { name: 'Remove the photo…' })).toBeNull()
  })

  it('says the reason and keeps the photo when the removal is refused, and says so when the file stayed', async () => {
    const refused = fakeIo(ZZ)
    refused.removePhoto.mockRejectedValueOnce(new Error('The photo was not removed. You may not have leave to change this account, or the photo was changed meanwhile.'))
    renderWithProviders(<YourCardCard role="dev" userId="u-zz" teammate="ZZ Test Learner" io={refused} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the photo…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the photo' }))
    expect(await screen.findByText('The photo was not removed. You may not have leave to change this account, or the photo was changed meanwhile.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change the photo' })).toBeTruthy()
    cleanup()
    const left = fakeIo(ZZ)
    left.removePhoto.mockResolvedValueOnce({ fileGone: false })
    renderWithProviders(<YourCardCard role="dev" userId="u-zz" teammate="ZZ Test Learner" io={left} renderer={fakeRenderer()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the photo…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the photo' }))
    expect(await screen.findByText('The photo came off the card. Its file could not be deleted.')).toBeTruthy()
  })

  it('shows a subcontractor no card', () => {
    const io = fakeIo(MARISOL)
    const { container } = renderWithProviders(<YourCardCard role="subcontractor" userId="u-sub" io={io} renderer={fakeRenderer()} />)
    expect(container.querySelector('[data-your-card]')).toBeNull()
    expect(io.load).not.toHaveBeenCalled()
  })

  it('opens the same card for a teammate, under their name', async () => {
    renderWithProviders(<YourCardCard role="assistant" userId="u-dale" teammate="Dale Okafor" io={fakeIo({ ...MARISOL, photoPath: null })} renderer={fakeRenderer()} />)
    expect(await screen.findByText('Card and footer for Dale Okafor')).toBeTruthy()
    expect(await screen.findByText('Add a photo to make the footer and the card for Dale.')).toBeTruthy()
  })
})

const PORTAL_PHONE = '(512) 360-0599'
