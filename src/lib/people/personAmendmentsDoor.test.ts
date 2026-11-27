import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { doorLinksPayload, doorWithdrawPayload, withdrawRefusalMeansAlreadyOff, WITHDRAW_WHY_MAX } from './personAmendmentsDoor'

const LINKS_MIGRATION = readFileSync('supabase/migrations/20261112050000_person_file_amendments.sql', 'utf8')
const IO = readFileSync('src/lib/people/personAmendmentsIo.ts', 'utf8')

describe('the HR tab writes a correction link through the door (punch list #315)', () => {
  it('one link a target, from the newer thing to each older one', () => {
    expect(
      doorLinksPayload({
        personId: 'p1',
        fromKind: 'hr_entry',
        fromId: 'e9',
        targets: [
          { kind: 'hr_entry', id: 'e1', how: 'corrects' },
          { kind: 'hr_evidence', id: 'f1', how: 'completes' },
        ],
      }),
    ).toEqual({
      person_id: 'p1',
      amendments: [
        { from_kind: 'hr_entry', from_id: 'e9', to_kind: 'hr_entry', to_id: 'e1', how: 'corrects' },
        { from_kind: 'hr_entry', from_id: 'e9', to_kind: 'hr_evidence', to_id: 'f1', how: 'completes' },
      ],
    })
  })

  it('a withdrawal carries the link, the file and the reason, trimmed and held to the length the door takes', () => {
    expect(doorWithdrawPayload({ personId: 'p1', id: 'a1', why: '  two different trucks ' })).toEqual({ person_id: 'p1', withdraw_amendments: [{ id: 'a1', why: 'two different trucks' }] })
    const long = doorWithdrawPayload({ personId: 'p1', id: 'a1', why: 'x'.repeat(WITHDRAW_WHY_MAX + 40) })
    expect(long.withdraw_amendments[0]?.why).toHaveLength(WITHDRAW_WHY_MAX)
  })

  it('reads the door’s one refusal that means the link is already off, and no other', () => {
    expect(withdrawRefusalMeansAlreadyOff("hr_agent_write: no live link 3f0c on this person's file")).toBe(true)
    expect(withdrawRefusalMeansAlreadyOff('hr_agent_write: withdraw_amendments[] needs id and why (1 to 200 characters)')).toBe(false)
    expect(withdrawRefusalMeansAlreadyOff('dev_hr_entry_write: devs only')).toBe(false)
    expect(withdrawRefusalMeansAlreadyOff(null)).toBe(false)
  })

  it('the door takes the keys and raises the words this file leans on', () => {
    // The keys the payloads use, as hr_agent_write reads them, and the reason's length.
    for (const key of ["p->'amendments'", "p->'withdraw_amendments'", "a->>'from_kind'", "a->>'to_kind'", "a->>'from_id'", "a->>'to_id'", "a->>'how'", "a->>'id'", "a->>'why'"]) expect(LINKS_MIGRATION).toContain(key)
    expect(LINKS_MIGRATION).toContain('length(v_why) NOT BETWEEN 1 AND 200')
    expect(LINKS_MIGRATION).toContain("RAISE EXCEPTION 'hr_agent_write: no live link % on this person''s file'")
    // Who made the link and who took it off come from the sign-in, never from the payload.
    expect(LINKS_MIGRATION).toContain("a->>'how', auth.uid(), v_label);")
    expect(LINKS_MIGRATION).toContain('SET withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawn_why = v_why')
  })

  it('the tab reads the table and writes it through the door alone', () => {
    expect(IO).toContain(".from('person_file_amendments').select(")
    expect(IO).not.toMatch(/\.from\('person_file_amendments'\)\s*\.(insert|update|upsert|delete)\(/)
    expect(IO.match(/\.rpc\('dev_hr_entry_write'/g)).toHaveLength(2)
    expect(IO).not.toContain('p_dry_run: true')
  })
})
