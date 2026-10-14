// @vitest-environment jsdom
/**
 * The speech bubble beside a customer's name (residential R2, PR 3b): the office team sees it, anyone else and a screen
 * with no sign-in draw nothing; a press finds or makes the customer's own contact, runs `onOpen`, and opens their
 * thread over the Messages page; a refusal says its words and leaves the page where it was; the row under it never
 * hears the press; on a list its box is at least 24 px each way (v2.5518).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

const auth = vi.hoisted(() => ({ value: { role: 'assistant' } as { role: string } | null }))
vi.mock('../../hooks/useAuth', () => ({
  useOptionalAuth: () => auth.value,
  useAuth: () => auth.value,
}))
const io = vi.hoisted(() => ({ contactForCustomer: vi.fn<(id: string) => Promise<string>>() }))
vi.mock('../../lib/messages/messagesIo', () => ({ contactForCustomer: io.contactForCustomer }))

import { MESSAGES_BUTTON_MIN_HIT, MessagesButton } from './MessagesButton'
import { renderWithProviders } from '../../test/renderSmokeMocks'

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname + l.search}</output>
}

beforeEach(() => {
  auth.value = { role: 'assistant' }
  io.contactForCustomer.mockReset()
})

describe('MessagesButton', () => {
  it('draws nothing for a superintendent, a primary, or with no sign-in', () => {
    for (const value of [{ role: 'superintendent' }, { role: 'primary' }, null]) {
      auth.value = value
      document.body.innerHTML = ''
      renderWithProviders(<MessagesButton customerId="cu-dana" customerName="Dana Whitfield" />)
      expect(screen.queryByLabelText('Open Dana Whitfield’s messages')).toBeNull()
    }
  })

  it('opens the customer’s thread over Messages, after the window it sits in closes, and the row never hears it', async () => {
    io.contactForCustomer.mockResolvedValue('c-dana')
    const onOpen = vi.fn()
    const onRow = vi.fn()
    renderWithProviders(
      <>
        <div onClick={onRow}>
          <MessagesButton customerId="cu-dana" customerName=" Dana Whitfield " onOpen={onOpen} />
        </div>
        <Where />
      </>,
    )
    fireEvent.click(screen.getByLabelText('Open Dana Whitfield’s messages'))
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/messages?thread=c-dana'))
    expect(io.contactForCustomer).toHaveBeenCalledWith('cu-dana')
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onRow).not.toHaveBeenCalled()
  })

  it('gives a thumb at least 24 px each way on a list, the bubble still 15 px and the row’s room given back', () => {
    renderWithProviders(<MessagesButton customerId="cu-dana" customerName="Dana Whitfield" />)
    const btn = screen.getByLabelText('Open Dana Whitfield’s messages')
    expect(btn.style.minWidth).toBe(`${MESSAGES_BUTTON_MIN_HIT}px`)
    expect(btn.style.minHeight).toBe(`${MESSAGES_BUTTON_MIN_HIT}px`)
    expect(MESSAGES_BUTTON_MIN_HIT).toBe(24)
    expect(btn.style.boxSizing).toBe('border-box')
    // 15 px and 2 px of padding each side is 19: the 5 px it grows by come back as a margin of 2.5 px each way.
    expect(btn.style.margin).toBe('-2.5px')
    expect(btn.querySelector('svg')!.getAttribute('width')).toBe('15')
  })

  it('leaves a caller’s own tile to size itself, with no margin taken back', () => {
    renderWithProviders(<MessagesButton customerId="cu-dana" customerName="Dana Whitfield" size={18} style={{ width: 40, height: 40 }} />)
    const btn = screen.getByLabelText('Open Dana Whitfield’s messages')
    expect(btn.style.width).toBe('40px')
    expect(btn.style.minHeight).toBe('24px')
    expect(btn.style.margin).toBe('')
  })

  it('says a refusal in its words and stays on the page', async () => {
    io.contactForCustomer.mockRejectedValue(new Error('A training account cannot start a customer’s thread.'))
    const onOpen = vi.fn()
    renderWithProviders(
      <>
        <MessagesButton customerId="cu-joe" customerName="Joe Ruiz" onOpen={onOpen} />
        <Where />
      </>,
    )
    fireEvent.click(screen.getByLabelText('Open Joe Ruiz’s messages'))
    expect(await screen.findByText(/A training account cannot start a customer’s thread\./)).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('/')
    expect(onOpen).not.toHaveBeenCalled()
  })
})
