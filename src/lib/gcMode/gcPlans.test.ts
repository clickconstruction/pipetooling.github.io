import { describe, expect, it } from 'vitest'
import {
  activitiesTouched,
  answeredNotInSet,
  openQuestions,
  questionInNote,
  questionRecipients,
  questionState,
  compareBids,
  gcReducer,
  initialGcState,
  nextSetLabel,
  packagesForSheets,
  planEmail,
  planRecipients,
  pushSchedule,
  sheetAsIndexed,
  sheetsAtRev,
  sheetsInText,
  setThatAddedLine,
  type GcAction,
  type GcProject,
} from './gcModel'

const state = initialGcState()
function project(id: string): GcProject {
  const p = state.projects.find((x) => x.id === id)
  if (!p) throw new Error(`no project ${id}`)
  return p
}

describe('sheetsInText', () => {
  it('reads sheet numbers with a dash, without one, and with a dot', () => {
    expect(sheetsInText('E-201 boxes. A101 and a1.01 changed. FP-101 heads. A-101A enlarged.')).toEqual(['E-201', 'A101', 'A1.01', 'FP-101', 'A-101A'])
  })

  it('does not take a word like R30, T24 or RTU-3 for a sheet', () => {
    expect(sheetsInText('R30 insulation, Title T24, RTU-3 moved 6 ft.')).toEqual([])
  })
})

describe('sheetAsIndexed', () => {
  it('writes a sheet the way the index does', () => {
    expect(sheetAsIndexed(project('boerne'), 'a401')).toBe('A-401')
    expect(sheetAsIndexed(project('boerne'), 'A-401')).toBe('A-401')
  })

  it('writes a sheet the index lacks with a dash when the index uses dashes', () => {
    expect(sheetAsIndexed(project('boerne'), 'S301')).toBe('S-301')
  })
})

describe('nextSetLabel', () => {
  it('counts each numbered kind on its own', () => {
    expect(nextSetLabel(project('boerne'), 'Addendum')).toBe('Addendum 2')
    expect(nextSetLabel(project('boerne'), 'Bulletin')).toBe('Bulletin 1')
    expect(nextSetLabel(project('helotes'), 'Addendum')).toBe('Addendum 1')
  })

  it('names a whole set once, then numbers a second one', () => {
    expect(nextSetLabel(project('boerne'), 'Permit set')).toBe('Permit set')
    expect(nextSetLabel(project('helotes'), 'Permit set')).toBe('Permit set 2')
  })
})

describe('packagesForSheets', () => {
  it('guesses from the sheet titles as well as the letters', () => {
    // S-201 is the roof framing plan: concrete from the letters, steel and roofing from the title.
    expect(packagesForSheets(project('boerne'), ['S-201'])).toEqual(['conc', 'steel', 'roof'])
  })

  it('reads the title the set gives a sheet it adds', () => {
    expect(packagesForSheets(project('boerne'), ['A-601'], [{ id: 'A-601', title: 'Roof plan' }])).toEqual(['roof'])
    expect(packagesForSheets(project('boerne'), ['A-601'])).toEqual([])
  })
})

describe('issuePlanSet', () => {
  const action: GcAction = {
    type: 'issuePlanSet',
    projectId: 'boerne',
    label: 'Addendum 2',
    note: 'A canopy over the storefront.',
    sheets: ['A-401', 'S-301', 'L-101'],
    addedSheets: [
      { id: 'S-301', title: 'Canopy framing plan' },
      { id: 'L-101', title: '' },
    ],
    touches: ['steel'],
    recipients: ['bexar', 'lonestar'],
    newTrades: [{ trade: 'Landscaping', budget: 22_000, ours: false, scope: ['Planting', 'Irrigation'] }],
  }
  const next = gcReducer(state, action)
  const boerne = next.projects.find((p) => p.id === 'boerne')
  const set = boerne?.planSets[boerne.planSets.length - 1]

  it('adds the set with its name, its new sheets and the trade it brings', () => {
    expect(set?.label).toBe('Addendum 2')
    expect(set?.rev).toBe(2)
    expect(set?.touches).toEqual(['steel', 'boerne-landscaping'])
    expect(boerne?.packages.map((p) => p.trade).slice(0, 3)).toEqual(['Sitework', 'Landscaping', 'Concrete'])
    expect(boerne?.packages.find((p) => p.trade === 'Landscaping')?.scope.map((s) => s.label)).toEqual(['Planting', 'Irrigation'])
  })

  it('emails only the companies ticked, and says it in the log', () => {
    expect(set?.sentTo?.map((x) => [x.partnerId, x.touched])).toEqual([
      ['bexar', true],
      ['lonestar', false],
    ])
    expect(next.log[0]?.text).toBe(
      'Issued Addendum 2 on Boerne Retail Shell and emailed 2 companies. 1 was told it changes their trade. It adds landscaping. Nobody is asked yet.',
    )
  })

  it('gives an added sheet the title the office typed, or says which set added it', () => {
    if (!boerne) return
    const sheets = sheetsAtRev(boerne, 2)
    expect(sheets.find((s) => s.id === 'S-301')).toMatchObject({ title: 'Canopy framing plan', added: true, changedInRev: 2 })
    expect(sheets.find((s) => s.id === 'L-101')).toMatchObject({ title: 'Added by Addendum 2', added: true })
  })

  it('counts the next addendum from the addenda only', () => {
    if (!boerne) return
    const withBulletin = gcReducer(next, { ...action, label: 'Bulletin 1', addedSheets: [], newTrades: [] })
    const p = withBulletin.projects.find((x) => x.id === 'boerne')
    expect(p ? nextSetLabel(p, 'Addendum') : '').toBe('Addendum 3')
  })
})

describe('planEmail', () => {
  const last = (lines: string[]) => lines[lines.length - 1]
  const boerne = project('boerne')
  const voltage = planRecipients(state, boerne, ['elec']).find((r) => r.partner.id === 'voltage') ?? null

  it('names the scope lines the new set touches', () => {
    const one = planEmail(boerne, 'Addendum 2', 'More fixtures.', ['E-101'], voltage, { lines: ['Lighting'] })
    expect(last(one.body)).toMatch(/^This changes electrical\. The line it touches is lighting\. Please open the plans/)
    const two = planEmail(boerne, 'Addendum 2', 'More fixtures.', ['E-101'], voltage, { lines: ['Lighting', 'Site lighting'] })
    expect(last(two.body)).toMatch(/The lines it touches are lighting and site lighting\./)
  })

  it('says nothing about lines when none are named', () => {
    expect(last(planEmail(boerne, 'Addendum 2', 'More fixtures.', ['E-101'], voltage).body)).toMatch(/^This changes electrical\. Please open the plans/)
  })
})

describe('a new set that adds scope lines', () => {
  const next = gcReducer(state, {
    type: 'issuePlanSet',
    projectId: 'boerne',
    label: 'Addendum 2',
    note: 'A detention pond at the north end. C-101 changed.',
    sheets: ['C-101'],
    addedSheets: [],
    touches: [],
    recipients: ['lonestar', 'tricounty'],
    newTrades: [],
    newLines: [
      { packageId: 'site', label: 'Detention pond', sheets: ['C-101'] },
      { packageId: 'site', label: '  ', sheets: [] },
    ],
  })
  const boerne = next.projects.find((p) => p.id === 'boerne')
  const site = boerne?.packages.find((p) => p.id === 'site')

  it('adds the line to the end of the trade, with its sheets, and the set remembers it', () => {
    expect(site?.scope[site.scope.length - 1]).toEqual({ id: 'site-r2-1', label: 'Detention pond', sheets: ['C-101'] })
    expect(site?.scope).toHaveLength(5)
    const set = boerne?.planSets[boerne.planSets.length - 1]
    expect(set?.addedLines).toEqual([{ packageId: 'site', scopeId: 'site-r2-1' }])
    expect(set?.touches).toEqual(['site'])
    expect(boerne ? setThatAddedLine(boerne, 'site-r2-1') : null).toBe('Addendum 2')
    expect(boerne ? setThatAddedLine(boerne, 'site-1') : 'x').toBeNull()
    expect(next.log[0]?.text).toBe('Issued Addendum 2 on Boerne Retail Shell and emailed 2 companies. 2 were told it changes their trade. It adds 1 scope line.')
  })

  it('leaves the line unanswered on quotes already in, so Compare bids reads it as not clear', () => {
    if (!boerne || !site) throw new Error('no Boerne sitework')
    const tri = compareBids(next, boerne, site).lines.find((l) => l.company === 'Tri-County Site')
    expect(tri?.text).toMatch(/^Tri-County Site bid \$191,000 and is not clear about detention pond\. No cost is set for detention pond yet/)
    expect(tri?.complete).toBe(false)
  })

  it('names the line it adds in the email', () => {
    const boerneBefore = project('boerne')
    const lonestar = planRecipients(state, boerneBefore, ['site']).find((r) => r.partner.id === 'lonestar') ?? null
    const body = planEmail(boerneBefore, 'Addendum 2', 'A pond.', ['C-101'], lonestar, { lines: ['Paving'], adds: ['Detention pond'] }).body
    expect(body[body.length - 1]).toMatch(/^This changes sitework\. It adds detention pond to your scope\. The line it touches is paving\. Please open/)
  })
})

describe('a set issued on a job with a schedule', () => {
  const drawn = gcReducer(state, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' })
  const helotes = () => {
    const p = drawn.projects.find((x) => x.id === 'helotes')
    if (!p) throw new Error('no Helotes')
    return p
  }
  const act = (acts: { lineId: string; start: string; finish: string }[], id: string) => {
    const a = acts.find((x) => x.lineId === id)
    if (!a) throw new Error(`no activity ${id}`)
    return a
  }

  it('finds the scheduled activities its changed sheets reach', () => {
    // E-101 is the lighting plan: Lighting names it, and lines that name no sheet read all of
    // Electrical. Panels and feeders names E-201, the panel schedules, so it is not reached.
    expect(activitiesTouched(helotes(), ['E-101']).map((a) => a.lineId).sort()).toEqual(['delec-2', 'delec-3', 'delec-4'])
    expect(activitiesTouched(project('helotes'), ['E-101'])).toEqual([])
  })

  it('adds days to an activity and moves what waits on it, never earlier', () => {
    const schedule = helotes().schedule
    if (!schedule) throw new Error('no schedule')
    const before = act(schedule.activities, 'dry-2')
    const push = pushSchedule(schedule.activities, { 'delec-4': 5 })
    // Low voltage rough takes five days longer; hang and tape waits on it, so it starts five days later.
    expect(act(push.activities, 'delec-4').finish).toBe('2026-11-16')
    expect(act(push.activities, 'dry-2').start > before.start).toBe(true)
    expect(push.moved.find((m) => m.lineId === 'delec-4')?.days).toBe(5)
    expect(push.lastAfter > push.lastBefore).toBe(true)
    // Framing waited on nothing that moved, so it stays put.
    expect(act(push.activities, 'dry-1')).toEqual(act(schedule.activities, 'dry-1'))
  })

  it('lets a push inside an activity\'s spare days leave the job\'s last day alone', () => {
    const schedule = helotes().schedule
    if (!schedule) throw new Error('no schedule')
    // HVAC controls run seven days beside electrical's eight-day trims: one spare day absorbs one.
    const push = pushSchedule(schedule.activities, { 'dhvac-3': 1 })
    expect(push.lastAfter).toBe(push.lastBefore)
  })

  it('records the days on the set, moves the schedule, keeps the baseline once started, and says so', () => {
    const started = {
      ...drawn,
      projects: drawn.projects.map((p) => (p.id === 'helotes' ? { ...p, stage: 'building' as const, startedOn: '2026-10-12' } : p)),
    }
    const next = gcReducer(started, {
      type: 'issuePlanSet',
      projectId: 'helotes',
      label: 'Bulletin 1',
      note: 'Data drops added at each operatory.',
      sheets: ['E-102'],
      addedSheets: [],
      touches: ['delec'],
      recipients: ['brightline'],
      newTrades: [],
      schedulePushes: { 'delec-4': 5, 'delec-1': 0 },
    })
    const p = next.projects.find((x) => x.id === 'helotes')
    const set = p?.planSets[p.planSets.length - 1]
    expect(set?.pushed).toEqual([{ lineId: 'delec-4', days: 5 }])
    expect(p?.schedule?.baseline?.lockedOn).toBe('2026-10-12')
    expect(p?.schedule?.baseline?.activities['delec-4']?.finish).toBe('2026-11-11')
    expect(act(p?.schedule?.activities ?? [], 'delec-4').finish).toBe('2026-11-16')
    // Five days on low voltage rough: the rough-in inspection is an activity now, so all five reach the end.
    expect(next.log[0]?.text).toMatch(/It adds 5 days to the job\.$/)
  })

  it('names the new dates in the email to the company on the trade', () => {
    const r = planRecipients(state, project('helotes'), ['delec']).find((x) => x.partner.id === 'brightline') ?? null
    const body = planEmail(project('helotes'), 'Bulletin 1', 'Data drops.', ['E-102'], r, { moves: ['Low voltage rough now runs Wed Nov 4 to Mon Nov 16.'] }).body
    expect(body[body.length - 1]).toMatch(/Low voltage rough now runs Wed Nov 4 to Mon Nov 16\. Build from this set\./)
  })
})

describe('questions about the plans', () => {
  // Only a company asked to quote the trade can ask about it.
  const invited = gcReducer(state, { type: 'invite', projectId: 'padb', packageId: 'bsite', partnerId: 'lonestar' })
  const asked = gcReducer(invited, {
    type: 'tradeAskQuestion',
    projectId: 'padb',
    packageId: 'bsite',
    partnerId: 'lonestar',
    text: 'Is the drive-through lane concrete or asphalt?',
    sheets: ['c-101', ' C-101 '],
  })
  const padb = (s: typeof state) => {
    const p = s.projects.find((x) => x.id === 'padb')
    if (!p) throw new Error('no Pad B')
    return p
  }

  it('adds the question with the sheets it is about, and says so in the log', () => {
    const q = padb(asked).questions[0]
    expect(q).toMatchObject({ id: 'padb-q-1', packageId: 'bsite', partnerId: 'lonestar', askedOn: '2026-10-02', answer: null, sheets: ['C-101'] })
    expect(q ? questionState(q) : null).toBe('asked')
    expect(openQuestions(padb(asked)).map((x) => x.id)).toEqual(['padb-q-1'])
    expect(asked.log[0]?.text).toBe('Lonestar Earthworks asked about C-101: Is the drive-through lane concrete or asphalt?')
    expect(gcReducer(invited, { type: 'tradeAskQuestion', projectId: 'padb', packageId: 'bsite', partnerId: 'lonestar', text: '  ', sheets: [] })).toBe(invited)
    expect(gcReducer(state, { type: 'tradeAskQuestion', projectId: 'padb', packageId: 'bsite', partnerId: 'lonestar', text: 'Asked before being asked?', sheets: [] })).toBe(state)
  })

  const sent = gcReducer(asked, { type: 'sendQuestionToArchitect', projectId: 'padb', questionId: 'padb-q-1' })

  it('sends it to the architect once', () => {
    const q = padb(sent).questions[0]
    expect(q?.sentToArchitectOn).toBe('2026-10-02')
    expect(q ? questionState(q) : null).toBe('with the architect')
    expect(sent.log[0]?.text).toBe("Sent Lonestar Earthworks's question to Marsh & Vale Architects.")
    expect(gcReducer(sent, { type: 'sendQuestionToArchitect', projectId: 'padb', questionId: 'padb-q-1' })).toBe(sent)
  })

  it('sends the answer only to companies on the trade, while we bid every one of them', () => {
    const q = padb(sent).questions[0]
    if (!q) throw new Error('no question')
    // Alamo bids concrete, not sitework, so it does not hear the answer even if ticked.
    expect(questionRecipients(sent, padb(sent), q).map((r) => r.partner.id)).toEqual(['lonestar'])
    const answered = gcReducer(sent, { type: 'answerQuestion', projectId: 'padb', questionId: 'padb-q-1', answer: 'Concrete, per detail 3 on C-101.', recipients: ['lonestar', 'alamo'] })
    const a = padb(answered).questions[0]
    expect(a).toMatchObject({ answer: 'Concrete, per detail 3 on C-101.', answeredOn: '2026-10-02', answerSentTo: [{ partnerId: 'lonestar', on: '2026-10-02' }] })
    expect(answered.log[0]?.text).toBe('Answered a sitework question on Boerne Retail Pad B and sent it to 1 company.')
    expect(answeredNotInSet(padb(answered)).map((x) => x.id)).toEqual(['padb-q-1'])
    expect(a ? questionInNote(padb(answered), a) : '').toBe('C-101, Sitework: Is the drive-through lane concrete or asphalt? Answer: Concrete, per detail 3 on C-101.')

    // A new set carries the answer: the question remembers the set.
    const carried = gcReducer(answered, {
      type: 'issuePlanSet',
      projectId: 'padb',
      label: 'Addendum 1',
      note: a ? questionInNote(padb(answered), a) : '',
      sheets: [],
      addedSheets: [],
      touches: [],
      recipients: ['lonestar'],
      newTrades: [],
      questionIds: ['padb-q-1'],
    })
    expect(padb(carried).questions[0]?.inSetRev).toBe(1)
    expect(answeredNotInSet(padb(carried))).toEqual([])
  })
})
