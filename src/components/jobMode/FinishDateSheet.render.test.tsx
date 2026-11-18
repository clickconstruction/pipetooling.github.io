// @vitest-environment jsdom
/**
 * My finish date's window (punch list #396, PR 3): quick picks around the day in force, a date box for any other
 * day, a line for what is in the way, and one save in his own name. Held here: what it opens on, what a pick and
 * the date box save, a day already gone, and a refused save that keeps the window and the words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

const saved: unknown[] = []
let saveFails: { message: string } | null = null
vi.mock('../../lib/jobMode/finishCallIo', () => ({
  saveFinishCall: (input: unknown) => {
    if (saveFails) return Promise.reject(saveFails)
    saved.push(input)
    return Promise.resolve()
  },
}))
// The window's today: a Wednesday, two days before the plan's Friday.
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-18' }))

async function mount(props: { plannedYmd: string | null; saidYmd?: string | null; saidWhy?: string | null }) {
  const { renderWithProviders } = await import('../../test/renderSmokeMocks')
  const { FinishDateSheet } = await import('./FinishDateSheet')
  const onClose = vi.fn()
  const onSaved = vi.fn()
  renderWithProviders(<FinishDateSheet jobId="job-1" plannedYmd={props.plannedYmd} saidYmd={props.saidYmd ?? null} saidWhy={props.saidWhy ?? null} onClose={onClose} onSaved={onSaved} />)
  return { onClose, onSaved }
}

afterEach(() => {
  cleanup()
  saved.length = 0
  saveFails = null
})

describe('FinishDateSheet', () => {
  it('opens on the plan’s day, with the working days either side, and saves a pick with what is in the way', async () => {
    const { onClose, onSaved } = await mount({ plannedYmd: '2026-11-20' })
    const picks = screen.getAllByTestId('finish-date-pick')
    expect(picks.map((p) => [p.textContent, p.getAttribute('aria-pressed')])).toEqual([['Thu, Nov 19', 'false'], ['Fri, Nov 20, the plan', 'true'], ['Mon, Nov 23', 'false']])
    expect(screen.queryByTestId('finish-date-day')).toBeNull()
    fireEvent.click(picks[2]!)
    fireEvent.change(screen.getByTestId('finish-date-why'), { target: { value: 'Waiting on the inspector' } })
    const save = screen.getByTestId('finish-date-save') as HTMLButtonElement
    expect(save.textContent).toBe('Save my date')
    fireEvent.click(save)
    await waitFor(() => expect(saved).toEqual([{ jobId: 'job-1', finishOn: '2026-11-23', planWas: '2026-11-20', why: 'Waiting on the inspector' }]))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onSaved).toHaveBeenCalled()
  })

  it('opens on his own last word, with what he said was in the way', async () => {
    await mount({ plannedYmd: '2026-11-20', saidYmd: '2026-11-25', saidWhy: 'Two more days of top-out' })
    const on = screen.getAllByTestId('finish-date-pick').filter((p) => p.getAttribute('aria-pressed') === 'true')
    expect(on.map((p) => p.textContent)).toEqual(['Wed, Nov 25'])
    expect((screen.getByTestId('finish-date-why') as HTMLInputElement).value).toBe('Two more days of top-out')
  })

  it('Another day opens the date box, and a day already gone is not saved', async () => {
    await mount({ plannedYmd: '2026-11-20' })
    fireEvent.click(screen.getByTestId('finish-date-another'))
    const box = screen.getByTestId('finish-date-day') as HTMLInputElement
    expect(box.min).toBe('2026-11-18')
    fireEvent.change(box, { target: { value: '2026-11-10' } })
    expect((screen.getByTestId('finish-date-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByTestId('finish-date-save'))
    await waitFor(() => expect(saved).toEqual([{ jobId: 'job-1', finishOn: '2026-12-01', planWas: '2026-11-20', why: '' }]))
  })

  it('with no planned finish it opens on the date box, and Save waits for a day', async () => {
    await mount({ plannedYmd: null })
    expect(screen.queryAllByTestId('finish-date-pick')).toHaveLength(0)
    expect(screen.getByTestId('finish-date-day')).toBeTruthy()
    expect((screen.getByTestId('finish-date-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the window and the words when the save is refused, and says why', async () => {
    saveFails = { message: 'new row violates row-level security policy' }
    const { onClose } = await mount({ plannedYmd: '2026-11-20' })
    fireEvent.change(screen.getByTestId('finish-date-why'), { target: { value: 'Rain' } })
    fireEvent.click(screen.getByTestId('finish-date-save'))
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByTestId('finish-date-why') as HTMLInputElement).value).toBe('Rain')
    expect((screen.getByTestId('finish-date-save') as HTMLButtonElement).disabled).toBe(false)
  })
})
