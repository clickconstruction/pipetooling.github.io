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

/** The box opens folded (punch list #390): press its header to read the rows. */
const openBin = () => fireEvent.click(document.querySelector('[data-lien-off-path-bin] [data-lien-bin-fold]') as HTMLButtonElement)

describe('LienOffPathBinView', () => {
  it('opens folded to one line, the name, the jobs, the money and Show, and a press on it opens the rows (punch list #390)', () => {
    render(<LienOffPathBinView bin={BIN} isMobile={false} onPutBack={vi.fn()} />)
    const press = document.querySelector('[data-lien-bin-fold]') as HTMLButtonElement
    expect(press.getAttribute('aria-expanded')).toBe('false')
    expect(press.textContent).toBe('Off the lien path2 jobs · $1,400 unpaidShow ▾')
    expect(document.querySelector('[data-lien-off-path-bin-row]')).toBeNull()
    expect(document.querySelector('[data-lien-off-path-bin-back]')).toBeNull()
    openBin()
    expect(press.getAttribute('aria-expanded')).toBe('true')
    expect(press.textContent).toBe('Off the lien path2 jobs · $1,400 unpaidHide ▴')
    expect(document.getElementById(press.getAttribute('aria-controls')!)!.querySelectorAll('[data-lien-off-path-bin-row]')).toHaveLength(2)
    openBin()
    expect(document.querySelector('[data-lien-off-path-bin-row]')).toBeNull()
  })

  it('a phone’s fold press is 44 px tall', () => {
    render(<LienOffPathBinView bin={BIN} isMobile onPutBack={null} />)
    expect((document.querySelector('[data-lien-bin-fold]') as HTMLButtonElement).style.minHeight).toBe('44px')
  })

  it('draws the bin’s name, its money and its count, and a row per job with who, the day, the attorney and the reason', () => {
    render(<LienOffPathBinView bin={BIN} isMobile={false} onPutBack={vi.fn()} />)
    const bin = document.querySelector('[data-lien-off-path-bin]') as HTMLElement
    expect(bin.getAttribute('aria-label')).toBe('Off the lien path')
    expect(document.querySelector('[data-lien-bin-fold-words]')!.textContent).toBe('2 jobs · $1,400 unpaid')
    openBin()
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
    openBin()
    const presses = [...document.querySelectorAll('[data-lien-off-path-bin-back]')] as HTMLButtonElement[]
    expect(presses.map((p) => p.textContent)).toEqual(['Put it back…', 'Put it back…'])
    fireEvent.click(presses[1]!)
    expect(onPutBack).toHaveBeenCalledWith('j978')
  })

  it('a reader who is not the lien office sees the rows and no press', () => {
    render(<LienOffPathBinView bin={BIN} isMobile={false} onPutBack={null} />)
    openBin()
    expect(document.querySelectorAll('[data-lien-off-path-bin-row]')).toHaveLength(2)
    expect(document.querySelector('[data-lien-off-path-bin-back]')).toBeNull()
  })

  it('a row’s name opens the job when the desk hands a door, with a phone’s tap height', () => {
    const onOpenJob = vi.fn()
    render(<LienOffPathBinView bin={BIN} isMobile onOpenJob={onOpenJob} onPutBack={vi.fn()} />)
    openBin()
    const open = document.querySelector('[data-lien-off-path-bin-open="j977"]') as HTMLButtonElement
    expect(open.style.minHeight).toBe('40px')
    fireEvent.click(open)
    expect(onOpenJob).toHaveBeenCalledWith('j977')
  })
})
