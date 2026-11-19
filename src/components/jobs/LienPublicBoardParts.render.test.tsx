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

/** The box opens folded (punch list #390): press its header to read the rows. */
const openBin = () => fireEvent.click(document.querySelector('[data-lien-public-bin] [data-lien-bin-fold]') as HTMLButtonElement)

describe('LienPublicBinView', () => {
  const TWO = () => buildLienPublicBin([job({}), job({ jobId: 'j883', number: '883', name: 'ZZ Test Drains', unpaid: 2918.4, status: 'billed', attorneySince: '2026-11-16T18:00:00Z', papers: [{ kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-08T15:00:00Z' }] })])!

  it('opens folded to one line: the name, the jobs and the money, the rows that need the bond, and Show (punch list #390)', () => {
    render(<LienPublicBinView bin={TWO()} isMobile={false} onPutBack={vi.fn()} />)
    const press = document.querySelector('[data-lien-bin-fold]') as HTMLButtonElement
    expect(press.getAttribute('aria-expanded')).toBe('false')
    expect(press.getAttribute('data-lien-bin-fold')).toBe('folded')
    expect(press.textContent).toBe('Public jobs · bond claim2 jobs · $32,241 unpaid2 to get the bondShow ▾')
    expect(document.querySelector('[data-lien-bin-fold-ask]')!.textContent).toBe('2 to get the bond')
    // Folded, no row, no chip and no door back is drawn.
    expect(document.querySelector('[data-lien-public-bin-row]')).toBeNull()
    expect(document.querySelector('[data-lien-public-bin-chip]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Put a job back on the lien path…' })).toBeNull()
  })

  it('a press on the header opens the box, where the chips say what the folded line counted, and a second press folds it', () => {
    render(<LienPublicBinView bin={TWO()} isMobile={false} onPutBack={vi.fn()} />)
    openBin()
    const press = document.querySelector('[data-lien-bin-fold]') as HTMLButtonElement
    expect(press.getAttribute('aria-expanded')).toBe('true')
    expect(press.textContent).toBe('Public jobs · bond claim2 jobs · $32,241 unpaidHide ▴')
    expect(document.querySelector('[data-lien-bin-fold-ask]')).toBeNull()
    expect(document.getElementById(press.getAttribute('aria-controls')!)!.querySelectorAll('[data-lien-public-bin-row]')).toHaveLength(2)
    expect(document.querySelectorAll('[data-lien-public-bin-chip]')).toHaveLength(2)
    openBin()
    expect(press.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-lien-public-bin-row]')).toBeNull()
  })

  it('the amber count is the rows with the chip, not every row', () => {
    render(<LienPublicBinView bin={buildLienPublicBin([job({}), job({ jobId: 'j9', number: '9', unpaid: 100, bond: 'no' })])!} isMobile={false} onPutBack={null} />)
    expect(document.querySelector('[data-lien-bin-fold]')!.textContent).toBe('Public jobs · bond claim2 jobs · $29,423 unpaid1 to get the bondShow ▾')
  })

  it('a box where every bond is known folds with no amber count, and a phone’s press is 44 px tall', () => {
    render(<LienPublicBinView bin={buildLienPublicBin([job({ bond: 'yes' })])!} isMobile onPutBack={null} />)
    const press = document.querySelector('[data-lien-bin-fold]') as HTMLButtonElement
    expect(press.textContent).toBe('Public jobs · bond claim1 job · $29,323 unpaidShow ▾')
    expect(document.querySelector('[data-lien-bin-fold-ask]')).toBeNull()
    expect(press.style.minHeight).toBe('44px')
  })

  it('lists each job with its money, the bond chip and where it stands; one property puts back at once', () => {
    const bin = TWO()
    const onPutBack = vi.fn()
    render(<LienPublicBinView bin={bin} isMobile={false} onPutBack={onPutBack} />)
    expect(screen.getByRole('region', { name: 'Public jobs · bond claim' })).toBeTruthy()
    expect(document.querySelector('[data-lien-bin-fold-words]')!.textContent).toBe('2 jobs · $32,241 unpaid')
    openBin()
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
    openBin()
    fireEvent.click(screen.getByRole('button', { name: 'Put a job back on the lien path…' }))
    expect(onPutBack).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Put 9 back…' }))
    expect(onPutBack).toHaveBeenCalledWith('addr-2')
  })

  it('folding the box drops a half-made pick, so it opens again asking nothing', () => {
    const bin = buildLienPublicBin([job({}), job({ jobId: 'j9', addressId: 'addr-2', number: '9', name: 'ZZ Test School', unpaid: 100 })])!
    render(<LienPublicBinView bin={bin} isMobile={false} onPutBack={vi.fn()} />)
    openBin()
    fireEvent.click(screen.getByRole('button', { name: 'Put a job back on the lien path…' }))
    expect(screen.getByRole('button', { name: 'Put 9 back…' })).toBeTruthy()
    openBin()
    openBin()
    expect(screen.queryByRole('button', { name: 'Put 9 back…' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Put a job back on the lien path…' })).toBeTruthy()
  })

  it('outside the office the bin reads without a door back', () => {
    render(<LienPublicBinView bin={buildLienPublicBin([job({})])!} isMobile={false} onPutBack={null} />)
    openBin()
    expect(document.querySelectorAll('[data-lien-public-bin-row]')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Put a job back on the lien path…' })).toBeNull()
  })
})
