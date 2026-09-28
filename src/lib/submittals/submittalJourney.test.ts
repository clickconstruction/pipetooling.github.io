import { describe, expect, it } from 'vitest'
import { submittalJourney, type SubmittalJourneyInput } from './submittalJourney'

const base: SubmittalJourneyInput = { scheduleTags: 12, picks: 14, rev: null, room: null, decisions: null }
const draft = (o: Partial<NonNullable<SubmittalJourneyInput['rev']>> = {}) => ({ number: 1, status: 'draft', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: false, ...o })
const statuses = (i: SubmittalJourneyInput) => submittalJourney(i).stages.map((s) => s.status).join(',')

describe('submittalJourney', () => {
  it('has eight stages in process order', () => {
    expect(submittalJourney(base).stages.map((s) => `${s.number} ${s.label}`)).toEqual([
      '1 Schedule & picks', '2 Build Rev 1', '3 Reasons & sheets', '4 Package', '5 Share', '6 Their call', '7 Resubmit', '8 Procure',
    ])
  })

  it('a fresh bid with nothing picked points at Pricing', () => {
    const j = submittalJourney({ ...base, picks: 0 })
    expect(statuses({ ...base, picks: 0 })).toBe('current,later,later,later,later,later,later,later')
    expect(j.next).toEqual({ kind: 'next', text: "12 tags on the schedule, nothing picked yet. Pick a house for each part on the Pricing compare, or build Rev 1 now and type each row's product with Edit.", action: 'build_rev1', actionLabel: 'Build Rev 1 and type the products' })
  })

  it('a bid with no schedule offers typing it first, the robot second', () => {
    const j = submittalJourney({ ...base, scheduleTags: 0, picks: 0 })
    expect(j.next.action).toBe('plug_in_schedule')
    expect(j.next.text).toMatch(/No fixture schedule/)
  })

  it('schedule and picks ready → Build Rev 1 is the step, and its pill anchors on the empty card', () => {
    const j = submittalJourney(base)
    expect(statuses(base)).toBe('done,current,later,later,later,later,later,later')
    expect(j.next).toMatchObject({ kind: 'next', action: 'build_rev1', actionLabel: 'Build Rev 1 from the picks' })
    expect(j.stages[1]?.anchor).toBe('submittals-build')
  })

  it('a draft owing reasons and sheets → stage 3, worded with counts, Drop a vendor PDF as the door', () => {
    const i = { ...base, rev: draft({ owesReason: 2, sheetsNeeded: 10 }) }
    expect(statuses(i)).toBe('done,done,current,later,later,later,later,later')
    expect(submittalJourney(i).next).toEqual({ kind: 'next', text: "2 rows still owe a reason · 10 rows still need a cut sheet. Edit the rows, or drop the house's PDF and put its pages on the rows.", action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
    expect(submittalJourney(i).stages[1]?.anchor).toBe('submittals-revisions')
    expect(submittalJourney({ ...base, rev: draft({ owesReason: 1 }) }).next.text).toMatch(/^1 row still owes a reason\./)
  })

  it('a draft with no rows sends you back to the picks', () => {
    expect(submittalJourney({ ...base, rev: draft({ rows: 0 }) }).next).toMatchObject({ action: 'open_pricing', text: expect.stringMatching(/No rows/) })
  })

  it('rows complete → Build package; package built → Share', () => {
    expect(submittalJourney({ ...base, rev: draft() }).next).toMatchObject({ action: 'build_package', actionLabel: 'Build package' })
    expect(statuses({ ...base, rev: draft() })).toBe('done,done,done,current,later,later,later,later')
    expect(submittalJourney({ ...base, rev: draft({ packageBuilt: true }) }).next).toMatchObject({ action: 'share', actionLabel: 'Share' })
    expect(statuses({ ...base, rev: draft({ packageBuilt: true }) })).toBe('done,done,done,done,current,later,later,later')
  })

  it('shared and waiting: nobody opened it, or opened with names', () => {
    const shared = draft({ number: 2, status: 'shared', packageBuilt: true })
    const quiet = submittalJourney({ ...base, rev: shared, room: { status: 'open', opens: 0, identified: [] } })
    expect(quiet.next).toMatchObject({ kind: 'waiting', action: 'copy_room_link', text: expect.stringMatching(/nobody has opened the room yet/) })
    expect(statuses({ ...base, rev: shared, room: { status: 'open', opens: 0, identified: [] } })).toBe('done,done,done,done,done,waiting,later,later')
    const opened = submittalJourney({ ...base, rev: shared, room: { status: 'open', opens: 5, identified: ['Dana Whitfield'] } })
    expect(opened.next.text).toBe('Rev 2 is in the room · opened 5× · Dana Whitfield on it. Their calls land on the rows here; a question lands on your inbox.')
    const closed = submittalJourney({ ...base, rev: shared, room: { status: 'closed', opens: 5, identified: [] } })
    expect(closed.next).toMatchObject({ kind: 'waiting', action: null, text: expect.stringMatching(/room is closed/) })
  })

  it('rows sent back → Resubmit is the step with the Rev N+1 button', () => {
    const i = { ...base, rev: draft({ number: 2, status: 'shared', packageBuilt: true }), room: { status: 'open', opens: 9, identified: ['Dana Whitfield'] }, decisions: { decided: 14, approved: 13, open: 0, sentBack: 1, byName: ['Dana Whitfield'] } }
    expect(statuses(i)).toBe('done,done,done,done,done,done,current,current')
    expect(submittalJourney(i).next).toEqual({ kind: 'next', text: 'Dana Whitfield approved 13 and sent 1 back. Fix the pick on Pricing, then start the resubmit with only that row.', action: 'resubmit', actionLabel: 'Rev 3 from the 1 row sent back' })
  })

  it('every row approved → done; some still open → waiting', () => {
    const rev = draft({ number: 2, status: 'shared', packageBuilt: true })
    const all = submittalJourney({ ...base, rev, decisions: { decided: 14, approved: 14, open: 0, sentBack: 0, byName: ['Dana Whitfield'] } })
    expect(all.next).toEqual({ kind: 'done', text: 'Every row approved by Dana Whitfield. The procurement log is next.', action: null, actionLabel: null })
    expect(all.stages.slice(0, 7).every((s) => s.status === 'done')).toBe(true)
    expect(all.stages[7]!.status).toBe('current')
    const some = submittalJourney({ ...base, rev, decisions: { decided: 10, approved: 10, open: 4, sentBack: 0, byName: [] } })
    expect(some.next).toMatchObject({ kind: 'waiting', text: 'The reviewer approved 10 · 4 rows still open.' })
  })

  it('an older revision on screen is the record, not the work', () => {
    const j = submittalJourney({ ...base, rev: draft({ number: 1, status: 'shared', isNewest: false, packageBuilt: true }) })
    expect(j.next).toMatchObject({ kind: 'done', action: null, text: expect.stringMatching(/^Rev 1 is the record/) })
  })
})
