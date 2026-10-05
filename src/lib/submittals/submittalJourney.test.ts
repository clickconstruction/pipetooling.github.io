import { describe, expect, it } from 'vitest'
import { groupJourneyStages, stageGate, SUBMITTAL_STAGE_GROUPS, submittalJourney, type SubmittalJourneyInput } from './submittalJourney'

const base: SubmittalJourneyInput = { scheduleTags: 12, picks: 14, rev: null, room: null, decisions: null }
const draft = (o: Partial<NonNullable<SubmittalJourneyInput['rev']>> = {}) => ({ number: 1, status: 'draft', isNewest: true, rows: 14, owesReason: 0, sheetsNeeded: 0, packageBuilt: false, ...o })
const statuses = (i: SubmittalJourneyInput) => submittalJourney(i).stages.map((s) => s.status).join(',')

describe('submittalJourney', () => {
  it('has eight stages in process order', () => {
    expect(submittalJourney(base).stages.map((s) => `${s.number} ${s.label}`)).toEqual([
      '1 Sources', '2 Build Rev 1', '3 Reasons & sheets', '4 Package', '5 Share', '6 Their call', '7 Resubmit', '8 Procure',
    ])
  })

  it('a fresh bid with nothing picked points at Pricing', () => {
    const j = submittalJourney({ ...base, picks: 0 })
    expect(statuses({ ...base, picks: 0 })).toBe('current,later,later,later,later,later,later,later')
    expect(j.next).toEqual({ kind: 'next', text: "12 tags on the schedule. Nothing picked yet. Pick a house for each part on Pricing. Or build Rev 1 now and type each product with Edit.", action: 'build_rev1', actionLabel: 'Build Rev 1 and type the products' })
  })

  it('v2.4107 · a bid priced from a takeoff, with no picks, is told to choose from the takeoff', () => {
    const j = submittalJourney({ ...base, scheduleTags: 0, picks: 0, takeoff: { fixtures: 26, withProduct: 22 } })
    expect(j.next).toEqual({ kind: 'next', text: 'The takeoff has 26 fixtures. 22 of them have a part. Pick what the GC sees, then build Rev 1 from them. You can type the plans’ schedule later. Then each row is checked against it.', action: 'choose_from_takeoff', actionLabel: 'Choose from the takeoff' })
    expect(statuses({ ...base, scheduleTags: 0, picks: 0, takeoff: { fixtures: 26, withProduct: 22 } })).toBe('current,later,later,later,later,later,later,later')
    // Once Rev 1 exists from the takeoff, stage 1 is done even with no picks.
    expect(statuses({ ...base, scheduleTags: 0, picks: 0, takeoff: { fixtures: 26, withProduct: 22 }, rev: draft() })).toMatch(/^done,done/)
  })

  it('a bid with no schedule offers typing it first, the robot second', () => {
    const j = submittalJourney({ ...base, scheduleTags: 0, picks: 0 })
    expect(j.next.action).toBe('plug_in_schedule')
    expect(j.next.text).toMatch(/no fixture schedule yet/)
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
    expect(submittalJourney(i).next).toEqual({ kind: 'next', text: "2 rows still owe a reason. 10 rows still need a cut sheet. Tap Edit on a row to fill it in. Or drop the house’s PDF and put its pages on the rows.", action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
    expect(submittalJourney(i).stages[1]?.anchor).toBe('submittals-revisions')
    expect(submittalJourney({ ...base, rev: draft({ owesReason: 1 }) }).next.text).toMatch(/^1 row still owes a reason\./)
  })

  it('a draft with no rows sends you back to the picks', () => {
    expect(submittalJourney({ ...base, rev: draft({ rows: 0 }) }).next).toMatchObject({ action: 'open_pricing', text: expect.stringMatching(/no rows/) })
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
    expect(quiet.next).toMatchObject({ kind: 'waiting', action: 'copy_room_link', text: expect.stringMatching(/Nobody has opened the link yet/) })
    expect(statuses({ ...base, rev: shared, room: { status: 'open', opens: 0, identified: [] } })).toBe('done,done,done,done,done,waiting,later,later')
    const opened = submittalJourney({ ...base, rev: shared, room: { status: 'open', opens: 5, identified: ['Dana Whitfield'] } })
    expect(opened.next.text).toBe('Rev 2 is with the GC. The link was opened 5 times. Dana Whitfield is on it. Their answers show up on the rows here.')
    const closed = submittalJourney({ ...base, rev: shared, room: { status: 'closed', opens: 5, identified: [] } })
    expect(closed.next).toMatchObject({ kind: 'waiting', action: null, text: expect.stringMatching(/link is closed/) })
  })

  it('rows sent back → Resubmit is the step with the Rev N+1 button', () => {
    const i = { ...base, rev: draft({ number: 2, status: 'shared', packageBuilt: true }), room: { status: 'open', opens: 9, identified: ['Dana Whitfield'] }, decisions: { decided: 14, approved: 13, open: 0, sentBack: 1, byName: ['Dana Whitfield'] } }
    expect(statuses(i)).toBe('done,done,done,done,done,done,current,current')
    expect(submittalJourney(i).next).toEqual({ kind: 'next', text: 'Dana Whitfield approved 13 and sent 1 back. Start a Rev 3 draft to fix that row. Nothing is sent until you share.', action: 'resubmit', actionLabel: 'Start a Rev 3 draft…' })
  })

  it('2026-10-03 · rows sent back while others have no answer: the button and the line say both go on', () => {
    const i = { ...base, rev: draft({ number: 1, status: 'shared', packageBuilt: true }), room: { status: 'open', opens: 2, identified: ['structura'] }, decisions: { decided: 4, approved: 0, open: 9, noAnswer: 10, sentBack: 4, byName: ['structura'] } }
    expect(submittalJourney(i).next).toEqual({ kind: 'next', text: 'structura sent 4 rows back. 10 rows still have no answer. Start a Rev 2 draft to fix what was sent back. The rows with no answer go on it too. Nothing is sent until you share.', action: 'resubmit', actionLabel: 'Start a Rev 2 draft…' })
  })

  it('every row approved → done; some still open → waiting', () => {
    const rev = draft({ number: 2, status: 'shared', packageBuilt: true })
    const all = submittalJourney({ ...base, rev, decisions: { decided: 14, approved: 14, open: 0, sentBack: 0, byName: ['Dana Whitfield'] } })
    expect(all.next).toEqual({ kind: 'done', text: 'Dana Whitfield approved every row. Next is the order log, Step 8.', action: null, actionLabel: null })
    expect(all.stages.slice(0, 7).every((s) => s.status === 'done')).toBe(true)
    expect(all.stages[7]!.status).toBe('current')
    const some = submittalJourney({ ...base, rev, decisions: { decided: 10, approved: 10, open: 4, sentBack: 0, byName: [] } })
    expect(some.next).toMatchObject({ kind: 'waiting', text: 'The reviewer approved 10. 4 rows still waiting for an answer.' })
  })

  it('2026-10-03 · answers typed on a draft light Their call and Resubmit, and rows sent back are the next thing to do', () => {
    // BP375: a draft sent by email. Six rows still need a cut sheet, four were sent back, ten have no answer.
    const bp375 = { ...base, rev: draft({ number: 1, rows: 14, sheetsNeeded: 6 }), decisions: { decided: 4, approved: 0, open: 9, noAnswer: 10, sentBack: 4, byName: ['structura'] } }
    expect(statuses(bp375)).toBe('done,done,current,later,later,waiting,current,later')
    expect(submittalJourney(bp375).next).toEqual({ kind: 'next', text: 'structura sent 4 rows back. 10 rows still have no answer. Start a Rev 2 draft to fix what was sent back. The rows with no answer go on it too. Nothing is sent until you share.', action: 'resubmit', actionLabel: 'Start a Rev 2 draft…' })
    // Step 7's button is past building once the GC has answered.
    expect(stageGate(submittalJourney(bp375).stages, 'resubmit')).toEqual({ on: true, why: null })
    // Share was never done in the app, and its button stays held until the package is built.
    expect(stageGate(submittalJourney(bp375).stages, 'share').on).toBe(false)
    // Every row sent back, none waiting: Their call is done.
    expect(statuses({ ...bp375, decisions: { decided: 14, approved: 10, open: 0, noAnswer: 0, sentBack: 4, byName: ['structura'] } })).toBe('done,done,current,later,later,done,current,current')
  })

  it('2026-10-03 · a draft with some rows approved and the rest still with the GC keeps its own next thing, with Their call waiting', () => {
    const some = { ...base, rev: draft({ number: 1, rows: 14, sheetsNeeded: 6 }), decisions: { decided: 5, approved: 5, open: 9, noAnswer: 9, sentBack: 0, byName: ['structura'] } }
    // Since 2026-10-04 the package pill is live too: no row owes a reason.
    expect(statuses(some)).toBe('done,done,current,current,later,waiting,later,current')
    expect(submittalJourney(some).next).toMatchObject({ kind: 'next', action: 'drop_vendor_pdf', text: expect.stringMatching(/^6 rows still need a cut sheet/) })
  })

  it('2026-10-03 · a draft the GC approved whole by email is done: next is the order log', () => {
    const all = { ...base, rev: draft({ number: 1, rows: 14, sheetsNeeded: 6 }), decisions: { decided: 14, approved: 14, open: 0, noAnswer: 0, sentBack: 0, byName: ['structura'] } }
    expect(statuses(all)).toBe('done,done,current,later,later,done,done,current')
    expect(submittalJourney(all).next).toEqual({ kind: 'done', text: 'structura approved every row. Next is the order log, Step 8.', action: null, actionLabel: null })
  })

  it('a draft nobody has answered lights nothing past its own steps', () => {
    const quiet = { ...base, rev: draft({ number: 1, rows: 14, sheetsNeeded: 6 }), decisions: { decided: 0, approved: 0, open: 13, noAnswer: 14, sentBack: 0, byName: [] } }
    expect(statuses(quiet)).toBe('done,done,current,current,later,later,later,later')
    expect(stageGate(submittalJourney(quiet).stages, 'resubmit').on).toBe(false)
  })

  it('an older revision on screen is the record, not the work', () => {
    const j = submittalJourney({ ...base, rev: draft({ number: 1, status: 'shared', isNewest: false, packageBuilt: true }) })
    expect(j.next).toMatchObject({ kind: 'done', action: null, text: expect.stringMatching(/^Rev 1 was shared\. It is the record now/) })
  })

  it('2026-10-03 · pill 2 names the revision once there is one, and a replaced draft never reads as shared', () => {
    expect(submittalJourney(base).stages[1]!.label).toBe('Build Rev 1')
    expect(submittalJourney({ ...base, rev: draft({ number: 4 }) }).stages[1]!.label).toBe('Rev 4')
    // BP398 Rev 3: a draft answered by email, then replaced by Rev 4.
    const answered = { ...base, rev: draft({ number: 3, status: 'superseded', isNewest: false }), decisions: { decided: 3, approved: 2, open: 1, sentBack: 1, byName: ['ZZ Test GC'] } }
    expect(submittalJourney(answered).next.text).toBe('Rev 3 was not shared from the app. Its answers were typed in. It is the record now. Pick the newest version above to keep working.')
    // Procure lights on its own: two rows were approved.
    expect(statuses(answered)).toBe('done,done,done,later,later,done,later,current')
    const dropped = { ...base, rev: draft({ number: 1, status: 'superseded', isNewest: false }) }
    expect(submittalJourney(dropped).next.text).toBe('Rev 1 was replaced before it was shared. It is the record now. Pick the newest version above to keep working.')
    expect(statuses(dropped)).toBe('done,done,done,later,later,later,later,later')
  })
})

describe('plain words on the Next line (v2.4124)', () => {
  const GLUE = /[—;()·]/
  const shared = draft({ number: 2, status: 'shared', packageBuilt: true })
  const cases: SubmittalJourneyInput[] = [
    base,
    { ...base, picks: 0 },
    { ...base, scheduleTags: 0, picks: 0 },
    { ...base, scheduleTags: 0, picks: 0, takeoff: { fixtures: 26, withProduct: 22 } },
    { ...base, rev: draft() },
    { ...base, rev: draft({ rows: 0 }) },
    { ...base, rev: draft({ owesReason: 2, sheetsNeeded: 10 }) },
    { ...base, rev: draft({ packageBuilt: true }) },
    { ...base, rev: shared, room: { status: 'open', opens: 0, identified: [] } },
    { ...base, rev: shared, room: { status: 'open', opens: 5, identified: ['Dana Whitfield', 'Pat Ortega'] } },
    { ...base, rev: shared, room: { status: 'closed', opens: 5, identified: [] } },
    { ...base, rev: shared, decisions: { decided: 14, approved: 13, open: 0, sentBack: 1, byName: ['Dana Whitfield'] } },
    { ...base, rev: shared, decisions: { decided: 10, approved: 10, open: 4, sentBack: 0, byName: [] } },
    { ...base, rev: shared, decisions: { decided: 14, approved: 14, open: 0, sentBack: 0, byName: ['Dana Whitfield'] } },
    { ...base, rev: { ...draft(), isNewest: false } },
  ]
  it.each(cases.map((c, i) => [i, c] as const))('case %i: short sentences, nothing glued', (_i, input) => {
    const text = submittalJourney(input).next.text
    expect(text, text).not.toMatch(GLUE)
    for (const s of text.split(/(?<=[.?!])\s+/)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(20)
  })
})

describe('the four words over the pills (v2.4126)', () => {
  it('cover the eight stages once, in order', () => {
    expect(SUBMITTAL_STAGE_GROUPS.flatMap((g) => g.numbers)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(SUBMITTAL_STAGE_GROUPS.map((g) => g.label)).toEqual(['Build', 'Send', 'Their answer', 'Order'])
  })
  it('take their status from their pills', () => {
    const groups = groupJourneyStages(submittalJourney({ ...base, rev: draft({ owesReason: 2 }) }).stages)
    expect(groups.map((g) => `${g.label}:${g.status}:${g.stages.length}`)).toEqual(['Build:current:3', 'Send:later:2', 'Their answer:later:2', 'Order:later:1'])
    const shared = draft({ number: 2, status: 'shared', packageBuilt: true })
    const waiting = groupJourneyStages(submittalJourney({ ...base, rev: shared, room: { status: 'open', opens: 0, identified: [] } }).stages)
    expect(waiting.map((g) => g.status)).toEqual(['done', 'done', 'waiting', 'later'])
    const all = groupJourneyStages(submittalJourney({ ...base, rev: shared, decisions: { decided: 14, approved: 14, open: 0, sentBack: 0, byName: ['Dana Whitfield'] } }).stages)
    expect(all.map((g) => g.status)).toEqual(['done', 'done', 'done', 'current'])
  })
})

describe('2026-10-04 · a cut sheet no longer holds the package', () => {
  // BP375's shape before any answer: 14 rows, no reason owed, six small items with no page in the vendor's file.
  const short = { ...base, rev: draft({ rows: 14, sheetsNeeded: 6 }) }

  it('with only cut sheets missing, the rows and the package are both live, and the line says the package can go now', () => {
    expect(statuses(short)).toBe('done,done,current,current,later,later,later,later')
    expect(submittalJourney(short).next).toEqual({ kind: 'next', text: '6 rows still need a cut sheet. Tap Edit on a row to fill it in. Or drop the house’s PDF and put its pages on the rows. You can build the package now too. Those rows will read cut sheet to follow.', action: 'drop_vendor_pdf', actionLabel: 'Drop a vendor PDF' })
    expect(stageGate(submittalJourney(short).stages, 'package')).toEqual({ on: true, why: null })
    expect(stageGate(submittalJourney(short).stages, 'share').on).toBe(false)
  })

  it('built with cut sheets missing: Share is next, and the line says how many read to follow', () => {
    const built = { ...base, rev: draft({ rows: 14, sheetsNeeded: 6, packageBuilt: true }) }
    expect(statuses(built)).toBe('done,done,current,done,current,later,later,later')
    expect(submittalJourney(built).next).toEqual({ kind: 'next', text: 'The package is built. 6 rows in it read cut sheet to follow. Tap Share to get a link for the GC.', action: 'share', actionLabel: 'Share' })
    expect(submittalJourney({ ...base, rev: draft({ rows: 14, sheetsNeeded: 1, packageBuilt: true }) }).next.text).toBe('The package is built. 1 row in it reads cut sheet to follow. Tap Share to get a link for the GC.')
  })

  it('a reason still holds it, with or without cut sheets', () => {
    const owes = { ...base, rev: draft({ rows: 14, owesReason: 2, sheetsNeeded: 6 }) }
    expect(statuses(owes)).toBe('done,done,current,later,later,later,later,later')
    expect(stageGate(submittalJourney(owes).stages, 'package')).toEqual({ on: false, why: 'Build package turns on when every row that owes a reason has one.' })
  })

  it('a draft answered by email leaves the Package pill unlit, and its buttons follow the draft’s own facts', () => {
    const answered = { ...base, rev: draft({ rows: 14, sheetsNeeded: 6 }), decisions: { decided: 4, approved: 0, open: 9, noAnswer: 10, sentBack: 4, byName: ['structura'] } }
    const stages = submittalJourney(answered).stages
    expect(stages.find((st) => st.key === 'package')!.status).toBe('later')
    expect(stageGate(stages, 'package').on).toBe(false)
    expect(stageGate(stages, 'package', { rows: 14, owesReason: 0, packageBuilt: false }).on).toBe(true)
    expect(stageGate(stages, 'share', { rows: 14, owesReason: 0, packageBuilt: false }).on).toBe(false)
    expect(stageGate(stages, 'share', { rows: 14, owesReason: 0, packageBuilt: true }).on).toBe(true)
    expect(stageGate(stages, 'package', { rows: 14, owesReason: 1, packageBuilt: false }).on).toBe(false)
    expect(stageGate(stages, 'package', { rows: 0, owesReason: 0, packageBuilt: false }).on).toBe(false)
  })
})

describe('stageGate (v2.4169)', () => {
  const gates = (i: SubmittalJourneyInput) => (['package', 'share', 'resubmit'] as const).map((k) => `${k}:${stageGate(submittalJourney(i).stages, k).on ? 'on' : 'held'}`).join(' ')
  it('a stage you have not reached holds its button, with the reason', () => {
    expect(gates({ ...base, rev: draft({ owesReason: 2 }) })).toBe('package:held share:held resubmit:held')
    expect(stageGate(submittalJourney({ ...base, rev: draft({ owesReason: 2 }) }).stages, 'package').why).toBe('Build package turns on when every row that owes a reason has one.')
    expect(gates({ ...base, rev: draft() })).toBe('package:on share:held resubmit:held')
    expect(gates({ ...base, rev: draft({ packageBuilt: true }) })).toBe('package:on share:on resubmit:on')
    const shared = draft({ number: 2, status: 'shared', packageBuilt: true })
    expect(gates({ ...base, rev: shared, room: { status: 'open', opens: 0, identified: [] } })).toBe('package:on share:on resubmit:on')
  })
})
