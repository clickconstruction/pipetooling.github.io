// @vitest-environment jsdom
/**
 * Render smoke for the Lien desk's envelope card (v2.7427): the two halves and the foot line, the ticks
 * in their fixed order with an amount each, counsel's caution in the row of the tick it is about, and
 * the sentence that stands in for the key once the wording is locked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LienEnvelopeCard, type LienEnvelopeCardProps } from './LienEnvelopeCard'

afterEach(cleanup)

const tick = (checked: boolean) => ({ checked, disabled: false, onChange: vi.fn() })
const props = (over: Partial<LienEnvelopeCardProps> = {}): LienEnvelopeCardProps => ({
  ownerName: 'ZZ Test Owner LLC',
  contractorName: 'ZZ Test Contractor',
  courtesyEmail: 'office@zz-test.example',
  cover: { ...tick(true), title: 'Counsel’s cover letter, filled for this job' },
  houses: { ...tick(true), count: 1, amount: '$5,403', unread: true },
  release: { ...tick(false), amount: '$29,323', unread: false },
  lockedWords: null,
  onPreview: vi.fn(),
  ...over,
})
const rows = () => [...document.querySelectorAll('[data-lien-envelope-tick]')] as HTMLElement[]

describe('LienEnvelopeCard (v2.7427)', () => {
  it('draws who it goes to at the left, a labelled row each, with the courtesy PDF under the contractor', () => {
    render(<LienEnvelopeCard {...props()} />)
    const to = document.querySelector('[data-lien-envelope-zone="to"]') as HTMLElement
    expect(to.querySelector('.lienEnvelopeTitle')?.textContent).toBe('Goes to · certified mail')
    expect([...to.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Owner', 'Contractor'])
    expect([...to.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['ZZ Test Owner LLC', 'ZZ Test Contractorand a courtesy PDF to office@zz-test.example'])
    cleanup()
    render(<LienEnvelopeCard {...props({ courtesyEmail: null })} />)
    expect(document.querySelector('[data-lien-envelope-zone="to"]')?.textContent).not.toContain('courtesy PDF')
  })

  it('lists the ticks in a fixed order, each with its amount, and mutes the words of one that is off', () => {
    render(<LienEnvelopeCard {...props()} />)
    expect(document.querySelector('[data-lien-envelope-zone="with"] .lienEnvelopeTitle')?.textContent).toBe('With the notice')
    expect(rows().map((r) => [r.getAttribute('data-lien-envelope-tick'), r.getAttribute('data-on'), r.querySelector('label')?.textContent])).toEqual([
      ['cover', 'yes', 'Counsel\'s cover letterpage 1'],
      ['houses', 'yes', 'Name the supply house owed$5,403'],
      ['release', 'no', 'A conditional release$29,323'],
    ])
    // The desk's markers and tooltips ride on the labels as before.
    expect(document.querySelector('[data-lien-desk-houses-tick]')?.getAttribute('title')).toContain('A paragraph at the end of counsel\'s letter')
    expect(document.querySelector('[data-lien-desk-release-tick]')?.getAttribute('title')).toContain('§ 53.284 conditional release')
    cleanup()
    // Two houses: the plural. The letter off: no page word, and the desk passes no houses or release tick.
    render(<LienEnvelopeCard {...props({ cover: { ...tick(false), title: 't' }, houses: null, release: null })} />)
    expect(rows().map((r) => r.querySelector('label')?.textContent)).toEqual(['Counsel\'s cover letter'])
    cleanup()
    render(<LienEnvelopeCard {...props({ houses: { ...tick(true), count: 2, amount: '$13,058', unread: false } })} />)
    expect(screen.getByLabelText(/Name the supply houses owed/)).toBeTruthy()
  })

  it('puts counsel’s caution in the row of the tick it is about, outside the label', () => {
    render(<LienEnvelopeCard {...props({ release: { ...tick(true), amount: '$29,323', unread: true } })} />)
    const houses = document.querySelector('[data-lien-desk-houses-counsel]') as HTMLElement
    const release = document.querySelector('[data-lien-desk-release-counsel]') as HTMLElement
    expect(houses.textContent).toBe('Counsel has not read this paragraph yet.')
    expect(release.textContent).toBe('Counsel has not read this paragraph yet.')
    expect(houses.closest('[data-lien-envelope-tick]')?.getAttribute('data-lien-envelope-tick')).toBe('houses')
    expect(release.closest('[data-lien-envelope-tick]')?.getAttribute('data-lien-envelope-tick')).toBe('release')
    expect(houses.closest('label')).toBeNull()
    cleanup()
    render(<LienEnvelopeCard {...props({ houses: { ...tick(false), count: 1, amount: '$5,403', unread: false } })} />)
    expect(document.querySelector('[data-lien-desk-houses-counsel]')).toBeNull()
  })

  it('hands each tick’s press to the desk and holds a disabled one', () => {
    const p = props({ release: { checked: false, disabled: true, onChange: vi.fn(), amount: '$29,323', unread: false } })
    render(<LienEnvelopeCard {...p} />)
    fireEvent.click(screen.getByLabelText(/Counsel's cover letter/))
    expect(p.cover.onChange).toHaveBeenCalledWith(false)
    fireEvent.click(screen.getByLabelText(/Name the supply house owed/))
    expect(p.houses!.onChange).toHaveBeenCalledWith(false)
    expect((screen.getByLabelText(/A conditional release/) as HTMLInputElement).disabled).toBe(true)
  })

  it('keeps the key and the preview door on the foot line, and the locked sentence in the key’s place', () => {
    const p = props()
    render(<LienEnvelopeCard {...p} />)
    const foot = document.querySelector('[data-lien-desk-paper-legend]') as HTMLElement
    expect(foot.closest('[data-lien-desk-send-line]')).toBeTruthy()
    expect(foot.textContent).toContain('A shaded box on the paper is yours to change. Hover says where the rest came from.')
    fireEvent.click(within(foot).getByRole('button', { name: 'Preview in a new window ↗' }))
    expect(p.onPreview).toHaveBeenCalledTimes(1)
    cleanup()
    render(<LienEnvelopeCard {...props({ lockedWords: 'Sent for approval — pull it back to a draft to change the wording.' })} />)
    const locked = document.querySelector('[data-lien-desk-paper-legend]') as HTMLElement
    expect(locked.textContent).toContain('Sent for approval — pull it back to a draft to change the wording.')
    expect(locked.textContent).not.toContain('A shaded box')
    expect(locked.querySelector('.lienEnvelopeSwatch')).toBeNull()
  })
})
