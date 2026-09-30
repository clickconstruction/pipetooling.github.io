import { describe, expect, it } from 'vitest'
import { renderCtRosterAuditEmail } from '../../supabase/functions/_shared/ctRosterAuditEmail'
import type { CtRosterDiff } from '../../supabase/functions/_shared/ctRosterDiff'
import { sampleCtRosterDiff } from './teamSampleEmails'

const CLEAN: CtRosterDiff = { onlyInCt: [], linkedButGone: [], twinFlagMismatch: [], activeMismatch: [], emailChanged: [], backfillCandidates: [], clean: true }

// The weekly roster audit email (v2.4182 lift): the sample two-item drift and the all-clear.
describe('ctRosterAuditEmail kernel', () => {
  it('a clean audit is the Monday heartbeat', () => {
    const { subject, html } = renderCtRosterAuditEmail(CLEAN, 14, 14)
    expect(subject).toBe('CT↔PT roster audit: clean')
    expect(html).toContain('14 ClickTooling people · 14 CountTooling accounts · no drift — all clear ✅')
    expect(html).not.toContain('<h3')
  })

  it('the subject counts the items and pluralizes', () => {
    const { diff, ptCount, ctCount } = sampleCtRosterDiff()
    expect(renderCtRosterAuditEmail(diff, ptCount, ctCount).subject).toBe('CT↔PT roster audit: 2 items to look at')
    expect(renderCtRosterAuditEmail({ ...CLEAN, clean: false, onlyInCt: diff.onlyInCt }, 1, 1).subject).toBe('CT↔PT roster audit: 1 item to look at')
  })

  it('one section per non-empty list, with its count, hint, and the banned mark', () => {
    const { diff, ptCount, ctCount } = sampleCtRosterDiff()
    const { html } = renderCtRosterAuditEmail(diff, ptCount, ctCount)
    expect(html).toContain('Only on CountTooling (1)')
    expect(html).toContain('<code>oldsub@example.com</code> (banned)')
    expect(html).toContain('Backfill candidates (1)')
    expect(html).toContain('Kim Tech — <code>kim@example.com</code>')
    expect(html).not.toContain('Active mismatch')
    expect(html).toContain('drift found:')
  })

  it('a linked pair shows both sides, an admin seat says so, and names are escaped', () => {
    const pt = { id: 'u-1', email: 'a@example.com', name: 'A <B>', archived_at: null, is_digital_twin: false, counttooling_user_id: 'ct-1' }
    const ct = { ct_user_id: 'ct-1', email: 'a@example.com', is_digital_twin: true, is_admin: true, active: true }
    const { html } = renderCtRosterAuditEmail({ ...CLEAN, clean: false, twinFlagMismatch: [{ pt, ct }], onlyInCt: [ct] }, 2, 2)
    expect(html).toContain('A &lt;B&gt; — PT <code>a@example.com</code> ↔ CT <code>a@example.com</code>')
    expect(html).toContain('— CT admin')
  })
})
