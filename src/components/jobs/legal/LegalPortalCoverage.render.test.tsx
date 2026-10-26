// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import LegalPortalCoverage from './LegalPortalCoverage'
import type { FirmCoverage } from '../../../lib/legal/legalFirmCoverage'

const COVERAGE: FirmCoverage = {
  firms: [
    { id: 'f-snell', name: 'Snell Law Firm', createdAt: '2026-01-01T00:00:00Z', counties: ['Bexar', 'Comal'], matterCount: 2 },
    { id: 'f-austin', name: 'Austin Collections', createdAt: '2026-06-01T00:00:00Z', counties: ['Travis'], matterCount: 0 },
  ],
  countyCounts: { Bexar: 2 },
}

describe('LegalPortalCoverage', () => {
  it('lists every firm with its counties and matter count, marks the reading firm, and says counts only', () => {
    render(<LegalPortalCoverage coverage={COVERAGE} firmId="f-austin" />)
    const firms = document.querySelector('[data-legal-coverage-firms]')!
    expect(firms.textContent).toContain('Snell Law Firm')
    expect(firms.textContent).toContain('2 counties · Bexar, Comal')
    expect(firms.textContent).toContain('2 matters with the firm')
    expect(firms.textContent).toContain('Austin Collections · your firm')
    expect(firms.textContent).toContain('No matters yet')
    expect(firms.textContent).toContain('Counts only. Another firm’s case names and amounts stay with that firm.')
    // The reading firm alone is marked.
    expect(document.querySelector('[data-legal-coverage-firm="f-snell"]')!.textContent).not.toContain('your firm')
  })

  it('the county card asks for a tap until a county is picked', () => {
    render(<LegalPortalCoverage coverage={COVERAGE} firmId="f-snell" />)
    expect(document.querySelector('[data-legal-coverage-county]')!.textContent).toContain('Tap a county on the map for its case count.')
    expect(document.querySelector('[data-legal-coverage-count]')).toBeNull()
  })
})
