import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { firmVoidProblem, isLegalClientId, isVoidedEntry, legalActDateProblem, legalLinkPerson, legalPlanDateProblem, legalRateLimitMessage, officeCanVoid, recordedByForLink, recordedByOf, recordedHowWords, voidIsRetry } from '../../../supabase/functions/_shared/legalPortalActs'
import { buildFirmActivity, type LegalMatterRow } from './legalMatters'
import { conversationRows, conversationWho, entryRecordedByWords } from './legalAsks'
import type { LegalEntryRow } from './legalMatters'

describe('the firm’s acts (#85 item 18)', () => {
  it('takes a real date up to today and up to three years back', () => {
    expect(legalActDateProblem('2026-10-01', '2026-10-05')).toBeNull()
    expect(legalActDateProblem('2026-10-05', '2026-10-05')).toBeNull()
    expect(legalActDateProblem('2026-10-06', '2026-10-05')).toBe('The date cannot be in the future.')
    expect(legalActDateProblem('2026-02-30', '2026-10-05')).toBe('Pick a date.')
    expect(legalActDateProblem('', '2026-10-05')).toBe('Pick a date.')
    expect(legalActDateProblem('2023-10-05', '2026-10-05')).toBeNull()
    expect(legalActDateProblem('2023-10-04', '2026-10-05')).toMatch(/three years/)
  })
  it('a planned step may sit ahead, up to three years either way (v2.5800)', () => {
    expect(legalPlanDateProblem('2026-12-15', '2026-10-05')).toBeNull()
    expect(legalPlanDateProblem('2029-10-05', '2026-10-05')).toBeNull()
    expect(legalPlanDateProblem('2029-10-06', '2026-10-05')).toBe('That day is more than three years ahead.')
    expect(legalPlanDateProblem('2023-10-04', '2026-10-05')).toMatch(/three years back/)
    expect(legalPlanDateProblem('', '2026-10-05')).toBe('Pick the day it is planned for.')
  })
  it('knows a one-time key and names the matter when the hourly limit is hit', () => {
    expect(isLegalClientId('3f2b8c1e-9d4a-4b7e-8c21-5a6f0e9d1b2c')).toBe(true)
    expect(isLegalClientId('not-a-key')).toBe(false)
    expect(isLegalClientId(42)).toBe(false)
    expect(legalRateLimitMessage('Lenox Builders', '3:40 PM')).toBe('60 changes on Lenox Builders in the last hour is the limit. Try again after 3:40 PM.')
    expect(legalRateLimitMessage(' ', null)).toBe('60 changes on this matter in the last hour is the limit. Try again in an hour.')
  })
  it('reads who recorded an act, and words it for each side', () => {
    expect(recordedByOf({ recordedBy: { id: 'r1', name: ' Dana Reyes ' } })).toEqual({ id: 'r1', name: 'Dana Reyes' })
    expect(recordedByOf({ recordedBy: { id: 'r1', name: '' } })).toBeNull()
    expect(recordedByOf(null)).toBeNull()
    const base = { id: 'e', matter_id: 'm', kind: 'fee', amount: 450, body: '', occurred_on: '2026-10-01', via_portal: true, created_by: null, acknowledged_at: null, created_at: '' } as LegalEntryRow
    const dana = { ...base, meta: { recordedBy: { id: 'r1', name: 'Dana Reyes' } } }
    expect(entryRecordedByWords(dana, 'firm')).toBe('Dana Reyes')
    expect(entryRecordedByWords(dana, 'office')).toBe('Dana Reyes · firm')
    expect(entryRecordedByWords({ ...base, meta: {} }, 'firm')).toBe('your firm')
    expect(entryRecordedByWords({ ...base, meta: {} }, 'office')).toBe('the firm')
    expect(entryRecordedByWords({ ...base, meta: {}, via_portal: false, created_by: 'u1' }, 'firm')).toBe('the office')
    expect(entryRecordedByWords({ ...base, meta: {}, via_portal: false, created_by: 'u1' }, 'office', () => 'Grace')).toBe('Grace')
    const [q] = conversationRows([{ ...dana, kind: 'question', created_at: '2026-10-01T15:00:00Z' }])
    expect(conversationWho(q!, 'firm')).toBe('Dana Reyes asked')
    expect(conversationWho(q!, 'office')).toBe('Dana Reyes at the firm asked')
  })
})

describe('an unknown Recorded by is refused, never saved as the firm (review)', () => {
  it('submit-legal-portal answers 400 when the id names nobody live on the firm’s list', () => {
    const src = readFileSync('supabase/functions/submit-legal-portal/index.ts', 'utf8')
    expect(src).toMatch(/if \(!who\) return jsonResponse\(\{ error: 'Pick who recorded this from the list\.' \}, 400\)/)
  })
})

describe('undo with a reason (#85 item 18, PR 2)', () => {
  const e = (over: Record<string, unknown>) => ({ kind: 'fee', via_portal: true, voided_at: null, acknowledged_at: null, ...over }) as { kind: string; via_portal: boolean; voided_at: string | null; acknowledged_at: string | null }
  it('each side undoes its own: the firm its fees, costs and an unapplied payment; the office its fees, costs and notes', () => {
    expect(firmVoidProblem(e({}))).toBeNull()
    expect(firmVoidProblem(e({ kind: 'cost' }))).toBeNull()
    expect(firmVoidProblem(e({ kind: 'payment_received' }))).toBeNull()
    expect(firmVoidProblem(e({ kind: 'payment_received', acknowledged_at: '2026-10-05T00:00:00Z' }))).toMatch(/already applied/)
    expect(firmVoidProblem(e({ kind: 'step' }))).toBe('Record the right step instead.')
    expect(firmVoidProblem(e({ via_portal: false }))).toMatch(/office’s/)
    expect(firmVoidProblem(e({ voided_at: '2026-10-05T00:00:00Z' }))).toBe('Already undone.')
    expect(officeCanVoid(e({ via_portal: false, kind: 'note' }))).toBe(true)
    expect(officeCanVoid(e({ via_portal: false, kind: 'plan' }))).toBe(true)
    expect(firmVoidProblem(e({ kind: 'plan' }))).toBeNull()
    expect(officeCanVoid(e({ via_portal: false, kind: 'recovery_applied' }))).toBe(false)
    expect(officeCanVoid(e({ via_portal: true }))).toBe(false)
    expect(isVoidedEntry({ voided_at: '2026-10-05T00:00:00Z' })).toBe(true)
  })
  it('a voided act leaves the office’s Needs You', () => {
    const m = { id: 'm1', payer_key: 'c:x', payer_name: 'Lenox' } as LegalMatterRow
    const row = { id: 'f1', matter_id: 'm1', kind: 'fee', amount: 3500, body: 'Filing fee', occurred_on: '2026-10-01', meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at: '2026-10-01T15:00:00Z' }
    expect(buildFirmActivity([row], [m]).count).toBe(1)
    expect(buildFirmActivity([{ ...row, voided_at: '2026-10-05T00:00:00Z' }], [m]).count).toBe(0)
    // The office's Acknowledge on a fee row stamps acknowledged_at, which takes it off the card too.
    expect(buildFirmActivity([{ ...row, acknowledged_at: '2026-10-05T00:00:00Z' }], [m]).count).toBe(0)
    // v2.5800: a step the firm planned on the timeline is a plan, not an act waiting on the office.
    expect(buildFirmActivity([{ ...row, kind: 'plan', amount: null, body: 'Mail the notice', meta: { notes: '', source: 'firm' } }], [m]).count).toBe(0)
  })
  it('a retried undo with the same reason is the same act; a different reason is not', () => {
    const done = { voided_at: '2026-10-05T00:00:00Z', voided_via_portal: true, void_reason: 'Entered twice' }
    expect(voidIsRetry(done, ' Entered twice ')).toBe(true)
    expect(voidIsRetry(done, 'Wrong matter')).toBe(false)
    expect(voidIsRetry({ ...done, voided_via_portal: false }, 'Entered twice')).toBe(false)
    expect(voidIsRetry({ voided_at: null }, 'Entered twice')).toBe(false)
  })
})

/**
 * v2.8312 (punch list #85, a review residual): *Recorded by* was the firm's own claim, since anyone holding
 * the link could pick any name. A firm now has one person's links beside its shared one (v2.4750), so the link
 * decides: on one person's link the act is that person's, whatever the page sent.
 */
describe('who an act is recorded by follows the link', () => {
  const own = { id: 'L1', purpose: 'person', label: ' Dana Reyes ' }
  const shared = { id: 'L0', purpose: 'firm', label: null }

  it('names the person a link belongs to, and nobody on the shared link', () => {
    expect(legalLinkPerson(own)).toBe('Dana Reyes')
    expect(legalLinkPerson(shared)).toBeNull()
    expect(legalLinkPerson({ id: 'L2', purpose: 'person', label: '  ' })).toBeNull()
    expect(legalLinkPerson({ id: 'L3', purpose: 'firm', label: 'Dana Reyes' })).toBeNull()
    expect(legalLinkPerson(null)).toBeNull()
  })

  it('on one person’s link it is that person, and a pick the page sent is not read', () => {
    expect(recordedByForLink(own, null)).toEqual({ id: 'link:L1', name: 'Dana Reyes', how: 'own_link' })
    expect(recordedByForLink(own, { id: 'r9', name: 'Somebody Else' })).toEqual({ id: 'link:L1', name: 'Dana Reyes', how: 'own_link' })
  })

  it('on the shared link it is the pick, marked as a pick, or nobody', () => {
    expect(recordedByForLink(shared, { id: 'r1', name: 'Lee Paralegal' })).toEqual({ id: 'r1', name: 'Lee Paralegal', how: 'shared_link' })
    expect(recordedByForLink(shared, null)).toBeNull()
    expect(recordedByForLink(null, { id: 'r1', name: 'Lee Paralegal' })).toEqual({ id: 'r1', name: 'Lee Paralegal', how: 'shared_link' })
  })

  it('reads how the name got there, and nothing on an act saved before the record kept it', () => {
    expect(recordedByOf({ recordedBy: { id: 'link:L1', name: 'Dana Reyes', how: 'own_link' } })).toEqual({ id: 'link:L1', name: 'Dana Reyes', how: 'own_link' })
    expect(recordedByOf({ recordedBy: { id: 'r1', name: 'Lee Paralegal', how: 'shared_link' } })?.how).toBe('shared_link')
    expect(recordedByOf({ recordedBy: { id: 'r1', name: 'Lee Paralegal', how: 'made up' } })).toEqual({ id: 'r1', name: 'Lee Paralegal' })
    expect(recordedHowWords({ how: 'own_link' })).toBe('own link')
    expect(recordedHowWords({ how: 'shared_link' })).toBe('name picked')
    expect(recordedHowWords({})).toBe('')
    expect(recordedHowWords(null)).toBe('')
  })

  it('the office reads which; the firm reads the name alone', () => {
    const base = { id: 'e', matter_id: 'm', kind: 'fee', amount: 450, body: '', occurred_on: '2026-11-22', via_portal: true, created_by: null, acknowledged_at: null, created_at: '' } as LegalEntryRow
    const pinned = { ...base, meta: { recordedBy: { id: 'link:L1', name: 'Dana Reyes', how: 'own_link' } } }
    const picked = { ...base, meta: { recordedBy: { id: 'r1', name: 'Lee Paralegal', how: 'shared_link' } } }
    expect(entryRecordedByWords(pinned, 'office')).toBe('Dana Reyes · firm · own link')
    expect(entryRecordedByWords(picked, 'office')).toBe('Lee Paralegal · firm · name picked')
    expect(entryRecordedByWords(pinned, 'firm')).toBe('Dana Reyes')
    expect(entryRecordedByWords(picked, 'firm')).toBe('Lee Paralegal')
    const [q] = conversationRows([{ ...pinned, kind: 'question', created_at: '2026-11-22T15:00:00Z' }])
    expect(conversationWho(q!, 'office')).toBe('Dana Reyes at the firm asked (own link)')
    expect(conversationWho(q!, 'firm')).toBe('Dana Reyes asked')
    const [q2] = conversationRows([{ ...picked, kind: 'question', created_at: '2026-11-22T15:00:00Z' }])
    expect(conversationWho(q2!, 'office')).toBe('Lee Paralegal at the firm asked (name picked)')
  })
})

describe('the functions read the link, never the page, on one person’s link', () => {
  const submit = readFileSync('supabase/functions/submit-legal-portal/index.ts', 'utf8')
  const portal = readFileSync('supabase/functions/legal-portal/index.ts', 'utf8')

  it('submit-legal-portal reads the link’s purpose and label with the key', () => {
    expect(submit.match(/select\('id, firm_id, revoked_at, purpose, label'\)/g)).toHaveLength(2)
  })

  it('a matter act: no pick is read on one person’s link, and the link decides the name', () => {
    expect(submit).toContain("const recordedById = legalLinkPerson(link) ? '' : str(body.recordedById, 64)")
    expect(submit).toContain('const recordedBy = recordedByForLink(link, picked)')
    expect(submit).toContain('if (recordedBy) meta.recordedBy = recordedBy')
    // Nothing else writes the name onto an act.
    expect(submit.match(/meta\.recordedBy = /g)).toHaveLength(1)
  })

  it('Start here’s answers: the link’s person before the name the page sent', () => {
    expect(submit).toContain('const by = legalLinkPerson(link) ?? str(body.by, 120)')
  })

  it('legal-portal tells the page whose link it is, in both answers', () => {
    expect(portal).toContain('const linkPerson = legalLinkPerson(link)')
    expect(portal.match(/recipients, linkPerson, firmPaused,/g)).toHaveLength(2)
  })
})
