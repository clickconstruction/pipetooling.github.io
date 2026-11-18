// @vitest-environment jsdom
/**
 * Text the customer… on the share sheet (punch list #345, named Text it… until #394): for the
 * office, on a map that is on a job, the press opens the customer's own box on Text with the map's
 * name and the link in it, tied to the job. Nothing is sent in the press. On a map with no job the
 * press keeps its place, dead, and says why. Nobody outside the office is offered one. Sam and the
 * Oak Street job are made up; nothing is a real row.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Contact } from '../../lib/contacts/kernel'
import type { ReplyIo } from '../../lib/messages/replyIo'
import type { PaintedMapTextJob } from '../../lib/paintedMap/paintedMapText'
import { renderWithProviders } from '../../test/renderSmokeMocks'

vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <svg data-testid="qr" /> }))
vi.mock('../gc/messages/reply/useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const link = vi.hoisted(() => ({ held: true, minted: 0 }))
vi.mock('../../lib/paintedMap/paintedMapLinkIo', () => ({
  loadPaintedMapVisits: async () => ({ ok: true, value: [] }),
  loadPaintedMapLinks: async () => ({ ok: true, value: link.held || link.minted > 0 ? [{ id: 'link-0', made_at: '2026-11-10T16:00:00Z', expires_at: '2999-01-01T00:00:00Z', ended_at: null, open_count: 0 }] : [] }),
  mintPaintedMapLink: async () => {
    link.minted += 1
    return { code: 'q7m2kd4x9p', endsOn: null }
  },
  endPaintedMapLinks: async () => 1,
  rememberPaintedMapLink: () => {},
  rememberedPaintedMapLink: () => (link.held ? { code: 'q7m2kd4x9p', endsOn: '2027-02-11' } : null),
}))

import { PaintedMapShareSheet } from './PaintedMapShareSheet'

afterEach(() => {
  cleanup()
  link.held = true
  link.minted = 0
})

const SAM: Contact = {
  id: 'c-sam',
  kind: 'customer',
  name: 'Sam Sample',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-sam' },
  channels: [{ id: 'ch-cell', kind: 'phone', value: '512-555-0199', optedOutAt: null }],
  jobIds: ['pipeline:j-oak'],
  defaultJobId: null,
  customerId: 'cust-sam',
  gcCompanyId: null,
}
const OAK: PaintedMapTextJob = { id: 'j-oak', name: 'Oak Street', status: 'working', customerId: 'cust-sam' }
const WORDS = 'Here is a map for you, The way in for deliveries. Open it here: https://example.test/way/q7m2kd4x9p'

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa' })),
    addNote: vi.fn(() => Promise.resolve('m-note')),
    sendEmail: vi.fn(() => Promise.resolve('m-email')),
    sendText: vi.fn(() => Promise.resolve('m-text')),
    logCall: vi.fn(() => Promise.resolve('m-call')),
  }
}

function draw(over: { mayText?: boolean; jobId?: string | null; job?: PaintedMapTextJob | null; refuse?: string; phone?: boolean } = {}) {
  const io = fakeIo()
  const loadJob = vi.fn(async (_id: string) => {
    if (over.refuse) throw new Error(over.refuse)
    return over.job === undefined ? OAK : over.job
  })
  const load = vi.fn(async (_id: string) => SAM)
  renderWithProviders(
    <PaintedMapShareSheet
      mapId="m1"
      mapName="The way in for deliveries"
      origin="https://example.test"
      onClose={() => {}}
      phone={over.phone ?? true}
      openMessages={async () => true}
      mayText={over.mayText ?? true}
      jobId={over.jobId === undefined ? 'j-oak' : over.jobId}
      loadJob={loadJob}
      textBox={{ load, io }}
    />,
  )
  return { io, loadJob, load }
}

describe('PaintedMapShareSheet, Text the customer…', () => {
  it('opens the customer’s box on Text with the map’s name and the link, and sends nothing in the press', async () => {
    const { io, loadJob, load } = draw()
    fireEvent.click(await screen.findByRole('button', { name: /Text the customer…/ }))
    await waitFor(() => expect(document.querySelector('[data-reply-box]')).toBeTruthy())
    expect(loadJob).toHaveBeenCalledWith('j-oak')
    expect(load).toHaveBeenCalledWith('cust-sam')
    const box = document.querySelector('[data-reply-box]') as HTMLElement
    await waitFor(() => expect((within(box).getByRole('textbox') as HTMLTextAreaElement).value).toBe(WORDS))
    expect(screen.getByTestId('contract-text-door').textContent).toContain('Text the map’s link')
    expect(within(box).getByRole('button', { name: 'Send text…' })).toBeTruthy()
    expect(io.sendText).not.toHaveBeenCalled()
  })

  it('sends through the box’s send window, tied to the job, and closes the door after', async () => {
    const { io } = draw()
    fireEvent.click(await screen.findByRole('button', { name: /Text the customer…/ }))
    await waitFor(() => expect(document.querySelector('[data-reply-box]')).toBeTruthy())
    const box = document.querySelector('[data-reply-box]') as HTMLElement
    await waitFor(() => expect((within(box).getByRole('textbox') as HTMLTextAreaElement).value).toBe(WORDS))
    fireEvent.click(within(box).getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    const send = within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() => expect(io.sendText).toHaveBeenCalledTimes(1))
    expect(io.sendText).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'c-sam', channelId: 'ch-cell', jobKey: 'pipeline:j-oak', body: WORDS }))
    await waitFor(() => expect(screen.queryByTestId('contract-text-door')).toBeNull())
  })

  it('a second press on Text the customer… closes the box', async () => {
    draw()
    fireEvent.click(await screen.findByRole('button', { name: /Text the customer…/ }))
    await waitFor(() => expect(screen.getByTestId('contract-text-door')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Text the customer…/ }))
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
  })

  it('keeps the press in its place on a map with no job, dead, and says why on it', async () => {
    const { loadJob } = draw({ jobId: null })
    await screen.findByRole('button', { name: 'Copy the link' })
    const dead = document.querySelector('[data-painted-share-text-none]') as HTMLButtonElement
    expect(dead.textContent).toBe('Text the customer…This map is on no job.')
    expect(dead.disabled).toBe(true)
    fireEvent.click(dead)
    expect(loadJob).not.toHaveBeenCalled()
  })

  it('sits under the person’s own text on a phone, each saying whose number it goes from', async () => {
    draw()
    const own = await screen.findByRole('button', { name: 'Text it from my phone…' })
    const customer = screen.getByRole('button', { name: /Text the customer…/ })
    expect(customer.textContent).toBe('Text the customer…From the company’s number')
    expect(own.compareDocumentPosition(customer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leads at a desk, where there is no Messages to open', async () => {
    draw({ phone: false })
    await screen.findByRole('button', { name: /Text the customer…/ })
    expect(screen.queryByRole('button', { name: 'Text it from my phone…' })).toBeNull()
    expect(document.querySelectorAll('[data-painted-share-tile="copy"]')).toHaveLength(1)
  })

  it('makes the link first when none is out, then opens the box with it', async () => {
    link.held = false
    const { loadJob } = draw()
    fireEvent.click(await screen.findByRole('button', { name: /Text the customer…/ }))
    await waitFor(() => expect(document.querySelector('[data-reply-box]')).toBeTruthy())
    expect(link.minted).toBe(1)
    expect(loadJob).toHaveBeenCalledWith('j-oak')
    const box = document.querySelector('[data-reply-box]') as HTMLElement
    await waitFor(() => expect((within(box).getByRole('textbox') as HTMLTextAreaElement).value).toBe(WORDS))
  })

  it('offers nothing to anyone outside the office', async () => {
    draw({ mayText: false })
    await screen.findByRole('button', { name: 'Copy the link' })
    expect(screen.queryByRole('button', { name: /Text the customer…/ })).toBeNull()
    expect(document.querySelector('[data-painted-share-text-none]')).toBeNull()
  })

  it('says so when the job cannot be opened, and when the read fails', async () => {
    draw({ job: null })
    fireEvent.click(await screen.findByRole('button', { name: /Text the customer…/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('The job could not be opened, so the text cannot go from here. Copy the link.')
    cleanup()
    draw({ refuse: 'permission denied for table jobs_ledger' })
    fireEvent.click(await screen.findByRole('button', { name: /Text the customer…/ }))
    expect((await screen.findByRole('alert')).textContent).toBe('permission denied for table jobs_ledger')
    expect(screen.queryByTestId('contract-text-door')).toBeNull()
  })
})
