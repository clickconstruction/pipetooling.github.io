// @vitest-environment jsdom
/**
 * The bin *Off the lien path* (the *not lienable* train, PR 3): each job a person took off, with its money, who, the
 * day, the attorney, the reason, and the press that puts it back. Made-up ZZ Test jobs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { buildLienOffPathBin, type LienOffPathJob } from '../../lib/jobs/lienOffPathBin'
import { LienOffPathBinView } from './LienOffPathBoardParts'

const job = (over: Partial<LienOffPathJob>): LienOffPathJob => ({
  jobId: 'j977',
  number: '977',
  name: 'ZZ Test Trip Charges',
  gcName: 'ZZ Test Builders',
  unpaid: 1050,
  reason: 'The bill is for trips to pick up checks, not for work on the property.',
  since: '2026-11-16T21:00:00Z',
  byUserId: 'u1',
  byName: 'Dana',
  attorneySince: null,
  status: 'billed',
  papers: [],
  ...over,
})
const BIN = buildLienOffPathBin([job({}), job({ jobId: 'j978', number: '978', name: 'ZZ Test Check Pickup', unpaid: 350, reason: 'A check pickup, not work.', attorneySince: '2026-11-17T15:00:00Z' })])!

afterEach(cleanup)

describe('LienOffPathBinView', () => {
  it('draws the bin’s name, its money and its count, and a row per job with who, the day, the attorney and the reason', () => {
    render(<LienOffPathBinView bin={BIN} isMobile={false} onPutBack={vi.fn()} />)
    const bin = document.querySelector('[data-lien-off-path-bin]') as HTMLElement
    expect(bin.getAttribute('aria-label')).toBe('Off the lien path')
    // Folded until pressed (v2.7854, punch list #390), as the Public jobs box is: one line, and no row.
    const fold = document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement
    expect(fold.textContent).toBe('Off the lien path2 jobs · $1,400 unpaidShow ▾')
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-lien-off-path-bin-row]')).toBeNull()
    fireEvent.click(fold)
    expect(bin.textContent).toContain('$1,400 unpaid')
    expect(document.querySelector('[data-lien-off-path-bin-count]')!.textContent).toBe('2')
    const rows = [...document.querySelectorAll('[data-lien-off-path-bin-row]')] as HTMLElement[]
    expect(rows.map((r) => r.getAttribute('data-lien-off-path-bin-row'))).toEqual(['j977', 'j978'])
    expect(rows[0]!.textContent).toContain('977 · ZZ Test Trip Charges')
    expect(rows[0]!.textContent).toContain('$1,050')
    expect(rows[0]!.querySelector('[data-lien-off-path-bin-line]')!.textContent).toBe('ZZ Test Builders · off since Nov 16, by Dana · not on the attorney’s list')
    expect(rows[0]!.querySelector('[data-lien-off-path-bin-reason]')!.textContent).toBe('The bill is for trips to pick up checks, not for work on the property.')
    expect(rows[1]!.querySelector('[data-lien-off-path-bin-line]')!.textContent).toContain('with the attorney since Nov 17')
  })

  it('each row’s Put it back… hands the desk that job', () => {
    const onPutBack = vi.fn()
    render(<LienOffPathBinView bin={BIN} isMobile={false} onPutBack={onPutBack} />)
    fireEvent.click(document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement)
    const presses = [...document.querySelectorAll('[data-lien-off-path-bin-back]')] as HTMLButtonElement[]
    expect(presses.map((p) => p.textContent)).toEqual(['Put it back…', 'Put it back…'])
    fireEvent.click(presses[1]!)
    expect(onPutBack).toHaveBeenCalledWith('j978')
  })

  it('a reader who is not the lien office sees the rows and no press', () => {
    render(<LienOffPathBinView bin={BIN} isMobile={false} onPutBack={null} />)
    fireEvent.click(document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement)
    expect(document.querySelectorAll('[data-lien-off-path-bin-row]')).toHaveLength(2)
    expect(document.querySelector('[data-lien-off-path-bin-back]')).toBeNull()
  })

  it('a row’s name opens the job when the desk hands a door, with a phone’s tap height', () => {
    const onOpenJob = vi.fn()
    render(<LienOffPathBinView bin={BIN} isMobile onOpenJob={onOpenJob} onPutBack={vi.fn()} />)
    fireEvent.click(document.querySelector('[data-lien-board-box-fold]') as HTMLButtonElement)
    const open = document.querySelector('[data-lien-off-path-bin-open="j977"]') as HTMLButtonElement
    expect(open.style.minHeight).toBe('40px')
    fireEvent.click(open)
    expect(onOpenJob).toHaveBeenCalledWith('j977')
  })
})
