// @vitest-environment jsdom
/**
 * Render smoke for the list behind the bar (punch list #163 PR 2): the three sections and their
 * presses; Drop it, Send now and Got it write the store. The rows' words are the kernel's
 * (`src/lib/offline/outbox.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { markRefused, markSent, markSending, markTryFailed, newPress } from '../lib/offline/outbox'
import { createOutboxState } from '../lib/offline/outboxState'
import { OutboxDoor } from './OutboxDoor'

const quietIo = { readAll: async () => [], write: async () => {}, del: async () => {}, clear: async () => {} }

describe('OutboxDoor render smoke', () => {
  it('lists Needs you, Waiting and Sent today, and the presses act on the store', async () => {
    const now = Date.now()
    const box = createOutboxState(quietIo)
    box.put(markRefused(newPress({ id: 'r', seq: 1, kind: 'clock-in', userId: 'u1', pressedAt: now - 3_600_000, payload: { jobLedgerId: 'j1', bidId: null, notes: '', travel: null }, about: 'Ridgeway Builders', door: '/dashboard' }), { message: 'The office closed that session at 8:05 AM.', code: 'P0001' }))
    box.put(markTryFailed(markSending(newPress({ id: 'w', seq: 2, kind: 'job-note', userId: 'u1', pressedAt: now - 600_000, payload: { jobId: 'j1', body: 'x' }, about: 'Ridgeway Builders' }), now - 5_000), now - 5_000))
    box.put(markSent(newPress({ id: 's', seq: 3, kind: 'field-report', userId: 'u1', pressedAt: now - 300_000, payload: { templateId: 't', fieldValues: {}, jobLedgerId: 'j1', projectId: null, bidId: null, lat: null, lng: null }, about: 'Ridgeway Builders' }), {}, now - 60_000))
    const onClose = vi.fn()
    const onSendNow = vi.fn()
    renderWithProviders(<OutboxDoor store={box} onClose={onClose} onSendNow={onSendNow} />)
    expect(await screen.findByText('Needs you')).toBeTruthy()
    expect(screen.getByText('Waiting')).toBeTruthy()
    expect(screen.getByText('Sent today')).toBeTruthy()
    expect(screen.getByText('The office closed that session at 8:05 AM.')).toBeTruthy()
    expect(screen.getByTestId('outbox-row-w').textContent).toContain('waiting to send, last tried')
    expect(screen.getByTestId('outbox-row-s').textContent).toContain('Field report')

    fireEvent.click(screen.getByRole('button', { name: 'Send now' }))
    expect(onSendNow).toHaveBeenCalledTimes(1)
    expect(box.presses().find((p) => p.id === 'w')?.attempts).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(box.presses().find((p) => p.id === 's')?.seen).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Fix' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(box.presses().find((p) => p.id === 'r')?.seen).toBe(true)

    const drops = screen.getAllByRole('button', { name: 'Drop it' })
    fireEvent.click(drops[0]!)
    expect(box.presses().some((p) => p.id === 'r')).toBe(false)
  })

  it('says nothing waits when the queue is empty', async () => {
    const box = createOutboxState(quietIo)
    renderWithProviders(<OutboxDoor store={box} onClose={() => {}} onSendNow={() => {}} />)
    expect((await screen.findByText(/Nothing waiting on the phone/)).textContent).toContain('Every press has reached the office.')
  })
})
