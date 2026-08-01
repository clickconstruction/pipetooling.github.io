// @vitest-environment jsdom
/**
 * Render tests for the phone-width name-focus expansion (v2.1229): focusing a
 * line item's name field on a narrow viewport makes the name span the full
 * grid width (colSpan 3) and drops that row's ×/$ inputs to their own row
 * below; the layout collapses back a beat after focus leaves the row, and
 * moving focus from the name into the relocated count field keeps it open.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen } from '@testing-library/react'
import { JobFormFixturesSection } from './JobFormFixturesSection'
import type { FixtureRow } from '../../lib/jobs/jobFormTypes'
import { renderWithProviders } from '../../test/renderSmokeMocks'

let narrowMatches = true

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: query === '(max-width: 640px)' && narrowMatches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const fixtures: FixtureRow[] = [
  { id: 'a', name: 'Rough In', count: 1, line_unit_price: 8400, line_description: '', invoice_id: null },
  { id: 'b', name: 'Top Out', count: 1, line_unit_price: 8400, line_description: '', invoice_id: null },
]

function renderSection() {
  return renderWithProviders(
    <JobFormFixturesSection
      fixtures={fixtures}
      fixtureScopeExpandedById={{}}
      setFixtureScopeExpandedById={() => {}}
      fixturesSectionHighlight={false}
      fixturesSectionHighlightRef={{ current: null }}
      updateFixtureRow={() => {}}
      addFixtureRow={() => {}}
      removeFixtureRow={() => {}}
      moveFixtureRow={() => {}}
      onOpenSegmentGenerator={() => {}}
      onOpenStripeFixturePreview={() => {}}
      jobTotalDollars={21000}
    />,
  )
}

function nameField(index: number): HTMLTextAreaElement {
  return screen.getAllByLabelText('Specific work or materials')[index] as HTMLTextAreaElement
}
function countField(index: number): HTMLInputElement {
  return screen.getAllByLabelText('Count')[index] as HTMLInputElement
}

describe('JobFormFixturesSection phone name-focus expansion (v2.1229)', () => {
  it('focusing a name field expands it to full width and drops that row inputs below', () => {
    narrowMatches = true
    renderSection()
    const name0 = nameField(0)
    expect(name0.closest('td')?.colSpan).not.toBe(3)
    expect(name0.closest('tr')).toBe(countField(0).closest('tr'))

    act(() => name0.focus())

    expect(name0.closest('td')?.colSpan).toBe(3)
    expect(name0.closest('tr')).not.toBe(countField(0).closest('tr'))
    expect(countField(0).closest('td')?.colSpan).toBe(3)
    expect(nameField(1).closest('tr')).toBe(countField(1).closest('tr'))
  })

  it('collapses back shortly after focus leaves the row', () => {
    narrowMatches = true
    vi.useFakeTimers()
    renderSection()
    act(() => nameField(0).focus())
    expect(nameField(0).closest('td')?.colSpan).toBe(3)

    act(() => {
      nameField(0).blur()
      vi.advanceTimersByTime(150)
    })
    expect(nameField(0).closest('td')?.colSpan).not.toBe(3)
    expect(nameField(0).closest('tr')).toBe(countField(0).closest('tr'))
  })

  it('stays expanded while focus moves from the name into the relocated count field', () => {
    narrowMatches = true
    vi.useFakeTimers()
    renderSection()
    act(() => nameField(0).focus())
    act(() => {
      countField(0).focus()
      vi.advanceTimersByTime(150)
    })
    expect(nameField(0).closest('td')?.colSpan).toBe(3)
  })

  it('does nothing on wide viewports', () => {
    narrowMatches = false
    renderSection()
    act(() => nameField(0).focus())
    expect(nameField(0).closest('td')?.colSpan).not.toBe(3)
    expect(nameField(0).closest('tr')).toBe(countField(0).closest('tr'))
  })
})

describe('JobFormFixturesSection phone column compression (v2.1233)', () => {
  it('narrow: numbered placeholder, content-sized ×/$ columns keyed to the longest value', () => {
    narrowMatches = true
    const { container } = renderSection()
    expect(nameField(0).placeholder).toBe('Line item 1')
    expect(nameField(1).placeholder).toBe('Line item 2')
    const cols = container.querySelectorAll('col')
    // Counts are all "1" (1 char); prices are all 8400 → "8,400.00" (8 chars);
    // two rows → the delete column reserves its slice.
    // jsdom reorders calc() terms on serialization — assert the parts.
    expect((cols[1] as HTMLElement).style.width).toContain('1ch')
    const priceColWidth = (cols[2] as HTMLElement).style.width
    expect(priceColWidth).toContain('8ch')
    expect(priceColWidth).toContain('1.75rem')
  })

  it('narrow: the descriptive placeholder returns while the name field is focus-expanded', () => {
    narrowMatches = true
    renderSection()
    act(() => nameField(0).focus())
    expect(nameField(0).placeholder).toBe('Specific work or materials')
    expect(nameField(1).placeholder).toBe('Line item 2')
  })

  it('wide: descriptive placeholder and the fixed desktop column widths', () => {
    narrowMatches = false
    const { container } = renderSection()
    expect(nameField(0).placeholder).toBe('Specific work or materials')
    const cols = container.querySelectorAll('col')
    expect((cols[1] as HTMLElement).style.width).toBe('4.5rem')
    const priceColWidth = (cols[2] as HTMLElement).style.width
    expect(priceColWidth).toContain('6.2rem')
    expect(priceColWidth).not.toContain('ch')
  })
})
