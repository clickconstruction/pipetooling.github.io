// @vitest-environment jsdom
/**
 * My email's door on the job (punch list #263 PR A, v2.6730): the line draws the conversations not on this job with Yes
 * on each, nothing for a switch that is off or a page with nothing on it, Yes tags onto this job and turns the row
 * green with a door to the thread, a refusal shows its words, and the door opens the tab searched as the line
 * searched. Dale and 4 Elm Ct are the mock-up's made-up people; nothing here is a real row.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MyMailRow, MyMailTagOk } from '../../../lib/myMail/contract'
import type { JobDoorIo } from '../../../lib/myMail/jobDoorIo'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { MyMailJobLine } from './MyMailJobLine'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const ELM_ID = '0f6c1a3e-2b4d-4e8f-9a1b-1c2d3e4f5a01'
const ELM = { kind: 'pipeline' as const, id: ELM_ID, key: `pipeline:${ELM_ID}`, num: 'JP1077', name: '4 Elm Ct' }
const NOW = '2026-11-08T18:00:00Z'

const row = (gmailId: string, threadId: string, at: string, over: Partial<MyMailRow> = {}): MyMailRow => ({
  gmailId,
  threadId,
  direction: 'in',
  who: { name: 'Dale Okafor', address: 'dale@ridgeway.example' },
  subject: 'Re: 4 Elm Ct water heater',
  snippet: '',
  at,
  files: 1,
  folded: null,
  tagged: null,
  guess: null,
  inMessages: null,
  ...over,
})
const PAGE = [
  row('m1', 't-elm', '2026-11-08T14:00:00Z'),
  row('m2', 't-elm', '2026-11-08T15:12:00Z'),
  row('m3', 't-invoice', '2026-11-07T09:00:00Z', { subject: 'Invoice 88412', direction: 'out', files: 0 }),
  row('m4', 't-on-job', '2026-11-08T16:00:00Z', { tagged: { ...ELM, messageId: 'l-1' } }),
]
const TAGGED: MyMailTagOk = { ok: true, jobKey: ELM.key, lines: 3, tied: 0, files: 1, contactId: 'c-dale', unknownSender: null }

function fakeIo(over: Partial<JobDoorIo> = {}): JobDoorIo {
  return {
    addresses: vi.fn(async () => ['dale@ridgeway.example']),
    read: vi.fn(async (addresses: readonly string[], num: string | null) => ({ query: `from:${addresses[0]} OR "${num}"`, rows: PAGE })),
    tag: vi.fn(async () => TAGGED),
    ...over,
  }
}

describe('MyMailJobLine', () => {
  it('reads the people’s addresses, then one page, and draws each conversation not on this job once with Yes', async () => {
    const io = fakeIo()
    renderWithProviders(<MyMailJobLine job={ELM} who="Dale Okafor" contactIds={['c-dale', 'c-pm']} io={io} nowIso={NOW} />)
    const line = await screen.findByTestId('my-mail-job-line')
    expect(io.addresses).toHaveBeenCalledWith(['c-dale', 'c-pm'])
    expect(io.read).toHaveBeenCalledWith(['dale@ridgeway.example'], 'JP1077')
    expect(line.getAttribute('aria-label')).toBe('Your mail with Dale Okafor')
    expect(screen.getByTestId('my-mail-job-line-count').textContent).toBe('2 conversations not on this job')
    // The conversation's newest mail, with how many the page holds and a clip for its file.
    expect(screen.getByTestId('my-mail-job-line-row-t-elm').textContent).toContain('Re: 4 Elm Ct water heater')
    expect(screen.getByTestId('my-mail-job-line-row-t-elm').textContent).toContain('2 in it')
    expect(screen.getByTestId('my-mail-job-line-row-t-invoice').textContent).toContain('you')
    expect(screen.queryByTestId('my-mail-job-line-row-t-on-job')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(2)
    expect(screen.getByText('Read from your Gmail as this opened. Nothing is kept until you press Yes.', { exact: false })).toBeTruthy()
    expect(io.tag).not.toHaveBeenCalled()
  })

  it('tags the conversation onto this job on Yes, turns the row green with a door to the thread, and tells the surface', async () => {
    const io = fakeIo()
    const onOpenThread = vi.fn()
    const onTagged = vi.fn()
    renderWithProviders(<MyMailJobLine job={ELM} who="Dale Okafor" addresses={['dale@ridgeway.example']} io={io} nowIso={NOW} onOpenThread={onOpenThread} onTagged={onTagged} />)
    await screen.findByTestId('my-mail-job-line')
    expect(io.addresses).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0]!)
    await waitFor(() => expect(screen.getByTestId('my-mail-job-line-row-t-elm').dataset.done).toBe('true'))
    expect(io.tag).toHaveBeenCalledWith('t-elm', { kind: 'pipeline', id: ELM_ID })
    expect(screen.getByTestId('my-mail-job-line-row-t-elm').textContent).toContain('on JP1077 ✓')
    expect(screen.getByTestId('my-mail-job-line-count').textContent).toBe('1 conversation not on this job')
    expect(onTagged).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'open the thread ›' }))
    expect(onOpenThread).toHaveBeenCalledWith('c-dale')
    // The other row keeps its Yes.
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(1)
  })

  it('shows the function’s words when a tag is refused, and the reason when the signal is lost', async () => {
    const io = fakeIo({ tag: vi.fn(async () => ({ ok: false as const, error: 'readOnly' as const, words: 'A training, sample or robot account cannot read mail here.' })) })
    renderWithProviders(<MyMailJobLine job={ELM} who="Dale" addresses={['dale@ridgeway.example']} io={io} nowIso={NOW} />)
    await screen.findByTestId('my-mail-job-line')
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' })[0]!)
    expect((await screen.findByRole('alert')).textContent).toBe('A training, sample or robot account cannot read mail here.')
    expect(screen.getByTestId('my-mail-job-line-row-t-elm').dataset.done).toBeUndefined()
  })

  it('draws nothing when the read answers no line, when the page has nothing not on the job, and when the read fails', async () => {
    const off = fakeIo({ read: vi.fn(async () => null) })
    const { unmount } = renderWithProviders(<MyMailJobLine job={ELM} who="Dale" addresses={['dale@ridgeway.example']} io={off} nowIso={NOW} />)
    await waitFor(() => expect(off.read).toHaveBeenCalled())
    expect(screen.queryByTestId('my-mail-job-line')).toBeNull()
    unmount()
    const onJob = fakeIo({ read: vi.fn(async () => ({ query: 'q', rows: [PAGE[3]!] })) })
    const second = renderWithProviders(<MyMailJobLine job={ELM} who="Dale" addresses={['dale@ridgeway.example']} io={onJob} nowIso={NOW} />)
    await waitFor(() => expect(onJob.read).toHaveBeenCalled())
    expect(screen.queryByTestId('my-mail-job-line')).toBeNull()
    second.unmount()
    const lost = fakeIo({
      read: vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    })
    renderWithProviders(<MyMailJobLine job={ELM} who="Dale" addresses={['dale@ridgeway.example']} io={lost} nowIso={NOW} />)
    await waitFor(() => expect(lost.read).toHaveBeenCalled())
    expect(screen.queryByTestId('my-mail-job-line')).toBeNull()
  })

  it('reads nothing with no people and no number, and opens the tab searched as the line searched', async () => {
    const io = fakeIo()
    const onOpenHref = vi.fn()
    const { unmount } = renderWithProviders(<MyMailJobLine job={{ ...ELM, num: '' }} who="Dale" addresses={[]} io={io} nowIso={NOW} />)
    await new Promise((r) => setTimeout(r, 10))
    expect(io.read).not.toHaveBeenCalled()
    unmount()
    const page = fakeIo({ read: vi.fn(async () => ({ query: 'from:dale@ridgeway.example OR "JP1077"', rows: [...PAGE, row('m9', 't-4', '2026-11-01T09:00:00Z'), row('m10', 't-5', '2026-11-02T09:00:00Z')] })) })
    renderWithProviders(<MyMailJobLine job={ELM} who="Dale Okafor" addresses={['dale@ridgeway.example']} io={page} nowIso={NOW} onOpenHref={onOpenHref} />)
    await screen.findByTestId('my-mail-job-line')
    // Four conversations: three drawn, one more behind the door.
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(3)
    expect(screen.getByTestId('my-mail-job-line-more').textContent).toBe('1 more. ')
    fireEvent.click(screen.getByTestId('my-mail-job-line-door'))
    expect(onOpenHref).toHaveBeenCalledWith('/messages?tab=my-email&q=from%3Adale%40ridgeway.example+OR+%22JP1077%22')
  })
})
