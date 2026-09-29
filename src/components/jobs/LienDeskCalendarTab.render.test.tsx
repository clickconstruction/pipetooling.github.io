// @vitest-environment jsdom
/**
 * Render smoke for the Lien desk's Calendar tab (v2.4101 the shell, v2.4152
 * the body): the to-do strip the columns write, the key, the density strip
 * with the today pill, a GC row with counted flags and its jobs' marks on
 * the shared axis, lien-gone closed by default, the search narrows, a row
 * opens the job, and the phone list instead of the axis. The grouping, the
 * axis and every mark come from lib/jobs/lienCalendar.ts (kernel-tested).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import LienDeskCalendarTab from './LienDeskCalendarTab'
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'

const TODAY = '2026-09-28'
const base = { todayYmd: TODAY, openBalance: 1000, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null }
const rows: LienCalendarJob[] = [
  { jobId: 'a', number: '890 PLUM', name: 'Rizvi', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '628 Terrell Rd', openBalance: 9800, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 9800, lastWorkYmd: '2026-08-12', isSub: true }), lastWorkYmd: '2026-08-12' },
  { jobId: 'b', number: '881 PLUM', name: 'Umar Khan', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '9703 Lenox Hl', openBalance: 7902, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 7902, lastWorkYmd: '2026-08-20', propertyKind: '', isSub: true }), lastWorkYmd: '2026-08-20', months: [{ key: '2026-07', due: '2026-09-15', state: 'sent' }, { key: '2026-08', due: '2026-10-15', state: 'due' }] },
  { jobId: 'd', number: '473 PLUM', name: 'Mike Holub', customer: 'Michael Holub', gcId: null, gcName: null, address: '109 Tuscarora', openBalance: 5724, isSub: false, runway: buildLienPayRunway({ ...base, openBalance: 5724, lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-09-30' }), lastWorkYmd: '2026-08-12' },
  { jobId: 'e', number: '663 PLUM', name: 'Knight', customer: 'Knight Contracting', gcId: 'gc2', gcName: 'Knight Contracting', address: '', openBalance: 658, isSub: true, runway: buildLienPayRunway({ ...base, openBalance: 658, lastWorkYmd: '2026-03-01', isSub: true }), lastWorkYmd: '2026-03-01' },
]

function mount(over: Partial<Parameters<typeof LienDeskCalendarTab>[0]> = {}) {
  const onOpen = vi.fn()
  render(<LienDeskCalendarTab rows={rows} loading={false} todayYmd={TODAY} onOpenJob={onOpen} {...over} />)
  return { onOpen }
}

describe('LienDeskCalendarTab', () => {
  it('the first fold is a to-do the columns write, with the key and the density strip under it', () => {
    mount()
    const todo = screen.getByTestId('lien-cal-todo')
    expect(todo.textContent).toContain('By Oct 15 · 17 d')
    expect(todo.textContent).toContain('2 notices to RMC · Dudley Mason · $17.7k')
    expect(todo.textContent).toContain('Before that')
    expect(todo.textContent).toContain('1 property has no kind')
    expect(todo.textContent).toContain('By Nov 16 · 49 d')
    expect(screen.getByTestId('lien-cal-key').textContent).toContain('a § 53.056 notice owed for that work month')
    expect(screen.getByTestId('lien-cal-today-pill').textContent).toBe('today · Sep 28')
    expect(screen.getByTestId('lien-cal-today-line')).toBeTruthy()
    expect(screen.getByTestId('lien-cal-density').textContent).toContain('Oct 15')
  })

  it('groups: the GC row folds its flags with a count, its jobs draw their marks; Lien gone is closed by default', () => {
    mount()
    const rmc = screen.getByTestId('lien-cal-group-gc:gc1')
    expect(rmc.textContent).toContain('RMC · Dudley Mason')
    expect(rmc.textContent).toContain('send 2 notices · 17 d')
    expect(rmc.querySelector('[title="2 notices owed by Oct 15"]')).toBeTruthy()
    // Umar Khan: the sent month's check, the owed month's hollow flag (a door), the kind bracket
    const tracks = screen.getAllByTestId('lien-cal-track')
    expect(tracks.length).toBe(3)
    expect(screen.getByRole('button', { name: /A § 53.056 notice is owed for August 2026 — send it by Oct 15/ })).toBeTruthy()
    expect(screen.getByTitle('The July 2026 notice is on file')).toBeTruthy()
    expect(screen.getByTitle(/Property kind not set: residential would be the first date, commercial Dec 15/)).toBeTruthy()
    // Mike Holub: a pay dot and room
    expect(screen.getByTitle(/Expected to pay Sep 30/)).toBeTruthy()
    expect(screen.getByTitle('Room — the money is expected before the lien date')).toBeTruthy()
    expect(screen.queryByText('Knight')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Lien gone/ }))
    expect(screen.getByText('Knight')).toBeTruthy()
    expect(screen.getByTitle(/The lien window closed/)).toBeTruthy()
  })

  it('a row and a hollow flag open the job; the search narrows the groups', () => {
    const { onOpen } = mount()
    fireEvent.click(screen.getByRole('button', { name: /890 PLUM/ }))
    expect(onOpen).toHaveBeenCalledWith('a')
    fireEvent.click(screen.getByRole('button', { name: /A § 53.056 notice is owed for August 2026/ }))
    expect(onOpen).toHaveBeenLastCalledWith('b')
    fireEvent.change(screen.getByLabelText('Search the lien calendar'), { target: { value: 'holub' } })
    expect(screen.queryByText('RMC · Dudley Mason')).toBeNull()
    expect(screen.getByText('Direct — we contracted with the owner')).toBeTruthy()
  })

  it('the to-do’s doors act only when the parent wires them', () => {
    const onDraft = vi.fn()
    mount({ onDraft })
    fireEvent.click(screen.getByRole('button', { name: 'Draft the two ›' }))
    expect(onDraft).toHaveBeenCalledWith('2026-10-15', ['a', 'b'])
    expect(screen.queryByRole('button', { name: /Set kinds/ })).toBeNull()
  })

  it('on a phone: no axis — the column cards, then the sentences', () => {
    mount({ isMobile: true })
    const phone = screen.getByTestId('lien-cal-phone')
    expect(within(phone).getByText('Oct 15 · 17 d')).toBeTruthy()
    expect(within(phone).getByText('2 notices')).toBeTruthy()
    expect(screen.queryByTestId('lien-cal-density')).toBeNull()
    expect(screen.queryByTestId('lien-cal-key')).toBeNull()
  })
})
