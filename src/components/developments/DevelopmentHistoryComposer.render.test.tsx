// @vitest-environment jsdom
/**
 * The History composer's About picker (v2.6205): the site picked by default, the groups and the stage
 * words in the list, a typed search, and the amber piece chip setting the pick. Harlow Ranch's made-up
 * pieces; nothing is real.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { AboutGroup } from '../../lib/developments/aboutPicker'
import { DevelopmentHistoryComposer } from './DevelopmentHistoryTools'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const GROUPS: AboutGroup[] = [
  { group: 'site', label: 'The site', rows: [{ key: 'site', about: { kind: 'site' }, label: 'Harlow Ranch', meta: null, search: 'Harlow Ranch', group: 'site' }] },
  { group: 'recent', label: 'Written about last', rows: [{ key: 'job:j568', about: { kind: 'job', id: 'j568' }, label: 'JP568 Lot 14', meta: 'Billed Awaiting Payment', search: 'JP568 Lot 14', group: 'jobs' }] },
  {
    group: 'jobs',
    label: 'Jobs',
    rows: [
      { key: 'job:j958', about: { kind: 'job', id: 'j958' }, label: 'JP958 Crew weeks', meta: 'Working', search: 'JP958 Crew weeks', group: 'jobs' },
      { key: 'job:j568', about: { kind: 'job', id: 'j568' }, label: 'JP568 Lot 14', meta: 'Billed Awaiting Payment', search: 'JP568 Lot 14', group: 'jobs' },
    ],
  },
  { group: 'bids', label: 'Bids', rows: [{ key: 'bid:b556', about: { kind: 'bid', id: 'b556' }, label: 'BP556 Bunker & Lodge', meta: 'sent', search: 'BP556 Bunker & Lodge', group: 'bids' }] },
  { group: 'customer', label: 'The customer', rows: [{ key: 'customer', about: { kind: 'customer', id: 'c1' }, label: 'Harlow Ranch LLC', meta: null, search: 'Harlow Ranch LLC', group: 'customer' }] },
]

function draw(preferKey: string | null, onClose?: () => void) {
  return renderWithProviders(<DevelopmentHistoryComposer groups={GROUPS} preferKey={preferKey} phone={false} busy={false} onKeep={async () => true} onClose={onClose} />)
}

describe('DevelopmentHistoryComposer About picker', () => {
  it('picks the site by default, lists the groups with stage words when opened, and a typed search narrows it', () => {
    draw(null)
    const about = screen.getByTestId('history-about')
    const trigger = within(about).getByRole('combobox')
    expect(trigger.textContent).toContain('Harlow Ranch')
    fireEvent.click(trigger)
    const list = screen.getByRole('listbox', { name: 'About which piece' })
    expect(list.textContent).toContain('Written about last')
    expect(list.textContent).toContain('Jobs')
    expect(list.textContent).toContain('JP958 Crew weeks')
    expect(list.textContent).toContain('Working')
    expect(list.textContent).toContain('BP556 Bunker & Lodge')
    expect(list.textContent).toContain('sent')
    const search = screen.getByPlaceholderText('Type a number or a name')
    fireEvent.change(search, { target: { value: '568' } })
    const narrowed = screen.getByRole('listbox', { name: 'About which piece' })
    expect(narrowed.textContent).toContain('JP568 Lot 14')
    expect(narrowed.textContent).not.toContain('JP958')
    fireEvent.click(within(narrowed).getAllByRole('option').find((o) => /JP568/.test(o.textContent ?? ''))!)
    expect(within(about).getByRole('combobox').textContent).toContain('JP568 Lot 14')
  })

  it('follows the piece chip: a picked piece sets About, clearing it goes back to the site', () => {
    const { rerender } = draw(null)
    const trigger = () => within(screen.getByTestId('history-about')).getByRole('combobox')
    expect(trigger().textContent).toContain('Harlow Ranch')
    rerender(<DevelopmentHistoryComposer groups={GROUPS} preferKey="bid:b556" phone={false} busy={false} onKeep={async () => true} />)
    expect(trigger().textContent).toContain('BP556 Bunker & Lodge')
    rerender(<DevelopmentHistoryComposer groups={GROUPS} preferKey={null} phone={false} busy={false} onKeep={async () => true} />)
    expect(trigger().textContent).toContain('🏠 Harlow Ranch')
  })

  it('offers Close when the page gives it one', () => {
    const onClose = vi.fn()
    draw(null, onClose)
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
