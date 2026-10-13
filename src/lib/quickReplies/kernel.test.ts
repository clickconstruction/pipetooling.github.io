/**
 * Quick replies over the Messages prototype's made-up lines and people (v1.178, branch spike/gc-mode): its nineteen
 * lines with their presses by Robert, Rosa and Wendi, its three flows' steps, and its people, Greg on Asked to quote,
 * Tom on Papers in, Dr. Priya Raman on Start date, Jonah on Addenda and an unknown number.
 */
import { describe, expect, it } from 'vitest'
import { SEED_FLOWS } from '../flows/seed'
import { plainWordsFailures } from '../plainWords'
import {
  EDITOR_WORDS,
  FIND_NOTE,
  QR_KIND_ORDER,
  QR_KINDS,
  QR_PRESS_COUNTED,
  REMOVE_ASK,
  addQuickReply,
  editQuickReply,
  editorCounts,
  editorFoot,
  editorGroups,
  editorRows,
  editorTabs,
  findWhere,
  guessWords,
  historyHead,
  lastChange,
  lastUsedWords,
  nameOf,
  pressQuickReply,
  qrEmpty,
  qrGroups,
  qrGuess,
  qrKindOf,
  qrLineCount,
  qrMarks,
  qrStripCount,
  qrTagWords,
  qrTotal,
  qrVisible,
  removeQuickReply,
  restoreQuickReply,
  showNarrow,
  stepLine,
  stepsByKind,
  usedBy,
  versionWords,
  type QrResult,
  type QuickReply,
  type QuickReplyVersion,
  type StepsByKind,
} from './kernel'

const at = (month: number, day: number, hour = 9, minute = 0) => Date.UTC(2026, month - 1, day, hour, minute)
const NOW = at(10, 2, 11, 45)

// The flow's own steps, as helper 4's seed holds them (`flows/seed.ts`), not a copy.
const STEPS: StepsByKind = stepsByKind(SEED_FLOWS)

type Seed = Pick<QuickReply, 'text' | 'for' | 'stepId' | 'scope' | 'addedBy' | 'addedAt' | 'uses'>
const line = (id: string, seed: Seed): QuickReply => ({ id, removed: false, lastUsed: null, ...seed })

// The prototype's quickReplies, ids q1 to q19, the user ids made up as robert, rosa and wendi.
const LINES: QuickReply[] = [
  line('q1', { scope: 'team', text: 'Your quote is in your portal now, thank you.', for: 'trade', stepId: 'ask', addedBy: 'rosa', addedAt: at(9, 12, 9, 10), uses: { rosa: 10, robert: 2, wendi: 2 } }),
  line('q2', { scope: 'team', text: 'Did the invite come through?', for: 'trade', stepId: 'invited', addedBy: 'robert', addedAt: at(9, 12, 9, 14), uses: { robert: 3, rosa: 14 } }),
  line('q3', { scope: 'team', text: 'Checking on the number. Still good for today?', for: 'trade', stepId: 'ask', addedBy: 'robert', addedAt: at(9, 14, 8, 40), uses: { robert: 12, rosa: 23, wendi: 6 } }),
  line('q4', { scope: 'team', text: 'Understood. You will have it by 9 AM Thursday.', for: 'customer', stepId: 'bid', addedBy: 'rosa', addedAt: at(9, 20, 14, 0), uses: { rosa: 9 } }),
  line('q5', { scope: 'team', text: 'Thanks, we will call you back within the hour.', for: 'any', stepId: null, addedBy: 'rosa', addedAt: at(9, 20, 14, 2), uses: { rosa: 8, robert: 1, wendi: 3 } }),
  line('q6', { scope: 'team', text: 'The plans are in your portal; questions close Monday.', for: 'trade', stepId: 'invited', addedBy: 'robert', addedAt: at(9, 22, 9, 20), uses: { robert: 5, rosa: 3 } }),
  line('q7', { scope: 'team', text: 'We received it, thank you. We will be in touch after we compare.', for: 'trade', stepId: 'ask', addedBy: 'rosa', addedAt: at(9, 22, 9, 25), uses: { rosa: 6 } }),
  line('q8', { scope: 'team', text: 'The site is open from 7. Check in with the super when you arrive.', for: 'trade', stepId: null, addedBy: 'wendi', addedAt: at(9, 26, 8, 0), uses: { wendi: 3 } }),
  line('q9', { scope: 'team', text: 'Your pay application is sent; the architect has it.', for: 'customer', stepId: 'payapp', addedBy: 'rosa', addedAt: at(9, 30, 16, 0), uses: { rosa: 2 } }),
  line('q13', { scope: 'team', text: 'Send the W-9 when you can; the insurance certificate too.', for: 'trade', stepId: 'papers', addedBy: 'rosa', addedAt: at(9, 24, 10, 0), uses: { rosa: 4 } }),
  line('q14', { scope: 'team', text: 'Got it, thank you.', for: 'any', stepId: null, addedBy: 'rosa', addedAt: at(9, 12, 9, 0), uses: { rosa: 30, robert: 7, wendi: 9 } }),
  line('q15', { scope: 'team', text: 'The change order is in your portal to sign.', for: 'customer', stepId: 'co', addedBy: 'rosa', addedAt: at(9, 28, 15, 0), uses: { rosa: 3 } }),
  line('q16', { scope: 'team', text: 'We will have the start date to you by Friday.', for: 'customer', stepId: 'start', addedBy: 'rosa', addedAt: at(9, 26, 14, 28), uses: { rosa: 2 } }),
  line('q17', { scope: 'team', text: 'Addendum 2 is in the portal; the pond is in sitework.', for: 'trade', stepId: 'invited', addedBy: 'robert', addedAt: at(10, 2, 10, 55), uses: { robert: 2 } }),
  line('q18', { scope: 'team', text: 'The submittal is back to you with comments.', for: 'arch', stepId: 'submittals', addedBy: 'rosa', addedAt: at(9, 23, 9, 0), uses: { rosa: 1 } }),
  line('q19', { scope: 'team', text: 'Pay application 3 is in for your certificate.', for: 'arch', stepId: 'certify', addedBy: 'rosa', addedAt: at(9, 30, 16, 5), uses: { rosa: 2 } }),
  line('q10', { scope: 'mine', text: 'Can you get it to us a day earlier?', for: 'trade', stepId: 'ask', addedBy: 'robert', addedAt: at(9, 18, 11, 0), uses: { robert: 19 } }),
  line('q11', { scope: 'mine', text: 'Running about 20 minutes late, sorry.', for: 'any', stepId: null, addedBy: 'robert', addedAt: at(10, 1, 7, 30), uses: { robert: 5 } }),
  line('q12', { scope: 'mine', text: "Is the detention pond in your scope or concrete's?", for: 'trade', stepId: 'ask', addedBy: 'robert', addedAt: at(10, 2, 8, 50), uses: { robert: 1 } }),
]

const ids = (rows: readonly QuickReply[]) => rows.map((q) => q.id)
const byId = (id: string) => {
  const q = LINES.find((x) => x.id === id)
  if (!q) throw new Error(`no ${id}`)
  return q
}
function ok(result: QrResult) {
  if ('error' in result) throw new Error(result.error)
  return result
}

describe('the strip’s groups for a thread', () => {
  it('puts the step they are on first, then the rest of their kind, then anyone’s, mine first in each', () => {
    const groups = qrGroups(LINES, { kind: 'trade', nowStepId: 'ask', steps: STEPS.trade ?? [], me: 'robert' })
    expect(groups.map((g) => [g.title, g.tag, ids(g.rows)])).toEqual([
      ['Asked to quote', 'the step they are on', ['q10', 'q3', 'q1', 'q12', 'q7']],
      ['Other trade partners', null, ['q6', 'q2', 'q17', 'q13', 'q8']],
      ['Anyone', null, ['q14', 'q11', 'q5']],
    ])
    // The head the owner read on Greg's thread (v1.143).
    expect(qrStripCount(groups, 'trade')).toBe('13 for trade partners')
  })

  it('keeps a person’s own lines off another person’s strip', () => {
    const groups = qrGroups(LINES, { kind: 'trade', nowStepId: 'ask', steps: STEPS.trade ?? [], me: 'rosa' })
    expect(groups.map((g) => ids(g.rows))).toEqual([
      ['q3', 'q1', 'q7'],
      ['q2', 'q13', 'q6', 'q8', 'q17'],
      ['q14', 'q5'],
    ])
    expect(qrStripCount(groups, 'trade')).toBe('10 for trade partners')
  })

  it('reads the step they are on by its name, or a customer’s and an architect’s own', () => {
    const priya = qrGroups(LINES, { kind: 'customer', nowStepId: 'start', steps: STEPS.customer ?? [], me: 'robert' })
    expect(priya.map((g) => [g.title, ids(g.rows)])).toEqual([
      ['Start date', ['q16']],
      ['Other customers', ['q4', 'q15', 'q9']],
      ['Anyone', ['q14', 'q11', 'q5']],
    ])
    // Jonah is on Addenda, which has no line, so his strip opens on the rest of the architects' lines.
    const jonah = qrGroups(LINES, { kind: 'arch', nowStepId: 'addenda', steps: STEPS.arch ?? [], me: 'robert' })
    expect(jonah.map((g) => [g.key, ids(g.rows)])).toEqual([
      ['kind', ['q19', 'q18']],
      ['any', ['q14', 'q11', 'q5']],
    ])
  })

  it('shows an unknown number the lines for anyone once', () => {
    const groups = qrGroups(LINES, { kind: 'unknown', nowStepId: 'who', steps: [], me: 'robert' })
    expect(groups.map((g) => [g.title, ids(g.rows)])).toEqual([['Anyone', ['q14', 'q11', 'q5']]])
    expect(qrStripCount(groups, 'unknown')).toBe('3 for anyone')
    expect(qrKindOf('unknown')).toBe('any')
  })

  it('narrows every group to the typed words', () => {
    const groups = qrGroups(LINES, { kind: 'trade', nowStepId: 'ask', steps: STEPS.trade ?? [], me: 'robert', filter: ' PORTAL ' })
    expect(groups.map((g) => [g.key, ids(g.rows)])).toEqual([
      ['step', ['q1']],
      ['kind', ['q6', 'q17']],
    ])
    expect(qrGroups(LINES, { kind: 'trade', nowStepId: 'ask', steps: STEPS.trade ?? [], me: 'robert', filter: 'striping' })).toEqual([])
  })

  it('says the step fits in Find a reply', () => {
    const [first] = qrGroups(LINES, { kind: 'trade', nowStepId: 'ask', steps: STEPS.trade ?? [], me: 'robert', place: 'find' })
    expect(first?.tag).toBe('fits the step they are on')
  })

  it('shows the narrow box once the team’s list is past ten lines', () => {
    expect(qrVisible(LINES, 'robert').filter((q) => q.scope === 'team')).toHaveLength(16)
    expect(showNarrow(LINES, 'robert')).toBe(true)
    expect(showNarrow(LINES.filter((q) => q.scope === 'mine' || Number(q.id.slice(1)) <= 9), 'robert')).toBe(false)
  })

  it('offers to add the words when no line has them', () => {
    expect(qrEmpty(' striping ')).toEqual({ words: 'No line has those words.', add: 'Add “striping” as a quick reply' })
    expect(qrEmpty('')).toEqual({ words: 'No lines for this kind of person yet. Edit adds one.', add: null })
  })

  it('says Nothing matches. in Find a reply, as the prototype did', () => {
    expect(qrEmpty(' striping ', 'find')).toEqual({ words: 'Nothing matches.', add: 'Add “striping” as a quick reply' })
    expect(qrEmpty('', 'find').words).toBe(qrEmpty('').words)
  })

  it('says when a line was last used, naming the person only when the window knows them', () => {
    expect(lastUsedWords('Oct 12, 8:02 AM', 'Greg Paulk')).toBe('last used Oct 12, 8:02 AM, on Greg Paulk')
    expect(lastUsedWords('Oct 12, 8:02 AM', null)).toBe('last used Oct 12, 8:02 AM')
  })

  it('names a user for the editor, or says Someone', () => {
    expect(nameOf({ 'u-rosa': 'Rosa' }, 'u-rosa')).toBe('Rosa')
    expect(nameOf({ 'u-rosa': 'Rosa' }, 'u-gone')).toBe('Someone')
    expect(nameOf({}, null)).toBe('Someone')
  })

  it('counts a group’s lines for its pill', () => {
    expect(qrLineCount(1)).toBe('1 line.')
    expect(qrLineCount(4)).toBe('4 lines.')
  })

  it('lights the typed words in a line, whatever their case', () => {
    expect(qrMarks('Your quote is in your portal now, thank you.', 'YOUR')).toEqual([
      { text: 'Your', lit: true },
      { text: ' quote is in ', lit: false },
      { text: 'your', lit: true },
      { text: ' portal now, thank you.', lit: false },
    ])
    expect(qrMarks('Got it, thank you.', '  ')).toEqual([{ text: 'Got it, thank you.', lit: false }])
    expect(qrMarks('Got it.', 'got it.')).toEqual([{ text: 'Got it.', lit: true }])
  })
})

describe('Find a reply', () => {
  it('says where they are and what finishes the step', () => {
    expect(
      findWhere({ step: { name: 'Asked to quote', done: 'their quote is in the portal' }, who: 'them', firstName: 'Greg', daysOn: 10, off: false }),
    ).toEqual({ head: ['Asked to quote', "Greg's move", 'on it 10 days'], sentence: 'Their quote is in the portal finishes it.' })
    expect(findWhere({ step: { name: 'Start date', done: 'the start date is set' }, who: 'us', firstName: 'Priya', daysOn: 1, off: false }).head).toEqual([
      'Start date',
      'our move',
      'on it 1 day',
    ])
    expect(findWhere({ step: { name: 'Pay application', done: 'x' }, who: 'both', firstName: 'Elena', daysOn: null, off: false }).head).toEqual([
      'Pay application',
      'both sides',
    ])
  })

  it('names who a step waits on', () => {
    expect(
      findWhere({ step: { name: 'Pay application', done: 'x' }, who: 'wait', waitingOn: 'Jonah', firstName: 'Elena', daysOn: null, off: false }).head,
    ).toEqual(['Pay application', 'waiting on Jonah'])
    expect(findWhere({ step: { name: 'Pay application', done: 'x' }, who: 'wait', firstName: 'Elena', daysOn: null, off: false }).head[1]).toBe(
      'waiting on someone else',
    )
  })

  it('says when nothing is on, or they are off the flow', () => {
    expect(findWhere({ step: null, who: 'them', firstName: 'Marcus', daysOn: null, off: true })).toEqual({ head: [], sentence: 'Off the flow.' })
    expect(findWhere({ step: null, who: 'them', firstName: 'Dee', daysOn: null, off: false })).toEqual({ head: [], sentence: 'Nothing on now.' })
  })
})

describe('the line a step’s ask puts in the box', () => {
  it('is the most used line for their kind on that step', () => {
    expect(stepLine(LINES, 'trade', 'ask', 'robert')?.id).toBe('q10')
    expect(stepLine(LINES, 'trade', 'ask', 'rosa')?.id).toBe('q3')
    expect(stepLine(LINES, 'trade', 'papers', 'rosa')?.id).toBe('q13')
    expect(stepLine(LINES, 'customer', 'warranty', 'rosa')).toBeNull()
  })
})

describe('the steps a line can belong to', () => {
  it('reads them from the flows, by who the line is for, in the flow’s order', () => {
    expect(STEPS.trade?.map((s) => s.id)).toEqual(['invited', 'portal', 'papers', 'msa', 'ask', 'compare', 'sow', 'draws', 'closeout'])
    expect(STEPS.customer?.map((s) => s.id)).toEqual(['agreement', 'asked', 'bid', 'yes', 'contract', 'start', 'onsite', 'payapp', 'close', 'warranty', 'co'])
    expect(STEPS.arch?.map((s) => s.name)).toEqual(['Plans in', 'Questions', 'Addenda', 'Submittals', 'Certify pay apps'])
    expect(STEPS.any).toBeUndefined()
    expect(stepsByKind({})).toEqual({ trade: [], customer: [], arch: [], lead: [], sub: [], supply_house: [], candidate: [] })
  })

  it('has no steps for the four kinds of 2026-10-13: three have no flow, and a sub’s has no steps yet', () => {
    expect([STEPS.lead, STEPS.sub, STEPS.supply_house, STEPS.candidate]).toEqual([[], [], [], []])
    expect(qrTagWords({ for: 'sub', stepId: 'asked' }, STEPS)).toEqual(['for subs', 'on no step'])
  })

  it('guesses only steps the flows have', () => {
    const texts = [
      'Send the W-9.',
      'The submittal is back.',
      'Pay application 3 is in for your certificate.',
      'Your pay application is sent.',
      'The start date is Monday.',
      'The change order is ready.',
      'Your contract is ready.',
      'The statement of work is attached.',
      'Your draw is approved.',
      'Did the invite come through?',
      'Your quote is in.',
    ]
    for (const text of texts) {
      const guess = qrGuess(text)
      expect(guess.stepId, text).not.toBeNull()
      expect(STEPS[guess.for]?.some((s) => s.id === guess.stepId), text).toBe(true)
    }
  })
})

describe('a guess at a new line’s tags', () => {
  it('reads who the line is for and its step from its words', () => {
    const guesses = LINES.filter((q) => q.scope === 'team').map((q) => [q.id, qrGuess(q.text)])
    expect(Object.fromEntries(guesses)).toEqual({
      q1: { for: 'trade', stepId: 'ask' },
      q2: { for: 'trade', stepId: 'invited' },
      q3: { for: 'trade', stepId: 'ask' },
      q4: { for: 'any', stepId: null },
      q5: { for: 'any', stepId: null },
      q6: { for: 'trade', stepId: 'invited' },
      q7: { for: 'any', stepId: null },
      q8: { for: 'any', stepId: null },
      q9: { for: 'customer', stepId: 'payapp' },
      q13: { for: 'trade', stepId: 'papers' },
      q14: { for: 'any', stepId: null },
      q15: { for: 'customer', stepId: 'co' },
      q16: { for: 'customer', stepId: 'start' },
      q17: { for: 'trade', stepId: 'invited' },
      q18: { for: 'arch', stepId: 'submittals' },
      q19: { for: 'arch', stepId: 'certify' },
    })
  })

  it('reads the rest of the prototype’s words', () => {
    expect(qrGuess('Your contract is ready to sign.')).toEqual({ for: 'customer', stepId: 'contract' })
    expect(qrGuess('The statement of work is attached.')).toEqual({ for: 'trade', stepId: 'sow' })
    expect(qrGuess('Your draw is approved.')).toEqual({ for: 'trade', stepId: 'draws' })
  })

  it('takes draw and contract as whole words', () => {
    expect(qrGuess('The drawings are in your portal.')).toEqual({ for: 'trade', stepId: 'ask' })
    expect(qrGuess('Is your contractor license current?')).toEqual({ for: 'any', stepId: null })
  })

  it('says it is a guess until the person sets the tags', () => {
    expect(guessWords('', false)).toBe('the tags are guessed from the words')
    expect(guessWords('Did the invite come through?', false)).toBe('guessed from the words')
    expect(guessWords('Did the invite come through?', true)).toBe('set by you')
  })

  it('names the tags, and a step the flow lost as no step', () => {
    expect(qrTagWords({ for: 'trade', stepId: 'ask' }, STEPS)).toEqual(['for trade partners', 'on Asked to quote'])
    expect(qrTagWords({ for: 'any', stepId: null }, STEPS)).toEqual(['for anyone', 'on no step'])
    expect(qrTagWords({ for: 'trade', stepId: 'gone' }, STEPS)).toEqual(['for trade partners', 'on no step'])
  })
})

describe('the Edit quick replies window', () => {
  const removed = { ...byId('q8'), removed: true }
  const someoneElses = line('q20', { scope: 'mine', text: 'On my way.', for: 'any', stepId: null, addedBy: 'rosa', addedAt: at(10, 1), uses: { rosa: 4 } })
  const WITH = [...LINES.filter((q) => q.id !== 'q8'), removed, someoneElses]

  it('counts each tab over the team’s lines and the person’s own', () => {
    expect(editorCounts(WITH, 'robert')).toEqual({ all: 18, trade: 9, customer: 4, arch: 2, lead: 0, sub: 0, supply_house: 0, candidate: 0, any: 3, mine: 3, removed: 1 })
    expect(editorCounts(WITH, 'rosa')).toMatchObject({ all: 16, mine: 1, any: 3 })
  })

  it('shows Removed only once a line is removed', () => {
    expect(editorTabs(editorCounts(WITH, 'robert')).map((t) => `${t.label} · ${t.count}`)).toEqual([
      'All · 18',
      'Trade partners · 9',
      'Customers · 4',
      'Architects · 2',
      'Anyone · 3',
      'Mine · 3',
      'Removed · 1',
    ])
    expect(editorTabs(editorCounts(LINES, 'robert')).map((t) => t.tab)).not.toContain('removed')
  })

  it('lists a tab’s rows, narrowed by the search, the most used first', () => {
    expect(ids(editorRows(WITH, 'robert', 'arch', ''))).toEqual(['q19', 'q18'])
    expect(ids(editorRows(WITH, 'robert', 'mine', ''))).toEqual(['q10', 'q11', 'q12'])
    expect(ids(editorRows(WITH, 'robert', 'removed', ''))).toEqual(['q8'])
    expect(ids(editorRows(WITH, 'robert', 'all', 'pond'))).toEqual(['q17', 'q12'])
    expect(ids(editorRows(WITH, 'rosa', 'any', ''))).toEqual(['q14', 'q5', 'q20'])
  })

  it('groups the rows by who they are for, then by the flow’s steps, no step last', () => {
    const groups = editorGroups(editorRows(WITH, 'robert', 'all', ''), STEPS)
    expect(groups.map((g) => [g.title.join(' · '), ids(g.rows)])).toEqual([
      ['Trade partners · Invited', ['q2', 'q6', 'q17']],
      ['Trade partners · Papers in', ['q13']],
      ['Trade partners · Asked to quote', ['q3', 'q10', 'q1', 'q7', 'q12']],
      ['Customers · Our bid', ['q4']],
      ['Customers · Start date', ['q16']],
      ['Customers · Pay application', ['q9']],
      ['Customers · Change orders', ['q15']],
      ['Architects · Submittals', ['q18']],
      ['Architects · Certify pay apps', ['q19']],
      ['Anyone', ['q14', 'q5', 'q11']],
    ])
  })

  it('gives a lead, a sub, a supply house and a candidate a tab and a group once a line is for them, after the architects', () => {
    const forLead = line('q22', { scope: 'team', text: 'Thanks for calling. When can we come look?', for: 'lead', stepId: null, addedBy: 'rosa', addedAt: at(10, 2, 9), uses: {} })
    const forSupply = line('q23', { scope: 'team', text: 'Please send the quote to bids.', for: 'supply_house', stepId: null, addedBy: 'rosa', addedAt: at(10, 2, 9), uses: {} })
    const rows = [...LINES, forLead, forSupply]
    expect(editorTabs(editorCounts(rows, 'robert')).map((t) => `${t.label} · ${t.count}`)).toEqual([
      'All · 21',
      'Trade partners · 10',
      'Customers · 4',
      'Architects · 2',
      'Leads · 1',
      'Supply houses · 1',
      'Anyone · 3',
      'Mine · 3',
    ])
    const groups = editorGroups(editorRows(rows, 'robert', 'all', ''), STEPS)
    expect(groups.slice(-3).map((g) => [g.title.join(' · '), ids(g.rows)])).toEqual([
      ['Leads · no step', ['q22']],
      ['Supply houses · no step', ['q23']],
      ['Anyone', ['q14', 'q5', 'q11']],
    ])
  })

  it('puts a line on a step its flow lost with the lines on no step', () => {
    const lost = line('q21', { scope: 'team', text: 'See you at the walk.', for: 'trade', stepId: 'walk', addedBy: 'wendi', addedAt: at(10, 1), uses: {} })
    const groups = editorGroups([byId('q8'), lost, byId('q2')], STEPS)
    expect(groups.map((g) => [g.title.join(' · '), g.stepId, ids(g.rows)])).toEqual([
      ['Trade partners · Invited', 'invited', ['q2']],
      ['Trade partners · no step', null, ['q8', 'q21']],
    ])
  })

  it('says what the list holds at its foot', () => {
    expect(editorFoot(18, '')).toEqual(['18 lines', 'by who they are for, then the step, the most used first'])
    expect(editorFoot(1, ' pond ')).toEqual(['1 line match “pond”', 'by who they are for, then the step, the most used first'])
  })
})

describe('a line’s versions', () => {
  const ROBERT = 'robert'

  it('adds a line for the team or just for me, with its first version', () => {
    const added = ok(addQuickReply({ id: 'q22', text: '  The walk is Monday at 7.  ', tags: { for: 'trade', stepId: 'draws' }, mine: false, by: ROBERT, at: NOW }))
    expect(added.line).toMatchObject({ text: 'The walk is Monday at 7.', for: 'trade', stepId: 'draws', scope: 'team', addedBy: ROBERT, uses: {} })
    expect(added.versions).toEqual([{ by: ROBERT, at: NOW, kind: 'added', toText: 'The walk is Monday at 7.', toTags: { for: 'trade', stepId: 'draws' } }])
    expect(added.words).toBe('Added for the team, with your name and today on it.')
    const mine = ok(addQuickReply({ id: 'q23', text: 'On my way.', tags: { for: 'any', stepId: 'ask' }, mine: true, by: ROBERT, at: NOW }))
    expect(mine.line).toMatchObject({ scope: 'mine', stepId: null })
    expect(mine.words).toBe('Added to yours, with your name and today on it.')
    expect(addQuickReply({ id: 'q24', text: ' ', tags: { for: 'any', stepId: null }, mine: false, by: ROBERT, at: NOW })).toEqual({ error: 'Write the line first.' })
  })

  it('keeps the words and the tags as two versions when both change', () => {
    const before = byId('q3')
    const saved = ok(editQuickReply(before, { text: 'Checking on the quote. Still good for today?', tags: { for: 'trade', stepId: null } }, 'wendi', NOW))
    expect(saved.line).toMatchObject({ text: 'Checking on the quote. Still good for today?', stepId: null, for: 'trade' })
    expect(saved.versions).toEqual([
      { by: 'wendi', at: NOW, kind: 'words', fromText: before.text, toText: 'Checking on the quote. Still good for today?' },
      { by: 'wendi', at: NOW, kind: 'tags', fromTags: { for: 'trade', stepId: 'ask' }, toTags: { for: 'trade', stepId: null } },
    ])
    expect(saved.words).toBe('Saved, with your name and today in its history.')
  })

  it('writes no version when nothing changed', () => {
    const q = byId('q14')
    expect(ok(editQuickReply(q, { text: ` ${q.text} `, tags: { for: 'any', stepId: null } }, ROBERT, NOW))).toMatchObject({ versions: [], words: 'Nothing changed.' })
    expect(editQuickReply(q, { text: '', tags: { for: 'any', stepId: null } }, ROBERT, NOW)).toEqual({ error: 'Write something, or Cancel.' })
  })

  it('removes a line into the history and brings it back', () => {
    const gone = ok(removeQuickReply(byId('q8'), ROBERT, NOW))
    expect(gone.line.removed).toBe(true)
    expect(gone.versions).toEqual([{ by: ROBERT, at: NOW, kind: 'removed' }])
    expect(gone.words).toBe('Removed. It can be brought back from the Removed tab.')
    expect(qrVisible([gone.line], ROBERT)).toEqual([])
    const back = ok(restoreQuickReply(gone.line, ROBERT, NOW))
    expect(back.line.removed).toBe(false)
    expect(back.versions[0]?.kind).toBe('restored')
    expect(back.words).toBe('Back on the list.')
  })

  it('counts a press by the person and on whom', () => {
    const pressed = pressQuickReply(byId('q1'), ROBERT, 'greg', NOW)
    expect(pressed.uses).toEqual({ rosa: 10, robert: 3, wendi: 2 })
    expect(pressed.lastUsed).toEqual({ at: NOW, by: ROBERT, contactId: 'greg' })
    expect(qrTotal(pressed)).toBe(15)
    expect(pressQuickReply(byId('q16'), ROBERT, null, NOW).uses).toEqual({ rosa: 2, robert: 1 })
  })

  it('reads the history of the line Wendi reworded', () => {
    const history: QuickReplyVersion[] = [
      { by: 'robert', at: at(9, 14, 8, 40), kind: 'added', toText: 'Checking on the quote. Still good for today?', toTags: { for: 'trade', stepId: null } },
      { by: 'robert', at: at(9, 22, 9, 5), kind: 'tags', fromTags: { for: 'trade', stepId: null }, toTags: { for: 'trade', stepId: 'ask' } },
      { by: 'wendi', at: at(9, 29, 16, 12), kind: 'words', fromText: 'Checking on the quote. Still good for today?', toText: 'Checking on the number. Still good for today?' },
    ]
    expect(history.map((v) => versionWords(v, STEPS))).toEqual([
      { did: 'added it', struck: null, added: 'Checking on the quote. Still good for today?', note: null },
      { did: 'tagged it', struck: 'for trade partners · on no step', added: 'for trade partners · on Asked to quote', note: null },
      { did: 'changed the words', struck: 'Checking on the quote. Still good for today?', added: 'Checking on the number. Still good for today?', note: null },
    ])
    expect(historyHead(history, byId('q3'))).toEqual(['History', '3 versions', 'used 41 times'])
    expect(lastChange(history)?.by).toBe('wendi')
    expect(lastChange(history.slice(0, 1))).toBeNull()
    expect(usedBy(byId('q3'))).toEqual([
      { by: 'rosa', count: 23 },
      { by: 'robert', count: 12 },
      { by: 'wendi', count: 6 },
    ])
  })

  it('says a removed line stays in the history', () => {
    expect(versionWords({ by: 'robert', at: NOW, kind: 'removed' }, STEPS)).toEqual({
      did: 'removed it',
      struck: null,
      added: null,
      note: 'It stays here and can be brought back.',
    })
    expect(versionWords({ by: 'robert', at: NOW, kind: 'restored' }, STEPS).did).toBe('brought it back')
  })
})

describe('the seven kinds of contact, as the strip and the editor name them', () => {
  it('names the four kinds of 2026-10-13 after the three that were, and anyone last', () => {
    expect(QR_KIND_ORDER).toEqual(['trade', 'customer', 'arch', 'lead', 'sub', 'supply_house', 'candidate', 'any'])
    expect(QR_KIND_ORDER.slice(3, 7).map((k) => QR_KINDS[k])).toEqual(['leads', 'subs', 'supply houses', 'candidates'])
    expect(qrKindOf('supply_house')).toBe('supply_house')
    expect(qrStripCount([], 'candidate')).toBe('0 for candidates')
  })

  it('reads each in plain words', () => {
    const sentences = QR_KIND_ORDER.map((k) => `These lines are for ${QR_KINDS[k]}.`)
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})

describe('plain words', () => {
  it('holds every sentence the strip and the window say', () => {
    const sentences = [
      FIND_NOTE,
      REMOVE_ASK.title,
      REMOVE_ASK.words,
      qrEmpty('').words,
      qrEmpty('x').words,
      qrEmpty('x', 'find').words,
      QR_PRESS_COUNTED,
      EDITOR_WORDS.saveNote,
      EDITOR_WORDS.removedNote,
      EDITOR_WORDS.empty(''),
      EDITOR_WORDS.empty('x'),
      findWhere({ step: { name: 'Asked to quote', done: 'their quote is in the portal' }, who: 'them', firstName: 'Greg', daysOn: 10, off: false }).sentence,
      findWhere({ step: null, who: 'them', firstName: 'Marcus', daysOn: null, off: true }).sentence,
      findWhere({ step: null, who: 'them', firstName: 'Dee', daysOn: null, off: false }).sentence,
      versionWords({ by: 'robert', at: NOW, kind: 'removed' }, STEPS).note ?? '',
      ...[
        addQuickReply({ id: 'a', text: 'x', tags: { for: 'any', stepId: null }, mine: false, by: 'r', at: NOW }),
        addQuickReply({ id: 'b', text: 'x', tags: { for: 'any', stepId: null }, mine: true, by: 'r', at: NOW }),
        addQuickReply({ id: 'c', text: '', tags: { for: 'any', stepId: null }, mine: true, by: 'r', at: NOW }),
        editQuickReply(byId('q14'), { text: 'Got it.', tags: { for: 'any', stepId: null } }, 'r', NOW),
        editQuickReply(byId('q14'), { text: byId('q14').text, tags: { for: 'any', stepId: null } }, 'r', NOW),
        editQuickReply(byId('q14'), { text: '', tags: { for: 'any', stepId: null } }, 'r', NOW),
        removeQuickReply(byId('q14'), 'r', NOW),
        restoreQuickReply(byId('q14'), 'r', NOW),
      ].map((r) => ('error' in r ? r.error : r.words)),
    ]
    expect(sentences.filter((s) => !s)).toEqual([])
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
