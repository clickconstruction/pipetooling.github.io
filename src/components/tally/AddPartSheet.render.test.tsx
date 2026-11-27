// @vitest-environment jsdom
/**
 * The Add a part sheet (v2.8284). It opens with choices, the box's own words and the job's names, before a word is
 * typed. Words typed are offered as typed first, above every list. The quantity step has chips and a second press
 * that writes the part and keeps the sheet for the next. The Take flow keeps its own words and its own opening.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { Container } from '../../lib/materials/onSite'
import type { OnHandName } from '../../lib/materials/onSiteNames'
import { AddPartSheet } from './AddPartSheet'

const box = (said: string | null): Container => ({ id: 'g101', jobId: 'j1', label: 'G101', kind: 'cage', where: '', said, locationId: null, lat: null, lng: null, retiredAt: null, createdAt: '2026-11-01T00:00:00Z' } as Container)
const name = (partName: string, pieces: number): OnHandName => ({ key: `words:${partName.toLowerCase()}`, partId: null, partName, manufacturer: null, pieces, boxes: ['G1'] })
const names = [name('Hangers', 94), name('Black paint rust', 4)]
const search = vi.fn(async () => [])

const open = (over: Partial<Parameters<typeof AddPartSheet>[0]> = {}) => {
  const onAdd = vi.fn()
  const onAddAnother = vi.fn(() => true)
  render(<AddPartSheet container={box('hangers')} names={names} searchParts={search} onClose={() => {}} onAdd={onAdd} onAddAnother={onAddAnother} {...over} />)
  return { onAdd, onAddAnother }
}
const field = () => screen.getByRole('searchbox', { name: 'Search the parts book' })

afterEach(cleanup)

describe('the Add a part sheet', () => {
  it('opens with choices: what the box says, then the names the job holds', () => {
    open()
    const says = screen.getByTestId('add-part-box-says')
    expect(says.textContent).toContain('This box says')
    // the box's words are the job's own name for the part
    expect(within(says).getByRole('button').textContent).toBe('HangersUse these words')
    expect(within(screen.getByTestId('add-part-already')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Hangers94 in G1', 'Black paint rust4 in G1'])
    expect(screen.queryByTestId('add-part-as-typed')).toBeNull()
  })

  it('a box with no line of its own opens on the job’s names alone', () => {
    open({ container: box(null) })
    expect(screen.queryByTestId('add-part-box-says')).toBeNull()
    expect(screen.getByTestId('add-part-already')).toBeTruthy()
  })

  it('what is typed is offered as typed first, above the lists, and left out when a listed name is those words', () => {
    open()
    fireEvent.change(field(), { target: { value: 'hang' } })
    const asTyped = screen.getByTestId('add-part-as-typed')
    expect(asTyped.textContent).toBe('Use “hang” as typed')
    // it stands before the list of names, where the keyboard does not cover it
    expect(asTyped.compareDocumentPosition(screen.getByTestId('add-part-already')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByTestId('add-part-box-says')).toBeNull()
    fireEvent.change(field(), { target: { value: 'Hangers' } })
    expect(screen.queryByTestId('add-part-as-typed')).toBeNull()
    expect(within(screen.getByTestId('add-part-already')).getByRole('button', { name: /Hangers/ })).toBeTruthy()
  })

  it('the number takes the focus selected, with a numeric keypad, and the chips get to a real load in a press or two', () => {
    const { onAdd } = open()
    fireEvent.click(within(screen.getByTestId('add-part-box-says')).getByRole('button'))
    const many = screen.getByLabelText('How many') as HTMLInputElement
    expect(document.activeElement).toBe(many)
    expect(many.getAttribute('inputmode')).toBe('numeric')
    expect(within(screen.getByRole('group', { name: 'Add to the number' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['+10', '+25', '+100'])
    fireEvent.click(screen.getByRole('button', { name: '+25' }))
    expect(many.value).toBe('25')
    fireEvent.click(screen.getByRole('button', { name: '+25' }))
    fireEvent.click(screen.getByRole('button', { name: '+10' }))
    expect(many.value).toBe('60')
    fireEvent.change(many, { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add 40 to G101' }))
    expect(onAdd).toHaveBeenCalledWith({ partId: null, partName: 'Hangers', manufacturer: null }, 40)
  })

  it('Pick a different part sits first in the quantity step, under the picked name, and the presses that act come last (punch list #398, v2.8635)', () => {
    open()
    fireEvent.click(within(screen.getByTestId('add-part-box-says')).getByRole('button'))
    const dialog = screen.getByRole('dialog', { name: 'Add a part to G101' })
    expect(dialog.textContent).toContain('Hangers')
    const names = within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
    const at = (name: string) => names.indexOf(name)
    expect(at('Pick a different part')).toBeGreaterThanOrEqual(0)
    expect(at('Pick a different part')).toBeLessThan(at('One fewer'))
    expect(at('One fewer')).toBeLessThan(at('+10'))
    expect(at('+100')).toBeLessThan(at('Add 1 and another part'))
    // The press that adds the part is the sheet's last control: it stands in the foot, under the scroller (finding 263).
    expect(at('Add 1 and another part')).toBeLessThan(at('Add 1 to G101'))
    expect(names[names.length - 1]).toBe('Add 1 to G101')
    fireEvent.click(screen.getByRole('button', { name: 'Pick a different part' }))
    expect(screen.getByRole('searchbox', { name: 'Search the parts book' })).toBeTruthy()
  })

  it('the blue Add press stands in the sheet’s foot, outside the part that scrolls, so it stays above the keys on a short phone (punch list #398, finding 263)', () => {
    open()
    // Before a part is picked there is nothing to add, so the sheet has no foot.
    expect(screen.queryByTestId('add-part-primary')).toBeNull()
    fireEvent.click(within(screen.getByTestId('add-part-box-says')).getByRole('button'))
    const dialog = screen.getByRole('dialog', { name: 'Add a part to G101' })
    const add = screen.getByTestId('add-part-primary')
    expect(add.textContent).toBe('Add 1 to G101')
    const scrollers = [...dialog.querySelectorAll<HTMLElement>('div')].filter((d) => d.style.overflowY === 'auto')
    expect(scrollers).toHaveLength(1)
    const scroller = scrollers[0]!
    expect(scroller.contains(add)).toBe(false)
    // The foot follows the scroller and does not shrink or scroll.
    expect(add.parentElement?.previousElementSibling).toBe(scroller)
    expect(add.parentElement?.style.flex).toMatch(/^(none|0 0 auto)$/)
    // The scroller still holds the number, the chips and the second Add press, which is its last control.
    const inScroller = within(scroller).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent ?? '')
    expect(inScroller).toContain('+10')
    expect(inScroller[inScroller.length - 1]).toBe('Add 1 and another part')
    expect(within(scroller).getByRole('spinbutton')).toBeTruthy()
    // The number typed moves the press's own words, and the press writes that number.
    fireEvent.click(within(scroller).getByRole('button', { name: '+10' }))
    expect(add.textContent).toBe('Add 10 to G101')
  })

  it('Add 40 and another part writes the part, keeps the sheet on the picker and says what went in', () => {
    const { onAdd, onAddAnother } = open()
    fireEvent.change(field(), { target: { value: 'wax ring' } })
    fireEvent.click(screen.getByTestId('add-part-as-typed'))
    fireEvent.change(screen.getByLabelText('How many'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add 40 and another part' }))
    expect(onAddAnother).toHaveBeenCalledWith({ partId: null, partName: 'wax ring', manufacturer: null }, 40)
    expect(onAdd).not.toHaveBeenCalled()
    expect(screen.getByTestId('add-part-note').textContent).toBe('40 wax ring added to G101.')
    expect((field() as HTMLInputElement).value).toBe('')
    expect(screen.getByTestId('add-part-already')).toBeTruthy()
  })

  it('a write that did not land leaves the part picked, and says nothing went in', () => {
    const onAddAnother = vi.fn(() => false)
    open({ onAddAnother })
    fireEvent.click(within(screen.getByTestId('add-part-box-says')).getByRole('button'))
    fireEvent.click(screen.getByTestId('add-part-another'))
    expect(screen.queryByTestId('add-part-note')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add 1 to G101' })).toBeTruthy()
  })

  it('the Take flow keeps its words and its opening, with no second press', () => {
    open({ words: { title: 'What did you take?', sub: 'It is not on the list.', press: (n) => `Add ${n} to the take` }, onAddAnother: undefined })
    expect(screen.getByRole('dialog', { name: 'What did you take?' })).toBeTruthy()
    expect(screen.queryByTestId('add-part-box-says')).toBeNull()
    expect(screen.queryByTestId('add-part-already')).toBeNull()
    fireEvent.change(field(), { target: { value: 'wax ring' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use “wax ring” as typed' }))
    expect(screen.getByRole('button', { name: 'Add 1 to the take' })).toBeTruthy()
    expect(screen.queryByTestId('add-part-another')).toBeNull()
  })
})

describe('the quantity step in the room a small phone’s number pad leaves (finding 310)', () => {
  const room = (phone: boolean, height: number | null) => {
    window.matchMedia = ((query: string) => ({ matches: phone && query.includes('max-width'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    if (height != null) Object.defineProperty(window, 'visualViewport', { value: { height, offsetTop: 0, addEventListener: () => {}, removeEventListener: () => {} }, configurable: true })
    else delete (window as unknown as { visualViewport?: unknown }).visualViewport
  }
  afterEach(() => {
    delete (window as unknown as { visualViewport?: unknown }).visualViewport
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })
  const pickHangers = () => fireEvent.click(within(screen.getByTestId('add-part-box-says')).getByRole('button'))
  const number = () => screen.getByRole('spinbutton', { name: 'How many' }) as HTMLInputElement

  it('with the keys up the number’s field stands as tall as its − and +, so the chips fit over the blue press', () => {
    room(true, 320)
    open()
    pickHangers()
    expect([number().style.height, number().style.paddingTop, number().style.paddingBottom]).toEqual(['56px', '0px', '0px'])
    expect(screen.getByRole('group', { name: 'Add to the number' })).toBeTruthy()
    expect(screen.getByTestId('add-part-primary').textContent).toBe('Add 1 to G101')
  })

  it('with the keys away, and at a desk, the field is as it was', () => {
    room(true, 553)
    const phone = open()
    pickHangers()
    expect(number().style.height).toBe('')
    expect(phone).toBeTruthy()
    cleanup()
    room(false, null)
    open()
    pickHangers()
    expect(number().style.height).toBe('')
  })
})
