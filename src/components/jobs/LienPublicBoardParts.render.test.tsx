// @vitest-environment jsdom
/**
 * The Board's parts for public property (v2.7443): the amber line over the bins and the bin *Public jobs · bond claim*.
 * Their words come from `lienPublicProperty.ts`, tested there; this is the wiring. Made-up ZZ Test jobs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LienPublicBinView, LienPublicBoardLineView } from './LienPublicBoardParts'
import { buildLienPublicBin, lienPublicBoardLine, type LienPublicJob } from '../../lib/jobs/lienPublicProperty'

afterEach(cleanup)

const line = lienPublicBoardLine({ askingJobIds: new Set(['j883', 'j523']), openPaperJobIds: new Set(['j883', 'j523']), unpaidOf: (id) => (id === 'j883' ? 2918.4 : 29323.4), addressIdOf: () => 'addr-1' })!
const job = (over: Partial<LienPublicJob>): LienPublicJob => ({ jobId: 'j523', addressId: 'addr-1', number: '523', name: 'ZZ Test Hills', gcName: 'ZZ Test Builders', unpaid: 29323.4, bond: 'unknown', attorneySince: null, status: 'working', papers: [], ...over })

describe('LienPublicBoardLineView', () => {
  it('says how many jobs and how much, and Review opens the properties in turn', () => {
    const onReview = vi.fn()
    render(<LienPublicBoardLineView line={line} isMobile={false} onReview={onReview} />)
    expect(document.querySelector('[data-lien-public-board-line]')!.textContent).toContain('2 jobs sit on public property and are still on the lien path · $32,241 unpaid')
    fireEvent.click(screen.getByRole('button', { name: 'Review them ›' }))
    expect(onReview).toHaveBeenCalledTimes(1)
  })
  it('outside the office the line reads without its press', () => {
    render(<LienPublicBoardLineView line={line} isMobile onReview={null} />)
    expect(screen.queryByRole('button', { name: 'Review them ›' })).toBeNull()
  })
})

describe('LienPublicBinView', () => {
  it('lists each job with its money, the bond chip and where it stands; one property puts back at once', () => {
    const bin = buildLienPublicBin([job({}), job({ jobId: 'j883', number: '883', name: 'ZZ Test Drains', unpaid: 2918.4, status: 'billed', attorneySince: '2026-11-16T18:00:00Z', papers: [{ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }] })])!
    const onPutBack = vi.fn()
    render(<LienPublicBinView bin={bin} isMobile={false} onPutBack={onPutBack} />)
    expect(screen.getByRole('region', { name: 'Public jobs · bond claim' })).toBeTruthy()
    // Folded until pressed (v2.7854, punch list #390): one line with the jobs, the money and the bond still to get, and no row.
    const fold = document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(fold.textContent).toBe('Public jobs · bond claim2 jobs · $32,241 unpaid2 to get the bondShow ▾')
    expect(document.querySelector('[data-lien-board-box-needs]')!.textContent).toBe('2 to get the bond')
    expect(document.querySelector('[data-lien-public-bin]')!.getAttribute('data-folded')).toBe('yes')
    expect(document.querySelector('[data-lien-public-bin-row]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Put a job back on the lien path…' })).toBeNull()
    fireEvent.click(fold)
    // Open, it is the box as it was, with Hide in the place of Show and the bond chip back on its row.
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(fold.textContent).toBe('Public jobs · bond claim$32,241 unpaid2Hide ▴')
    expect(document.querySelector('[data-lien-board-box-needs]')).toBeNull()
    expect(document.querySelector('[data-lien-public-bin-count]')!.textContent).toBe('2')
    expect(screen.getByText('$32,241 unpaid')).toBeTruthy()
    const rows = [...document.querySelectorAll('[data-lien-public-bin-row]')] as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-lien-public-bin-row'))).toEqual(['j523', 'j883'])
    expect(rows[0]!.querySelector('[data-lien-public-bin-chip]')!.textContent).toBe('get the bond')
    expect(rows[0]!.querySelector('[data-lien-public-bin-line]')!.textContent).toBe('ZZ Test Builders · bond not known yet · not on the attorney’s list, the job is still being worked')
    expect(rows[1]!.querySelector('[data-lien-public-bin-line]')!.textContent).toBe('ZZ Test Builders · a lien notice went out Oct 8 · with the attorney since Nov 16')
    fireEvent.click(screen.getByRole('button', { name: 'Put a job back on the lien path…' }))
    expect(onPutBack).toHaveBeenCalledWith('addr-1')
  })

  it('with two properties it asks which job first, then puts back that job’s property', () => {
    const bin = buildLienPublicBin([job({}), job({ jobId: 'j9', addressId: 'addr-2', number: '9', name: 'ZZ Test School', unpaid: 100 })])!
    const onPutBack = vi.fn()
    render(<LienPublicBinView bin={bin} isMobile={false} onPutBack={onPutBack} />)
    fireEvent.click(document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: 'Put a job back on the lien path…' }))
    expect(onPutBack).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Put 9 back…' }))
    expect(onPutBack).toHaveBeenCalledWith('addr-2')
  })

  it('folds again on a second press, and on a phone the folded line is a thumb tall (v2.7854)', () => {
    render(<LienPublicBinView bin={buildLienPublicBin([job({ bond: 'yes' })])!} isMobile onPutBack={vi.fn()} />)
    const fold = document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement
    expect(fold.style.minHeight).toBe('44px')
    // Every bond is known, so the folded line has no amber words.
    expect(document.querySelector('[data-lien-board-box-needs]')).toBeNull()
    fireEvent.click(fold)
    expect(document.querySelectorAll('[data-lien-public-bin-row]')).toHaveLength(1)
    fireEvent.click(fold)
    expect(document.querySelector('[data-lien-public-bin-row]')).toBeNull()
    expect(fold.getAttribute('aria-expanded')).toBe('false')
  })

  it('outside the office the bin reads without a door back', () => {
    render(<LienPublicBinView bin={buildLienPublicBin([job({})])!} isMobile={false} onPutBack={null} />)
    fireEvent.click(document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement)
    expect(document.querySelectorAll('[data-lien-public-bin-row]')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Put a job back on the lien path…' })).toBeNull()
  })
})
