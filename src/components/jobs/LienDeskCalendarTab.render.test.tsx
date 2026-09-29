// @vitest-environment jsdom
/**
 * Render smoke for the Lien desk's Calendar tab (v2.4101): groups by GC with
 * the group's next move, direct jobs under their heading, lien-gone closed by
 * default, the search narrows, a row opens the job. The grouping and words
 * come from lib/jobs/lienCalendar.ts (kernel-tested).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LienDeskCalendarTab from './LienDeskCalendarTab'
import { buildLienPayRunway } from '../../lib/jobs/lienPayRunway'
import type { LienCalendarJob } from '../../lib/jobs/lienCalendar'

const base = { todayYmd: '2026-09-28', openBalance: 1000, propertyKind: 'residential', expectedPayYmd: null, filedYmd: null, releasedYmd: null }
const rows: LienCalendarJob[] = [
  { jobId: 'a', number: '890 PLUM', name: 'Rizvi', customer: 'Dudley Mason', gcId: 'gc1', gcName: 'RMC · Dudley Mason', address: '628 Terrell Rd', openBalance: 9800, isSub: true, runway: buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12', isSub: true, openBalance: 9800 }) },
  { jobId: 'd', number: '473 PLUM', name: 'Mike Holub', customer: 'Michael Holub', gcId: null, gcName: null, address: '109 Tuscarora', openBalance: 5724, isSub: false, runway: buildLienPayRunway({ ...base, lastWorkYmd: '2026-08-12', expectedPayYmd: '2026-09-30', openBalance: 5724 }) },
  { jobId: 'e', number: '663 PLUM', name: 'Knight', customer: 'Knight Contracting', gcId: 'gc2', gcName: 'Knight Contracting', address: '', openBalance: 658, isSub: true, runway: buildLienPayRunway({ ...base, lastWorkYmd: '2026-07-20', isSub: true, openBalance: 658 }) },
]

describe('LienDeskCalendarTab', () => {
  it('groups: the GC first with its next move, Direct after, Lien gone last and closed', () => {
    const onOpen = vi.fn()
    render(<LienDeskCalendarTab rows={rows} loading={false} onOpenJob={onOpen} />)
    expect(screen.getByText('RMC · Dudley Mason')).toBeTruthy()
    expect(screen.getByText('send the notice · 17 d')).toBeTruthy()
    expect(screen.getByText('Direct — we contracted with the owner')).toBeTruthy()
    expect(screen.getByText('Lien gone')).toBeTruthy()
    expect(screen.queryByText('Knight')).toBeNull() // closed by default
    fireEvent.click(screen.getByRole('button', { name: /Lien gone/ }))
    expect(screen.getByText('Knight')).toBeTruthy()
    expect(screen.getByText(/3 jobs · \$16,182 open · 1 notice owed · 1 lien gone/)).toBeTruthy()
  })

  it('a row opens the job; the search narrows the groups', () => {
    const onOpen = vi.fn()
    render(<LienDeskCalendarTab rows={rows} loading={false} onOpenJob={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: /890 PLUM/ }))
    expect(onOpen).toHaveBeenCalledWith('a')
    fireEvent.change(screen.getByLabelText('Search the lien calendar'), { target: { value: 'holub' } })
    expect(screen.queryByText('RMC · Dudley Mason')).toBeNull()
    expect(screen.getByText('Mike Holub')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the lien calendar'), { target: { value: 'zzz' } })
    expect(screen.getByText('No billed job matches that.')).toBeTruthy()
  })
})
