// @vitest-environment jsdom
/**
 * The trade portal's files (P5a-1, to-dos/gc-mode/mockups/portal-p5a.md): a file picked with a submittal round, a change
 * it asks for, or its quote goes up first (the kind `file`), and its link rides with the kind that stores it. A refused
 * upload says why in the company's words and sends nothing else, so what was typed stays. The office's preview posts
 * nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const URL_UP = 'https://drive.google.com/file/d/up1/view'
const reads: string[] = []
const posts: Record<string, unknown>[] = []
let slice: TradePortalSlice
let fileAnswer: { ok: boolean; body: unknown } = { ok: true, body: { ok: true, value: { id: 'f1', name: 'panelboards.pdf', url: URL_UP } } }

beforeEach(() => {
  reads.length = 0
  posts.length = 0
  slice = gcTradePortalSample(TODAY)
  fileAnswer = { ok: true, body: { ok: true, value: { id: 'f1', name: 'panelboards.pdf', url: URL_UP } } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        posts.push(body)
        if (body.kind === 'file') return { ok: fileAnswer.ok, json: async () => fileAnswer.body }
        return { ok: true, json: async () => ({ ok: true }) }
      }
      reads.push(url)
      return { ok: true, json: async () => ({ today: TODAY, slice }) }
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const open = (path = `/t/${TOKEN}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const openJob = async (path?: string) => {
  open(path)
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  return within(await screen.findByRole('region', { name: 'Electrical · report your work and get paid' }))
}

/** A small PDF, as the picker hands it to the page. */
const pdf = (name: string) => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])], name, { type: 'application/pdf' })
const pick = async (input: HTMLElement, file: File) => {
  fireEvent.change(input, { target: { files: [file] } })
  await screen.findByText(file.name)
}
const base64Of = (bytes: number[]) => btoa(String.fromCharCode(...bytes))

describe('Your files on this job (punch list #205, PR 4)', () => {
  it('lists what the company sent us by what each is, with the day and Open, and the plans we sent', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    const block = within(await screen.findByRole('region', { name: 'Your files on this job' }))
    const table = block.getByRole('table')
    const rows = [...table.querySelectorAll('tbody tr')].map((tr) => [tr.getAttribute('data-portal-file'), tr.textContent])
    expect(rows.map((r) => r[0])).toEqual(['submittal', 'change', 'waiver'])
    expect(rows[0]![1]).toContain('Panelboards cut sheet.pdf')
    expect(rows[0]![1]).toContain('submittal')
    expect(rows[0]![1]).toContain('Oct 3')
    expect(rows[1]![1]).toContain('change you asked for')
    expect(rows[2]![1]).toContain('waiver you signed')
    const links = block.getAllByRole('link', { name: 'Open ↗' }) as HTMLAnchorElement[]
    expect(links.map((a) => a.href)).toEqual(['https://drive.google.com/file/d/sample-submittal/view', 'https://drive.google.com/file/d/sample-change/view', 'https://drive.google.com/file/d/sample-waiver/view'])
    expect(links.every((a) => a.target === '_blank')).toBe(true)
    // The dental office's sets carry no Drive link in the sample, so no plans row; the block still draws under the statement of work.
    expect(table.querySelector('[data-portal-file="plans"]')).toBeNull()
    const sow = screen.getByRole('region', { name: 'Electrical · statement of work' })
    const report = screen.getByRole('region', { name: 'Electrical · report your work and get paid' })
    const files = screen.getByRole('region', { name: 'Your files on this job' })
    expect(sow.compareDocumentPosition(files) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(files.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(files.textContent).not.toContain('never-passes')
  })

  it('sends Click a file with its one line as the kind file for note, and the file joins the list', async () => {
    fileAnswer = { ok: true, body: { ok: true, value: { id: 'f9', name: 'Trench by the back door.pdf', url: 'https://drive.google.com/file/d/f9/view' } } }
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    const block = within(await screen.findByRole('region', { name: 'Your files on this job' }))
    expect(block.getByText('A photo or a PDF up to 10 MB. It goes to the office with your note.')).toBeTruthy()
    const send = block.getByRole('button', { name: 'Send' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    await pick(block.getByLabelText('Send Click a file'), pdf('IMG_0412.pdf'))
    expect(send.disabled).toBe(true)
    fireEvent.change(block.getByLabelText('What is it? One line.'), { target: { value: 'Trench by the back door' } })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ token: TOKEN, kind: 'file', for: 'note', projectId: ID.job, name: 'IMG_0412.pdf', base64: base64Of([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]), note: 'Trench by the back door' })
    expect(await block.findByText('Sent. The office has it.')).toBeTruthy()
    const first = block.getByRole('table').querySelector('tbody tr')!
    expect(first.getAttribute('data-portal-file')).toBe('note')
    expect(first.textContent).toContain('Trench by the back door.pdf')
    expect(first.textContent).toContain('a file you sent')
    // Nothing read again: the answer is the row.
    expect(reads).toHaveLength(1)
  })

  it('says a refused note file in the company’s words and keeps the line typed', async () => {
    fileAnswer = { ok: false, body: { error: 'notAwarded' } }
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    const block = within(await screen.findByRole('region', { name: 'Your files on this job' }))
    await pick(block.getByLabelText('Send Click a file'), pdf('ticket.pdf'))
    fireEvent.change(block.getByLabelText('What is it? One line.'), { target: { value: 'Dump ticket' } })
    fireEvent.click(block.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(await block.findByText(/not awarded|not yours|did not go through|Click/i)).toBeTruthy()
    expect((block.getByLabelText('What is it? One line.') as HTMLInputElement).value).toBe('Dump ticket')
  })

  it('draws no block when the answer has no files list and no plans link', async () => {
    const { files: _files, ...older } = slice
    slice = older as TradePortalSlice
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    await screen.findByRole('region', { name: 'Electrical · report your work and get paid' })
    // The block still offers Send Click a file: the list is empty, the press stands.
    expect(within(screen.getByRole('region', { name: 'Your files on this job' })).queryByRole('table')).toBeNull()
  })
})

describe('a file from the portal (P5a-1)', () => {
  it('sends a submittal round’s file first, then the round with its link', async () => {
    const report = await openJob()
    await pick(report.getByLabelText('Pick the file'), pdf('panelboards.pdf'))
    expect(report.queryByLabelText('Its Drive link, if you have one')).toBeNull()
    fireEvent.change(report.getByLabelText('A note for Click'), { target: { value: 'Square D.' } })
    fireEvent.click(report.getByRole('button', { name: 'Send it' }))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[0]).toEqual({ token: TOKEN, kind: 'file', for: 'submittal', submittalId: ID.submittal1, name: 'panelboards.pdf', base64: base64Of([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]) })
    expect(posts[1]).toEqual({ token: TOKEN, kind: 'submittal_send', submittalId: ID.submittal1, fileName: 'panelboards.pdf', driveUrl: URL_UP, note: 'Square D.' })
    await waitFor(() => expect(reads).toHaveLength(2))
  })

  it('says a refused upload in the company’s words and sends nothing else, keeping what was typed', async () => {
    fileAnswer = { ok: false, body: { error: 'noJobFolder' } }
    const report = await openJob()
    await pick(report.getByLabelText('Pick the file'), pdf('panelboards.pdf'))
    fireEvent.change(report.getByLabelText('A note for Click'), { target: { value: 'Square D.' } })
    fireEvent.click(report.getByRole('button', { name: 'Send it' }))
    expect(await report.findByText('For now, email it to Click Construction.')).toBeTruthy()
    expect(posts.map((p) => p.kind)).toEqual(['file'])
    expect((report.getByLabelText('A note for Click') as HTMLInputElement).value).toBe('Square D.')
    expect(report.getByText('panelboards.pdf')).toBeTruthy()
  })

  it('says a file over 10 MB before it sends anything', async () => {
    const report = await openJob()
    const big = pdf('huge.pdf')
    Object.defineProperty(big, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(report.getByLabelText('Pick the file'), { target: { files: [big] } })
    expect(await report.findByText('That file is over 10 MB. Email it to Click Construction, or paste its Drive link.')).toBeTruthy()
    expect(posts).toEqual([])
  })

  it('asks for a change with its photo: the file first, then the change with its link', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    const changes = within(await screen.findByRole('region', { name: 'Electrical · changes to your work' }))
    fireEvent.click(changes.getByRole('button', { name: 'Ask for a change' }))
    fireEvent.change(changes.getByLabelText('What changed'), { target: { value: 'Two more outlets.' } })
    fireEvent.change(changes.getByLabelText('What you ask for it'), { target: { value: '$1,250' } })
    await pick(changes.getByLabelText('A photo or ticket, if you have one'), pdf('ticket.pdf'))
    fireEvent.click(changes.getByRole('button', { name: 'Send to Click' }))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[0]).toMatchObject({ kind: 'file', for: 'change', packageId: ID.jobTrade, name: 'ticket.pdf' })
    expect(posts[1]).toMatchObject({ kind: 'ask_change', packageId: ID.jobTrade, description: 'Two more outlets.', amount: 1250, fileUrl: URL_UP })
  })

  it('sends a quote with its own file', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Retail Shell/ }))
    const ask = within(await screen.findByRole('region', { name: 'Electrical · invitation to quote' }))
    fireEvent.change(ask.getByLabelText('Your quote'), { target: { value: '60000' } })
    const amounts = ask.getAllByLabelText('Amount for this stage')
    fireEvent.change(amounts[0]!, { target: { value: '30000' } })
    fireEvent.change(amounts[1]!, { target: { value: '20000' } })
    fireEvent.change(amounts[2]!, { target: { value: '10000' } })
    await pick(ask.getByLabelText(/^Your quote file/), pdf('quote.pdf'))
    fireEvent.click(ask.getByRole('button', { name: 'Send my quote' }))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[0]).toMatchObject({ kind: 'file', for: 'quote', inviteId: ID.ask, name: 'quote.pdf' })
    expect(posts[1]).toMatchObject({ kind: 'submit_quote', inviteId: ID.ask, quote: { amount: 60000, file: URL_UP } })
  })

  it('posts nothing from the office’s preview, and says so', async () => {
    const report = await openJob(`/t/${TOKEN}?preview=1`)
    await pick(report.getByLabelText('Pick the file'), pdf('panelboards.pdf'))
    fireEvent.click(report.getByRole('button', { name: 'Send it' }))
    expect(await report.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
  })
})
