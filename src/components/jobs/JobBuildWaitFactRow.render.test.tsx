// @vitest-environment jsdom
/**
 * The job window's fact row for a Build job that waits (punch list #192, write A, v2.8726): nothing on a job that
 * does not wait, the day, the reason and the name drawn as values, **Lift the wait** for the office alone, the row
 * leaving once the lift lands, and a refusal said under the row. Made-up jobs over a stood-in io.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobBuildWaitFactRow } from './JobBuildWaitFactRow'
import { BUILD_WAITS_CHANGED_EVENT } from '../../lib/bridge/build/buildWaitsIo'
import type { BuildWait } from '../../lib/bridge/build/buildWaits'

const wait = (over: Partial<BuildWait> = {}): BuildWait => ({ jobId: 'j878', reason: 'gc_not_ready', note: '', sinceYmd: '2026-10-26', markedByName: 'Dana Office', ...over })

/** A stood-in io whose lift ends the wait and tells the page to read again, as the real one does. */
function stoodIn(first: BuildWait | null, liftAnswer: () => Promise<void> = async () => {}) {
  let now = first
  const loadOpenForJob = vi.fn(async (_jobId: string) => now)
  const lift = vi.fn(async (_jobId: string) => {
    await liftAnswer()
    now = null
    window.dispatchEvent(new Event(BUILD_WAITS_CHANGED_EVENT))
  })
  return { loadOpenForJob, lift }
}

afterEach(cleanup)

describe('JobBuildWaitFactRow', () => {
  it('draws nothing on a job that does not wait', async () => {
    const io = stoodIn(null)
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift io={io} />)
    await waitFor(() => expect(io.loadOpenForJob).toHaveBeenCalledWith('j878'))
    expect(screen.queryByTestId('job-build-wait-fact')).toBeNull()
  })

  it('says since when, why and who, each as a value apart from the words', async () => {
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift io={stoodIn(wait({ note: 'Slab pour moved a week.' }))} />)
    const row = await screen.findByTestId('job-build-wait-fact')
    expect(row.textContent).toContain('Waits')
    const words = screen.getByTestId('job-build-wait-words')
    expect(words.textContent).toBe('Since Oct 26 · the GC is not ready for us · Dana')
    expect(Array.from(words.querySelectorAll('[data-value="worked-out"]')).map((b) => b.textContent)).toEqual(['Oct 26', 'the GC is not ready for us', 'Dana'])
    expect(screen.getByTestId('job-build-wait-note').textContent).toBe('Slab pour moved a week.')
    expect(screen.getByRole('button', { name: 'Lift the wait' })).toBeTruthy()
  })

  it('another reason is the person’s own words, said once', async () => {
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift io={stoodIn(wait({ reason: 'other', note: 'The permit is with the city.' }))} />)
    expect((await screen.findByTestId('job-build-wait-words')).textContent).toBe('Since Oct 26 · The permit is with the city · Dana')
    expect(screen.queryByTestId('job-build-wait-note')).toBeNull()
  })

  it('someone outside the office reads the row and gets no press', async () => {
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift={false} io={stoodIn(wait())} />)
    await screen.findByTestId('job-build-wait-fact')
    expect(screen.queryByTestId('job-build-wait-lift')).toBeNull()
  })

  it('Lift the wait lifts it, says so, and the row leaves', async () => {
    const io = stoodIn(wait())
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift io={io} />)
    fireEvent.click(await screen.findByTestId('job-build-wait-lift'))
    await waitFor(() => expect(screen.queryByTestId('job-build-wait-fact')).toBeNull())
    expect(io.lift).toHaveBeenCalledTimes(1)
    expect(io.lift).toHaveBeenCalledWith('j878')
    expect(await screen.findByText('The wait on 878 · ZZ Test Job is lifted. It counts on the Build desk again.')).toBeTruthy()
  })

  it('a lift the database refuses keeps the row and says the reason under it', async () => {
    const io = stoodIn(wait(), async () => {
      throw new Error('Only the office marks a job waiting or lifts a wait.')
    })
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift io={io} />)
    fireEvent.click(await screen.findByTestId('job-build-wait-lift'))
    expect((await screen.findByRole('alert')).textContent).toBe('Only the office marks a job waiting or lifts a wait.')
    expect(screen.getByTestId('job-build-wait-fact')).toBeTruthy()
    expect((screen.getByTestId('job-build-wait-lift') as HTMLButtonElement).disabled).toBe(false)
  })

  it('a wait marked elsewhere on the page shows without a reload', async () => {
    let now: BuildWait | null = null
    const io = { loadOpenForJob: vi.fn(async () => now), lift: vi.fn(async () => {}) }
    renderWithProviders(<JobBuildWaitFactRow jobId="j878" jobLabel="878 · ZZ Test Job" canLift io={io} />)
    await waitFor(() => expect(io.loadOpenForJob).toHaveBeenCalledTimes(1))
    now = wait({ reason: 'materials' })
    window.dispatchEvent(new Event(BUILD_WAITS_CHANGED_EVENT))
    expect((await screen.findByTestId('job-build-wait-words')).textContent).toBe('Since Oct 26 · waiting on materials · Dana')
  })
})
