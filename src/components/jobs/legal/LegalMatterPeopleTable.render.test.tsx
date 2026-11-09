// @vitest-environment jsdom
/**
 * Punch list #174, PR 1: the people on the matter and the letter's picker. The list draws the use with its reason, the
 * form refuses a never with no reason client side, the seed press shows only while the record names someone, and the
 * demand letter's strip offers a To as a press, a never struck with why.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LegalMatterPeopleTable from './LegalMatterPeopleTable'
import LegalLetterRecipients from './LegalLetterRecipients'
import { peopleFromRows } from '../../../lib/legal/legalMatterPeople'

const people = peopleFromRows([
  { id: 'p1', name: 'R. Calloway', role: 'president', organization: 'Sable Ridge Builders', email: 'rcalloway@srb-partners.example', phone: '', mailing_address: '', use: 'letters', reason: '', seeded_from: null, added_at: '2026-10-20T15:00:00Z' },
  { id: 'p2', name: 'Pecan Hollow Holdings LLC', role: 'owner', organization: '', email: '', phone: '', mailing_address: 'PO Box 418, Brenham TX', use: 'copies', reason: '', seeded_from: 'property', added_at: '2026-10-20T15:01:00Z' },
  { id: 'p3', name: 'D. Marsh', role: 'inspector', organization: 'City of Brenham', email: '', phone: '(555) 014-2251', mailing_address: '', use: 'never', reason: 'a witness, not a recipient', seeded_from: null, added_at: '2026-10-20T15:02:00Z' },
])

describe('LegalMatterPeopleTable', () => {
  it('draws each person with the role, the reach, the use and where a seeded row came from', () => {
    render(<LegalMatterPeopleTable people={people} panel={{ acts: null }} />)
    const list = document.querySelector('[data-legal-people]') as HTMLElement
    expect(within(list).getAllByRole('row')).toHaveLength(4)
    const owner = list.querySelector('[data-legal-person="p2"]') as HTMLElement
    expect(owner.textContent).toContain('seeded from the property record')
    expect(owner.textContent).toContain('PO Box 418, Brenham TX')
    expect((list.querySelector('[data-legal-person="p3"]') as HTMLElement).textContent).toContain('never — a witness, not a recipient')
    // Read only: no Edit, no Add, no seed.
    expect(within(list).queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(list.querySelector('[data-legal-people-add]')).toBeNull()
  })

  it('offers the seed only while the record names someone, and refuses a never with no reason before the RPC', async () => {
    const save = vi.fn(() => Promise.resolve(null))
    const seed = vi.fn(() => Promise.resolve(null))
    render(<LegalMatterPeopleTable people={[]} panel={{ acts: { save, remove: vi.fn(() => Promise.resolve(null)), seed, canSeed: true } }} />)
    expect(document.querySelector('[data-legal-people-empty]')?.textContent).toContain('Nobody on the matter yet')
    fireEvent.click(screen.getByRole('button', { name: 'Add the people the record knows' }))
    await waitFor(() => expect(seed).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '＋ Add a person' }))
    // The seed's press settles before Save can go (the list is busy while a press runs).
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save the person' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.change(document.querySelector('[data-legal-person-name]') as HTMLInputElement, { target: { value: 'D. Marsh' } })
    fireEvent.change(document.querySelector('[data-legal-person-use]') as HTMLSelectElement, { target: { value: 'never' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the person' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Say why letters never go to them.')
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(document.querySelector('[data-legal-person-reason]') as HTMLInputElement, { target: { value: 'a witness' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the person' }))
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'D. Marsh', use: 'never', reason: 'a witness' }), null)
  })
})

describe('LegalLetterRecipients', () => {
  it('offers a To as a press that fills the letter, lists the copies, and strikes a never with its reason', () => {
    const onPick = vi.fn()
    render(<LegalLetterRecipients people={people} pickedName="" onPick={onPick} />)
    const strip = document.querySelector('[data-legal-letter-recipients]') as HTMLElement
    const to = within(strip).getByRole('button', { name: 'R. Calloway · their president' })
    fireEvent.click(to)
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', email: 'rcalloway@srb-partners.example' }))
    expect(strip.querySelector('[data-legal-recipient="p2"]')?.textContent).toBe('Pecan Hollow Holdings LLC · owner of record')
    expect(strip.querySelector('[data-legal-recipient="p3"][data-legal-recipient-refused]')).toBeTruthy()
    expect(strip.textContent).toContain('D. Marsh cannot be picked: never — a witness, not a recipient.')
    expect(within(strip).queryByRole('button', { name: /D\. Marsh/ })).toBeNull()
  })

  it('with onToggleCopy, a copy chip is a press that reads on or off the letter’s Copies to line; a never stays struck (v2.6741)', () => {
    const onToggleCopy = vi.fn()
    render(<LegalLetterRecipients people={people} pickedName="" onPick={vi.fn()} copies={new Set(['p2'])} onToggleCopy={onToggleCopy} />)
    const strip = document.querySelector('[data-legal-letter-recipients]') as HTMLElement
    const copy = within(strip).getByRole('button', { name: 'Pecan Hollow Holdings LLC · owner of record' })
    expect(copy.getAttribute('aria-pressed')).toBe('true')
    expect(strip.querySelector('[data-legal-copies-count]')?.textContent).toBe('1 on the letter’s Copies to line')
    fireEvent.click(copy)
    expect(onToggleCopy).toHaveBeenCalledWith(expect.objectContaining({ id: 'p2' }))
    expect(within(strip).queryByRole('button', { name: /D\. Marsh/ })).toBeNull()
    document.body.innerHTML = ''
    render(<LegalLetterRecipients people={people} pickedName="" onPick={vi.fn()} copies={new Set()} onToggleCopy={onToggleCopy} />)
    expect(document.querySelector('[data-legal-recipient="p2"]')?.getAttribute('data-legal-copy-on')).toBe('no')
    expect(document.querySelector('[data-legal-copies-count]')?.textContent).toBe('nobody on the letter’s Copies to line')
  })

  it('draws nothing when the matter has no people', () => {
    render(<LegalLetterRecipients people={[]} pickedName="" onPick={vi.fn()} />)
    expect(document.querySelector('[data-legal-letter-recipients]')).toBeNull()
  })
})
