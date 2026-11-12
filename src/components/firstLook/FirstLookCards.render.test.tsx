// @vitest-environment jsdom
/**
 * Punch list #319 PR 1: the First look card above a person's lines. Over a fake io: a thread with no look draws
 * nothing; an ask with nothing in says the link is not opened; files draw as a picture and a player with a texted
 * picture beside them, and the look is stamped looked at once; a customer's Start an estimate opens a draft with no
 * convert; a number nobody named is told to name them; Ask again asks the reply box; Close the look asks first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { Contact } from '../../lib/contacts/kernel'
import { onAskForPhotos } from '../../lib/firstLook/askBus'
import type { ThreadLook, ThreadLookFile } from '../../lib/firstLook/card'
import type { FirstLookThreadIo } from '../../lib/firstLook/threadIo'
import type { LeadDoorsIo } from '../../lib/messages/leadDoorsIo'
import type { ThreadMessage } from '../../lib/messages/thread'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { OpenThreadContext, type OpenThread } from '../gc/messages/openThread'
import { FirstLookCards } from './FirstLookCards'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
const jobForm = vi.hoisted(() => ({ openNewJob: vi.fn() }))
vi.mock('../../contexts/JobFormModalContext', () => ({ useJobFormModal: () => ({ isOpen: false, openNewJob: jobForm.openNewJob, openEditJob: vi.fn(), closeJobForm: vi.fn() }) }))
const router = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => router.navigate }))
const win = vi.hoisted(() => ({ closeThread: vi.fn() }))
vi.mock('../gc/messages/useThreadWindow', () => ({ useThreadWindow: () => ({ contactId: 'dana', at: null, openThread: vi.fn(), closeThread: win.closeThread }) }))

const channel = (value: string): Contact['channels'][number] => ({ id: 'ch-phone', kind: 'phone', value, optedOutAt: null })
const DANA: Contact = { id: 'dana', kind: 'customer', name: 'Dana Whitfield', goesBy: null, company: '', record: { table: 'customers', id: 'cust-dana' }, channels: [channel('(830) 555-0101')], jobIds: [], defaultJobId: null, customerId: 'cust-dana', gcCompanyId: null }
const NUMBER: Contact = { ...DANA, id: 'num', kind: 'unknown', name: '(830) 555-0199', record: null, customerId: null }

const NOW = Date.now()
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString()
const LOOK: ThreadLook = { id: 'L1', contact_id: 'dana', asked_by_name: 'Rosa', made_at: iso(60), expires_at: new Date(NOW + 6 * 86_400_000).toISOString(), opened_at: null, sent_at: null, looked_at: null, closed_at: null, place: null, words: null }
const PHOTO: ThreadLookFile = { id: 'F1', look_id: 'L1', kind: 'photo', mime: 'image/jpeg', storage_path: 'L1/F1.jpg', bytes: 400_000, seconds: null, finished_at: iso(30) }
const VIDEO: ThreadLookFile = { id: 'F2', look_id: 'L1', kind: 'video', mime: 'video/mp4', storage_path: 'L1/F2.mp4', bytes: 9_000_000, seconds: 14, finished_at: iso(29) }

const fakeIo = (over: Partial<FirstLookThreadIo> = {}): FirstLookThreadIo => ({
  looks: vi.fn(async () => ({ looks: [], files: [] })),
  signLookFiles: vi.fn(async (paths: readonly string[]) => Object.fromEntries(paths.map((p) => [p, `https://files.test/${p}`]))),
  signTexted: vi.fn(async (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, `https://texted.test/${id}`]))),
  mint: vi.fn(async () => ({ id: 'L9', link: 'https://clicktooling.com/show/k7m2p9xq4d' })),
  stamp: vi.fn(async () => undefined),
  ...over,
})
const fakeDoors = (): LeadDoorsIo => ({ convert: vi.fn(async () => ({ customerId: 'cust-1' })), startEstimate: vi.fn(async () => ({ estimateNumber: 42 })) })

function draw(contact: Contact, io: FirstLookThreadIo, lines: ThreadMessage[] = []) {
  const doors = fakeDoors()
  const open: OpenThread = { contact, lines, jobFilter: null, rail: [], tiles: {}, userNames: {}, nowIso: new Date(NOW).toISOString(), searchJobs: vi.fn(async () => []) }
  renderWithProviders(
    <OpenThreadContext.Provider value={open}>
      <FirstLookCards contact={contact} io={io} doorsIo={doors} />
    </OpenThreadContext.Provider>,
  )
  return { io, doors }
}

afterEach(() => {
  cleanup()
  jobForm.openNewJob.mockClear()
  router.navigate.mockClear()
  win.closeThread.mockClear()
})

describe('the First look card on a thread (punch list #319 PR 1)', () => {
  it('a thread with no look draws nothing', async () => {
    const { io } = draw(DANA, fakeIo())
    await waitFor(() => expect(io.looks).toHaveBeenCalledWith('dana'))
    expect(document.querySelector('[data-first-looks]')).toBeNull()
  })

  it('an ask with nothing in says so, and stamps nothing', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [LOOK], files: [] })) })
    draw(DANA, io)
    expect(await screen.findByText('Nothing in yet. They have not opened the link.')).toBeTruthy()
    expect(screen.getByText(/^Asked .* by Rosa$/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ask again' })).toBeTruthy()
    expect(io.stamp).not.toHaveBeenCalled()
  })

  it('draws a photo, a video in a player and a texted picture, and stamps the look as looked at once', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [{ ...LOOK, sent_at: iso(20), place: 'Kitchen', words: 'It drips at night' }], files: [PHOTO, VIDEO] })) })
    const texted = { id: 'm1', contactId: 'dana', channel: 'text', direction: 'in', at: iso(10), who: 'Dana', body: '', files: [{ id: 'att-1', name: 'IMG_1.jpg', mime: 'image/jpeg', size: 1, kept: 'copy', url: null, icon: 'image', paper: null, paperAnswer: null, paperAnsweredBy: null, paperAnsweredAt: null }] } as unknown as ThreadMessage
    draw(DANA, io, [texted])
    expect(await screen.findByText('2 photos and 1 video in.')).toBeTruthy()
    await waitFor(() => expect(document.querySelectorAll('[data-look-file="photo"] img')).toHaveLength(2))
    expect((document.querySelector('[data-look-file="photo"] img') as HTMLImageElement).src).toBe('https://files.test/L1/F1.jpg')
    expect((document.querySelector('[data-look-file="video"]') as HTMLVideoElement).src).toBe('https://files.test/L1/F2.mp4')
    expect(screen.getByAltText('Photo 2, texted in')).toBeTruthy()
    expect(document.querySelector('[data-look-words]')?.textContent).toBe('Kitchen. They wrote: It drips at night')
    expect(screen.getByRole('button', { name: 'Ask for more' })).toBeTruthy()
    await waitFor(() => expect(io.stamp).toHaveBeenCalledWith('L1', 'looked'))
    expect(io.stamp).toHaveBeenCalledTimes(1)
  })

  it('a picture the browser cannot draw becomes a named chip with Open', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [LOOK], files: [PHOTO] })) })
    draw(DANA, io)
    const img = await waitFor(() => {
      const el = document.querySelector('[data-look-file="photo"] img')
      expect(el).toBeTruthy()
      return el as HTMLImageElement
    })
    fireEvent.error(img)
    const chip = document.querySelector('[data-look-file="chip"]') as HTMLElement
    expect(chip.textContent).toBe('Photo 1Open')
    expect(chip.querySelector('a')?.getAttribute('href')).toBe('https://files.test/L1/F1.jpg')
  })

  it('a customer’s Start an estimate opens a draft on them with no convert', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [LOOK], files: [PHOTO] })) })
    const { doors } = draw(DANA, io)
    fireEvent.click(await screen.findByRole('button', { name: 'Start an estimate' }))
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/estimates/42', { state: { freshEstimateDraft: true } }))
    expect(doors.convert).not.toHaveBeenCalled()
    expect(doors.startEstimate).toHaveBeenCalledWith('cust-dana', expect.objectContaining({ role: 'assistant' }))
    expect(win.closeThread).toHaveBeenCalled()
  })

  it('a customer’s Book a visit opens Add Job with their name and their words', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [{ ...LOOK, words: 'It drips at night', place: 'Kitchen' }], files: [PHOTO] })) })
    draw(DANA, io)
    fireEvent.click(await screen.findByRole('button', { name: 'Book a visit' }))
    await waitFor(() => expect(jobForm.openNewJob).toHaveBeenCalled())
    expect(jobForm.openNewJob.mock.calls[0]![0].prefillCustomer).toEqual({ name: 'Dana Whitfield', phone: '(830) 555-0101', email: null, note: 'Kitchen: It drips at night' })
  })

  it('a number nobody has named gets no doors, and is told to name them', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [{ ...LOOK, contact_id: 'num' }], files: [] })) })
    draw(NUMBER, io)
    expect(await screen.findByText('Name them to start an estimate or book a visit. Press Who is this?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Start an estimate' })).toBeNull()
  })

  it('Ask again asks this person’s reply box for the ask', async () => {
    const io = fakeIo({ looks: vi.fn(async () => ({ looks: [LOOK], files: [] })) })
    const heard = vi.fn()
    const other = vi.fn()
    const stop = onAskForPhotos('dana', heard)
    const stopOther = onAskForPhotos('someone-else', other)
    draw(DANA, io)
    fireEvent.click(await screen.findByRole('button', { name: 'Ask again' }))
    expect(heard).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
    stop()
    stopOther()
  })

  it('Close the look asks first, then closes and reads again', async () => {
    const looks = vi.fn(async () => ({ looks: [LOOK], files: [] as ThreadLookFile[] }))
    const io = fakeIo({ looks })
    draw(DANA, io)
    fireEvent.click(await screen.findByRole('button', { name: 'Close the look' }))
    expect(io.stamp).not.toHaveBeenCalled()
    expect(screen.getByText('Close this look? The card leaves the thread and the link stops taking photos.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close the look' }))
    const before = looks.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Close the look' }))
    await waitFor(() => expect(io.stamp).toHaveBeenCalledWith('L1', 'closed'))
    await waitFor(() => expect(looks.mock.calls.length).toBeGreaterThan(before))
  })
})
