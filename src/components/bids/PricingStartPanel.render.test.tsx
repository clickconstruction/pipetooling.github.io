// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PricingStartPanel } from './PricingStartPanel'
import type { PricingStartChoices } from '../../lib/bids/pricingStartChoices'

/**
 * The start panel for an unpriced version (punch list #137): the book door leads, the drawer
 * door is always there, the copy row keeps its honest caption — and a bid the Workbench could
 * not render gets an empty state that names what is missing and offers the adopt (v2.6251).
 */

const START: PricingStartChoices = {
  kind: 'start',
  title: 'No prices yet on Addendum 2 rebid.',
  bookTemplateId: 'tpl-haley',
  bookLabel: 'Price from HALEY',
  bookSubline: "The book To Plans prices from, as a fresh copy at today's book prices.",
  donors: [{ versionId: 'v1', label: 'Copy prices from To Plans', crossGc: false }],
}

const DOORS = { countsTo: '/bids?tab=counts&bidId=b1', laborTo: '/bids?tab=labor&bidId=b1', onAdopt: () => {} }

describe('PricingStartPanel', () => {
  it('renders the title, both book doors, the copy door and its caption', () => {
    const onPickBook = vi.fn()
    const onCopyFrom = vi.fn()
    render(<PricingStartPanel choices={START} busyBook={false} busyCopy={false} onPickBook={onPickBook} onBrowseBooks={() => {}} onCopyFrom={onCopyFrom} setupDoors={DOORS} />)
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
    render(<PricingStartPanel choices={START} busyBook busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} setupDoors={DOORS} />)
    const btn = screen.getByRole('button', { name: 'Opening…' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('no donors: the copy row and its caption stay out', () => {
    render(<PricingStartPanel choices={{ ...START, donors: [] }} busyBook={false} busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} setupDoors={DOORS} />)
    expect(screen.queryByText(/Or start from prices already on this bid/)).toBeNull()
    expect(screen.queryByText(/Rows only in this version stay unpriced/)).toBeNull()
  })

  it('no counts: the empty state names Counts and offers the adopt', () => {
    const onAdopt = vi.fn()
    renderWithProviders(<PricingStartPanel choices={{ kind: 'needs-setup', missing: 'counts' }} busyBook={false} busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} setupDoors={{ ...DOORS, onAdopt }} />)
    expect(screen.getByText('No counts on this version yet.')).toBeTruthy()
    expect((screen.getByRole('link', { name: 'Open Counts' }) as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=counts&bidId=b1')
    fireEvent.click(screen.getByRole('button', { name: 'Adopt an existing bid' }))
    expect(onAdopt).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/The Workbench needs Counts/)).toBeNull()
  })

  it('no cost estimate: the empty state names Labor', () => {
    renderWithProviders(<PricingStartPanel choices={{ kind: 'needs-setup', missing: 'cost-estimate' }} busyBook={false} busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} setupDoors={DOORS} />)
    expect(screen.getByText('No cost estimate on this bid yet.')).toBeTruthy()
    expect((screen.getByRole('link', { name: 'Open Labor' }) as HTMLAnchorElement).getAttribute('href')).toBe('/bids?tab=labor&bidId=b1')
    expect(screen.getByRole('button', { name: 'Adopt an existing bid' })).toBeTruthy()
  })

  it('no version to price: the adopt is the one press', () => {
    renderWithProviders(<PricingStartPanel choices={{ kind: 'needs-setup', missing: 'version' }} busyBook={false} busyCopy={false} onPickBook={() => {}} onBrowseBooks={() => {}} onCopyFrom={() => {}} setupDoors={DOORS} />)
    expect(screen.getByText('Nothing to price on this version yet.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adopt an existing bid' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
