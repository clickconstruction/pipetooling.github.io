import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { reopenBlocker, reopenNote, reopenPatch } from './jobContractReopen'

const sent = { status: 'sent', voided_at: null, first_viewed_at: null, view_count: 0, revision: 1, sent_channel: null as string | null }

describe('reopenBlocker', () => {
  it('offers Edit & re-send on a sent agreement nobody has opened — a link or a PDF email', () => {
    expect(reopenBlocker(sent)).toBeNull()
    expect(reopenBlocker({ ...sent, sent_channel: 'link' })).toBeNull()
    expect(reopenBlocker({ ...sent, sent_channel: 'pdf_email' })).toBeNull()
  })
  it('never once they have opened it: what they read stays on the record', () => {
    expect(reopenBlocker({ ...sent, first_viewed_at: '2026-09-03T15:00:00Z' })).toMatch(/opened it/)
    expect(reopenBlocker({ ...sent, view_count: 1 })).toMatch(/Void & redo/)
  })
  it('never a page already handed over, a draft, a signed or a voided one', () => {
    expect(reopenBlocker({ ...sent, sent_channel: 'handed' })).toMatch(/in their hands/)
    expect(reopenBlocker({ ...sent, status: 'draft' })).toMatch(/still a draft/)
    expect(reopenBlocker({ ...sent, status: 'signed' })).toMatch(/signed/)
    expect(reopenBlocker({ ...sent, voided_at: '2026-09-03T16:00:00Z' })).toMatch(/voided/)
    expect(reopenBlocker(null)).toMatch(/Nothing has been sent/)
  })
})

describe('reopenNote', () => {
  it('says what they may still be holding', () => {
    expect(reopenNote(sent)).toContain('unlocks here as revision 2')
    expect(reopenNote({ ...sent, revision: 3, sent_channel: 'pdf_email' })).toContain('revision 3 as a PDF')
    expect(reopenNote({ ...sent, revision: 3, sent_channel: 'pdf_email' })).toContain('file only a signed revision 4')
  })
})

describe('reopenPatch', () => {
  it('goes back to a draft one revision on, with no reminder waiting — and touches nothing else', () => {
    expect(reopenPatch({ revision: 1 })).toEqual({ status: 'draft', revision: 2, next_reminder_at: null })
  })
})
