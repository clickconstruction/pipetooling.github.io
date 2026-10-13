// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../../lib/messages/spineRows'
import type { JobTile } from '../../../../lib/messages/jobTiles'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import { OpenThreadContext, type OpenThread } from '../openThread'
import { MessagesRereadContext } from '../useMessagesReread'
import { ReplyBox } from './ReplyBox'

function fakeIo(): ReplyIo {
  return {
    loadSender: vi.fn(() => Promise.resolve({ name: 'Robert', title: 'Project manager', cell: '(210) 555-0142' })),
    addNote: vi.fn(() => Promise.resolve('m-note-new')),
    sendEmail: vi.fn(() => Promise.resolve('m-email-new')),
    sendText: vi.fn(() => Promise.resolve('m-text-new')),
  }
}

function thread(contactId: string, jobFilter: string | null = null): OpenThread {
  const view = spineMessagesView()
  const contact = view.contacts.find((c) => c.id === contactId)
  if (!contact) throw new Error(`no ${contactId} in the demo`)
  return {
    contact,
    lines: view.messages.filter((m) => m.contactId === contactId),
    jobFilter,
    rail: view.rails[contactId] ?? [],
    tiles: view.tiles,
    userNames: view.userNames,
    nowIso: DEMO_NOW,
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
}

function box(contactId = 'c-greg', more: { jobFilter?: string | null; io?: ReplyIo; provider?: boolean } = {}) {
  const io = more.io ?? fakeIo()
  const reread = vi.fn()
  const open = thread(contactId, more.jobFilter ?? null)
  const wrap = (child: ReactNode) =>
    more.provider === false ? child : <OpenThreadContext.Provider value={open}>{child}</OpenThreadContext.Provider>
  renderWithProviders(<MessagesRereadContext.Provider value={reread}>{wrap(<ReplyBox contact={open.contact} io={io} />)}</MessagesRereadContext.Provider>)
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  return { io, reread, el, open }
}

describe('ReplyBox: the reply box at the foot of a thread (Messages, cut 3)', () => {
  it('starts as a text for a number that can take one, ringed, with the company’s from line floating in the empty box', () => {
    const { el } = box()
    const kinds = within(el).getByRole('radiogroup', { name: 'Reply as' })
    expect(within(kinds).getByRole('radio', { name: 'Text' }).getAttribute('aria-checked')).toBe('true')
    expect(within(el).getByRole('textbox', { name: 'Write to Greg Paulk' }).getAttribute('placeholder')).toBe('Write to Greg Paulk…')
    expect(el.querySelector('[data-reply-from]')?.textContent).toBe('from the company number · Click Construction')
    expect(within(el).getByRole('button', { name: 'Send text…' })).toBeTruthy()
  })

  it('ties a reply to the star, or to the job the thread shows', () => {
    expect(box().el.querySelector('[data-reply-tie]')?.textContent).toBe('#42 Stone Oak Pharmacy · default ▾')
  })

  it('ties to the job in view when the thread is narrowed to one', () => {
    expect(box('c-greg', { jobFilter: 'bid:bid-boerne' }).el.querySelector('[data-reply-tie]')?.textContent).toBe('B482 Boerne Retail Shell · in view ▾')
  })

  it('counts a text as it is typed, and the from line steps aside', () => {
    const { el } = box()
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Checking on the number. Still good for today?' } })
    expect(el.querySelector('[data-reply-from]')).toBeNull()
    expect(el.querySelector('[data-reply-count]')?.textContent).toBe('45 characters · 1 text')
  })

  it('adds a note from the box, on the job it is tied to, then reads the thread again', async () => {
    const { el, io, reread } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Note' }))
    expect(el.textContent).toContain('only the team sees it · closes the row')
    fireEvent.change(within(el).getByRole('textbox', { name: 'A note for the team' }), { target: { value: 'Greg says the pad is ready.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Add the note' }))
    await waitFor(() => expect(io.addNote).toHaveBeenCalledWith('c-greg', 'Greg says the pad is ready.', 'project:proj-stoneoak', null))
    await waitFor(() => expect(reread).toHaveBeenCalledTimes(1))
    expect((within(el).getByRole('textbox') as HTMLTextAreaElement).value).toBe('')
  })

  it('opens the send window for a text, where a text waits until the phone is switched on', async () => {
    const { el, io } = box()
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Checking on the number.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send text…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.querySelector('[data-send-bubble]')?.textContent).toBe('Checking on the number.')
    expect(win.querySelector('[data-send-waits]')?.textContent).toContain('Texts wait until the phone is switched on.')
    expect((within(win).getByRole('button', { name: 'Send as text' }) as HTMLButtonElement).disabled).toBe(true)
    expect(io.sendText).not.toHaveBeenCalled()
  })

  it('sends an email from the window, its words built the way it goes, then closes and reads the thread again', async () => {
    const { el, io, reread } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Checking on the number. Still good for today?' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send email…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    expect(win.querySelector('[data-send-subject]')?.textContent).toBe('Stone Oak Pharmacy: Checking on the number. Still good for today')
    expect(win.textContent).toContain('To: Greg Paulk <greg@hillside.example>')
    const send = within(win).getByRole('button', { name: 'Send as email' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    await waitFor(() =>
      expect(io.sendEmail).toHaveBeenCalledWith({
        contactId: 'c-greg',
        channelId: 'ch-greg-email',
        jobKey: 'project:proj-stoneoak',
        draft: expect.objectContaining({
          subject: 'Stone Oak Pharmacy: Checking on the number. Still good for today',
          greeting: 'Hello Greg,',
          body: 'Checking on the number. Still good for today?',
          signature: ['Robert · Project manager', 'cell (210) 555-0142', 'Email back, text, or call.'],
        }),
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Before it goes, this is what they see' })).toBeNull())
    expect(reread).toHaveBeenCalledTimes(1)
  })

  it('changes the subject for this one email, and refuses a blank one', async () => {
    const { el } = box()
    fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'The pad is ready.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send email…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    fireEvent.click(within(win).getByRole('button', { name: 'change' }))
    fireEvent.change(within(win).getByRole('textbox', { name: 'Subject' }), { target: { value: '  ' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Save' }))
    expect(within(win).getByRole('alert').textContent).toBe('Type a subject, or Cancel.')
    fireEvent.change(within(win).getByRole('textbox', { name: 'Subject' }), { target: { value: 'The pad' } })
    fireEvent.click(within(win).getByRole('button', { name: 'Save' }))
    expect(win.querySelector('[data-send-subject]')?.textContent).toBe('The pad')
  })

  it('keeps the window open and says why when the send is refused', async () => {
    const io = fakeIo()
    io.sendEmail = vi.fn(() => Promise.reject(new Error('Only the office sends from here.')))
    const { el } = box('c-greg', { io })
    fireEvent.click(within(el).getByRole('radio', { name: 'Email' }))
    fireEvent.change(within(el).getByRole('textbox'), { target: { value: 'Hello there.' } })
    fireEvent.click(within(el).getByRole('button', { name: 'Send email…' }))
    const win = await screen.findByRole('dialog', { name: 'Before it goes, this is what they see' })
    const send = within(win).getByRole('button', { name: 'Send as email' }) as HTMLButtonElement
    await waitFor(() => expect(send.disabled).toBe(false))
    fireEvent.click(send)
    expect((await within(win).findByRole('alert')).textContent).toBe('Only the office sends from here.')
  })

  it('draws with no window around it, its tie on the person’s star and no choices', () => {
    const { el } = box('c-greg', { provider: false })
    expect(el.querySelector('[data-reply-tie]')?.textContent).toBe('a job not loaded · default ▾')
  })
})
