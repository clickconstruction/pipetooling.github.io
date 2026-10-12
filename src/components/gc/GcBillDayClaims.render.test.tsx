// @vitest-environment jsdom
/**
 * The daily log's Claims to check (Messages cut 9, wave 2): the walk of Lone Star's draw 2 on Stone Oak in walking order,
 * a tap that becomes what we see, the photo-or-note rule under the claim, the line that says when the list comes off the
 * checking days, and never a dollar anywhere it draws. The reads are mocked; the kernels are real.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/gc/billDay/billDayIo', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/gc/billDay/billDayIo')>()
  return { ...real, loadLineChecks: vi.fn(), loadBillDayNothing: vi.fn(), loadWhereOnSite: vi.fn(), loadBillDayCutoff: vi.fn(), recordLineCheck: vi.fn() }
})

import { loadBillDayCutoff, loadBillDayNothing, loadLineChecks, loadWhereOnSite, recordLineCheck, type LineCheckRow } from '../../lib/gc/billDay/billDayIo'
import { NO_DRAWS, type DrawTables } from '../../lib/gc/drawRows'
import { billDayJob, billDayState, WENDI_WALK, WHERE_ON_SITE } from '../../test/fixtures/billDayDemo'
import { installDomShims } from '../../test/renderSmokeMocks'
import { GcBillDayClaims } from './GcBillDayClaims'

installDomShims()

const drawTablesOf = (state: ReturnType<typeof billDayState>): DrawTables => ({
  ...NO_DRAWS,
  sowLines: state.projects.flatMap((p) => p.packages.flatMap((k) => (k.sow?.sov ?? []).map((l, i) => ({ id: l.id, sow_id: k.sow?.id ?? '', position: i, scope_item_id: null })))),
})
const rowOf = (c: (typeof WENDI_WALK)[number], i: number): LineCheckRow => ({
  id: `c${i}`,
  draw_id: c.drawId,
  sow_line_id: c.sovId,
  we_see_pct: c.weSee,
  stored_on_site: c.onSite,
  photo_url: c.photo ? 'https://drive.example.test/photo' : null,
  note: c.note,
  checked_by: c.by,
  checked_at: c.at,
  seq: i + 1,
})

beforeEach(() => {
  vi.mocked(loadLineChecks).mockResolvedValue([])
  vi.mocked(loadBillDayNothing).mockResolvedValue([])
  vi.mocked(loadWhereOnSite).mockResolvedValue(Object.entries(WHERE_ON_SITE).map(([id, where]) => ({ id, scope_item_id: null, where_on_site: where })))
  vi.mocked(loadBillDayCutoff).mockResolvedValue(6)
  vi.mocked(recordLineCheck).mockResolvedValue('c9')
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function show(today: string) {
  const state = billDayState(today)
  const project = billDayJob(state, 'stoneoak')
  render(<GcBillDayClaims state={state} project={project} drawTables={drawTablesOf(state)} />)
}
const claim = (key: string) => document.querySelector(`[data-bill-day-claim="${key}"]`) as HTMLElement

describe('GcBillDayClaims (the daily log’s Claims to check)', () => {
  it('lists the claims in walking order on a checking day, with the claim, the last draw and the schedule', async () => {
    show('2026-10-22')
    await waitFor(() => expect(document.querySelector('[data-bill-day-claims]')).not.toBeNull())
    expect(document.querySelector('[data-bill-day-claims]')?.textContent).toContain('pay application 4 · 3 lines on 1 draw · by Fri Oct 23')
    expect(document.querySelector('[data-bill-day-claims-count]')?.textContent).toBe('3 to tap')
    expect([...document.querySelectorAll('[data-bill-day-claim]')].map((c) => c.getAttribute('data-bill-day-claim'))).toEqual(['ls-2:ls-equip:stored', 'ls-2:ls-l1:work', 'ls-2:ls-l2:work'])
    expect(claim('ls-2:ls-l1:work').textContent).toContain('claims 90%, last draw 40%, schedule 78% by Oct 25')
    expect(within(claim('ls-2:ls-l1:work')).getAllByRole('button').map((b) => b.textContent)).toEqual(['90%', '75%', '65%', '…'])
  })

  it('keeps a tap, then asks for a photo or a note under the claim', async () => {
    show('2026-10-22')
    await waitFor(() => expect(claim('ls-2:ls-l1:work')).not.toBeNull())
    vi.mocked(loadLineChecks).mockResolvedValue([rowOf({ ...WENDI_WALK[0]!, photo: false, note: '' }, 0)])
    fireEvent.click(within(claim('ls-2:ls-l1:work')).getByRole('button', { name: '75%' }))
    await waitFor(() => expect(recordLineCheck).toHaveBeenCalledWith({ drawId: 'ls-2', sovId: 'ls-l1', weSee: 75, onSite: null }))
    await waitFor(() => expect(claim('ls-2:ls-l1:work').querySelector('[data-bill-day-needs]')).not.toBeNull())
    const needs = claim('ls-2:ls-l1:work').querySelector('[data-bill-day-needs]') as HTMLElement
    expect(needs.textContent).toContain('75% is under the 90% claimed. A photo or a note says why.')
    fireEvent.change(within(needs).getByLabelText('Or a note: what is not there'), { target: { value: 'East wing branch lines not hung.' } })
    fireEvent.click(within(needs).getByRole('button', { name: 'Keep it' }))
    await waitFor(() => expect(recordLineCheck).toHaveBeenLastCalledWith({ drawId: 'ls-2', sovId: 'ls-l1', weSee: 75, onSite: null, photoUrl: '', note: 'East wing branch lines not hung.' }))
  })

  it('says every line is tapped once Wendi walked, and never shows a dollar', async () => {
    vi.mocked(loadLineChecks).mockResolvedValue(WENDI_WALK.map(rowOf))
    show('2026-10-22')
    await waitFor(() => expect(document.querySelector('[data-bill-day-claims-count]')?.textContent).toBe('every line tapped'))
    expect(document.body.textContent).toContain("Every claim is checked. The office's gate clears by itself.")
    expect(document.body.textContent).not.toContain('$')
  })

  it('says when the list comes off the checking days, and shows it on asking', async () => {
    show('2026-10-02')
    await waitFor(() => expect(document.querySelector('[data-bill-day-claims]')).not.toBeNull())
    expect(document.body.textContent).toContain('The list comes on the checking days, Mon Oct 19 to Fri Oct 23, with a text on the first.')
    expect(document.querySelector('[data-bill-day-claim]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the list now' }))
    expect(document.querySelectorAll('[data-bill-day-claim]')).toHaveLength(3)
  })

  it('draws nothing on a job with no draw waiting on us', async () => {
    const state = billDayState('2026-10-22')
    render(<GcBillDayClaims state={state} project={billDayJob(state, 'helotes')} drawTables={drawTablesOf(state)} />)
    await waitFor(() => expect(loadBillDayCutoff).toHaveBeenCalled())
    expect(document.querySelector('[data-bill-day-claims]')).toBeNull()
  })
})
