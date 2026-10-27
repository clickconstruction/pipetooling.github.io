// @vitest-environment jsdom
/**
 * Render smoke for the Bid Board's per-GC lines (v2.5977). On the phone card the
 * room chip sits outside the line's no-wrap group, so a chip that doesn't fit drops
 * to its own line instead of pushing the card (and the page) sideways. The desk
 * table keeps its one no-wrap line. jsdom can't measure layout, so this pins the
 * structure that makes the wrap possible; the live 375px check is in the fragment.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { BidBoardGcLines } from './BidBoardGcRows'
import type { GcPacket } from '../../lib/bids/gcPackets'
import type { BidRoomStateSummary } from '../../lib/bids/bidRoomState'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})

afterEach(() => cleanup())

const packet: GcPacket = {
  key: 'gc-1',
  gcId: 'gc-1',
  name: 'General contractor',
  versions: [{ id: 'v1', name: 'Base', customer_id: 'gc-1', sort_order: 0 }],
  sentOn: '2026-09-03',
  sentValue: null,
  outcome: null,
}

const room: BidRoomStateSummary = {
  roomId: 'room-1',
  gcId: 'gc-1',
  closed: false,
  revNumber: 1,
  everSent: false,
  viewCount: 2,
  lastViewAt: '2026-09-03T15:00:00Z',
  outcome: null,
  outcomeAt: null,
  outcomeMeta: {},
  coPending: 0,
  coSigned: 0,
}

async function renderLines(variant: { phone?: boolean; dense?: boolean }) {
  renderWithProviders(
    <BidBoardGcLines bidId="b398" bidOutcome={null} packets={[packet]} onChanged={() => {}} roomStates={{ 'gc-1': room }} {...variant} />,
  )
  await settle()
  return {
    chip: screen.getByText(/^rev 1 · opened 2×/),
    name: screen.getByRole('button', { name: 'General contractor' }),
  }
}

describe('BidBoardGcLines', () => {
  it('on the phone card, keeps the room chip out of the no-wrap group so it can drop a line', async () => {
    const { chip, name } = await renderLines({ phone: true })
    const group = name.parentElement!
    expect(group.style.flexWrap).toBe('nowrap')
    expect(group.contains(chip)).toBe(false)
    expect(chip.parentElement).toBe(group.parentElement)
    expect(chip.parentElement!.style.flexWrap).toBe('wrap')
    // A label longer than the card ends in an ellipsis at the card's edge.
    expect(chip.style.maxWidth).toBe('100%')
    expect(chip.style.textOverflow).toBe('ellipsis')
  })

  it('in the desk table, keeps one no-wrap line with the chip at its end', async () => {
    const { chip, name } = await renderLines({ dense: true })
    expect(chip.parentElement).toBe(name.parentElement)
    expect(chip.parentElement!.style.flexWrap).toBe('nowrap')
    expect(chip.style.maxWidth).toBe('')
  })
})
