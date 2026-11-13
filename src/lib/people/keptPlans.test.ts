import { describe, expect, it } from 'vitest'
import { daysBetweenYmd, isKeepablePlanVerb, keepPayload, keepRefusal, keptByWords, keptPlanAgeWords, keptPlanApplyVerb, keptPlanArgKey, keptPlanSubject, keptPlansHeadWords, keptPlansToShow, type KeptPlanRow } from './keptPlans'

/** Made-up rows. */
const row = (id: string, state: string, kept_at: string, decided_at: string | null = null): KeptPlanRow => ({ id, person_id: 'p1', verb: 'plan_hr_entry', words: 'One entry.', author_label: 'Robert', session_label: 'morning session', kept_at, state, decided_label: decided_at ? 'Robert' : null, decided_at, decided_why: state === 'stale' ? 'The document was saved since.' : null })
const ymdOf = (iso: string) => iso.slice(0, 10)

describe('which plans may be kept', () => {
  it('only the verbs about a person’s file whose arguments are words alone', () => {
    expect(isKeepablePlanVerb('plan_hr_entry')).toBe(true)
    expect(isKeepablePlanVerb('plan_person_evidence')).toBe(false)
    expect(keepRefusal('plan_person_evidence', { evidence: {} })).toContain('not a plan that can be kept')
    expect(keepRefusal('plan_bill', { bill: {} })).toContain('Apply this one in its session')
    expect(keepRefusal('plan_hr_entry', null)).toBe('A kept plan needs the plan verb’s arguments.')
    expect(keepRefusal('plan_hr_entry', { entry: { person_id: 'p1', entries: [{ entry_date: '2026-11-03', content: 'x' }] } })).toBeNull()
  })

  it('never a file’s bytes and never counsel-only material, wherever in the arguments they sit', () => {
    expect(keepRefusal('plan_person_doc', { doc: { person_id: 'p1', title: 'Note', markdown: 'x', counsel_only: true } })).toBe('A counsel-only plan is not kept: its words stay in the session that made it.')
    expect(keepRefusal('plan_person_doc', { doc: { person_id: 'p1', title: 'Note', markdown: 'x', counsel_only: false } })).toBeNull()
    expect(keepRefusal('plan_hr_entry', { entry: { person_id: 'p1', files: [{ name: 'a.pdf', content_base64: 'AAAA' }] } })).toContain('bytes are not stored')
  })

  it('names the arguments’ key, the subject and the verb that applies', () => {
    expect([keptPlanArgKey('plan_hr_entry'), keptPlanArgKey('plan_person_doc'), keptPlanArgKey('plan_person_report')]).toEqual(['entry', 'doc', 'report'])
    expect([keptPlanSubject('plan_hr_entry'), keptPlanSubject('plan_person_doc'), keptPlanSubject('plan_person_report'), keptPlanSubject('plan_x')]).toEqual(['an HR entry', 'an HR document', 'a field report', 'a plan'])
    expect(keptPlanApplyVerb('plan_person_doc')).toBe('apply_person_doc')
  })

  it('builds the door’s payload, the session left out when blank', () => {
    expect(keepPayload({ personId: 'p1', verb: 'plan_hr_entry', args: { entry: { person_id: 'p1' } }, planHash: 'a'.repeat(64), reply: { entries_inserted: 1 }, words: '  One entry dated Nov 3.  ', session: ' ' })).toEqual({ person_id: 'p1', verb: 'plan_hr_entry', args: { entry: { person_id: 'p1' } }, plan_hash: 'a'.repeat(64), reply: { entries_inserted: 1 }, words: 'One entry dated Nov 3.' })
    expect(keepPayload({ personId: 'p1', verb: 'plan_hr_entry', args: {}, planHash: 'b'.repeat(64), reply: null, words: 'x', session: ' morning ' })).toMatchObject({ reply: {}, session: 'morning' })
  })
})

describe('the list in words', () => {
  it('says how long a plan has waited, by calendar days', () => {
    expect(daysBetweenYmd('2026-11-10', '2026-11-12')).toBe(2)
    expect(daysBetweenYmd('2026-11-12', '2026-11-10')).toBe(0)
    expect(keptPlanAgeWords('2026-11-12', '2026-11-12')).toBe('waiting today')
    expect(keptPlanAgeWords('2026-11-11', '2026-11-12')).toBe('waiting 1 day')
    expect(keptPlanAgeWords('2026-11-08', '2026-11-12')).toBe('waiting 4 days')
  })

  it('says who kept it, from which session, on which day', () => {
    expect(keptByWords({ author_label: 'Robert', session_label: 'morning session' }, '2026-11-10')).toBe('Kept by Robert’s agent, morning session, Nov 10, 2026')
    expect(keptByWords({ author_label: null, session_label: null }, '2026-11-10')).toBe('Kept by an agent, Nov 10, 2026')
    expect(keptPlansHeadWords(2)).toBe('Waiting on you (2)')
  })

  it('shows the waiting plans oldest first, then the ones that went stale this week; applied and dropped are not listed', () => {
    const rows = [
      row('c', 'waiting', '2026-11-12T15:00:00Z'),
      row('a', 'waiting', '2026-11-10T15:00:00Z'),
      row('s-new', 'stale', '2026-11-09T15:00:00Z', '2026-11-11T15:00:00Z'),
      row('s-old', 'stale', '2026-10-01T15:00:00Z', '2026-10-02T15:00:00Z'),
      row('d', 'dropped', '2026-11-09T15:00:00Z', '2026-11-10T15:00:00Z'),
      row('ap', 'applied', '2026-11-09T15:00:00Z', '2026-11-10T15:00:00Z'),
    ]
    const shown = keptPlansToShow(rows, '2026-11-12', ymdOf)
    expect(shown.waiting.map((r) => r.id)).toEqual(['a', 'c'])
    expect(shown.stale.map((r) => r.id)).toEqual(['s-new'])
    expect(keptPlansToShow([], '2026-11-12', ymdOf)).toEqual({ waiting: [], stale: [] })
  })
})
