// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { BOERNE } from '../../../../test/fixtures/jobFilesDemo'
import { jobFiles } from '../../../../lib/documents/jobFiles'
import type { AttachIo } from '../../../../lib/messages/attachIo'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { AttachPicker } from './AttachPicker'
import { ReplyBox } from './ReplyBox'

/**
 * Messages, cut 7f: Attach in the reply box, the picker, the chips and the send window's notes (`files-out-mockups.html`,
 * screens 1 to 4). Greg Paulk, a trade partner with a portal link on, writing about B482 Boerne Retail Shell: its plan
 * set, addendum 2 and bid tab from the job's files, and the rock clause from this computer.
 */

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Robert', title: 'Project manager', cell: '(210) 555-0142' })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
  }
}

function fakeAttach(more: Partial<AttachIo> = {}): AttachIo {
  return {
    loadJobFiles: vi.fn(() => Promise.resolve({ files: jobFiles(BOERNE), driveFailed: false })),
    hasPortal: vi.fn(() => Promise.resolve(true)),
    readDevice: vi.fn(() => Promise.resolve({ base64: 'JVBERi0=', mime: 'application/pdf' })),
    ...more,
  }
}

function box(attachIo: AttachIo = fakeAttach()) {
  const io = fakeIo()
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.id === 'c-greg')!
  const open: OpenThread = {
    contact,
    lines: view.messages.filter((m) => m.contactId === 'c-greg'),
    jobFilter: 'bid:bid-boerne',
    rail: view.rails['c-greg'] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
  renderWithProviders(
    <MessagesRereadContext.Provider value={vi.fn()}>
      <OpenThreadContext.Provider value={open}>
        <ReplyBox contact={contact} io={io} attachIo={attachIo} />
      </OpenThreadContext.Provider>
    </MessagesRereadContext.Provider>,
  )
  return { io, attachIo, el: document.querySelector('[data-reply-box]') as HTMLElement }
}

const picker = async () => screen.findByRole('dialog', { name: 'Attach a file' })
const pick = async (el: HTMLElement, name: string) => {
  fireEvent.click(within(el).getByRole('button', { name: 'Attach' }))
  const win = await picker()
  await waitFor(() => expect(win.querySelector(`[data-attach-row]`)).toBeTruthy())
  fireEvent.click(within(win).getByRole('button', { name: new RegExp(`^${name.replace(/[.,]/g, '.')}`) }))
}

describe('Attach in the reply box (Messages, cut 7f)', () => {
  it('shows Attach for an email or a text, never a note', () => {
    const { el } = box()
    expect(within(el).getByRole('button', { name: 'Attach' })).toBeTruthy()
    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    expect(within(el).queryByRole('button', { name: 'Attach' })).toBeNull()
  })

  it('picks the job’s files into chips, once each, and takes one off with its ×', async () => {
    const { el } = box()
    await pick(el, 'Addendum 2.pdf')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Attach a file' })).toBeNull())
    expect([...el.querySelectorAll('[data-reply-file]')].map((c) => c.textContent)).toEqual(['Addendum 2.pdf · 412 KB×'])
    expect(el.querySelector('[data-reply-file]')!.getAttribute('title')).toBe('From the job. On an email it goes as the file. On a text it goes as our link, to their portal when the file has a page there.')
    await pick(el, 'Addendum 2.pdf')
    expect(el.querySelectorAll('[data-reply-file]')).toHaveLength(1)
    fireEvent.click(within(el).getByRole('button', { name: 'Take Addendum 2.pdf off the message' }))
    expect(el.querySelector('[data-reply-files]')).toBeNull()
  })

  it('shows each file in the send window with how it goes, and sends them as the function takes them', async () => {
    const { el, io, attachIo } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
    await pick(el, 'Addendum 2.pdf')
    await pick(el, 'Boerne Retail Shell plans, rev 2')
    fireEvent.click(within(el).getByRole('button', { name: 'Attach' }))
    const win = await picker()
    const rock = new File(['%PDF-'], 'Rock clause, marked up.pdf', { type: 'application/pdf' })
    fireEvent.change(win.querySelector('input[aria-label="A file from this computer"]')!, { target: { files: [rock] } })
    expect(el.querySelectorAll('[data-reply-file]')).toHaveLength(3)

    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Greg, here is addendum 2 and the plan set with it.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send email…' }))
    const send = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect([...send.querySelectorAll('[data-send-file]')].map((c) => c.textContent)).toEqual([
      'Addendum 2.pdf · 412 KB',
      'Boerne Retail Shell plans, rev 2 · our link to their portal',
      'Rock clause, marked up.pdf · 1 KB',
    ])
    expect(send.querySelector('[data-send-file-note]')!.textContent).toBe(
      'Boerne Retail Shell plans, rev 2 goes as our link, the way a plan set always has. The link opens their portal at the plans. The link is ours, not Drive’s. We see when it is opened, never who, and we can cut it off.',
    )
    expect(send.textContent).toContain('A copy of this email is kept in Documents, with its files.')
    const go = within(send).getByRole('button', { name: 'Send as email' }) as HTMLButtonElement
    await waitFor(() => expect(go.disabled).toBe(false))
    fireEvent.click(go)
    await waitFor(() => expect(io.sendEmail).toHaveBeenCalledTimes(1))
    expect(attachIo.readDevice).toHaveBeenCalledWith(rock)
    const sent = (io.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { files: unknown[]; jobKey: string }
    expect(sent.jobKey).toBe('bid:bid-boerne')
    expect(sent.files).toEqual([
      expect.objectContaining({ key: 'drive:drv-addendum-2', source: 'drive', ref: 'drv-addendum-2', way: 'file', page: null }),
      expect.objectContaining({ key: 'plans:set-2', source: 'drive', ref: 'boerne-rev-2-folder', way: 'link', page: 'plans' }),
      expect.objectContaining({ source: 'device', way: 'file', base64: 'JVBERi0=', mime: 'application/pdf', landing: 'sent' }),
    ])
    await waitFor(() => expect(el.querySelector('[data-reply-files]')).toBeNull())
  })

  it('says on a text that each file goes as our link', async () => {
    const { el } = box()
    await pick(el, 'Addendum 2.pdf')
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Here is addendum 2.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send text…' }))
    const send = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(send.querySelector('[data-send-file-note]')!.textContent).toBe('A text cannot carry a file, so each goes as our link. It opens their portal when the file has a page there.')
  })
})

describe('AttachPicker', () => {
  const draw = (jobKey: string | null, io: AttachIo = fakeAttach()) => {
    const onPick = vi.fn()
    renderWithProviders(<AttachPicker jobKey={jobKey} jobName={jobKey ? 'B482 Boerne Retail Shell' : null} audience="trade" hasPortal io={io} onPick={onPick} onClose={vi.fn()} />)
    return { onPick, win: screen.getByRole('dialog', { name: 'Attach a file' }) }
  }

  it('lists the job’s files with their facts and where each lives, then this computer and a photo', async () => {
    const { win } = draw('bid:bid-boerne')
    expect(win.textContent).toContain('Reading the job’s Drive folder…')
    await waitFor(() => expect(win.querySelectorAll('[data-attach-row]')).toHaveLength(3))
    expect(win.textContent).toContain('From B482 Boerne Retail Shell')
    expect([...win.querySelectorAll('[data-attach-row] button:first-child')].map((b) => b.textContent)).toEqual([
      'Boerne Retail Shell plans, rev 2plan seta plan set, so it goes as our link · in their portal under the plans',
      'Bid tab, Sitework.pdfDrive · Team only96 KB',
      'Addendum 2.pdfDrive · Plans412 KB · in their portal under the plans',
    ])
    expect([...win.querySelectorAll('[data-attach-device]')].map((b) => b.getAttribute('data-attach-device'))).toEqual(['computer', 'photo'])
  })

  it('previews a file with Open in a tab and Attach it', async () => {
    const { win, onPick } = draw('bid:bid-boerne')
    await waitFor(() => expect(win.querySelectorAll('[data-attach-row]')).toHaveLength(3))
    const addendum = win.querySelector('[data-attach-row="drive:drv-addendum-2"]') as HTMLElement
    fireEvent.click(within(addendum).getByRole('button', { name: 'Preview' }))
    const preview = win.querySelector('[data-attach-preview]') as HTMLElement
    expect(preview.textContent).toContain('412 KB · from B482 Boerne Retail Shell')
    expect(within(preview).getByRole('link', { name: 'Open in a tab' }).getAttribute('href')).toBe('/files/drive/bid%3Abid-boerne%3Adrv-addendum-2')
    fireEvent.click(within(preview).getByRole('button', { name: 'Attach it' }))
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ draft: expect.objectContaining({ key: 'drive:drv-addendum-2' }) }))
  })

  it('says when Drive’s folder does not read and keeps the rest, and has nothing to pick on nobody’s job', async () => {
    const { win } = draw('bid:bid-boerne', fakeAttach({ loadJobFiles: vi.fn(() => Promise.resolve({ files: [], driveFailed: true })) }))
    await waitFor(() => expect(win.textContent).toContain('The job’s Drive folder did not read. The rest of its files are here.'))
    expect(win.textContent).toContain('Nothing on this job yet.')
  })

  it('on nobody’s job says so and reads nothing', () => {
    const io = fakeAttach()
    const { win } = draw(null, io)
    expect(win.textContent).toContain("This message is on nobody's job, so nothing to pick from a job.")
    expect(io.loadJobFiles).not.toHaveBeenCalled()
  })
})
