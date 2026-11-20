// @vitest-environment jsdom
/**
 * The pills on one row (2026-11-20): on a phone the row that carries the Customer pill ran past the card, and a wrap
 * left Customer alone on a second row. That row is now the sliding strip, trimmed; every other row wraps as it did.
 */
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { ONE_ROW_PILLS, PHONE_PILL_MIN_HEIGHT } from '../lib/phonePress'
import { JobThreadNotesPanel } from './JobThreadNotesPanel'

const viewport = vi.hoisted(() => ({ narrow: true }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => viewport.narrow }))

afterEach(() => {
  cleanup()
  viewport.narrow = true
})

function draw(withCustomer: boolean) {
  renderWithProviders(
    <JobThreadNotesPanel
      activity={[]}
      viewerRole="helpers"
      loading={false}
      canPost
      draft=""
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      submitting={false}
      showSectionTitle={false}
      showEmptyPlaceholder={false}
      {...(withCustomer ? { customerLines: [] } : {})}
    />,
  )
  return screen.getByRole('tablist', { name: 'Filter activity' })
}

describe('JobThreadNotesPanel: the pills on one row', () => {
  it('a tech on a phone: five pills in the sliding strip, none wrapped', () => {
    const row = draw(true)
    expect(within(row).getAllByRole('tab').map((b) => b.textContent)).toEqual(['All', 'Notes', 'Status', 'Crew', 'Customer'])
    expect(row.className).toContain('tab-strip-scroll')
    expect(row.style.overflowX).toBe('auto')
    const inner = row.firstElementChild as HTMLElement
    expect(inner.style.flexWrap).toBe('nowrap')
    expect(inner.style.gap).toBe(ONE_ROW_PILLS.gap)
    // A short row keeps to the left edge, where the wrap had it.
    expect(inner.style.marginLeft).toBe('0px')
  })

  it('keeps a fingertip of height and brings the sides in', () => {
    const row = draw(true)
    const all = within(row).getByRole('tab', { name: 'All' })
    expect(all.style.minHeight).toBe(`${PHONE_PILL_MIN_HEIGHT}px`)
    expect(all.style.padding).toBe(ONE_ROW_PILLS.pill)
    expect(all.style.flexShrink).toBe('0')
    // A dim word has no outline to keep clear of.
    expect(within(row).getByRole('tab', { name: 'Customer' }).style.padding).toBe(ONE_ROW_PILLS.word)
  })

  it('a phone row without the Customer pill wraps as it did', () => {
    const row = draw(false)
    expect(row.className).not.toContain('tab-strip-scroll')
    expect(row.style.flexWrap).toBe('wrap')
    expect(within(row).getByRole('tab', { name: 'All' }).style.padding).toBe('0.3rem 0.75rem')
  })

  it('a desk wraps, Customer or not', () => {
    viewport.narrow = false
    const row = draw(true)
    expect(row.className).not.toContain('tab-strip-scroll')
    expect(row.style.flexWrap).toBe('wrap')
    expect(within(row).getByRole('tab', { name: 'All' }).style.padding).toBe('0.15rem 0.5rem')
  })
})
