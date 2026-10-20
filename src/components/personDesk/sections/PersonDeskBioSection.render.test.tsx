// @vitest-environment jsdom
/**
 * The tech's bio on the person's desk (v2.5587, punch list #114) over a fake io: the office reads the bio as a customer
 * gets it with the Spanish gaps and the tech's veto; adds a line from a prompt with the count; is refused past the cap
 * before the server; removes a line after a confirm; and the block draws nothing for a sub, for a viewer off the
 * office, or while the push is not in.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BIO_CAP, bioLinesFromRows, type BioLineRow } from '../../../lib/bio/bio'
import type { BioIo } from '../../../lib/bio/bioIo'
import type { PersonDeskViewer } from '../../../lib/people/personDeskGates'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { bioOnDesk } from '../../../lib/bio/bioGates'
import { PersonDeskBioSection } from './PersonDeskBioSection'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const office: PersonDeskViewer = { role: 'assistant', isDev: false, canAccessPay: true, canAccessHours: true, canAccessVehicles: true, canAccessLicenses: true, canAccessContracts: true, readOnly: false }

const row = (id: string, text: string, extra: Partial<BioLineRow> = {}): BioLineRow => ({ id, text, text_es: null, position: 1, added_at: '2026-10-16T10:00:00Z', removed_at: null, off_by_user_at: null, ...extra })
const rows: BioLineRow[] = [
  row('l1', 'Luis has been a plumber for twelve years and holds a Texas journeyman license.', { position: 1, text_es: 'Es plomero desde hace doce años y tiene licencia de oficial en Texas.' }),
  row('l2', 'Water heaters and repipes are his specialty.', { position: 2, text_es: 'Su especialidad son los calentadores de agua y las retuberías.' }),
  row('l3', 'Off the clock he coaches Little League in Seguin.', { position: 3 }),
  row('l4', 'He is an Astros fan, win or lose.', { position: 4, text_es: 'Es aficionado de los Astros, ganen o pierdan.', off_by_user_at: '2026-10-16T11:00:00Z' }),
  row('l0', 'He drives a white van.', { position: 5, removed_at: '2026-10-15T00:00:00Z' }),
]

function fakeIo(lines: BioLineRow[] | null = rows, over: Partial<BioIo> = {}): BioIo {
  return {
    loadLines: vi.fn(async () => (lines ? bioLinesFromRows(lines) : null)),
    editLine: vi.fn(async () => 'new-id'),
    removeLine: vi.fn(async () => undefined),
    say: vi.fn(async () => undefined),
    ...over,
  }
}

const mount = (io: BioIo, viewer: PersonDeskViewer = office, personRole: 'helpers' | 'subcontractor' = 'helpers') =>
  renderWithProviders(<PersonDeskBioSection userId="u1" displayName="Luis Ortega" personRole={personRole} viewer={viewer} changeKey={0} io={io} />)

afterEach(cleanup)

describe('bioOnDesk', () => {
  it('is the office looking at someone who presses On my way', () => {
    expect(bioOnDesk('assistant', 'helpers')).toBe(true)
    expect(bioOnDesk('dev', 'primary')).toBe(true)
    expect(bioOnDesk('controller', 'assistant')).toBe(true)
    expect(bioOnDesk('assistant', 'subcontractor')).toBe(false)
    expect(bioOnDesk('primary', 'helpers')).toBe(false)
    expect(bioOnDesk(null, 'helpers')).toBe(false)
  })
})

describe('PersonDeskBioSection', () => {
  it('reads the bio as a customer gets it, the lines, the Spanish gaps and the veto', async () => {
    mount(fakeIo())
    expect(await screen.findByText('Luis’s bio')).toBeTruthy()
    expect(screen.getByTestId('desk-bio-preview').textContent).toBe(
      'A little about Luis: Luis has been a plumber for twelve years and holds a Texas journeyman license. Water heaters and repipes are his specialty. Off the clock he coaches Little League in Seguin.',
    )
    expect(screen.getByTestId('desk-bio-preview-es').textContent).toBe('Un poco sobre Luis: Es plomero desde hace doce años y tiene licencia de oficial en Texas. Su especialidad son los calentadores de agua y las retuberías.')
    expect(screen.getAllByTestId('desk-bio-line')).toHaveLength(4)
    expect(screen.getByText('No Spanish yet')).toBeTruthy()
    expect(screen.getByText('Luis turned this off')).toBeTruthy()
    expect(screen.getByTestId('desk-bio-left').textContent).toMatch(/^\d+ left of 320$/)
  })

  it('adds a line from a prompt, counting the whole, and saves through the io', async () => {
    const io = fakeIo()
    mount(io)
    fireEvent.click(await screen.findByTestId('desk-bio-add'))
    fireEvent.click(screen.getByRole('button', { name: 'Hometown' }))
    const box = screen.getByLabelText('The line') as HTMLTextAreaElement
    expect(box.value).toBe('Luis grew up in ')
    fireEvent.change(box, { target: { value: 'Luis grew up in Seguin.' } })
    fireEvent.change(screen.getByLabelText('The same in Spanish'), { target: { value: 'Luis creció en Seguin.' } })
    expect(screen.getByTestId('desk-bio-count').textContent).toMatch(/^\d+ left of 320 · Spanish \d+ left of 320$/)
    fireEvent.click(screen.getByRole('button', { name: 'Add the line' }))
    await waitFor(() => expect(io.editLine).toHaveBeenCalledWith({ userId: 'u1', id: null, text: 'Luis grew up in Seguin.', textEs: 'Luis creció en Seguin.' }))
    expect(await screen.findByText('Line added.')).toBeTruthy()
    await waitFor(() => expect(io.loadLines).toHaveBeenCalledTimes(2))
  })

  it('is refused past the cap before the server is asked', async () => {
    const io = fakeIo()
    mount(io)
    fireEvent.click(await screen.findByTestId('desk-bio-add'))
    fireEvent.change(screen.getByLabelText('The line'), { target: { value: 'x'.repeat(BIO_CAP) } })
    expect(screen.getByTestId('desk-bio-count').textContent).toMatch(/over 320/)
    const add = screen.getByRole('button', { name: 'Add the line' }) as HTMLButtonElement
    expect(add.disabled).toBe(true)
    fireEvent.click(add)
    expect(io.editLine).not.toHaveBeenCalled()
  })

  it('changes a line in place', async () => {
    const io = fakeIo()
    mount(io)
    const first = (await screen.findAllByTestId('desk-bio-line'))[0]!
    fireEvent.click(within(first).getByRole('button', { name: 'Edit' }))
    const box = screen.getByLabelText('The line') as HTMLTextAreaElement
    expect(box.value).toBe('Luis has been a plumber for twelve years and holds a Texas journeyman license.')
    fireEvent.change(box, { target: { value: 'Luis has been a plumber for thirteen years.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(io.editLine).toHaveBeenCalledWith({ userId: 'u1', id: 'l1', text: 'Luis has been a plumber for thirteen years.', textEs: 'Es plomero desde hace doce años y tiene licencia de oficial en Texas.' }))
  })

  it('removes a line after a confirm, and not on Cancel', async () => {
    const io = fakeIo()
    mount(io)
    const first = (await screen.findAllByTestId('desk-bio-line'))[0]!
    fireEvent.click(within(first).getByRole('button', { name: 'Remove' }))
    const ask = await screen.findByRole('alertdialog')
    expect(within(ask).getByText('Remove this line from Luis’s bio?')).toBeTruthy()
    fireEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(io.removeLine).not.toHaveBeenCalled()
    fireEvent.click(within(first).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(io.removeLine).toHaveBeenCalledWith('u1', 'l1'))
    expect(await screen.findByText('Line removed.')).toBeTruthy()
  })

  it('says when there is no bio yet, and offers the first line', async () => {
    mount(fakeIo([]))
    expect(await screen.findByText('Luis has no bio yet. The first line is the one a customer reads first.')).toBeTruthy()
    expect(screen.getByTestId('desk-bio-add')).toBeTruthy()
  })

  it('draws nothing for a sub, for a viewer off the office, in training mode no buttons, or while the push is not in', async () => {
    const io = fakeIo()
    mount(io, office, 'subcontractor')
    expect(screen.queryByTestId('desk-bio')).toBeNull()
    expect(io.loadLines).not.toHaveBeenCalled()
    cleanup()
    mount(fakeIo(), { ...office, role: 'primary' })
    expect(screen.queryByTestId('desk-bio')).toBeNull()
    cleanup()
    mount(fakeIo(), { ...office, readOnly: true })
    expect(await screen.findByText('Luis’s bio')).toBeTruthy()
    expect(screen.queryByTestId('desk-bio-add')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    cleanup()
    const notThere = fakeIo(null)
    mount(notThere)
    await waitFor(() => expect(notThere.loadLines).toHaveBeenCalled())
    expect(screen.queryByTestId('desk-bio')).toBeNull()
  })
})
