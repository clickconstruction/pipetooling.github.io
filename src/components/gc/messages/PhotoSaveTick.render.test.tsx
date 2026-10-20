// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MessageWindow } from './MessageWindow'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { contactById } from '../../../lib/contacts/kernel'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import type { LineFile } from '../../../lib/messages/lineFiles'
import { SENT_LINE_PREFIX } from '../../../lib/messages/sentLines'
import type { ThreadMessage } from '../../../lib/messages/thread'
import { loadPhotoSave, setPhotoSave } from '../../../lib/photos/photoSavesIo'

vi.mock('../../../lib/photos/photoSavesIo', () => ({ loadPhotoSave: vi.fn(), setPhotoSave: vi.fn() }))

// Messages, cut 10 (photos saved on arrival): the job's tick under a message's Attachments, at a phone's 375 px and at a desk.
const PHONE_QUERY = '(max-width: 760px)'
const realMatchMedia = window.matchMedia
function screenIs(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query === PHONE_QUERY,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

const view = spineMessagesView()
const greg = contactById(view.contacts, 'c-greg')!
// Greg's email to bids@, tied to the Boerne bid, with a PDF, a site photo, a link and a zip.
const email = view.messages.find((m) => m.id === 'm-greg-email-in')!
const BOERNE = 'bid:bid-boerne'
const TICK = 'Save every photo on this job to Drive as it comes in'

const load = vi.mocked(loadPhotoSave)
const set = vi.mocked(setPhotoSave)

function open(message: ThreadMessage = email) {
  renderWithProviders(<MessageWindow message={message} contact={greg} tile={view.tiles[BOERNE]} onClose={vi.fn()} />)
  return screen.getByRole('dialog')
}

describe('the job’s tick to save every photo to Drive (Messages, cut 10)', () => {
  beforeEach(() => {
    load.mockResolvedValue(null)
    set.mockReset()
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    window.matchMedia = realMatchMedia
  })

  for (const phone of [true, false]) {
    it(`starts off and turns on for the line’s job, saying since when (${phone ? '375 px' : 'a desk'})`, async () => {
      screenIs(phone)
      set.mockResolvedValue('2026-10-13T14:05:00.000Z')
      const win = open()
      expect(win.closest('[data-phone-sheet]')?.getAttribute('data-phone-sheet')).toBe(phone ? 'sheet' : 'window')
      const files = win.querySelector('[data-message-files]') as HTMLElement
      const tick = await within(files).findByRole('checkbox', { name: TICK })
      await waitFor(() => expect((tick as HTMLInputElement).disabled).toBe(false))
      expect(load).toHaveBeenCalledWith(BOERNE)
      expect((tick as HTMLInputElement).checked).toBe(false)
      expect(files.querySelector('[data-photo-tick]')?.getAttribute('data-photo-tick')).toBe('off')
      fireEvent.click(tick)
      expect(set).toHaveBeenCalledWith(BOERNE, true)
      await screen.findByText('This job is set to save its photos to Drive.')
      expect((tick as HTMLInputElement).checked).toBe(true)
      expect(files.querySelector('[data-photo-tick]')?.textContent).toContain('On since Tue Oct 13. Photos that came in before then are not copied.')
    })
  }

  it('reads a tick already on, and turns it off', async () => {
    load.mockResolvedValue('2026-10-13T14:05:00.000Z')
    set.mockResolvedValue(null)
    const win = open()
    const tick = (await within(win).findByRole('checkbox', { name: TICK })) as HTMLInputElement
    await waitFor(() => expect(tick.checked).toBe(true))
    fireEvent.click(tick)
    expect(set).toHaveBeenCalledWith(BOERNE, false)
    await screen.findByText('This job is set not to save its photos to Drive.')
    expect(tick.checked).toBe(false)
    expect(win.querySelector('[data-photo-tick]')?.textContent).not.toContain('On since')
  })

  it('toasts the function’s own words when it refuses, and stays as it was', async () => {
    set.mockRejectedValue(new Error('A training account cannot change where a job’s photos go.'))
    const win = open()
    const tick = (await within(win).findByRole('checkbox', { name: TICK })) as HTMLInputElement
    await waitFor(() => expect(tick.disabled).toBe(false))
    fireEvent.click(tick)
    await screen.findByText('A training account cannot change where a job’s photos go.')
    expect(tick.checked).toBe(false)
  })

  it('draws no tick when the read fails', async () => {
    load.mockRejectedValue(new Error('down'))
    const win = open()
    await waitFor(() => expect(load).toHaveBeenCalled())
    await waitFor(() => expect(win.querySelector('[data-photo-tick]')).toBeNull())
    expect(win.querySelector('[data-message-files]')).not.toBeNull()
  })

  it('shows no tick on a line on the person, a line with no picture, or a copy we sent', () => {
    const files = email.files as readonly LineFile[]
    open({ ...email, jobId: null })
    expect(screen.queryByRole('checkbox', { name: TICK })).toBeNull()
    cleanup()
    open({ ...email, files: files.filter((f) => f.icon !== 'image') })
    expect(screen.queryByRole('checkbox', { name: TICK })).toBeNull()
    cleanup()
    open({ ...email, id: `${SENT_LINE_PREFIX}copy-1`, direction: 'out' })
    expect(screen.queryByRole('checkbox', { name: TICK })).toBeNull()
    expect(load).not.toHaveBeenCalled()
  })
})
