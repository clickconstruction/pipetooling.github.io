// @vitest-environment jsdom
/**
 * Render smoke for Jobs → Subs → Work (v2.2927): mounts against the stubbed
 * client, paints the tiles and the empty board, and offers + New work order.
 * Guards crash-on-mount, not behavior.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { JobsSubsWorkView } from './JobsSubsWorkView'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('JobsSubsWorkView', () => {
  it('mounts, loads, and shows the empty board with the tiles', async () => {
    renderWithProviders(<JobsSubsWorkView jobs={[]} jobsLoading={false} authUserId="u-1" deepLinkWorkOrderId={null} onDeepLinkConsumed={vi.fn()} />)
    expect(screen.getByText('+ New work order')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/Nothing on the board/)).toBeTruthy())
    expect(screen.getByText('Stages waiting')).toBeTruthy()
    expect(screen.getByText('On a handshake')).toBeTruthy()
  })
})
