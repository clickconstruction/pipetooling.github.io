// @vitest-environment jsdom
/**
 * Render smoke for the send of a builder to GCs (punch list #404, step 9): the card reads the GCs, a send names the
 * builder, the customer, the person and the job it is about, the one press asks first by its count, and a read that
 * fails says why. The list's own rules are held by `BuilderSendList.render.test.tsx`. Every name is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'dev', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { SendParty } from '../../lib/documentBuilder/send'
import { BUILDER_SEND_NOTE } from '../../lib/documentBuilder/sendWords'
import { BuilderGcSendCard, type BuilderGcSendIo } from './BuilderGcSendCard'

afterEach(cleanup)

const GCS: SendParty[] = [
  { id: 'northgate', name: 'Northgate Builders', sub: '2 jobs with you', page: { state: 'on' }, contacts: [{ name: 'Dana Whitlock', email: 'dana@northgate.test' }], jobs: [{ id: 'j1', label: 'Pike Street clinic · Job 1180' }, { id: 'j2', label: 'Harbor annex · Job 1204' }], send: null },
  { id: 'harlan', name: 'Harlan Construction', sub: '1 job with you', page: { state: 'on' }, contacts: [{ name: 'Lee Okafor', email: 'lee@harlan.test' }], jobs: [{ id: 'j3', label: 'Mill Road shell · Job 1190' }], send: null },
]

function draw(over: Partial<BuilderGcSendIo> = {}, props: { revision?: number; unread?: string } = {}) {
  const io = {
    readParties: vi.fn(async () => GCS),
    send: vi.fn(async () => ({ ok: true as const, value: { test: true as const, email: '' } })),
    takeOff: vi.fn(async () => ({ ok: true as const, value: true as const })),
    turnPageOn: vi.fn(async () => ({ ok: true as const, value: true as const })),
    ...over,
  }
  renderWithProviders(<BuilderGcSendCard builderKey="sub-nda" revision={props.revision ?? 2} unread={props.unread ?? ''} io={io as unknown as BuilderGcSendIo} />)
  return io
}

describe('BuilderGcSendCard', () => {
  it('lists the GCs, each with how many jobs they have with us', async () => {
    const io = draw()
    expect(await screen.findByText('Send it to a GC')).toBeTruthy()
    expect(io.readParties).toHaveBeenCalledWith('sub-nda')
    expect(screen.getByText('Northgate Builders')).toBeTruthy()
    expect(screen.getByText('2 jobs with you')).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Find a GC' })).toBeTruthy()
  })

  it('sends the builder to one person at a GC, about the job that was picked, then reads the rows again', async () => {
    const io = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Send it to Northgate Builders' }))
    expect((screen.getByRole('textbox', { name: 'A note to them' }) as HTMLTextAreaElement).value).toBe(BUILDER_SEND_NOTE)
    fireEvent.change(screen.getByRole('combobox', { name: 'What it is about' }), { target: { value: 'j2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to Dana' }))
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(1))
    expect(io.send).toHaveBeenCalledWith({ builderKey: 'sub-nda', customerId: 'northgate', aboutJobId: 'j2', contactEmail: 'dana@northgate.test', note: BUILDER_SEND_NOTE, why: 'first', anyway: false })
    await waitFor(() => expect(io.readParties).toHaveBeenCalledTimes(2))
  })

  it('asks before the one press sends to every GC, by its count, and sends nothing on Cancel', async () => {
    const io = draw()
    fireEvent.click(await screen.findByRole('button', { name: 'Send to 2 GCs who are ready' }))
    expect(await screen.findByText('Send to 2 GCs? Each gets an email now, about all their jobs with you.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText(/Each gets an email now/)).toBeNull())
    expect(io.send).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Send to 2 GCs who are ready' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send to 2 GCs' }))
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(2))
    expect(vi.mocked(io.send).mock.calls.map((c) => c[0])).toMatchObject([{ customerId: 'northgate', aboutJobId: null }, { customerId: 'harlan', aboutJobId: null }])
  })

  it('is dead until the builder is published, and holds an unread revision until Send it anyway is ticked', async () => {
    draw({}, { revision: 0 })
    expect(((await screen.findByRole('button', { name: 'Send to 2 GCs who are ready' })) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Publish the builder first.')).toBeTruthy()
    cleanup()
    draw({}, { unread: 'No attorney has read revision 2.' })
    expect(((await screen.findByRole('button', { name: 'Send to 2 GCs who are ready' })) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'No attorney has read revision 2. Send it anyway.' }))
    expect((screen.getByRole('button', { name: 'Send to 2 GCs who are ready' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('says why the GCs did not read', async () => {
    draw({ readParties: vi.fn(async () => Promise.reject(new Error('a made-up reason'))) })
    expect(await screen.findByText(/a made-up reason/)).toBeTruthy()
  })

  it('says so with no GC on any job', async () => {
    draw({ readParties: vi.fn(async () => []) })
    expect(await screen.findByText('No customer is the GC on a job yet. A GC shows here once a job names them as its GC.')).toBeTruthy()
  })
})
