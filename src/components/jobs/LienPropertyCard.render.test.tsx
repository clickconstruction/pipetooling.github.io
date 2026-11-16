// @vitest-environment jsdom
/**
 * Render smoke for the property card (v2.7488): every job at one property on a row, with where its notice and its
 * affidavit stand, one tally over them, and the presses that open a paper, a job and the owner's other property.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LienPropertyCard from './LienPropertyCard'
import { lienPropertyAffidavitLine, lienPropertyNoticeLine, lienPropertyTally, type LienProperty, type LienPropertyJobLine } from '../../lib/jobs/lienPropertyPapers'
import type { LienTimelineBookRow } from '../../lib/jobs/lienTimelineBook'

afterEach(cleanup)

const line = (jobId: string, label: string, notice: Parameters<typeof lienPropertyNoticeLine>[0], affidavit: Parameters<typeof lienPropertyAffidavitLine>[0], openBalance: number): LienPropertyJobLine => ({ jobId, label, months: 'Sep', gcName: 'Marlow Builders', notice: lienPropertyNoticeLine(notice), affidavit: lienPropertyAffidavitLine(affidavit), openBalance })

const jobs = [
  line('j1207', '1207 · Water heater', { isSub: true, pile: 'printed', noticed: false, sentOn: [], printedOn: '2026-11-16' }, { pile: null, gateHeld: false, missing: [] }, 1_712),
  line('j1203', '1203 · Kitchen rough-in', { isSub: true, pile: 'sent', noticed: true, sentOn: ['2026-10-14'] }, { pile: 'to_draft', gateHeld: false, missing: [], deadline: '2027-01-15' }, 595),
  line('j1198', '1198 · Slab leak', { isSub: true, pile: null, noticed: true, sentOn: ['2026-09-22'] }, { pile: 'awaiting', gateHeld: false, missing: [], deadline: '2026-12-15' }, 8_274),
]

const property: LienProperty = {
  key: 'p1',
  addressId: 'p1',
  address: '412 Ridgeline Dr, Hollow Creek',
  ownerName: 'Avery and Jordan Pell',
  rows: [{ job: { propertyKind: 'residential' } } as unknown as LienTimelineBookRow],
  jobs,
  openBalance: 10_581,
  tally: lienPropertyTally(jobs),
  sameOwner: [{ addressId: 'p2', address: '88 Fenwick Ln, Hollow Creek', jobs: 1 }],
}

const noop = () => {}

describe('LienPropertyCard', () => {
  it('shows the property whole: its head, its tally and a row per job with both papers', () => {
    render(<LienPropertyCard property={property} loading={false} error="" onClose={noop} onOpenPaper={noop} onOpenProperty={noop} fromJobId="j1207" />)
    expect(screen.getByTestId('lien-property-title').textContent).toBe('412 Ridgeline Dr, Hollow Creek')
    expect(screen.getByRole('dialog').textContent).toContain('Owner of record: Avery and Jordan Pell · residential · GC: Marlow Builders')
    expect(screen.getByTestId('lien-property-tally').textContent).toBe('3 jobs · $10,581 open · 2 notices sent · 1 to print and mail · 2 at the affidavit')
    expect(screen.getByTestId('lien-property-notice-j1207').textContent).toBe('Approved · to mailprinted Nov 16')
    expect(screen.getByTestId('lien-property-notice-j1203').textContent).toBe('Notice sent Oct 14')
    expect(screen.getByTestId('lien-property-notice-j1198').textContent).toBe('Notice sent Sep 22')
    expect(screen.getByTestId('lien-property-affidavit-j1203').textContent).toBe('To send for Master approvallast day Jan 15')
    expect(document.querySelector('[data-lien-property-row="j1207"]')?.getAttribute('data-from')).toBe('true')
    expect(document.querySelector('[data-lien-property-row="j1203"]')?.getAttribute('data-from')).toBeNull()
  })

  it('a paper is a press that opens it; the owner’s other property and Close are presses too', () => {
    const onOpenPaper = vi.fn()
    const onOpenProperty = vi.fn()
    const onClose = vi.fn()
    render(<LienPropertyCard property={property} loading={false} error="" onClose={onClose} onOpenPaper={onOpenPaper} onOpenProperty={onOpenProperty} />)
    fireEvent.click(screen.getByTestId('lien-property-notice-j1203'))
    expect(onOpenPaper).toHaveBeenCalledWith('j1203', 'notice')
    fireEvent.click(screen.getByTestId('lien-property-affidavit-j1198'))
    expect(onOpenPaper).toHaveBeenCalledWith('j1198', 'affidavit')
    // A job with no affidavit line has nothing to open there.
    expect(screen.getByTestId('lien-property-affidavit-j1207').tagName).toBe('SPAN')
    fireEvent.click(screen.getByRole('button', { name: '88 Fenwick Ln, Hollow Creek · 1 job ›' }))
    expect(onOpenProperty).toHaveBeenCalledWith('p2')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('says it is reading, says what failed, and says when no job stands on the property', () => {
    const { rerender } = render(<LienPropertyCard property={null} loading error="" onClose={noop} onOpenPaper={noop} onOpenProperty={noop} />)
    expect(screen.getByTestId('lien-property-waiting').textContent).toBe('Reading every job at this property…')
    rerender(<LienPropertyCard property={null} loading={false} error="the network dropped" onClose={noop} onOpenPaper={noop} onOpenProperty={noop} />)
    expect(screen.getByRole('alert').textContent).toBe('The jobs at this property could not be read: the network dropped')
    rerender(<LienPropertyCard property={null} loading={false} error="" onClose={noop} onOpenPaper={noop} onOpenProperty={noop} />)
    expect(screen.getByTestId('lien-property-waiting').textContent).toContain('Nothing waiting on this property')
  })

  it('on a phone each job is a stacked block and each paper names itself', () => {
    render(<LienPropertyCard property={property} loading={false} error="" onClose={noop} onOpenPaper={noop} onOpenProperty={noop} phone />)
    expect(screen.getByTestId('lien-property-notice-j1203').textContent).toBe('Notice: Notice sent Oct 14')
    expect(screen.getByTestId('lien-property-affidavit-j1203').textContent).toBe('Affidavit: To send for Master approvallast day Jan 15')
  })
})
