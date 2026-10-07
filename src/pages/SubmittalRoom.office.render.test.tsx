// @vitest-environment jsdom
/**
 * The review room refuses the office (v2.4599, punch list #62): a write the function refuses for a
 * signed-in office session or the office's preview shows its reason where the press was — the
 * identify sheet, the send bar, the thread — and a preview's writes carry the flag. Kept apart
 * from `SubmittalRoom.render.test.tsx` so the two can change without touching each other.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SubmittalRoom from './SubmittalRoom'
import { OFFICE_REFUSAL } from '../../supabase/functions/_shared/submittalReviewActions'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: () => Promise.resolve({ apikey: 'anon', Authorization: 'Bearer office-session' }) }))

const row = (o: Record<string, unknown>) => ({ id: 'r', tag: 'X-1', kind: 'matches', plans: 'TOTO CT708UVG', proposed: 'TOTO CT708UVG#01', why: '', performanceChange: false, sheetPages: 1, decision: null, ...o })
const payload = (o: Record<string, unknown> = {}) => ({
  status: 'open',
  closedAt: null,
  bid: { label: 'B398 ZZ Test', projectName: 'ZZ Test', address: '5501 Balcones Dr, Austin, TX' },
  company: { name: 'Click Plumbing', tagline: 'Plumbing, Electrical, and HVAC', phone: '(512) 555-0100' },
  person: null,
  revisions: [
    {
      id: 'rev-2', rev: 2, sharedAt: '2026-09-16T15:00:00Z', current: true, hasPackage: true,
      rows: [row({ id: 'a', tag: 'DWH-1', kind: 'differs', plans: 'Rheem RH375 · 40 gal', proposed: 'Bradford White RE2HP50 · 50 gal', why: 'The specified product has a long lead time · about 1 week.' })],
      counts: { total: 1, matches: 0, differs: 1, notQuoted: 0, added: 0, decided: 0, open: 1 },
    },
  ],
  ...o,
})

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SubmittalRoom />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('SubmittalRoom · the office is never the GC (v2.4599, #62)', () => {
  /** The room for GETs; every write answers as the function does for the office. */
  function refuseWrites(room: unknown) {
    const posts: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('get-submittal-room')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(room) } as Response)
      const action = (JSON.parse(String(init?.body ?? '{}')) as { action: 'identify' | 'message' | 'decide' }).action
      posts.push(String(url))
      return Promise.resolve({ ok: false, status: 403, json: () => Promise.resolve({ error: OFFICE_REFUSAL[action], code: 'office' }) } as Response)
    }))
    return posts
  }
  const dana = { id: 'p1', name: 'Dana Whitfield', role: 'architect', mayDecide: true }

  it('identify refused: the sheet shows the reason and stays open; a preview’s writes carry the flag', async () => {
    const posts = refuseWrites(payload())
    mount('/submittal?t=roomtoken&preview=1')
    await screen.findByText('1 product needs your answer')
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on DWH-1' })).getByRole('button', { name: 'Approve' }))
    const sheet = await screen.findByRole('dialog', { name: 'Before you decide' })
    fireEvent.change(within(sheet).getByLabelText('Your name'), { target: { value: 'Wendi' } })
    fireEvent.change(within(sheet).getByLabelText('Your email'), { target: { value: 'wendi@example.com' } })
    fireEvent.click(within(sheet).getByRole('button', { name: "That's me" }))
    expect((await within(sheet).findByRole('alert')).textContent).toBe('You are signed in as the office. Enter their answer from the Submittals tab.')
    expect(screen.getByRole('dialog', { name: 'Before you decide' })).toBeTruthy()
    expect(posts[0]).toMatch(/submit-submittal-review\?preview=1$/)
  })

  it('decide refused on a personal link: the send bar shows the reason, nothing reads as recorded', async () => {
    const posts = refuseWrites(payload({ person: dana }))
    mount('/submittal?t=ptok')
    await screen.findByText('1 product needs your answer')
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on DWH-1' })).getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send my review' }))
    expect((await within(screen.getByTestId('room-send')).findByRole('alert')).textContent).toBe('You are signed in as the office. Enter their answer from the Submittals tab.')
    expect(screen.queryByRole('status')).toBeNull()
    expect(posts[0]).toMatch(/submit-submittal-review$/)
  })

  it('an ask refused: the thread shows the reason', async () => {
    refuseWrites(payload({ person: dana, messages: [] }))
    mount('/submittal?t=ptok')
    const thread = await screen.findByTestId('room-thread')
    fireEvent.change(within(thread).getByLabelText('Ask about a product or say what you need'), { target: { value: 'Which finish?' } })
    fireEvent.click(within(thread).getByRole('button', { name: 'Ask' }))
    expect((await within(thread).findByRole('alert')).textContent).toBe('You are signed in as the office. Answer their questions from the Submittals tab.')
  })

  it('v2.4608 · opened from the office’s door, the page says so; opened plain, it does not', async () => {
    refuseWrites(payload())
    const { unmount } = mount('/submittal?t=roomtoken&preview=1')
    await screen.findByText('1 product needs your answer')
    expect(screen.getByTestId('room-preview-banner').textContent).toBe('You are looking as the office. Nothing here is counted or saved.')
    unmount()
    mount('/submittal?t=roomtoken')
    await screen.findByText('1 product needs your answer')
    expect(screen.queryByTestId('room-preview-banner')).toBeNull()
  })
})

