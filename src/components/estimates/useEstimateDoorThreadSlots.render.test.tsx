// @vitest-environment jsdom
/**
 * The estimate door (v2.5698, punch list #139 PR 7) through the slots: our estimate email whose words repeat the
 * subject draws the door as its body; one with its own words draws it under the line; their email and a text draw
 * none; a press closes the thread and lands on the estimate's page.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { useEstimateDoorThreadSlots } from './useEstimateDoorThreadSlots'

afterEach(cleanup)

const SUBJECT = 'Estimate #166 — Estimate for Evan Johnson — $6,250 · Click Plumbing and Electrical'
const CONTACT = { id: 'c-evan' } as Contact
const message = (set: Partial<ThreadMessage> = {}): ThreadMessage =>
  ({ id: 'm1', contactId: 'c-evan', jobId: null, channel: 'email', direction: 'out', at: '2026-10-20T18:33:00Z', who: 'Taunya', subject: SUBJECT, body: SUBJECT, ...set }) as ThreadMessage

function Harness({ m }: { m: ThreadMessage }) {
  const slots = useEstimateDoorThreadSlots()
  return (
    <div>
      <div data-testid="body">{slots.lineBody?.(m, CONTACT) ?? 'words'}</div>
      <div data-testid="under">{slots.underLine?.(m, CONTACT) ?? null}</div>
    </div>
  )
}

const mount = (m: ThreadMessage) =>
  renderWithProviders(
    <>
      <Harness m={m} />
      <Routes>
        <Route path="/estimates/:n" element={<div data-testid="estimate-page">the estimate page</div>} />
        <Route path="*" element={null} />
      </Routes>
    </>,
  )

describe('useEstimateDoorThreadSlots', { timeout: 15_000 }, () => {
  it('draws the door in place of words that only repeat the subject, and a press lands on the estimate', async () => {
    mount(message())
    const body = screen.getByTestId('body')
    expect(body.textContent).toBe('📄 Open estimate #166')
    expect(screen.getByTestId('under').textContent).toBe('')
    fireEvent.click(screen.getByTestId('estimate-door'))
    expect(await screen.findByTestId('estimate-page')).toBeTruthy()
  })
  it('draws it under the line when the email has words of its own', () => {
    mount(message({ body: 'Evan, here it is.\nEstimate #166 …' }))
    expect(screen.getByTestId('body').textContent).toBe('words')
    expect(screen.getByTestId('under').textContent).toBe('📄 Open estimate #166')
  })
  it('draws none on their email or on a text', () => {
    mount(message({ direction: 'in' }))
    expect(screen.queryByTestId('estimate-door')).toBeNull()
    cleanup()
    mount(message({ channel: 'text', subject: null, body: 'Evan, your estimate: https://clicktooling.com/estimate/accept?t=abc' }))
    expect(screen.queryByTestId('estimate-door')).toBeNull()
  })
})
