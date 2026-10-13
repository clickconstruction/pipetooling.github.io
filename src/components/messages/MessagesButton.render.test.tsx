// @vitest-environment jsdom
/**
 * The speech bubble beside a customer's name (residential R2, PR 3b): the office team sees it, anyone else and a screen
 * with no sign-in draw nothing; a press finds or makes the customer's own contact, runs `onOpen`, and opens their
 * thread over the Messages page; a refusal says its words and leaves the page where it was; the row under it never
 * hears the press.
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

import { MessagesButton } from './MessagesButton'
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
