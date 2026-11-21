// @vitest-environment jsdom
/**
 * The send card of one job's sheet and the sheet's link (punch list #404). Taunya's call of 2026-11-21: a sheet's link
 * closes with the last trade, and the person sees where it stands at all times. The card says under its list how many
 * trades have the sheet and what taking it off a page does to the link, and it tells the link's card to read again
 * after a send or a take-off. Every name here is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { SendParty, SendRecord } from '../../lib/documentBuilder/send'
import { SheetSendCard, type SheetSendIo } from './SheetSendCard'

afterEach(cleanup)

const sent = (id: string): SendRecord => ({ id, contactName: 'Ana Pruitt', contactEmail: 'ana@cedarfork.test', about: null, sentOn: '2026-11-12', sentRevision: 1, timesSent: 1, openedOn: null, openedRevision: null })
const party = (id: string, name: string, over: Partial<SendParty> = {}): SendParty => ({ id, name, page: { state: 'on' }, contacts: [{ name: 'Ana Pruitt', email: 'ana@cedarfork.test' }], send: null, ...over })
const CEDAR = party('cedarfork', 'Cedar Fork Drain', { send: sent('send-cedar') })
const MESA = party('lonemesa', 'Lone Mesa Excavation', { send: sent('send-mesa') })
const PECOS = party('pecos', 'Pecos Insulation')

function draw(parties: SendParty[]) {
  let now = parties
  const io = {
    readParties: vi.fn(async () => now),
    send: vi.fn(),
    takeOff: vi.fn(async (sendId: string) => {
      now = now.map((p) => (p.send?.id === sendId ? { ...p, send: null } : p))
      return { ok: true as const, value: true }
    }),
    turnPageOn: vi.fn(),
  }
  const onLinkMayHaveMoved = vi.fn()
  render(<SheetSendCard builderKey="insurance" projectId="cedar" sheetId="sheet-cedar" revision={1} unread="" onLinkMayHaveMoved={onLinkMayHaveMoved} io={io as unknown as SheetSendIo} />)
  return { io, onLinkMayHaveMoved }
}

const line = () => screen.queryByTestId('sheet-link-with-sends')?.textContent ?? null

describe('SheetSendCard', () => {
  it('says the link stays on while more than one trade has the sheet', async () => {
    draw([CEDAR, MESA, PECOS])
    await screen.findByText('Cedar Fork Drain')
    expect(line()).toBe("2 trades have this sheet. The sheet's link stays on until the sheet is off the last trade's page.")
  })

  it('says nothing of the link while no trade has the sheet', async () => {
    draw([PECOS])
    await screen.findByText('Pecos Insulation')
    expect(line()).toBeNull()
  })

  it('says before the press that the last take-off closes the link, and has the link read again after it', async () => {
    const { io, onLinkMayHaveMoved } = draw([CEDAR, PECOS])
    await screen.findByText('Cedar Fork Drain')
    expect(line()).toBe("1 trade has this sheet. Taking it off their page also switches the sheet's link off.")
    fireEvent.click(screen.getByRole('button', { name: 'Take it off the page of Cedar Fork Drain' }))
    await waitFor(() => expect(io.takeOff).toHaveBeenCalledWith('send-cedar'))
    await waitFor(() => expect(onLinkMayHaveMoved).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(line()).toBeNull())
  })
})
