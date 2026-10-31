// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import LegalStatementsStrip from './LegalStatementsStrip'
import type { LegalEntryRow } from '../../../lib/legal/legalMatters'

afterEach(cleanup)

const TODAY = '2026-10-31'
const row = (over: Partial<LegalEntryRow>): LegalEntryRow => ({ id: 'e', matter_id: 'm', kind: 'statement', amount: null, body: 'x', occurred_on: '2026-09-03', meta: {}, via_portal: false, created_by: 'u1', acknowledged_at: null, created_at: '2026-10-28T15:00:00Z', ...over })
const draft = row({ id: 'st-draft', meta: { title: 'Affidavit of Daniel Alvarez', affiant: { kind: 'team', user_id: 'u-da', name: 'Daniel Alvarez', role: 'RMP' }, form: 'notary', incident_to: '2026-09-17', state: 'draft', prints: [] } })
const signed = row({ id: 'st-signed', occurred_on: '2026-09-09', meta: { title: 'Declaration of Thanh Nguyen', affiant: { kind: 'witness', name: 'Thanh Nguyen' }, form: 'declaration', venue_county: 'Williamson', state: 'signed', prints: [{ at: '2026-10-16T15:00:00Z', face: 'signing' }], signed_on: '2026-10-29', document_id: 'd-scan' } })
const dropped = row({ id: 'st-gone', voided_at: '2026-10-30T10:00:00Z', meta: { title: 'Dropped' } })

describe('LegalStatementsStrip (punch list #220, v2.6210)', () => {
  it('with nothing sworn, names the press and offers it', () => {
    const swear = vi.fn()
    render(<LegalStatementsStrip entries={[row({ kind: 'event' })]} todayYmd={TODAY} canEdit acts={{ swear, open: vi.fn() }} />)
    expect(screen.getByText('Nothing sworn on this account yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Swear a statement…' }))
    expect(swear).toHaveBeenCalledTimes(1)
  })
  it('lists a draft and a signed statement with their chips, words and doors; a dropped one is gone', async () => {
    const open = vi.fn()
    const openDocument = vi.fn(async () => {})
    render(<LegalStatementsStrip entries={[draft, signed, dropped]} todayYmd={TODAY} canEdit acts={{ swear: vi.fn(), open, openDocument }} />)
    expect(screen.getByText('1 draft · 1 signed')).toBeTruthy()
    expect(document.querySelector('[data-legal-statement="st-gone"]')).toBeNull()
    const d = document.querySelector('[data-legal-statement="st-draft"]') as HTMLElement
    expect(d.textContent).toContain('draft · not signed')
    expect(d.textContent).toContain('Affidavit of Daniel Alvarez')
    expect(d.textContent).toContain('sworn statement · draft · Daniel Alvarez · team · about Sep 3 to Sep 17')
    expect(d.textContent).toContain('Draft · not signed.')
    fireEvent.click(within(d).getByRole('button', { name: 'Open the draft' }))
    expect(open).toHaveBeenCalledWith('st-draft')
    const s = document.querySelector('[data-legal-statement="st-signed"]') as HTMLElement
    expect(s.textContent).toContain('signed Oct 29')
    expect(s.textContent).toContain('Signed Oct 29 under penalty of perjury in Williamson County. The signed copy is on Evidence. Printed once before the signing.')
    fireEvent.click(within(s).getByRole('button', { name: 'Open the signed copy' }))
    expect(openDocument).toHaveBeenCalledWith('d-scan')
    // The signed one comes first: newest day it is about on top.
    expect([...document.querySelectorAll('[data-legal-statement]')].map((e) => e.getAttribute('data-legal-statement'))).toEqual(['st-signed', 'st-draft'])
  })
  it('read only: the rows, no press', () => {
    render(<LegalStatementsStrip entries={[draft]} todayYmd={TODAY} canEdit={false} acts={null} />)
    expect(screen.queryByRole('button', { name: 'Swear a statement…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open the draft' })).toBeNull()
    expect(screen.getByText('Affidavit of Daniel Alvarez')).toBeTruthy()
  })
})
