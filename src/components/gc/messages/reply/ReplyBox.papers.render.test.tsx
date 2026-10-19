// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import type { Contact } from '../../../../lib/contacts/kernel'
import type { Paper } from '../../../../lib/messages/papers'
import type { PapersIo } from '../../../../lib/messages/papersIo'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { ReplyBox } from './ReplyBox'

// Send texts is on, so the Text tab draws its strip; the step they are on reads as nothing, so no read waits.
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))

// Made-up people and money: Dana Whitfield and the Helotes re-pipe, as the mock-ups say.
const DANA: Contact = {
  id: 'c-dana',
  kind: 'customer',
  name: 'Dana Whitfield',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-dana' },
  channels: [{ id: 'ch-dana-cell', kind: 'phone', value: '(210) 555-0188', optedOutAt: null }],
  jobIds: ['pipeline:j-helotes'],
  defaultJobId: null,
  customerId: 'cust-dana',
  gcCompanyId: null,
}

const REMIND: QuickReply = {
  id: 'q-remind',
  text: '{first}, {amount} is still open on job {number}. You can pay it here: {bill}',
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: 0,
  removed: false,
  uses: {},
  lastUsed: null,
}

const PAPERS: Paper[] = [
  { kind: 'bill', id: 'b-other', jobId: 'j-water', job: 'Water heater', number: '1400', open: true, amount: 420, billedYmd: '2026-10-18', payUrl: 'https://clicktooling.com/pay/b-other' },
  { kind: 'bill', id: 'b-1042', jobId: 'j-helotes', job: 'Helotes re-pipe', number: '1312', open: true, amount: 1440, billedYmd: '2026-10-12', payUrl: 'https://clicktooling.com/pay/b-1042' },
  { kind: 'bill', id: 'b-paid', jobId: 'j-helotes', job: 'Helotes re-pipe', number: '1312', open: false, amount: 300, billedYmd: '2026-09-01', payUrl: 'https://clicktooling.com/pay/b-paid' },
  { kind: 'estimate', id: 'e-1044', jobId: null, job: 'Kitchen re-pipe', number: '1044', approved: false, amount: 3200, sentYmd: '2026-10-14' },
]

// Cast, so the fake reads the same before and after the shortcut's io lands beside it.
const fakeQuick = (): QuickRepliesIo =>
  ({
    loadLines: vi.fn(() => Promise.resolve([REMIND])),
    loadVersions: vi.fn(() => Promise.resolve({})),
    press: vi.fn(() => Promise.resolve()),
    add: vi.fn(() => Promise.resolve('q-new')),
    edit: vi.fn(() => Promise.resolve(1)),
    remove: vi.fn(() => Promise.resolve()),
    restore: vi.fn(() => Promise.resolve()),
    setPress: vi.fn(() => Promise.resolve(1)),
    setShortcut: vi.fn(() => Promise.resolve(1)),
  }) as QuickRepliesIo

const fakeIo = (): ReplyIo => ({
  loadSender: vi.fn(() => Promise.resolve({ name: 'Rosa' })),
  addNote: vi.fn(() => Promise.resolve('m-note')),
  sendEmail: vi.fn(() => Promise.resolve('m-email')),
  sendText: vi.fn(() => Promise.resolve('m-text')),
})

function draw(over: { job?: boolean; contact?: Contact } = {}) {
  const papersIo: PapersIo = { load: vi.fn(() => Promise.resolve(PAPERS)) }
  renderWithProviders(
    <ReplyBox
      contact={over.contact ?? DANA}
      io={fakeIo()}
      quickIo={fakeQuick()}
      papersIo={papersIo}
      job={over.job === false ? undefined : { key: 'pipeline:j-helotes', name: 'Helotes re-pipe' }}
      kinds={['text']}
      openStrip
    />,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  const textbox = within(el).getByRole('textbox') as HTMLTextAreaElement
  return { papersIo, el, textbox }
}

beforeEach(() => localStorage.clear())

describe('a line about money fills from the right bill (#127)', () => {
  it('in a job’s box, from the job’s own open bill: what is open, its number and its pay page', async () => {
    const { papersIo, el, textbox } = draw()
    await waitFor(() => expect(el.querySelector('[data-qr-line="q-remind"]')).toBeTruthy())
    expect(papersIo.load).toHaveBeenCalledWith('cust-dana')
    await waitFor(() => expect(el.querySelector('[data-qr-line="q-remind"]')?.textContent).toContain('$1,440'))
    fireEvent.click(el.querySelector('[data-qr-line="q-remind"]')!)
    expect(textbox.value).toBe('Dana, $1,440 is still open on job 1312. You can pay it here: https://clicktooling.com/pay/b-1042')
  })

  it('in a thread with no job, from their newest open bill', async () => {
    localStorage.setItem('msgQrOpen', '1')
    const { el, textbox } = draw({ job: false })
    await waitFor(() => expect(el.querySelector('[data-qr-line="q-remind"]')?.textContent).toContain('$420'))
    fireEvent.click(el.querySelector('[data-qr-line="q-remind"]')!)
    expect(textbox.value).toBe('Dana, $420 is still open on job 1400. You can pay it here: https://clicktooling.com/pay/b-other')
  })

  it('reads no papers for someone who is not a customer', async () => {
    const { papersIo, el } = draw({ contact: { ...DANA, kind: 'trade', customerId: null } })
    await waitFor(() => expect(el.querySelector('[data-qr-strip]')).toBeTruthy())
    expect(papersIo.load).not.toHaveBeenCalled()
  })
})

const paperIds = (el: HTMLElement) => [...el.querySelectorAll('[data-slash-paper]')].map((r) => r.getAttribute('data-slash-paper'))
const type = (box: HTMLTextAreaElement, value: string) => fireEvent.change(box, { target: { value } })

describe('/bill lists the customer’s bills after the lines (#127 PR 2)', () => {
  it('lists the job’s open bills first, then the other job’s, then the paid one, under “Dana’s bills”', async () => {
    const { el, textbox } = draw()
    type(textbox, '/bill')
    await waitFor(() => expect(paperIds(el)).toEqual(['b-1042', 'b-other', 'b-paid']))
    expect(el.querySelector('[data-slash-papers]')?.textContent).toBe("Dana's bills")
    expect(el.querySelector('[data-slash-paper="b-1042"]')?.textContent).toContain('$1,440')
  })

  it('Enter on a bill puts in the team’s bill line, filled for that bill', async () => {
    const { el, textbox } = draw()
    type(textbox, '/bill')
    await waitFor(() => expect(paperIds(el)).toHaveLength(3))
    // The line that holds {bill} comes first, then the papers: ↓ twice lights the second bill, the other job's.
    fireEvent.keyDown(textbox, { key: 'ArrowDown' })
    fireEvent.keyDown(textbox, { key: 'ArrowDown' })
    fireEvent.keyDown(textbox, { key: 'Enter' })
    expect(textbox.value).toBe('Dana, $420 is still open on job 1400. You can pay it here: https://clicktooling.com/pay/b-other')
  })

  it('a paid bill takes the app’s copy words, with its own amount and pay page', async () => {
    const { el, textbox } = draw()
    type(textbox, '/owe')
    await waitFor(() => expect(paperIds(el)).toHaveLength(3))
    fireEvent.mouseDown(el.querySelector('[data-slash-paper="b-paid"]')!)
    expect(textbox.value).toBe('Dana, here is a copy of your paid bill 1312 for Helotes re-pipe: https://clicktooling.com/pay/b-paid')
  })

  it('offers no estimate until estimates can be shared by link', async () => {
    const { el, textbox } = draw()
    type(textbox, '/estimate')
    await waitFor(() => expect(el.querySelector('[data-slash-list]')).toBeTruthy())
    expect(paperIds(el)).toEqual([])
  })
})
