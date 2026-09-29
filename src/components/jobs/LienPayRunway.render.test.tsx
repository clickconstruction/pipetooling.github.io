// @vitest-environment jsdom
/**
 * Render smoke for the lien runway (v2.4051; two lines since v2.4064): the words are a button that
 * opens the Lien window, the track carries the pay dot and the flag when the
 * kernel gives marks, and a closed or filed reading draws the sentence alone.
 * Every mark and word comes from buildLienPayRunway (kernel-tested).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LienPayRunway from './LienPayRunway'
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'

const base = { todayYmd: '2026-09-28', openBalance: 8200, lastWorkYmd: '2026-07-20', propertyKind: 'residential', filedYmd: null, releasedYmd: null }

describe('LienPayRunway', () => {
  it('room: the sentence is a door, the track shows today and the end date', () => {
    const onOpen = vi.fn()
    const { container } = render(<LienPayRunway runway={buildLienPayRunway({ ...base, expectedPayYmd: '2026-10-03' })} onOpen={onOpen} />)
    const words = screen.getByRole('button')
    expect(screen.getByText('pay Oct 3 → file lien by Oct 15')).toBeTruthy()
    expect(screen.getByText(/^12 d of room/)).toBeTruthy()
    expect(words.getAttribute('title')).toContain('§ 53.052')
    expect(container.querySelector('.lienRunway')?.getAttribute('data-state')).toBe('room')
    expect(screen.getByText('today')).toBeTruthy()
    fireEvent.click(words)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('closed: one red line, no track', () => {
    const { container } = render(<LienPayRunway runway={buildLienPayRunway({ ...base, lastWorkYmd: '2026-05-20', propertyKind: 'non_residential', expectedPayYmd: null })} />)
    expect(screen.getByText('lien gone')).toBeTruthy()
    expect(screen.getByText(/^window closed Sep 15/)).toBeTruthy()
    expect(screen.queryByText('today')).toBeNull()
    expect(container.querySelector('.lienRunway')?.getAttribute('data-state')).toBe('closed')
  })

  it('a sub job with the notice owed draws the hollow flag; recorded, the check (v2.4096)', () => {
    const owed = render(<LienPayRunway runway={buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12', isSub: true, expectedPayYmd: null })} />)
    expect(screen.getByText('notice by Oct 15 · lien by Nov 16')).toBeTruthy()
    expect(screen.getByText(/^send the notice · 17 d/)).toBeTruthy()
    expect(owed.container.querySelector('.lienRunway')?.getAttribute('data-state')).toBe('notice_due')
    owed.unmount()
    const done = render(<LienPayRunway runway={buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12', isSub: true, noticedMonths: ['2026-08'], expectedPayYmd: null })} />)
    expect(screen.getByText('✓')).toBeTruthy()
    expect(done.container.querySelector('.lienRunway')?.getAttribute('data-state')).toBe('no_pay')
  })

  it('nothing open: renders nothing', () => {
    const { container } = render(<LienPayRunway runway={buildLienPayRunway({ ...base, openBalance: 0, expectedPayYmd: null })} />)
    expect(container.firstChild).toBeNull()
  })
})
