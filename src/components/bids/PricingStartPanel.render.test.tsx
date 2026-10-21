// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PricingStartPanel } from './PricingStartPanel'
import type { PricingStartChoices } from '../../lib/bids/pricingStartChoices'

/**
 * The start panel for an unpriced version (punch list #137): the book door leads, the drawer
 * door is always there, the copy row keeps its honest caption — and the setup sentence stays
 * for a bid the Workbench could not render anyway.
 */

const START: PricingStartChoices = {
  kind: 'start',
  title: 'No prices yet on Addendum 2 rebid.',
  bookTemplateId: 'tpl-haley',
  bookLabel: 'Price from HALEY',
  bookSubline: "The book To Plans prices from, as a fresh copy at today's book prices.",
  donors: [{ versionId: 'v1', label: 'Copy prices from To Plans', crossGc: false }],
}

describe('PricingStartPanel', () => {
  it('renders the title, both book doors, the copy door and its caption', () => {
    const onPickBook = vi.fn()
    const onCopyFrom = vi.fn()
    render(<PricingStartPanel choices={START} busyBook={false} busyCopy={false} onPickBook={onPickBook} onBrowseBooks={() => {}} onCopyFrom={onCopyFrom} />)
    expect(screen.getByText('No prices yet on Addendum 2 rebid.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Price from HALEY' }))
    expect(onPickBook).toHaveBeenCalledWith('tpl-haley')
    expect(screen.getByRole('button', { name: 'another book ▸' })).toBeTruthy()
    expect(screen.getByText(/fresh copy at today's book prices/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Copy prices from To Plans' }))
    expect(onCopyFrom).toHaveBeenCalledWith('v1')
    expect(screen.getByText(/Rows only in this version stay unpriced/)).toBeTruthy()
  })

  it('a busy book press reads Opening… and is disabled', () => {
    render(<PricingStartPanel choices={START} busyBook busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Opening…' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('no donors: the copy row and its caption stay out', () => {
    render(<PricingStartPanel choices={{ ...START, donors: [] }} busyBook={false} busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} />)
    expect(screen.queryByText(/Or start from prices already on this bid/)).toBeNull()
    expect(screen.queryByText(/Rows only in this version stay unpriced/)).toBeNull()
  })

  it('needs-setup keeps the setup sentence', () => {
    render(<PricingStartPanel choices={{ kind: 'needs-setup' }} busyBook={false} busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} />)
    expect(screen.getByText(/The Workbench needs Counts, an active Pricing, and a cost estimate/)).toBeTruthy()
  })
})
