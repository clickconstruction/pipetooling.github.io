// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import type { Contact } from '../../../../lib/contacts/kernel'
import type { RatingLinkIo } from '../../../../lib/ratings/ratingLinkIo'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickReply } from '../../../../lib/quickReplies/kernel'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { ReplyBox } from './ReplyBox'

// Send texts is on, so the Text tab draws its strip; the step they are on reads as nothing, so no read waits.
vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))

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

const LINE_RATE: QuickReply = {
  id: 'q-rate',
  text: '{first}, thanks for having us out. Tell us how we did with one tap: {rate}',
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'u-rosa',
  addedAt: 0,
  removed: false,
  uses: {},
  lastUsed: null,
}

const fakeQuick = (): QuickRepliesIo =>
  ({
    loadLines: vi.fn(() => Promise.resolve([LINE_RATE])),
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
  logCall: vi.fn(() => Promise.resolve('m-call-new')),
})

const LINK = 'https://clicktooling.com/rate?t=9mB7aa11bb22cc33dd44ee55ff667788'

function draw(over: { job?: boolean; mint?: RatingLinkIo['mint'] } = {}) {
  const ratingLinkIo: RatingLinkIo = { mint: vi.fn(over.mint ?? (() => Promise.resolve(LINK))), asksOn: vi.fn(() => Promise.resolve([])) }
  renderWithProviders(
    <ReplyBox
      contact={DANA}
      io={fakeIo()}
      quickIo={fakeQuick()}
      ratingLinkIo={ratingLinkIo}
      job={over.job === false ? undefined : { key: 'pipeline:j-helotes', name: 'Helotes re-pipe' }}
      kinds={['text']}
      openStrip
    />,
  )
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  const textbox = within(el).getByRole('textbox') as HTMLTextAreaElement
  return { ratingLinkIo, el, textbox }
}

beforeEach(() => localStorage.clear())

describe('{rate} mints a one-tap rating ask for the message (v2.5877)', () => {
  it('a press fills the line and the minted link takes the blank, named by contact and job', async () => {
    localStorage.setItem('msgQrOpen', '1')
    const { el, textbox, ratingLinkIo } = draw()
    await waitFor(() => expect(el.querySelector('[data-qr-line="q-rate"]')).toBeTruthy())
    fireEvent.click(el.querySelector('[data-qr-line="q-rate"]')!)
    await waitFor(() => expect(textbox.value).toBe(`Dana, thanks for having us out. Tell us how we did with one tap: ${LINK}`))
    expect(ratingLinkIo.mint).toHaveBeenCalledWith('c-dana', 'j-helotes', 'Dana Whitfield')
  })

  it('in a thread with no job, the ask is minted on the person alone', async () => {
    localStorage.setItem('msgQrOpen', '1')
    const { el, textbox, ratingLinkIo } = draw({ job: false })
    await waitFor(() => expect(el.querySelector('[data-qr-line="q-rate"]')).toBeTruthy())
    fireEvent.click(el.querySelector('[data-qr-line="q-rate"]')!)
    await waitFor(() => expect(textbox.value).toContain(LINK))
    expect(ratingLinkIo.mint).toHaveBeenCalledWith('c-dana', null, 'Dana Whitfield')
  })

  it('a mint that fails leaves the blank, so the box does not send half a line', async () => {
    localStorage.setItem('msgQrOpen', '1')
    const { el, textbox } = draw({ mint: () => Promise.reject(new Error('The rating link was not made.')) })
    await waitFor(() => expect(el.querySelector('[data-qr-line="q-rate"]')).toBeTruthy())
    fireEvent.click(el.querySelector('[data-qr-line="q-rate"]')!)
    await waitFor(() => expect(textbox.value).toContain('{rate}'))
    expect(textbox.value).toContain('{rate}')
  })
})
