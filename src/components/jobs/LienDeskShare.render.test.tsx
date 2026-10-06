// @vitest-environment jsdom
/**
 * Render smokes for the Lien desk's Share (v2.4311): the panel opens on the whole desk with the
 * message as it will go; a To row says who it is for (v2.4722); Which liens narrows it to one GC; Send to a teammate… hands the share sheet the
 * subject, the text and the link (or copies where there is no sheet); counsel's line copies the
 * firm's live link; Email a teammate… starts on the leader when approvals wait and sends the
 * payload, never HTML; Email me a test goes to the sender; Escape closes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienDeskShare from './LienDeskShare'
import type { LienDeskData } from '../../hooks/useLienDeskData'
import { buildLienDeskQueue, summarizeLienDeskForNeedsYou, type LienDeskItemRow, type LienNoticeMonthRow } from '../../lib/jobs/lienDesk'
import { buildLienAffidavitQueue } from '../../lib/jobs/lienDeskAffidavits'
import { EMPTY_LIEN_RETAINAGE_QUEUE } from '../../lib/jobs/lienDeskRetainage'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const people = [
  { id: 'u-mal', name: 'Malachi', email: 'malachi@example.test', role: 'master_technician' },
  { id: 'u-rob', name: 'Robert', email: 'robert@example.test', role: 'dev' },
  { id: 'u-tau', name: 'Taunya', email: 'taunya@example.test', role: 'assistant' },
]
const sendMock = vi.fn(async (_input: unknown) => ({ sentTo: ['Malachi'], failed: [] as string[] }))
const firmMock = vi.fn(async (_origin: string) => ({ firmName: 'Smith Law', url: 'https://clicktooling.test/legal?t=abc' }) as { firmName: string; url: string | null } | null)
vi.mock('../../lib/jobs/lienDeskShareIo', () => ({
  fetchLienSharePeople: async () => people,
  fetchFirmPortalUrl: (origin: string) => firmMock(origin),
  sendLienStatusEmail: (input: unknown) => sendMock(input),
}))

const TODAY = '2026-10-01'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function row(job: number, month: string, deadline: string, gc: string, owed: number): LienNoticeMonthRow {
  return { job_id: id(job), work_month: month, approved_hours: 8, deadline, noticed: false, open_balance: owed, customer_id: gc, gc_customer_id: gc, property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null }
}
const items = [
  { id: 'it-878', job_id: id(878), kind: 'notice_53_056', status: 'awaiting_approval', months: ['2026-07'], created_at: '2026-09-20T15:00:00Z', voided_at: null, sent_at: null, submitted_at: '2026-09-24T15:00:00Z', printed_at: null },
] as unknown as LienDeskItemRow[]
const queue = buildLienDeskQueue([row(878, '2026-07', '2026-10-15', 'gc-sp', 38625), row(898, '2026-07', '2026-10-15', 'gc-kn', 4800), row(258, '2026-08', '2026-10-15', 'gc-rmc', 9800)], items, {}, TODAY)
const data = {
  queue,
  summary: summarizeLienDeskForNeedsYou(queue),
  affidavits: buildLienAffidavitQueue([], [], TODAY),
  retainage: EMPTY_LIEN_RETAINAGE_QUEUE(),
  jobsById: {
    [id(878)]: { id: id(878), hcp_number: '878', click_number: null, job_name: 'Take 5- Seguin' },
    [id(898)]: { id: id(898), hcp_number: '898', click_number: null, job_name: 'Reliant Health' },
    [id(258)]: { id: id(258), hcp_number: '258', click_number: null, job_name: 'Dudley Mason' },
  },
  gcsById: { 'gc-sp': { id: 'gc-sp', name: 'Southern Post Construction' }, 'gc-kn': { id: 'gc-kn', name: 'Knight Contracting' }, 'gc-rmc': { id: 'gc-rmc', name: 'RMC- Dudley Mason' } },
} as unknown as LienDeskData

// jsdom has no share sheet; the tests that need one add it and remove it again.
const nav = navigator as unknown as { share?: unknown }
let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  sendMock.mockClear()
  writeText = vi.fn(async () => {})
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
})
afterEach(() => {
  delete nav.share
})

function renderShare(onClose = vi.fn()) {
  renderWithProviders(<LienDeskShare isMobile={false} data={data} calendarRows={[]} todayYmd={TODAY} me={{ id: 'u-grace', name: 'Grace' }} onClose={onClose} />)
  return onClose
}
const preview = () => document.querySelector('[data-lien-share-preview]')!.textContent ?? ''

describe('LienDeskShare — the panel', () => {
  it('opens on the whole desk with the message, the time and the desk’s link', async () => {
    renderShare()
    await settle()
    expect(screen.getByRole('dialog', { name: 'Share where the liens stand' })).toBeTruthy()
    expect(preview()).toContain('We are about to send lien notices on 3 jobs.')
    expect(preview()).toContain('$53,225 is owed on them.')
    expect(preview()).toContain('• Take 5- Seguin, Southern Post Construction, $38,625')
    expect(preview()).toContain(`${window.location.origin}/jobs?tab=stages&liendesk=1`)
    expect(screen.getByText(/^as of /)).toBeTruthy()
  })

  it('says who it is for before anything else: someone in the office, never a customer or a GC (v2.4722)', async () => {
    renderShare()
    await settle()
    const to = document.querySelector('[data-lien-share-to]')!
    expect(to.textContent).toContain('Someone in the office')
    expect(to.textContent).toContain('A master, a controller or an assistant. Never a customer or a GC.')
    const scope = document.querySelector('[data-lien-share-scope]')!
    expect(to.compareDocumentPosition(scope) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Which liens')).toBeTruthy()
    expect(screen.queryByText('What to send')).toBeNull()
    expect(screen.queryByText(/carries no names/)).toBeNull()
  })

  it('Which liens narrows the message to one GC', async () => {
    renderShare()
    await settle()
    fireEvent.click(document.querySelector('[data-lien-share-scope]')!)
    const menu = screen.getByRole('menu', { name: 'Which liens' })
    expect(within(menu).getAllByRole('menuitemradio').map((b) => b.querySelector('strong')?.textContent)).toEqual(['Everything on the desk', 'Southern Post Construction', 'RMC- Dudley Mason', 'Knight Contracting'])
    fireEvent.click(document.querySelector('[data-lien-share-scope-option="gc-rmc"]')!)
    expect(preview()).toContain('RMC- Dudley Mason liens,')
    expect(preview()).toContain('• 258 Dudley Mason, Aug, $9,800, to draft')
    expect(preview()).toContain('Open the Lien desk on job 258:')
    expect(preview()).toContain(`liendeskJob=${id(258)}`)
  })

  it('Send to a teammate… hands the share sheet the subject, the text and the link, then closes', async () => {
    const share = vi.fn(async () => {})
    nav.share = share
    const onClose = renderShare()
    await settle()
    const send = document.querySelector('[data-lien-share-send]') as HTMLButtonElement
    expect(send.textContent).toContain('Send to a teammate…')
    expect(document.activeElement).toBe(send)
    fireEvent.click(send)
    await settle()
    expect(share).toHaveBeenCalledTimes(1)
    const arg = (share.mock.calls[0] as unknown as [{ title: string; text: string; url: string }])[0]
    expect(arg.title).toBe('Liens, Oct 1: 3 notices due, $53,225, first by Oct 15')
    expect(arg.text.startsWith('Liens, ')).toBe(true)
    expect(arg.text.endsWith('Open the Lien desk:')).toBe(true)
    expect(arg.url).toBe(`${window.location.origin}/jobs?tab=stages&liendesk=1`)
    expect(onClose).toHaveBeenCalled()
    fireEvent.click(document.querySelector('[data-lien-share-copy]')!)
    await settle()
    expect(writeText).toHaveBeenCalledWith(preview())
  })

  it('without a share sheet the main button copies and says so', async () => {
    renderShare()
    await settle()
    const send = document.querySelector('[data-lien-share-send]') as HTMLButtonElement
    expect(send.textContent).toContain('Copy the text')
    expect(document.querySelector('[data-lien-share-copy]')).toBeNull()
    fireEvent.click(send)
    await settle()
    expect(writeText).toHaveBeenCalledWith(preview())
    expect(await screen.findByText('Copied. Paste it into a text, an email or a chat.')).toBeTruthy()
  })

  it('a refused copy says the one thing left to do, never a share sheet that was not there', async () => {
    writeText.mockRejectedValueOnce(Object.assign(new Error('Document is not focused.'), { name: 'NotAllowedError' }))
    renderShare()
    await settle()
    fireEvent.click(document.querySelector('[data-lien-share-send]')!)
    await settle()
    expect(await screen.findByText('Could not copy the message. Select it and copy it by hand.')).toBeTruthy()
    expect(screen.queryByText(/share sheet/)).toBeNull()
  })

  it('counsel’s line copies the firm’s live link', async () => {
    renderShare()
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Copy the firm’s link/ }))
    await settle()
    expect(writeText).toHaveBeenCalledWith('https://clicktooling.test/legal?t=abc')
  })

  it('a live link whose address is no longer readable (item 22) points at the Legal desk instead of going quiet', async () => {
    firmMock.mockResolvedValueOnce({ firmName: 'Smith Law', url: null })
    renderShare()
    await settle()
    expect(document.querySelector('[data-lien-share-firm]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /Copy the firm’s link/ })).toBeNull()
    expect(document.querySelector('[data-lien-share-firm-desk]')?.textContent).toMatch(/Send the link on the Legal desk/)
  })

  it('no firm link, no counsel line', async () => {
    firmMock.mockResolvedValueOnce(null)
    renderShare()
    await settle()
    expect(document.querySelector('[data-lien-share-firm]')).toBeNull()
  })

  it('Escape closes the panel', async () => {
    const onClose = renderShare()
    await settle()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('LienDeskShare — Email a teammate…', () => {
  it('starts on the leader when approvals wait and sends the payload, never HTML', async () => {
    const onClose = renderShare()
    await settle()
    fireEvent.click(document.querySelector('[data-lien-share-email]')!)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Email where the liens stand' })).toBeTruthy()
    const malachi = document.querySelector('[data-lien-share-person="u-mal"]')!
    expect(malachi.getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('[data-lien-share-person="u-grace"]')).toBeNull()
    expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Liens, Oct 1: 3 notices due, $53,225, first by Oct 15')
    fireEvent.change(screen.getByLabelText(/A note on top/), { target: { value: 'Seguin waits on you.' } })
    const send = document.querySelector('[data-lien-share-send-email]') as HTMLButtonElement
    expect(send.textContent).toBe('Send to Malachi')
    fireEvent.click(send)
    await settle()
    expect(sendMock).toHaveBeenCalledTimes(1)
    const input = sendMock.mock.calls[0]![0] as { mode: string; recipientIds: string[]; note: string; subject: string; payload: { jobs: unknown[]; gc: string | null } }
    expect(input.mode).toBe('send')
    expect(input.recipientIds).toEqual(['u-mal'])
    expect(input.note).toBe('Seguin waits on you.')
    expect(input.payload.jobs).toHaveLength(3)
    expect(input.payload.gc).toBeNull()
    expect(JSON.stringify(input)).not.toContain('<')
    expect(onClose).toHaveBeenCalled()
  })

  it('picks and unpicks people, and Email me a test goes to the sender', async () => {
    renderShare()
    await settle()
    fireEvent.click(document.querySelector('[data-lien-share-email]')!)
    await settle()
    fireEvent.click(document.querySelector('[data-lien-share-person="u-rob"]')!)
    expect((document.querySelector('[data-lien-share-send-email]') as HTMLButtonElement).textContent).toBe('Send to Malachi and Robert')
    fireEvent.click(document.querySelector('[data-lien-share-person="u-mal"]')!)
    fireEvent.click(document.querySelector('[data-lien-share-person="u-rob"]')!)
    expect((document.querySelector('[data-lien-share-send-email]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(document.querySelector('[data-lien-share-test]')!)
    await settle()
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'test', recipientIds: [] }))
    expect(await screen.findByText('A test is on its way to you.')).toBeTruthy()
  })

  it('‹ Back returns to the panel', async () => {
    renderShare()
    await settle()
    fireEvent.click(document.querySelector('[data-lien-share-email]')!)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: '‹ Back' }))
    expect(screen.getByRole('dialog', { name: 'Share where the liens stand' })).toBeTruthy()
  })
})
