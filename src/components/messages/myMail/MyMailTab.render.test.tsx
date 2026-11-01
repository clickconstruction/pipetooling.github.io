// @vitest-environment jsdom
/**
 * The My email tab (punch list #230 PR 3) over a fake gmail-mine, never the network: To tag by default with the
 * guessed and the unguessed mail, the tagged and a box's line out of it and the notices behind one fold line; the
 * words line with the address and its guide; Yes tagging the conversation onto the guess and reading the page again;
 * Tag… opening the job picker with their jobs first; a sender nobody knows asked about at once; the views and their
 * empty words; an empty page with older mail behind it offering Older ›, and the true end; the search sent to the
 * function; Older › and ‹ Newer; Untag asked once; Another job… moving a tagged conversation through the same picker,
 * and a pick of its own job doing nothing; Put it on the job on a mail no line holds yet; a refusal as one calm line; a
 * lost signal on the retry panel; the switch off reading nothing. Everything is made up.
 */
import { FunctionsFetchError } from '@supabase/supabase-js'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobTile } from '../../../lib/messages/jobTiles'
import type { MyMailView } from '../../../lib/myMail/contract'
import { renderSettled } from '../../../test/renderSmokeMocks'
import { CEDAR, ELM, fakeMyMailIo, HARBOR, mailRow, MY_MAIL_NOW, MY_MAIL_PAGE, MY_MAIL_ROWS, openedMail, TAG_OK, type FakeMyMailIo } from '../../../test/myMailRows'
import { MyMailTab, type MyMailTabProps } from './MyMailTab'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})

afterEach(cleanup)

const ELM_TILE: JobTile = { key: ELM.key, kind: 'pipeline', num: 'JP1077', name: '4 Elm Ct', day: { words: 'Working', tone: '' } }
const HARBOR_TILE: JobTile = { key: 'pipeline:job-harbor', kind: 'pipeline', num: 'JP1081', name: '19 Harbor Ln', day: { words: 'Ready to bill', tone: '' } }

/** The tab as the page holds it: the view and the words in state, as the URL would hold them. */
function Harness({ start = 'toTag', startQ = '', spy, ...props }: Omit<MyMailTabProps, 'view' | 'onView' | 'q' | 'onQ'> & { start?: MyMailView; startQ?: string; spy?: { onView?: (v: MyMailView) => void; onQ?: (q: string) => void } }) {
  const [view, setView] = useState<MyMailView>(start)
  const [q, setQ] = useState(startQ)
  return (
    <MyMailTab
      {...props}
      view={view}
      onView={(v) => {
        spy?.onView?.(v)
        setView(v)
      }}
      q={q}
      onQ={(next) => {
        spy?.onQ?.(next)
        setQ(next)
      }}
    />
  )
}

async function tab(io: FakeMyMailIo = fakeMyMailIo(), more: Partial<Parameters<typeof Harness>[0]> = {}) {
  const host = {
    jobs: { theirs: vi.fn((address: string) => (address === 'ap@harlanfreight.example' ? [ELM_TILE, HARBOR_TILE] : [])), search: vi.fn(async () => []) },
    writes: { nameContact: vi.fn(async () => 'c-harlan'), searchRecords: vi.fn(async () => []) },
    lineContact: vi.fn(() => null),
    onOpenThread: vi.fn(),
    onChanged: vi.fn(),
  }
  const result = await renderSettled(<Harness io={io} on={true} phone={false} nowIso={MY_MAIL_NOW} {...host} {...more} />, {
    loaded: () => screen.findByTestId('my-mail-tab'),
  })
  return { ...result, io, host }
}
const rowIds = () => [...document.querySelectorAll('[data-testid="my-mail-list"] [data-my-mail-row]')].map((r) => r.getAttribute('data-my-mail-row'))
const rowOf = (id: string) => within(document.querySelector(`[data-my-mail-row="${id}"]`) as HTMLElement)

describe('MyMailTab', () => {
  it('opens on To tag: the mail to tag newest first, the tagged and a box’s line out, the notices behind one line', async () => {
    const { io } = await tab()
    await screen.findByTestId('my-mail-list')
    expect(io.list).toHaveBeenCalledWith({ view: 'toTag', pageToken: null })
    expect(rowIds()).toEqual(['dale-new', 'priya-out', 'harlan'])
    expect(screen.getByRole('button', { name: 'To tag' }).getAttribute('aria-pressed')).toBe('true')
    const words = document.querySelector('[data-my-mail-words]') as HTMLElement
    expect(words.textContent).toContain('Your mail, read live from marisol@clickplumbing.example. Nothing is kept until you tag it.')
    expect(within(words).getByRole('link', { name: 'What this reads' }).getAttribute('href')).toBe('/help?g=tag-an-email-onto-a-job-from-your-own-mail#what-the-tab-reads-and-keeps')
    const fold = document.querySelector('[data-my-mail-fold]') as HTMLElement
    expect(fold.textContent).toContain('1 notice or newsletter, left out as the bids@ reader leaves it out')
    fireEvent.click(within(fold).getByRole('button', { name: 'show' }))
    expect(rowIds()).toEqual(['dale-new', 'priya-out', 'harlan', 'news'])
    expect(within(fold).getByRole('button', { name: 'hide' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.queryByText(/unread/i)).toBeNull()
  })

  it('Yes tags the conversation onto the guess, says what is on the job, and reads the page again', async () => {
    const { io, host } = await tab()
    await screen.findByTestId('my-mail-list')
    fireEvent.click(rowOf('dale-new').getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(io.tag).toHaveBeenCalledWith({ threadId: 't-dale-new', job: { kind: 'pipeline', id: 'job-elm' } }))
    expect(await screen.findByText('Tagged onto JP1077. 3 lines and 1 file are on the job now.')).toBeTruthy()
    await waitFor(() => expect(io.list).toHaveBeenCalledTimes(2))
    expect(host.onChanged).toHaveBeenCalledTimes(1)
  })

  it('Tag… opens the job picker with their jobs first, and the pick tags the conversation', async () => {
    const { io, host } = await tab()
    await screen.findByTestId('my-mail-list')
    fireEvent.click(rowOf('harlan').getByRole('button', { name: 'Tag…' }))
    const picker = await screen.findByRole('dialog', { name: 'Tag this conversation onto' })
    expect(host.jobs.theirs).toHaveBeenCalledWith('ap@harlanfreight.example')
    expect(within(picker).getByText('Their jobs')).toBeTruthy()
    fireEvent.click(within(picker).getByText('19 Harbor Ln'))
    await waitFor(() => expect(io.tag).toHaveBeenCalledWith({ threadId: 't-harlan', job: { kind: 'pipeline', id: 'job-harbor' } }))
    expect(await screen.findByText('Tagged onto JP1081. 3 lines and 1 file are on the job now.')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Tag this conversation onto' })).toBeNull()
  })

  it('asks Who is this? at once for a sender nobody knows, and the tag stands when it closes unnamed', async () => {
    const io = fakeMyMailIo({ tag: async () => ({ ...TAG_OK, unknownSender: { contactId: 'c-harlan', address: 'ap@harlanfreight.example', name: 'Harlan Freight' } }) })
    await tab(io)
    await screen.findByTestId('my-mail-list')
    fireEvent.click(rowOf('harlan').getByRole('button', { name: 'Tag…' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Tag this conversation onto' })).getByText('4 Elm Ct'))
    const who = await screen.findByRole('dialog', { name: 'Who is this? Harlan Freight' })
    fireEvent.click(within(who).getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('dialog', { name: 'Who is this? Harlan Freight' })).toBeNull()
    expect(io.untag).not.toHaveBeenCalled()
  })

  it('says why a tag did not go, in the function’s words', async () => {
    const io = fakeMyMailIo({ tag: async () => ({ ok: false, error: 'notFound', words: 'That mail or that job is not there anymore.' }) })
    await tab(io)
    await screen.findByTestId('my-mail-list')
    fireEvent.click(rowOf('priya-out').getByRole('button', { name: 'Yes' }))
    expect((await screen.findByRole('alert')).textContent).toBe('That mail or that job is not there anymore.')
    expect(io.tag).toHaveBeenCalledWith({ threadId: 't-priya-out', job: { kind: 'bid', id: CEDAR.id } })
  })

  it('reads each view again, and each empty view says what it means with its press', async () => {
    const spy = { onView: vi.fn() }
    const { io } = await tab(fakeMyMailIo(), { spy })
    await screen.findByTestId('my-mail-list')
    fireEvent.click(screen.getByRole('button', { name: 'Tagged' }))
    await waitFor(() => expect(io.list).toHaveBeenLastCalledWith({ view: 'tagged', pageToken: null }))
    await waitFor(() => expect(rowIds()).toEqual(['dale-old']))
    expect(rowOf('dale-old').getByRole('button', { name: 'open the line ›' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => expect(rowIds()).toEqual(['dale-new', 'priya-out', 'harlan', 'dale-old', 'box']))
    expect(rowOf('box').getByText('already in Messages ✓')).toBeTruthy()
    expect(spy.onView.mock.calls.map((c) => c[0])).toEqual(['tagged', 'all'])
    cleanup()

    const allTagged = fakeMyMailIo({ list: async () => ({ ...MY_MAIL_PAGE, rows: [MY_MAIL_ROWS[3]!], nextPageToken: null }) })
    await tab(allTagged)
    expect((await screen.findByText('Nothing waiting to tag.')).closest('[data-empty-state]')?.querySelector('button, a')).toBeNull()
    cleanup()

    const none = fakeMyMailIo({ list: async () => ({ ...MY_MAIL_PAGE, rows: [], nextPageToken: null }) })
    const second = await tab(none, { start: 'tagged', spy })
    const empty = (await screen.findByText('No tagged conversations yet.')).closest('[data-empty-state]') as HTMLElement
    expect(empty.textContent).toBe('No tagged conversations yet. To tag lists the mail you can tag.')
    fireEvent.click(within(empty).getByRole('button', { name: 'To tag' }))
    expect(spy.onView).toHaveBeenLastCalledWith('toTag')
    await waitFor(() => expect(second.io.list).toHaveBeenLastCalledWith({ view: 'toTag', pageToken: null }))
  })

  it('says a page the view drew nothing of is not the end while Gmail holds older mail, and keeps Nothing waiting to tag. for the end', async () => {
    // A tagged conversation, a newsletter and a mail a box holds: To tag draws none of them, and Gmail has an older page.
    const hidden = [MY_MAIL_ROWS[3]!, MY_MAIL_ROWS[4]!, MY_MAIL_ROWS[5]!]
    const io = fakeMyMailIo({ list: async ({ pageToken }) => (pageToken === 'tok-2' ? { ...MY_MAIL_PAGE, rows: [], nextPageToken: null } : { ...MY_MAIL_PAGE, rows: hidden, nextPageToken: 'tok-2' }) })
    await tab(io)
    const line = (await screen.findByText('Nothing to tag on this page.')).closest('[data-empty-state]') as HTMLElement
    expect(line.textContent).toBe('Nothing to tag on this page. Older › shows the next fifty mails.')
    expect(screen.queryByText('Nothing waiting to tag.')).toBeNull()
    // Older › once, on the line, and not again under the list.
    expect(screen.getAllByRole('button', { name: 'Older ›' })).toHaveLength(1)
    fireEvent.click(within(line).getByRole('button', { name: 'Older ›' }))
    await waitFor(() => expect(io.list).toHaveBeenLastCalledWith({ view: 'toTag', pageToken: 'tok-2' }))
    const end = (await screen.findByText('Nothing waiting to tag.')).closest('[data-empty-state]') as HTMLElement
    expect(end.querySelector('button, a')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Older ›' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '‹ Newer' }))
    expect(await screen.findByText('Nothing to tag on this page.')).toBeTruthy()
  })

  it('sends the search to the function, and an empty search offers to clear it', async () => {
    const spy = { onQ: vi.fn() }
    const io = fakeMyMailIo({ list: async ({ q }) => (q ? { ...MY_MAIL_PAGE, rows: [], nextPageToken: null } : MY_MAIL_PAGE) })
    await tab(io, { spy })
    await screen.findByTestId('my-mail-list')
    const box = screen.getByRole('searchbox', { name: 'Search my mail' })
    fireEvent.change(box, { target: { value: 'Zed' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(spy.onQ).toHaveBeenLastCalledWith('Zed')
    await waitFor(() => expect(io.list).toHaveBeenLastCalledWith({ view: 'toTag', q: 'Zed', pageToken: null }))
    expect(await screen.findByText('No emails match ‘Zed’.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(spy.onQ).toHaveBeenLastCalledWith('')
    expect((screen.getByRole('searchbox', { name: 'Search my mail' }) as HTMLInputElement).value).toBe('')
    await waitFor(() => expect(io.list).toHaveBeenLastCalledWith({ view: 'toTag', pageToken: null }))
  })

  it('walks Older › by Gmail’s token and back with ‹ Newer', async () => {
    const io = fakeMyMailIo({ list: async ({ pageToken }) => (pageToken === 'tok-2' ? { ...MY_MAIL_PAGE, rows: [mailRow('older-1', { at: '2026-10-01T15:00:00.000Z' })], nextPageToken: null } : MY_MAIL_PAGE) })
    await tab(io)
    await screen.findByTestId('my-mail-list')
    expect(screen.queryByRole('button', { name: '‹ Newer' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Older ›' }))
    await waitFor(() => expect(rowIds()).toEqual(['older-1']))
    expect(io.list).toHaveBeenLastCalledWith({ view: 'toTag', pageToken: 'tok-2' })
    expect(screen.queryByRole('button', { name: 'Older ›' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '‹ Newer' }))
    await waitFor(() => expect(rowIds()).toEqual(['dale-new', 'priya-out', 'harlan']))
  })

  it('opens the reader from a row, asks once before Untag, and opens the thread over the tab', async () => {
    const io = fakeMyMailIo()
    const { host } = await tab(io, { start: 'tagged', lineContact: vi.fn(() => 'c-dale') })
    await waitFor(() => expect(rowIds()).toEqual(['dale-old']))
    fireEvent.click(rowOf('dale-old').getByRole('button', { name: 'open the line ›' }))
    const reader = await screen.findByRole('dialog', { name: 'Re: 4 Elm Ct water heater' })
    fireEvent.click(await within(reader).findByRole('button', { name: 'Untag' }))
    const ask = await screen.findByRole('alertdialog')
    expect(ask.textContent).toContain('Untag takes this conversation off the job.')
    expect(ask.textContent).toContain('A line the bids@ or team@ reader took goes back to where it was.')
    fireEvent.click(within(ask).getByRole('button', { name: 'Untag' }))
    await waitFor(() => expect(io.untag).toHaveBeenCalledWith({ threadId: 't-dale-old' }))
    expect(await screen.findByText('Untagged. 3 lines came off the job.')).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Re: 4 Elm Ct water heater' })).getByRole('button', { name: 'open the thread ›' }))
    expect(host.onOpenThread).toHaveBeenCalledWith('c-dale', 'm-elm-1')
    expect(screen.queryByRole('dialog', { name: 'Re: 4 Elm Ct water heater' })).toBeNull()
  })

  it('moves a tagged conversation with Another job…: the same picker, a tag onto the new job, the new job on the bar and the row', async () => {
    let on = ELM
    const tagged = () => ({ ...MY_MAIL_ROWS[3]!, tagged: { ...on, messageId: 'm-elm-1' } })
    const io = fakeMyMailIo({
      list: async () => ({ ...MY_MAIL_PAGE, rows: [tagged()], nextPageToken: null }),
      open: async () => openedMail(tagged()),
      tag: async ({ job }) => {
        on = job.id === HARBOR.id ? HARBOR : ELM
        return { ...TAG_OK, jobKey: on.key, lines: 0, tied: 3, files: 0 }
      },
    })
    const theirs = vi.fn(() => [ELM_TILE, HARBOR_TILE])
    const { host } = await tab(io, { start: 'tagged', jobs: { theirs, search: vi.fn(async () => []) }, lineContact: vi.fn(() => 'c-dale') })
    await waitFor(() => expect(rowIds()).toEqual(['dale-old']))
    fireEvent.click(rowOf('dale-old').getByRole('button', { name: 'open the line ›' }))
    const reader = await screen.findByRole('dialog', { name: 'Re: 4 Elm Ct water heater' })
    fireEvent.click(await within(reader).findByRole('button', { name: 'Another job…' }))
    const picker = await screen.findByRole('dialog', { name: 'Move this conversation onto' })
    expect(theirs).toHaveBeenCalledWith('dale@ridgeway.example')
    expect(within(picker).getByText('Their jobs')).toBeTruthy()
    fireEvent.click(within(picker).getByText('19 Harbor Ln'))
    await waitFor(() => expect(io.tag).toHaveBeenCalledWith({ threadId: 't-dale-old', job: { kind: 'pipeline', id: 'job-harbor' } }))
    expect(await screen.findByText('Moved to JP1081. 3 lines are on the job now.')).toBeTruthy()
    expect(await within(reader).findByText('JP1081 · 19 Harbor Ln')).toBeTruthy()
    expect(within(reader).queryByText('JP1077 · 4 Elm Ct')).toBeNull()
    // The row reads again in place, on its new job.
    await waitFor(() => expect(rowOf('dale-old').getByText('✓ JP1081 · 19 Harbor Ln')).toBeTruthy())
    expect(io.list).toHaveBeenCalledTimes(2)
    expect(host.onChanged).toHaveBeenCalledTimes(1)
    // A pick of the job it is on already does nothing.
    fireEvent.click(within(reader).getByRole('button', { name: 'Another job…' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Move this conversation onto' })).getByText('19 Harbor Ln'))
    expect(screen.queryByRole('dialog', { name: 'Move this conversation onto' })).toBeNull()
    expect(io.tag).toHaveBeenCalledTimes(1)
    expect(io.list).toHaveBeenCalledTimes(2)
  })

  it('puts a mail of a tagged conversation that no line holds yet on its job: the same tag again, and the bar and the row read again', async () => {
    let held = false
    const late = () =>
      mailRow('dale-late', { threadId: 't-dale-old', at: '2026-11-01T18:40:00.000Z', snippet: 'One more thing on the heater.', tagged: { ...ELM, messageId: held ? 'm-elm-9' : null } })
    const io = fakeMyMailIo({
      list: async () => ({ ...MY_MAIL_PAGE, rows: [late()], nextPageToken: null }),
      open: async () => openedMail(late()),
      tag: async () => {
        held = true
        return { ...TAG_OK, lines: 1, tied: 0, files: 0 }
      },
    })
    const { host } = await tab(io, { start: 'all' })
    await waitFor(() => expect(rowIds()).toEqual(['dale-late']))
    // The row says so before the reader does (v2.6295), and never offers a line it does not have.
    expect(rowOf('dale-late').queryByRole('button', { name: 'open the line ›' })).toBeNull()
    fireEvent.click(rowOf('dale-late').getByRole('button', { name: 'not on the job yet ›' }))
    const reader = await screen.findByRole('dialog', { name: 'Re: 4 Elm Ct water heater' })
    expect(await within(reader).findByText('This mail is not on the job yet.')).toBeTruthy()
    fireEvent.click(within(reader).getByRole('button', { name: 'Put it on the job' }))
    await waitFor(() => expect(io.tag).toHaveBeenCalledWith({ threadId: 't-dale-old', job: { kind: 'pipeline', id: 'job-elm' } }))
    expect(await screen.findByText('Added to JP1077. 1 line is on the job now.')).toBeTruthy()
    const bar = (await within(reader).findByText('✓ On')).closest('[data-my-mail-bar]') as HTMLElement
    expect(bar.textContent).toContain('JP1077 · 4 Elm Ct')
    expect(within(reader).queryByText('This mail is not on the job yet.')).toBeNull()
    await waitFor(() => expect(io.list).toHaveBeenCalledTimes(2))
    expect(io.open).toHaveBeenCalledTimes(2)
    expect(host.onChanged).toHaveBeenCalledTimes(1)
  })

  it('draws a refusal as one calm line: off with its door to Your account, off the Workspace in Google’s words', async () => {
    await tab(fakeMyMailIo({ list: async () => ({ ok: false, error: 'off', words: 'Your mail is not shown here. Turn on Show my mail on the My email tab in Settings, under Your account.' }) }))
    const off = await screen.findByText(/Your mail is not shown here/)
    expect(off.getAttribute('data-my-mail-refusal')).toBe('off')
    expect(within(off).getByRole('link', { name: 'Open Your account' }).getAttribute('href')).toBe('/settings?tab=settings-account#settings-my-mail')
    cleanup()
    await tab(fakeMyMailIo({ list: async () => ({ ok: false, error: 'offWorkspace', words: 'Google will not read this address for the app: it is not on the company Workspace. Google said: unauthorized_client.' }) }))
    const away = await screen.findByText(/Google said: unauthorized_client/)
    expect(within(away).queryByRole('link')).toBeNull()
  })

  it('draws a lost signal on the retry panel, and reads again on Retry', async () => {
    const io = fakeMyMailIo({ list: async () => Promise.reject(new FunctionsFetchError(new TypeError('Failed to fetch'))) })
    await tab(io)
    expect(await screen.findByText('No connection, so your mail could not be read. It reads again when the signal is back.')).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(io.list).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
  })

  it('with the switch off says so with its door, and reads nothing', async () => {
    const io = fakeMyMailIo()
    await tab(io, { on: false })
    expect((await screen.findByRole('link', { name: 'Open Your account' })).getAttribute('href')).toBe('/settings?tab=settings-account#settings-my-mail')
    expect(io.list).not.toHaveBeenCalled()
  })

  it('on a phone draws each row in one column', async () => {
    await tab(fakeMyMailIo(), { phone: true })
    await screen.findByTestId('my-mail-list')
    expect((document.querySelector('[data-my-mail-row="dale-new"]') as HTMLElement).style.gridTemplateColumns).toBe('minmax(0, 1fr)')
  })
})
