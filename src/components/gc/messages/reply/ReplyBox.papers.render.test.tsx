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
