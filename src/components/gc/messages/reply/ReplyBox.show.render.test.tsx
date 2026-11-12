// @vitest-environment jsdom
/**
 * Punch list #319 PR 1: the ask for photos in the reply box. `/show` leads the `/` list with the app's own line; a
 * pick puts it in with the sender named and the link made for this thread taking `{show}`; a mint that fails leaves
 * the blank so the box holds the send; and a press on the look's card (the ask bus) puts the same line under whatever
 * is already written, for this person's box alone.
 */
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/renderSmokeMocks'
import type { Contact } from '../../../../lib/contacts/kernel'
import { askForPhotos } from '../../../../lib/firstLook/askBus'
import type { FirstLookThreadIo } from '../../../../lib/firstLook/threadIo'
import type { PapersIo } from '../../../../lib/messages/papersIo'
import type { ReplyIo } from '../../../../lib/messages/replyIo'
import type { QuickRepliesIo } from '../../../../lib/quickReplies/quickRepliesIo'
import { ReplyBox } from './ReplyBox'

const noPapers: PapersIo = { load: () => Promise.resolve([]) }

vi.mock('./useTextsOn', () => ({ useTextsOn: () => true }))
vi.mock('../../../../hooks/useFlowNow', () => ({ useFlowNow: () => null, openFlowStep: vi.fn() }))
vi.mock('../../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant', profileName: 'Rosa Delgado' })
})

const DANA: Contact = {
  id: 'c-dana',
  kind: 'customer',
  name: 'Dana Whitfield',
  goesBy: null,
  company: '',
  record: { table: 'customers', id: 'cust-dana' },
  channels: [{ id: 'ch-dana-cell', kind: 'phone', value: '(210) 555-0188', optedOutAt: null }],
  jobIds: [],
  defaultJobId: null,
  customerId: 'cust-dana',
  gcCompanyId: null,
}

const fakeQuick = (): QuickRepliesIo =>
  ({
    loadLines: vi.fn(() => Promise.resolve([])),
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

const LINK = 'https://clicktooling.com/show/k7m2p9xq4d'
const ASK = `Hi Dana, this is Rosa with Click Plumbing. So we can price this before we come out, send us a few photos or a short video here: ${LINK} Or reply to this text with the photos.`

function draw(over: { mint?: FirstLookThreadIo['mint']; contact?: Contact } = {}) {
  const quick = fakeQuick()
  const showLinkIo = { mint: vi.fn(over.mint ?? (() => Promise.resolve({ id: 'L1', link: LINK }))) }
  renderWithProviders(<ReplyBox papersIo={noPapers} contact={over.contact ?? DANA} io={fakeIo()} quickIo={quick} showLinkIo={showLinkIo} kinds={['text']} />)
  const el = document.querySelector('[data-reply-box]') as HTMLElement
  const textbox = within(el).getByRole('textbox') as HTMLTextAreaElement
  return { showLinkIo, quick, el, textbox }
}

const type = (textbox: HTMLTextAreaElement, text: string) => {
  fireEvent.change(textbox, { target: { value: text, selectionStart: text.length, selectionEnd: text.length } })
  textbox.setSelectionRange(text.length, text.length)
  fireEvent.select(textbox)
}

beforeEach(() => localStorage.clear())

describe('the ask for photos in the reply box (punch list #319 PR 1)', () => {
  it('/show leads the list with the ask, and a pick fills it with the link made for this thread', async () => {
    const { el, textbox, showLinkIo, quick } = draw()
    fireEvent.focus(textbox)
    type(textbox, '/show')
    const row = await waitFor(() => {
      const found = el.querySelector('[role="option"]')
      expect(found?.textContent).toContain('send us a few photos or a short video')
      return found as HTMLElement
    })
    fireEvent.mouseDown(row)
    fireEvent.click(row)
    await waitFor(() => expect(textbox.value).toBe(ASK))
    expect(showLinkIo.mint).toHaveBeenCalledWith('c-dana')
    // The app's own line is never counted as a press.
    expect(quick.press).not.toHaveBeenCalled()
  })

  it('a mint that fails leaves the blank, so the box does not send half a line', async () => {
    const { el, textbox } = draw({ mint: () => Promise.reject(new Error('Only the office can ask for photos.')) })
    fireEvent.focus(textbox)
    type(textbox, '/photo')
    const row = await waitFor(() => {
      const found = el.querySelector('[role="option"]')
      expect(found).toBeTruthy()
      return found as HTMLElement
    })
    fireEvent.mouseDown(row)
    fireEvent.click(row)
    await waitFor(() => expect(textbox.value).toContain('{show}'))
    await waitFor(() => expect(el.textContent).toContain('Fill {show} first.'))
  })

  it('a press on the look’s card puts the ask under the words already written', async () => {
    const { textbox, showLinkIo } = draw()
    fireEvent.focus(textbox)
    type(textbox, 'Thanks for the call.')
    act(() => askForPhotos('someone-else'))
    expect(showLinkIo.mint).not.toHaveBeenCalled()
    act(() => askForPhotos('c-dana'))
    await waitFor(() => expect(textbox.value).toBe(`Thanks for the call.\n${ASK}`))
    expect(showLinkIo.mint).toHaveBeenCalledTimes(1)
  })

  it('a number nobody has named is not greeted by name', async () => {
    const { textbox } = draw({ contact: { ...DANA, id: 'c-num', kind: 'unknown', name: '(210) 555-0199', record: null, customerId: null } })
    act(() => askForPhotos('c-num'))
    await waitFor(() => expect(textbox.value).toMatch(/^Hi, this is Rosa with Click Plumbing\./))
  })
})
