// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderSmokeMocks'
import LienDeskMoreSheet from './LienDeskMoreSheet'
import { lienDeskMoreRows } from '../../lib/jobs/lienDeskPhoneMore'

afterEach(cleanup)

const rows = lienDeskMoreRows({ run: { label: 'Record the mailing', count: 4, hint: 'Type each envelope\u2019s tracking number' }, gcNotice: false, legendLabel: 'What this desk holds', caller: true, share: true, ownerRecords: true })

describe('LienDeskMoreSheet', () => {
  it('draws every door as a row with its name and its hint, the run first with its count', () => {
    render(<LienDeskMoreSheet rows={rows} onPick={() => {}} onClose={() => {}} />)
    const sheet = screen.getByRole('dialog', { name: 'More on the Lien desk' })
    const drawn = [...sheet.querySelectorAll('[data-lien-desk-more-row]')] as HTMLElement[]
    expect(drawn.map((r) => r.getAttribute('data-lien-desk-more-row'))).toEqual(['run', 'rules', 'caller', 'legend', 'share', 'owner_records'])
    expect(drawn[0]!.textContent).toContain('Record the mailing')
    expect((drawn[0]!.querySelector('[data-lien-desk-more-count]') as HTMLElement).textContent).toBe('4')
    expect(within(sheet).getByText('The Texas lien rules the app follows')).toBeTruthy()
    // Only the run wears a count.
    expect(sheet.querySelectorAll('[data-lien-desk-more-count]')).toHaveLength(1)
  })

  it('every row is a thumb tall', () => {
    render(<LienDeskMoreSheet rows={rows} onPick={() => {}} onClose={() => {}} />)
    for (const r of document.querySelectorAll('[data-lien-desk-more-row]')) expect(parseInt((r as HTMLElement).style.minHeight, 10)).toBeGreaterThanOrEqual(44)
  })

  it('a press hands the row\u2019s key back; the sheet writes nothing itself', () => {
    const onPick = vi.fn()
    render(<LienDeskMoreSheet rows={rows} onPick={onPick} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /An owner asked for records/ }))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith('owner_records')
  })

  it('× closes it', () => {
    const onClose = vi.fn()
    render(<LienDeskMoreSheet rows={rows} onPick={() => {}} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
