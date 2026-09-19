import { describe, expect, it } from 'vitest'
import { buildEmailReportPeople, digestDraftsFor, personKeyForEmail, personKeyForUser, planDigestRowWrites } from './emailReportPeople'
import type { SubscriptionWithAuthors } from '../reportEmailSubscriptions'

const roster = [
  { id: 'u-mal', name: 'Malachi', email: 'malachi@x.com' },
  { id: 'u-rob', name: 'Robert', email: 'robert@x.com' },
  { id: 'u-wen', name: 'Wendi', email: 'wendi@x.com' },
  { id: 'u-abe', name: 'Abraham', email: 'abe@x.com' },
  { id: 'u-dar', name: 'Darren', email: 'darren@x.com' },
]
const schedules = [
  { id: 's-last', name: 'Last week recap' },
  { id: 's-yest', name: 'Yesterday recap' },
]
const sub = (over: Partial<SubscriptionWithAuthors['subscription']>, authorUserIds: string[] = [], teamLeadUserIds: string[] = []): SubscriptionWithAuthors => ({
  subscription: { id: 'sub', recipient_user_id: null, recipient_email: null, label: null, all_authors: true, auto_send: true, enabled: true, created_by: null, created_at: null, updated_at: null, ...over },
  authorUserIds,
  teamLeadUserIds,
})

describe('buildEmailReportPeople (v2.3595)', () => {
  it('one row per person, sorted by name, digests and every-report folded together', () => {
    const people = buildEmailReportPeople({
      roster,
      schedules,
      digestRecipients: [
        { id: 'r1', schedule_id: 's-yest', recipient_user_id: 'u-rob', activity_scope: 'calendar_yesterday', crew_filter: 'all_users', include_costs: false },
        { id: 'r2', schedule_id: 's-last', recipient_user_id: 'u-wen', activity_scope: 'calendar_last_week', crew_filter: 'my_team', include_costs: true },
      ],
      subscriptions: [
        sub({ id: 'sub-mal', recipient_user_id: 'u-mal' }),
        sub({ id: 'sub-rob', recipient_user_id: 'u-rob', all_authors: false }, [], ['u-abe']),
        sub({ id: 'sub-owner', recipient_email: 'Owner@Example.com', label: 'Owner', all_authors: false }, ['u-dar']),
      ],
    })
    expect(people.map((p) => p.name)).toEqual(['Malachi', 'Owner', 'Robert', 'Wendi'])
    const rob = people.find((p) => p.userId === 'u-rob')!
    expect(rob.digests.map((d) => `${d.scheduleName} · ${d.text}`)).toEqual(['Yesterday recap · jobs yesterday · all users'])
    expect(rob.everyReport?.text).toBe('reports from everyone Abraham leads')
    const wen = people.find((p) => p.userId === 'u-wen')!
    expect(wen.digests[0]?.text).toBe('jobs last week · my team · with costs')
    expect(wen.everyReport).toBeNull()
    const mal = people.find((p) => p.userId === 'u-mal')!
    expect(mal.digests).toEqual([])
    expect(mal.everyReport?.text).toBe('every report anyone files')
    const owner = people.find((p) => p.outside)!
    expect(owner).toMatchObject({ key: 'email:owner@example.com', email: 'Owner@Example.com', name: 'Owner', digests: [] })
    expect(owner.everyReport?.text).toBe('reports from Darren')
  })

  it('keys are stable and an unknown user still gets a row', () => {
    expect(personKeyForUser('u1')).toBe('user:u1')
    expect(personKeyForEmail('  A@B.com ')).toBe('email:a@b.com')
    const people = buildEmailReportPeople({
      roster: [],
      schedules,
      digestRecipients: [{ id: 'r', schedule_id: 's-yest', recipient_user_id: 'ghost', activity_scope: 'weird', crew_filter: 'weird', include_costs: false }],
      subscriptions: [],
    })
    expect(people[0]).toMatchObject({ name: 'Unknown user', userId: 'ghost' })
    expect(people[0]?.digests[0]).toMatchObject({ activityScope: 'calendar_yesterday', crewFilter: 'all_users' })
  })

  it('a digest on a schedule the reader was not given is dropped; digests follow schedule order', () => {
    const people = buildEmailReportPeople({
      roster,
      schedules,
      digestRecipients: [
        { id: 'r1', schedule_id: 's-yest', recipient_user_id: 'u-rob', activity_scope: 'calendar_yesterday', crew_filter: 'all_users', include_costs: false },
        { id: 'r2', schedule_id: 's-last', recipient_user_id: 'u-rob', activity_scope: 'calendar_last_week', crew_filter: 'all_users', include_costs: false },
        { id: 'r3', schedule_id: 's-gone', recipient_user_id: 'u-rob', activity_scope: 'calendar_today', crew_filter: 'all_users', include_costs: false },
      ],
      subscriptions: [],
    })
    expect(people[0]?.digests.map((d) => d.scheduleName)).toEqual(['Last week recap', 'Yesterday recap'])
  })
})

describe('the person editor plan', () => {
  const rob = buildEmailReportPeople({
    roster,
    schedules,
    digestRecipients: [{ id: 'r1', schedule_id: 's-yest', recipient_user_id: 'u-rob', activity_scope: 'calendar_yesterday', crew_filter: 'all_users', include_costs: false }],
    subscriptions: [],
  })[0]!

  it('drafts one slice per schedule, on where the person has a row', () => {
    const drafts = digestDraftsFor(schedules, rob)
    expect(drafts).toEqual([
      { scheduleId: 's-last', on: false, activityScope: 'calendar_yesterday', crewFilter: 'all_users', includeCosts: false },
      { scheduleId: 's-yest', on: true, activityScope: 'calendar_yesterday', crewFilter: 'all_users', includeCosts: false },
    ])
    expect(digestDraftsFor(schedules, null).every((d) => !d.on)).toBe(true)
  })

  it('writes only the rows that changed — insert, update and delete by id, never a rewrite', () => {
    const drafts = digestDraftsFor(schedules, rob)
    expect(planDigestRowWrites('u-rob', rob.digests, drafts)).toEqual({ inserts: [], updates: [], deletes: [] })
    const changed = drafts.map((d) => (d.scheduleId === 's-last' ? { ...d, on: true, activityScope: 'calendar_last_week' as const } : { ...d, includeCosts: true }))
    expect(planDigestRowWrites('u-rob', rob.digests, changed)).toEqual({
      inserts: [{ schedule_id: 's-last', recipient_user_id: 'u-rob', activity_scope: 'calendar_last_week', crew_filter: 'all_users', include_costs: false }],
      updates: [{ id: 'r1', activity_scope: 'calendar_yesterday', crew_filter: 'all_users', include_costs: true }],
      deletes: [],
    })
    const off = drafts.map((d) => ({ ...d, on: false }))
    expect(planDigestRowWrites('u-rob', rob.digests, off)).toEqual({ inserts: [], updates: [], deletes: ['r1'] })
  })
})
