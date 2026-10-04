import { describe, expect, it } from 'vitest'
import {
  activitiesTouched,
  answeredNotInSet,
  changeOrderFromSet,
  currentRev,
  indexDiff,
  sheetsGoneAtRev,
  takenOutInText,
  lineReadsSpec,
  linesOnPlans,
  linesOnSpecs,
  packagesForSpecs,
  specsAtRev,
  specsInText,
  openQuestions,
  questionInNote,
  questionRecipients,
  questionState,
  questionsCloseOn,
  questionsOpen,
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
  type PlanSet,
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

describe('questions close before the bid is due', () => {
  it('closes three days before our bid is due, and never once the job is ours', () => {
    expect(questionsCloseOn(project('boerne'))).toBe('2026-10-05')
    expect(questionsOpen(project('boerne'), '2026-10-04')).toBe(true)
    expect(questionsOpen(project('boerne'), '2026-10-05')).toBe(false)
    expect(questionsCloseOn(project('helotes'))).toBeNull()
    expect(questionsOpen(project('helotes'), '2027-01-01')).toBe(true)
  })

  it('refuses a question once they have closed', () => {
    const late = { ...state, today: '2026-10-06' }
    const before = late.projects.find((p) => p.id === 'boerne')?.questions.length
    const next = gcReducer(late, { type: 'tradeAskQuestion', projectId: 'boerne', packageId: 'elec', partnerId: 'voltage', text: 'One more?', sheets: [] })
    expect(next).toBe(late)
    expect(next.projects.find((p) => p.id === 'boerne')?.questions.length).toBe(before)
  })
})

describe('a bid we lost', () => {
  const lost = gcReducer(state, { type: 'markLost', projectId: 'boerne', why: 'price', wonBy: null, note: '' })

  it('takes no questions and sends no set (the owner, 2026-10-03)', () => {
    const boerne = lost.projects.find((p) => p.id === 'boerne')
    if (!boerne) throw new Error('no Boerne')
    expect(boerne.lostOn).toBeTruthy()
    expect(questionsOpen(boerne, '2026-10-01')).toBe(false)
    expect(gcReducer(lost, { type: 'tradeAskQuestion', projectId: 'boerne', packageId: 'elec', partnerId: 'voltage', text: 'Still on?', sheets: [] })).toBe(lost)
    expect(gcReducer(lost, { type: 'issuePlanSet', projectId: 'boerne', label: 'Addendum 3', note: 'E-101 revised.', sheets: ['E-101'], addedSheets: [], touches: ['elec'], recipients: [], newTrades: [] })).toBe(lost)
  })

  it('opens again once the bid is reopened', () => {
    const back = gcReducer(lost, { type: 'reopenLost', projectId: 'boerne' })
    const boerne = back.projects.find((p) => p.id === 'boerne')
    expect(boerne && questionsOpen(boerne, '2026-10-01')).toBe(true)
  })
})

describe('a set that revises the project manual', () => {
  const manual = [
    { id: '09 29 00', title: 'Gypsum board' },
    { id: '09 91 23', title: 'Interior painting' },
    { id: '26 51 00', title: 'Interior lighting' },
  ]
  const withManual: GcProject = {
    ...project('boerne'),
    specs: manual,
    packages: project('boerne').packages.map((p) =>
      p.id === 'elec' ? { ...p, scope: p.scope.map((item) => (item.label === 'Lighting' ? { ...item, specs: ['26 51 00'] } : item.label === 'Fire alarm' ? { ...item, specs: [] } : item)) } : p,
    ),
  }
  const elec = withManual.packages.find((p) => p.id === 'elec')
  if (!elec) throw new Error('no Boerne electrical')

  it('reads section numbers out of the notes, each once, and not amounts or dates', () => {
    expect(specsInText('Section 09 91 23: low-VOC paint. 22-40-00 fixtures changed, and 07.54.23 too. Paid $120000 on 2026-10-03. Section 099123 again. 48 12 34 is no division.')).toEqual([
      '09 91 23',
      '22 40 00',
      '07 54 23',
    ])
  })

  it('keeps the manual as it stands at each set, a section the set adds in number order', () => {
    const issued = gcReducer({ ...state, projects: state.projects.map((p) => (p.id === 'boerne' ? withManual : p)) }, {
      type: 'issuePlanSet',
      projectId: 'boerne',
      label: 'Addendum 3',
      note: 'Section 09 91 23 revised. Section 09 30 13 added for the restroom tile.',
      sheets: [],
      addedSheets: [],
      touches: [],
      recipients: [],
      newTrades: [],
      specs: ['09 91 23', '09 30 13'],
      addedSpecs: [{ id: '09 30 13', title: 'Ceramic tiling' }],
    })
    const after = issued.projects.find((p) => p.id === 'boerne')
    if (!after) throw new Error('no Boerne')
    const set = after.planSets[after.planSets.length - 1]
    expect(set?.changedSpecs).toEqual(['09 91 23', '09 30 13'])
    expect(set?.addedSpecs).toEqual([{ id: '09 30 13', title: 'Ceramic tiling' }])
    const now = specsAtRev(after, currentRev(after))
    expect(now.map((x) => x.id)).toEqual(['09 29 00', '09 30 13', '09 91 23', '26 51 00'])
    expect(now.find((x) => x.id === '09 30 13')).toMatchObject({ title: 'Ceramic tiling', added: true, changedInRev: set?.rev })
    expect(now.find((x) => x.id === '09 91 23')).toMatchObject({ title: 'Interior painting', added: false, changedInRev: set?.rev })
    expect(specsAtRev(after, currentRev(after) - 1).map((x) => x.id)).toEqual(['09 29 00', '09 91 23', '26 51 00'])
  })

  it('finds the trades a section changes by its number', () => {
    expect(packagesForSpecs(withManual, ['26 51 00', '01 10 00'])).toEqual(['elec'])
  })

  it('reaches the lines that name the section, and the lines that name none', () => {
    // Lighting names 26 51 00. Fire alarm names no section, so it reads all of electrical.
    expect(lineReadsSpec(withManual, elec, elec.scope.find((i) => i.label === 'Lighting') ?? elec.scope[0]!, '26 51 00')).toBe(true)
    const hit = linesOnSpecs(withManual, elec, ['26 51 00']).map((l) => l.label)
    expect(hit).toContain('Lighting')
    expect(hit).toContain('Fire alarm')
    expect(linesOnSpecs(withManual, elec, ['26 24 16']).map((l) => l.label)).not.toContain('Lighting')
    expect(linesOnSpecs(withManual, elec, ['09 91 23'])).toEqual([])
    // Through either the sheets or the sections, in the scope's order, each once.
    const both = linesOnPlans(withManual, elec, ['E-101'], ['26 51 00']).map((l) => l.id)
    expect(both).toEqual(elec.scope.map((l) => l.id).filter((id) => both.includes(id)))
    expect(new Set(both).size).toBe(both.length)
  })

  it('names the sections in the email and in the change order', () => {
    const voltage = planRecipients(state, withManual, ['elec']).find((r) => r.partner.id === 'voltage') ?? null
    const email = planEmail(withManual, 'Addendum 3', 'New fixtures.', ['E-101'], voltage, { specs: [manual[2]!] })
    expect(email.body).toContain('Spec sections: 26 51 00 Interior lighting.')
    expect(changeOrderFromSet({ label: 'Bulletin 1', note: 'Section 09 91 23: low-VOC paint throughout.', sheets: ['A-101'], specs: ['09 91 23'] }, 'Painting', [], 0).description).toBe(
      'Bulletin 1, Painting: low-VOC paint throughout, per A-101 and 09 91 23',
    )
  })

  it('reaches scheduled activities through a section, on a job with no manual too', () => {
    const drawn = gcReducer(state, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' })
    const helotes = drawn.projects.find((x) => x.id === 'helotes')
    if (!helotes) throw new Error('no Helotes')
    const reached = activitiesTouched(helotes, [], ['26 51 00'])
    expect(reached.length).toBeGreaterThan(0)
    expect(reached.every((a) => helotes.packages.find((p) => p.id === a.packageId)?.trade === 'Electrical')).toBe(true)
    expect(activitiesTouched(helotes, [], [])).toEqual([])
  })
})

describe('a whole new set: what is new, gone and renamed', () => {
  const have = [
    { id: 'C-101', title: 'Site plan' },
    { id: 'C-201', title: 'Grading and drainage plan' },
    { id: 'A-101', title: 'Floor plan' },
  ]

  it('compares a pasted index with ours, numbers without their dashes and titles without capitals', () => {
    const d = indexDiff(have, [
      { id: 'C101', title: 'Site, grading and drainage plan' },
      { id: 'A-101', title: 'FLOOR PLAN' },
      { id: 'A-601', title: 'Interior details' },
    ])
    expect(d.added).toEqual([{ id: 'A-601', title: 'Interior details' }])
    expect(d.gone).toEqual([{ id: 'C-201', title: 'Grading and drainage plan' }])
    expect(d.renamed).toEqual([{ id: 'C-101', from: 'Site plan', to: 'Site, grading and drainage plan' }])
    expect(d.same).toEqual([{ id: 'A-101', title: 'Floor plan' }])
  })

  it('reads what a note takes out, and not a word that takes out work', () => {
    const sheetsOf = (line: string) => sheetsInText(line)
    expect(takenOutInText('Delete sheet C-201.\nA-101 is deleted.\nDelete the detention pond per C-101.\nE-201 removed', sheetsOf)).toEqual(['C-201', 'A-101', 'E-201'])
    expect(takenOutInText('Section 09-30-13 removed. Revise section 09 91 23.', specsInText)).toEqual(['09 30 13'])
  })

  it('keeps a sheet a set took out apart from the rest, and a renamed one under its new title', () => {
    const base = project('boerne')
    const firstId = base.sheets[0]?.id ?? ''
    const secondId = base.sheets[1]?.id ?? ''
    const set: PlanSet = {
      rev: currentRev(base) + 1,
      label: 'Permit set',
      issuedOn: '2026-10-03',
      note: '',
      changedSheets: [firstId, secondId],
      touches: [],
      removedSheets: [secondId],
      retitledSheets: [{ id: firstId, title: 'A new title' }],
    }
    const p: GcProject = { ...base, planSets: [...base.planSets, set] }
    const now = sheetsAtRev(p, set.rev)
    expect(now.some((x) => x.id === secondId)).toBe(false)
    expect(now.find((x) => x.id === firstId)).toMatchObject({ title: 'A new title', was: base.sheets[0]?.title, changedInRev: set.rev })
    expect(sheetsGoneAtRev(p, set.rev)).toEqual([{ id: secondId, title: base.sheets[1]?.title, goneInRev: set.rev }])
    // The set before still has it, and nothing was renamed there.
    expect(sheetsAtRev(p, set.rev - 1).some((x) => x.id === secondId)).toBe(true)
    expect(sheetsGoneAtRev(p, set.rev - 1)).toEqual([])
    expect(sheetsAtRev(p, set.rev - 1).every((x) => x.was === undefined)).toBe(true)
  })

  it('says in the email what the set takes out', () => {
    const boerne = project('boerne')
    const email = planEmail(boerne, 'Permit set', '', [], null, { gone: ['C-201 Grading and drainage plan'] })
    expect(email.body).toContain('Taken out of the set: C-201 Grading and drainage plan.')
  })
})

describe('work a set brings goes on a schedule already drawn', () => {
  const drawn = gcReducer(state, { type: 'draftSchedule', projectId: 'helotes', start: '2026-10-12' })
  const helotesIn = (s: typeof state) => {
    const p = s.projects.find((x) => x.id === 'helotes')
    if (!p?.schedule) throw new Error('no Helotes schedule')
    return { project: p, schedule: p.schedule }
  }
  const before = helotesIn(drawn).schedule
  const next = gcReducer(drawn, {
    type: 'issuePlanSet',
    projectId: 'helotes',
    label: 'Bulletin 9',
    note: 'A storefront at the entry, and a sink in the break room.',
    sheets: [],
    addedSheets: [],
    touches: ['dplumb'],
    recipients: [],
    newTrades: [{ trade: 'Glass and storefront', budget: 0, ours: false, scope: ['Storefront', 'Sealants'] }],
    newLines: [{ packageId: 'dplumb', label: 'Break room sink rough', sheets: [] }],
  })
  const { project: after, schedule } = helotesIn(next)
  const glass = after.packages.find((p) => p.trade === 'Glass and storefront')
  if (!glass) throw new Error('no storefront trade')
  const actOf = (id: string) => {
    const a = schedule.activities.find((x) => x.lineId === id)
    if (!a) throw new Error(`no activity ${id}`)
    return a
  }

  it('puts a new trade’s lines and an added line on the schedule, each once', () => {
    expect(schedule.activities).toHaveLength(before.activities.length + 3)
    expect(glass.scope.map((l) => schedule.activities.some((a) => a.lineId === l.id))).toEqual([true, true])
    const sink = after.packages.find((p) => p.id === 'dplumb')?.scope.find((l) => l.label === 'Break room sink rough')
    expect(sink && schedule.activities.some((a) => a.lineId === sink.id)).toBe(true)
    expect(next.log[0]?.text).toMatch(/It puts 3 new activities on the schedule\./)
  })

  it('places the storefront in dry-in: after the plumbing underground, never before today, and framing waits on it', () => {
    const storefront = actOf(glass.scope[0]?.id ?? '')
    const sealants = actOf(glass.scope[1]?.id ?? '')
    expect(storefront.start >= next.today).toBe(true)
    // Sealants follow the storefront: one crew does its lines one after another.
    expect(sealants.after).toContain(storefront.lineId)
    expect(sealants.start > storefront.finish).toBe(true)
    // Framing waits on dry-in, so it waits on the storefront too and starts after it.
    const framing = actOf('dry-1')
    expect(framing.after).toContain(storefront.lineId)
    expect(framing.start > storefront.finish).toBe(true)
  })

  it('puts the added rough-in line before the rough-in inspection', () => {
    const sink = after.packages.find((p) => p.id === 'dplumb')?.scope.find((l) => l.label === 'Break room sink rough')
    const inspection = actOf('helotes-insp-roughin')
    expect(sink && inspection.after.includes(sink.id)).toBe(true)
    expect(inspection.start > actOf(sink?.id ?? '').finish).toBe(true)
  })

  it('leaves a schedule alone when the set brings nothing new', () => {
    const quiet = gcReducer(drawn, { type: 'issuePlanSet', projectId: 'helotes', label: 'Bulletin 9', note: 'Notes only.', sheets: [], addedSheets: [], touches: [], recipients: [], newTrades: [] })
    expect(helotesIn(quiet).schedule).toEqual(before)
  })
})
