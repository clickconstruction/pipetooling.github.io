// @vitest-environment jsdom
/**
 * Render smoke for the walk tester's line (punch list #142 PR 3, v2.5738): the two states the card shows, read through
 * the io the card is handed, and the words it says when the read fails. Nothing here presses anything.
 */
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderSettled } from '../../test/renderSmokeMocks'
import WalkTesterLine from './WalkTesterLine'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const tester = { id: 'u-tester', email: 'walk-tester@walk.pipetooling.local', read_only: true, last_sign_in_at: '2026-10-20T15:00:00.000Z' }
const kit = JSON.stringify({ customerId: 'cu', contactId: 'c', email: 'bids@x.example', madeAt: '2026-10-22T14:00:00.000Z' })

describe('WalkTesterLine', () => {
  it('says there is no walk tester yet', async () => {
    const load = vi.fn(async () => ({ tester: null, kitValueText: null }))
    const { loaded } = await renderSettled(<WalkTesterLine load={load} />, { loaded: () => screen.findByText('No walk tester yet. The walk kit makes one on its first run.') })
    expect(loaded).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('names the tester, its mode and its last walk', async () => {
    const load = vi.fn(async () => ({ tester, kitValueText: kit }))
    const { loaded } = await renderSettled(<WalkTesterLine load={load} />, { loaded: () => screen.findByText('Walk tester · training mode · last walk Oct 22') })
    expect(loaded.getAttribute('aria-label')).toBe('Walk tester')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says when the read fails, instead of staying on Loading', async () => {
    const load = vi.fn(async () => {
      throw new Error('refused')
    })
    await renderSettled(<WalkTesterLine load={load} />, { loaded: () => screen.findByText('The walk tester could not be read.') })
  })
})
