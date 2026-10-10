import { describe, expect, it } from 'vitest'
import {
  allFollowPeople,
  companyPeople,
  initialGcState,
  mailGroupName,
  type FollowPerson,
  type GcState,
} from './gcModel'

function personOf(state: GcState, partnerId: string): FollowPerson {
  const p = allFollowPeople(state, partnerId).find((x) => x.partner.id === partnerId)
  if (!p) throw new Error(`no ${partnerId}`)
  return p
}

describe('who at a trade gets what, on the office side (the owner, 2026-10-05)', () => {
  it("About lists the main contact and the people the company named, with each one's emails", () => {
    const pecan = personOf(initialGcState(), 'pecanvalley').partner
    expect(companyPeople(pecan).map((p) => [p.name, p.role, p.main, p.gets.map((g) => mailGroupName(g))])).toEqual([
      ['Marcus Bell', 'Main contact', true, ['Quotes and plans', 'The job', 'Contracts and changes']],
      ['Dana Whitfield', 'Bookkeeper', false, ['Pay and papers']],
    ])
  })
})
