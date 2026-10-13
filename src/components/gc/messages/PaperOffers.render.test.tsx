// @vitest-environment jsdom
/**
 * Messages, cut 6: a file on a line that reads as a trade partner's paper is offered, never filed on its own. The press
 * closes the thread and opens the company window at that paper with the file; It is not answers the offer for everyone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'dev' as string | null | undefined }))
const io = vi.hoisted(() => ({ answerPaper: vi.fn(async (_id: string, _answer: string) => undefined) }))
const threadWindow = vi.hoisted(() => ({ closeThread: vi.fn() }))
vi.mock('../../../hooks/useAuth', () => ({ useOptionalAuth: () => (auth.role === undefined ? null : { role: auth.role }) }))
vi.mock('../../../lib/messages/messagesIo', () => ({ answerPaper: io.answerPaper }))
vi.mock('./useThreadWindow', () => ({ useThreadWindow: () => ({ contactId: 'c-greg', at: null, openThread: vi.fn(), closeThread: threadWindow.closeThread }) }))

import { PaperOffers } from './PaperOffers'
import { MessagesRereadContext } from './useMessagesReread'
import { GcCompanyOpenerContext } from '../gcCompanyOpener'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { contactById } from '../../../lib/contacts/kernel'
import { hasPaperOffer, lineFilesFromRows, type MessageAttachmentRow } from '../../../lib/messages/lineFiles'
import { SPINE_ATTACHMENTS, spineMessagesView } from '../../../lib/messages/spineRows'
import type { ThreadMessage } from '../../../lib/messages/thread'

const view = spineMessagesView()
const greg = contactById(view.contacts, 'c-greg')!
const coiRow: MessageAttachmentRow = { ...SPINE_ATTACHMENTS[0]!, id: 'f-coi', name: 'Hillside COI 2027.pdf', size_bytes: 380_000, bucket_path: 'g-2/1-Hillside-COI-2027.pdf', paper: 'coi' }
const lineWith = (rows: MessageAttachmentRow[]): ThreadMessage => ({ ...view.messages.find((m) => m.id === 'm-greg-email-in')!, files: lineFilesFromRows(rows).get('m-greg-email-in')! })

function offer(message: ThreadMessage) {
  const openPartner = vi.fn()
  const reread = vi.fn()
  renderWithProviders(
    <GcCompanyOpenerContext.Provider value={{ openPartner }}>
      <MessagesRereadContext.Provider value={reread}>
        <PaperOffers message={message} contact={greg} />
      </MessagesRereadContext.Provider>
    </GcCompanyOpenerContext.Provider>,
  )
  return { openPartner, reread, box: () => within(document.querySelector('[data-paper-offer="f-coi"]') as HTMLElement) }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  auth.role = 'dev'
})

describe('PaperOffers (Messages, cut 6)', () => {
  it('offers only a line whose kept file reads as a paper', () => {
    expect(hasPaperOffer(lineWith([coiRow]).files, greg)).toBe(true)
    expect(hasPaperOffer(lineWith(SPINE_ATTACHMENTS).files, greg)).toBe(false)
    expect(hasPaperOffer(lineWith([{ ...coiRow, paper_answer: 'not_it' }]).files, greg)).toBe(false)
    expect(hasPaperOffer(undefined, greg)).toBe(false)
  })

  it('files a certificate from the company window: the thread closes and the window opens at Insurance with the file', () => {
    const { openPartner, box } = offer(lineWith([coiRow]))
    expect(box().getByText('This reads like Hillside Excavation’s certificate of insurance.')).toBeTruthy()
    fireEvent.click(box().getByRole('button', { name: 'File this as their certificate' }))
    expect(threadWindow.closeThread).toHaveBeenCalledTimes(1)
    expect(openPartner).toHaveBeenCalledWith('gc-hillside', {
      tab: 'documents',
      doc: 'insurance',
      file: { attachmentId: 'f-coi', name: 'Hillside COI 2027.pdf', link: 'https://clicktooling.com/files/messages/f-coi', from: 'Greg’s email' },
    })
  })

  it('goes to the paper outside the signed-in app, where nobody may file', () => {
    auth.role = undefined
    const { box } = offer(lineWith([coiRow]))
    expect(box().getByRole('button', { name: 'Go to their insurance paper' })).toBeTruthy()
  })

  it('goes to the paper for a reader who may not file, and to the W-9 paper for a W-9', () => {
    auth.role = 'assistant'
    const { openPartner, box } = offer(lineWith([coiRow, { ...coiRow, id: 'f-w9', sort_order: 1, name: 'Hillside W-9.pdf', paper: 'w9' }]))
    expect(box().queryByRole('button', { name: 'File this as their certificate' })).toBeNull()
    fireEvent.click(box().getByRole('button', { name: 'Go to their insurance paper' }))
    const w9 = within(document.querySelector('[data-paper-offer="f-w9"]') as HTMLElement)
    expect(w9.getByText('This reads like Hillside Excavation’s W-9.')).toBeTruthy()
    fireEvent.click(w9.getByRole('button', { name: 'Go to their W-9 paper' }))
    expect(openPartner.mock.calls.map((c) => [c[0], (c[1] as { doc: string }).doc])).toEqual([
      ['gc-hillside', 'insurance'],
      ['gc-hillside', 'w9'],
    ])
  })

  it('takes the offer away with It is not, then reads the thread again; a refusal is said in words', async () => {
    const { reread, box } = offer(lineWith([coiRow]))
    fireEvent.click(box().getByRole('button', { name: 'It is not' }))
    await waitFor(() => expect(reread).toHaveBeenCalledTimes(1))
    expect(io.answerPaper).toHaveBeenCalledWith('f-coi', 'not_it')
    io.answerPaper.mockRejectedValueOnce(new Error('That offer could not be answered from this account.'))
    fireEvent.click(box().getByRole('button', { name: 'It is not' }))
    expect(await screen.findByText(/That offer could not be answered from this account/)).toBeTruthy()
    expect(reread).toHaveBeenCalledTimes(1)
  })
})
