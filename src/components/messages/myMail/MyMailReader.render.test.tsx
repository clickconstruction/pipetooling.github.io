// @vitest-environment jsdom
/**
 * The My email reader (punch list #230 PR 3) over a fake open: the mail whole with the guess bar on top, the count,
 * From, To and When, the words read as text with no HTML on the page, the file, and the foot's door to Gmail; Yes and
 * Another job… reach the tab; a tagged conversation's green bar with what the tag put on the job, open the thread ›
 * and Untag; a conversation the boxes wrote whole keeps no Untag; a mail a box holds; no guess; a refusal; a failed
 * read that offers Retry. Everything is made up.
 */
import { FunctionsFetchError } from '@supabase/supabase-js'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderSettled } from '../../../test/renderSmokeMocks'
import { ELM, fakeMyMailIo, mailRow, MARISOL, MY_MAIL_ROWS, openedMail, TAG_OK } from '../../../test/myMailRows'
import { MyMailReader, type MyMailReaderProps } from './MyMailReader'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})

afterEach(cleanup)

const byId = (id: string) => MY_MAIL_ROWS.find((r) => r.gmailId === id)!

async function read(id: string, more: Partial<MyMailReaderProps> = {}, io = fakeMyMailIo()) {
  const presses = { onYes: vi.fn(), onPick: vi.fn(), onUntag: vi.fn(), onOpenThread: vi.fn(), onClose: vi.fn(), lineContact: vi.fn((m: string) => (m === 'm-elm-1' ? 'c-dale' : null)) }
  const { loaded } = await renderSettled(<MyMailReader io={io} row={byId(id)} address={MARISOL} phone={false} readKey={0} done={null} busy={false} problem={null} {...presses} {...more} />, {
    loaded: () => screen.findByRole('dialog'),
  })
  return { presses, io, dialog: loaded }
}

describe('MyMailReader', () => {
  it('reads the mail whole: the guess bar, the count, From To and When, the words as text, the file and the door to Gmail', async () => {
    const io = fakeMyMailIo({ open: async () => openedMail(byId('dale-new'), { bodyHtml: '<div>Marisol,</div><div><br></div><div>Owner wants the <b>50-gal</b>.</div><script>alert(1)</script>', bodyText: '' }) })
    const { dialog } = await read('dale-new', {}, io)
    expect(await within(dialog).findByText('3 in this conversation')).toBeTruthy()
    expect(io.open).toHaveBeenCalledWith({ gmailId: 'dale-new' })
    const bar = dialog.querySelector('[data-my-mail-bar="guess"]') as HTMLElement
    expect(bar.textContent).toContain('Tag this conversation onto')
    expect(bar.textContent).toContain('JP1077 · 4 Elm Ct')
    expect(bar.textContent).toContain('the subject names 4 Elm Ct')
    expect(within(dialog).getByText('Dale Okafor <dale@ridgeway.example>')).toBeTruthy()
    expect(within(dialog).getByText(`Marisol Vega <${MARISOL}>`)).toBeTruthy()
    expect(within(dialog).getByText('Sunday, November 1, 2026 at 9:12 AM')).toBeTruthy()
    const body = dialog.querySelector('[data-my-mail-body]') as HTMLElement
    expect(body.textContent).toBe('Marisol,\n\nOwner wants the 50-gal.')
    expect(body.querySelector('b, script, div')).toBeNull()
    expect(within(dialog).getByText('📎 elm-ct-spec-sheet.pdf · 212 KB')).toBeTruthy()
    const gmail = within(dialog).getByRole('link', { name: 'Reply in Gmail ↗' }) as HTMLAnchorElement
    expect(gmail.getAttribute('href')).toBe('https://mail.google.com/mail/?authuser=marisol%40clickplumbing.example#all/t-dale-new')
    expect(gmail.getAttribute('target')).toBe('_blank')
    expect(within(dialog).getByText('Nothing here replies, archives or marks read.')).toBeTruthy()
  })

  it('hands Yes with the guess and Another job… to the tab', async () => {
    const { presses, dialog } = await read('dale-new')
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Yes' }))
    expect(presses.onYes).toHaveBeenCalledWith(expect.objectContaining({ key: ELM.key, why: 'the subject names 4 Elm Ct' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Another job…' }))
    expect(presses.onPick).toHaveBeenCalledTimes(1)
  })

  it('turns green once tagged: the job, what is on it now, open the thread › at the line, and Untag', async () => {
    const io = fakeMyMailIo({ open: async () => openedMail(byId('dale-new'), { tagged: { ...ELM, messageId: 'm-elm-1' } }) })
    const { presses, dialog } = await read('dale-new', { done: { ok: TAG_OK, chip: ELM } }, io)
    const bar = (await within(dialog).findByText('✓ On')).closest('[data-my-mail-bar]') as HTMLElement
    expect(bar.getAttribute('data-my-mail-bar')).toBe('tagged')
    expect(bar.textContent).toContain('JP1077 · 4 Elm Ct')
    expect(bar.textContent).toContain('3 lines and 1 file are on the job now.')
    fireEvent.click(within(bar).getByRole('button', { name: 'open the thread ›' }))
    expect(presses.onOpenThread).toHaveBeenCalledWith('c-dale', 'm-elm-1')
    fireEvent.click(within(bar).getByRole('button', { name: 'Untag' }))
    expect(presses.onUntag).toHaveBeenCalledTimes(1)
  })

  it('finds the thread of a conversation tagged before, through the page’s view of the line', async () => {
    const { presses, dialog } = await read('dale-old')
    const bar = (await within(dialog).findByText('✓ On')).closest('[data-my-mail-bar]') as HTMLElement
    expect(bar.textContent).not.toContain('on the job now')
    fireEvent.click(within(bar).getByRole('button', { name: 'open the thread ›' }))
    expect(presses.lineContact).toHaveBeenCalledWith('m-elm-1')
    expect(presses.onOpenThread).toHaveBeenCalledWith('c-dale', 'm-elm-1')
  })

  it('keeps no Untag on a conversation the boxes wrote whole', async () => {
    const box = { messageId: 'm-elm-1', jobKey: ELM.key }
    const io = fakeMyMailIo({ open: async () => openedMail(byId('dale-old'), { inMessages: box, threadRows: [mailRow('dale-2', { inMessages: { messageId: 'm-elm-2', jobKey: ELM.key } })] }) })
    const { dialog } = await read('dale-old', {}, io)
    await within(dialog).findByText('✓ On')
    expect(within(dialog).queryByRole('button', { name: 'Untag' })).toBeNull()
  })

  it('reads a mail a box holds on a job as already in Messages, and still offers the conversation', async () => {
    const { presses, dialog } = await read('box', { lineContact: vi.fn(() => 'c-dale') })
    const bar = (await within(dialog).findByText('Already in Messages ✓')).closest('[data-my-mail-bar]') as HTMLElement
    expect(bar.textContent).toContain('The bids@ or team@ reader took this mail.')
    fireEvent.click(within(bar).getByRole('button', { name: 'open the thread ›' }))
    expect(presses.onOpenThread).toHaveBeenCalledWith('c-dale', 'm-box-1')
    fireEvent.click(within(bar).getByRole('button', { name: 'Tag the conversation…' }))
    expect(presses.onPick).toHaveBeenCalledTimes(1)
  })

  it('offers Tag… on a mail with no guess, waits while it is tagged, and says why a tag did not go', async () => {
    const { presses, dialog } = await read('harlan')
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Tag…' }))
    expect(presses.onPick).toHaveBeenCalledTimes(1)
    cleanup()
    const busy = await read('harlan', { busy: true, problem: 'That mail or that job is not there anymore.' })
    expect(await within(busy.dialog).findByText('Tagging…')).toBeTruthy()
    expect(within(busy.dialog).getByRole('alert').textContent).toBe('That mail or that job is not there anymore.')
  })

  it('says a refusal in its words, and offers Retry on a lost signal', async () => {
    const refused = fakeMyMailIo({ open: async () => ({ ok: false, error: 'notFound', words: 'That mail or that job is not there anymore.' }) })
    const { dialog } = await read('harlan', {}, refused)
    expect((await within(dialog).findByText('That mail or that job is not there anymore.')).getAttribute('data-my-mail-refusal')).toBe('notFound')
    cleanup()
    const lost = fakeMyMailIo({ open: async () => Promise.reject(new FunctionsFetchError(new TypeError('Failed to fetch'))) })
    const second = await read('harlan', {}, lost)
    expect(await within(second.dialog).findByText('No connection, so the mail could not be read. It reads again when the signal is back.')).toBeTruthy()
    fireEvent.click(await within(second.dialog).findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(lost.open).toHaveBeenCalledTimes(2))
    // The second read fails too, and the panel offers Retry again.
    expect(await within(second.dialog).findByRole('button', { name: 'Retry' })).toBeTruthy()
  })
})
