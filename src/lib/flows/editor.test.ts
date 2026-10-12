import { describe, expect, it } from 'vitest'
import {
  PUT_BACK_WORDS,
  WHO_MOVES_NOTE,
  addFact,
  addPaper,
  addStep,
  draftFrom,
  draftWords,
  drawnEntry,
  flowFromRows,
  flowRows,
  historyLines,
  moveStep,
  moveToLane,
  nudgeChange,
  putBack,
  removeFact,
  removePaper,
  removeStep,
  removedLines,
  renameStep,
  restoreStep,
  saveDraft,
  savedWords,
  setFork,
  setJoin,
  setLoop,
  setNudge,
  setSeat,
  setUsual,
  setWho,
  stepKeyFor,
  whoMovesPreview,
  type EditResult,
  type FlowDraft,
} from './editor'
import { FLOW_FIXTURE_NOW, FLOW_FIXTURE_PEOPLE } from './flowFixtures'
import { SEED_FLOWS } from './seed'
import { stepById, type FlowDef } from './state'

/** A Central time in 2026 as an ISO timestamp; the demo days fall in daylight time. */
const at = (m: number, d: number, h: number, mi = 0) => new Date(`2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00-05:00`).toISOString()

/** The draft an edit made, or the test fails with its refusal. */
function ok(result: EditResult): FlowDraft {
  if (!result.ok) throw new Error(`refused: ${result.words}`)
  return result.draft
}

/** A chain of edits on a draft. */
const edits = (draft: FlowDraft, ...steps: ((d: FlowDraft) => EditResult)[]) => steps.reduce((d, edit) => ok(edit(d)), draft)

/** The trade flow as it was before Rosa's edit of Sep 20: Papers in nudged after 3 days, by a text. */
const tradeBefore = (): FlowDef => ({
  ...SEED_FLOWS.trade,
  lanes: SEED_FLOWS.trade.lanes.map((l) => ({
    ...l,
    steps: l.steps.map((s) => (s.id === 'papers' ? { ...s, nudge: { days: 3, how: 'text' as const, send: 'ask' as const, dayFact: null } } : s)),
  })),
})

describe('History, as the prototype v1.178 draws it', () => {
  it('reads the prototype’s History tab lines word for word', () => {
    const rosa = saveDraft(
      edits(
        draftFrom(tradeBefore()),
        (d) => setNudge(d, 'papers', { days: 5, how: 'text', send: 'ask', dayFact: null }),
        (d) => setNudge(d, 'papers', { days: 5, how: 'call', send: 'ask', dayFact: null }),
      ),
      'Rosa',
      at(9, 20, 14, 10),
    )
    expect(historyLines([drawnEntry(SEED_FLOWS.trade, 'Robert', at(9, 12, 9)), ...rosa.history])).toEqual([
      'Robert · Sep 12, 9:00 AM · the flow drawn, nine steps',
      'Rosa · Sep 20, 2:10 PM · Papers in: the nudge from 3 days to 5, a call',
    ])
    // Robert's restructure of Oct 2 moved steps between lanes, which the editor's arrows do not do; it reads as stored.
    const restructure = {
      stepId: null,
      what: 'Once holds the master agreement; the ask, the bid, the yes and the contract moved to Per job',
      before: null,
      after: null,
      by: 'Robert',
      at: at(10, 2, 11, 40),
    }
    // The customer flow was drawn with ten steps; change orders came later, apart in Per job.
    const customerAsDrawn = { ...SEED_FLOWS.customer, lanes: SEED_FLOWS.customer.lanes.map((l) => ({ ...l, steps: l.steps.filter((s) => s.id !== 'co') })) }
    expect(historyLines([drawnEntry(customerAsDrawn, 'Rosa', at(9, 12, 9, 30)), restructure])).toEqual([
      'Rosa · Sep 12, 9:30 AM · the flow drawn, ten steps',
      'Robert · Oct 2, 11:40 AM · Once holds the master agreement; the ask, the bid, the yes and the contract moved to Per job',
    ])
    expect(historyLines([drawnEntry(SEED_FLOWS.arch, 'Robert', at(9, 12, 9, 40))])).toEqual(['Robert · Sep 12, 9:40 AM · the flow drawn, five steps'])
  })

  it('writes one line per step that changed, with the step as it was and as it became', () => {
    expect(rosaSaved().history).toEqual([
      {
        stepId: 'papers',
        what: 'Papers in: the nudge from 3 days to 5, a call',
        before: stepById(tradeBefore(), 'papers'),
        after: stepById(SEED_FLOWS.trade, 'papers'),
        by: 'Rosa',
        at: at(9, 20, 14, 10),
      },
    ])
    expect(rosaSaved().flow).toEqual(SEED_FLOWS.trade)
  })

  it('says nothing for a nudge set back to what it was', () => {
    const back = edits(
      draftFrom(SEED_FLOWS.trade),
      (d) => setNudge(d, 'papers', null),
      (d) => setNudge(d, 'papers', stepById(SEED_FLOWS.trade, 'papers')?.nudge ?? null),
    )
    expect(saveDraft(back, 'Rosa', at(10, 2, 9)).history).toEqual([])
  })
})

const rosaSaved = () =>
  saveDraft(
    edits(draftFrom(tradeBefore()), (d) => setNudge(d, 'papers', { days: 5, how: 'call', send: 'ask', dayFact: null })),
    'Rosa',
    at(9, 20, 14, 10),
  )

describe('the edits, in the prototype’s words', () => {
  it('say each change as Settings → Flows lists it', () => {
    const draft = edits(
      draftFrom(SEED_FLOWS.trade),
      (d) => renameStep(d, 'papers', { name: 'Papers and insurance', nameEs: 'Documentos y seguro' }),
      (d) => moveStep(d, 'msa', 'up'),
      (d) => addFact(d, 'msa', 'tab_seen'),
      (d) => removeFact(d, 'msa', 'tab_seen'),
      (d) => addPaper(d, 'compare', 'quote'),
      (d) => removePaper(d, 'compare', 'quote'),
      (d) => setFork(d, 'papers', true),
      (d) => setLoop(d, 'closeout', 'each building'),
      (d) => setWho(d, 'compare', 'both'),
      (d) => setSeat(d, 'invited', { id: 'user-rosa', name: 'Rosa' }),
      (d) => setUsual(d, 'sow', 6),
      (d) => addStep(d, 'once', { name: 'Safety orientation', facts: ['portal_opened'] }),
      (d) => removeStep(d, 'draws', 'Rosa', at(10, 2, 9)),
      (d) => restoreStep(d, 'draws'),
      (d) => setNudge(d, 'portal', { days: 3, how: 'text', send: 'ask', dayFact: null }),
    )
    expect(draftWords(draft).map((w) => w.words)).toEqual([
      'Papers in renamed Papers and insurance',
      'Papers and insurance: Spanish name',
      'MSA signed moved up',
      'MSA signed: + they saw the bid results',
      'MSA signed: − they saw the bid results',
      'Compared: + paper quote',
      'Compared: − paper quote',
      'Papers and insurance: facts joined with or',
      'Closeout: repeats → each building',
      'Compared: whose move → both sides',
      'Invited: seat → Rosa',
      'Statement of work: usual → 6 days',
      '+ Safety orientation in Once',
      '− Draws',
      'Draws put back',
      'Portal opened: the nudge, one of ours sends it',
    ])
    const once = draft.flow.lanes[0]?.steps.map((s) => s.id)
    expect(once).toEqual(['invited', 'portal', 'msa', 'papers', 'safety_orientation'])
    expect(draft.flow.lanes[1]?.steps.map((s) => s.id).slice(-1)).toEqual(['draws'])
  })

  it('says a nudge turned on, off, or moved to another channel', () => {
    const text = { days: 3, how: 'text' as const, send: 'ask' as const, dayFact: null }
    expect(nudgeChange(null, text)).toBe('the nudge on, 3 days, a text')
    expect(nudgeChange(text, null)).toBe('the nudge off')
    expect(nudgeChange(text, { ...text, how: 'call' })).toBe('the nudge from a text to a call')
    expect(nudgeChange(text, { ...text, send: 'app' })).toBe('the nudge, the app sends it')
    expect(nudgeChange(text, { ...text, dayFact: 'pay_by' })).toBe('the nudge, at pay by')
    expect(nudgeChange(text, text)).toBe('')
  })
})

describe('a step moved to another lane', () => {
  /** The customer flow before the owner's afternoon of Oct 2: the ask, the bid, the yes and the contract in Once, change orders in Any time. */
  const customerBefore = (): FlowDef => {
    const steps = SEED_FLOWS.customer.lanes.flatMap((l) => l.steps)
    const step = (id: string) => steps.find((s) => s.id === id)!
    return {
      kind: 'customer',
      lanes: [
        { lane: 'once', steps: ['agreement', 'asked', 'bid', 'yes', 'contract'].map(step) },
        { lane: 'per_job', steps: ['start', 'onsite', 'payapp', 'close', 'warranty'].map(step) },
        { lane: 'any_time', steps: [step('co')] },
      ],
    }
  }

  it('replays the owner’s afternoon into the customer flow as it stands, one History line per step', () => {
    const draft = edits(
      draftFrom(customerBefore()),
      (d) => moveToLane(d, 'asked', 'per_job', 0),
      (d) => moveToLane(d, 'bid', 'per_job', 1),
      (d) => moveToLane(d, 'yes', 'per_job', 2),
      (d) => moveToLane(d, 'contract', 'per_job', 3),
      (d) => moveToLane(d, 'co', 'per_job'),
    )
    expect(draft.flow).toEqual(SEED_FLOWS.customer)
    expect(historyLines(saveDraft(draft, 'Robert', at(10, 2, 11, 40)).history)).toEqual([
      'Robert · Oct 2, 11:40 AM · Asked us moved to Per job',
      'Robert · Oct 2, 11:40 AM · Our bid moved to Per job',
      'Robert · Oct 2, 11:40 AM · Said yes moved to Per job',
      'Robert · Oct 2, 11:40 AM · Contract signed moved to Per job',
      'Robert · Oct 2, 11:40 AM · Change orders moved to Per job',
    ])
  })

  it('refuses the lane it is in, and a step that is not there', () => {
    expect(moveToLane(draftFrom(SEED_FLOWS.customer), 'start', 'per_job')).toEqual({
      ok: false,
      why: 'same lane',
      words: 'It is in Per job already. Move it with the arrows.',
    })
    expect(moveToLane(draftFrom(SEED_FLOWS.customer), 'nope', 'once')).toMatchObject({ ok: false, why: 'no step' })
  })

  it('makes the lane it goes to, and lets a lane it leaves empty go', () => {
    const moved = ok(moveToLane(draftFrom(SEED_FLOWS.arch), 'questions', 'any_time'))
    expect(moved.flow.lanes.map((l) => [l.lane, l.steps.map((s) => s.id)])).toEqual([
      ['per_job', ['plans', 'addenda', 'submittals', 'certify']],
      ['any_time', ['questions']],
    ])
    const only = ok(moveToLane(draftFrom(SEED_FLOWS.unknown), 'who', 'per_job'))
    expect(only.flow.lanes.map((l) => l.lane)).toEqual(['per_job'])
  })
})

describe('the refusals', () => {
  const draft = draftFrom(SEED_FLOWS.trade)

  it('refuse a step name that fails plain words, an empty one, and one another step has', () => {
    expect(renameStep(draft, 'papers', { name: 'Papers in; insurance too' })).toMatchObject({ ok: false, why: 'not plain' })
    expect(renameStep(draft, 'papers', { name: 'Papers (W-9 and insurance)' })).toMatchObject({ ok: false, why: 'not plain' })
    expect(addStep(draft, 'once', { name: '   ' })).toEqual({ ok: false, why: 'no name', words: 'Name it, or Not now.' })
    expect(renameStep(draft, 'papers', { name: 'msa signed' })).toEqual({ ok: false, why: 'name taken', words: 'Another step in this flow has that name.' })
    expect(renameStep(draft, 'papers', { name: `Papers ${'x'.repeat(80)}` })).toEqual({ ok: false, why: 'too long', words: 'A step’s name is 80 characters at most.' })
  })

  it('pick facts only from the app’s list and papers only from the list, once each', () => {
    expect(addFact(draft, 'msa', 'their_safety_card')).toMatchObject({ ok: false, why: 'not a fact' })
    expect(addStep(draft, 'once', { name: 'Safety card', facts: ['their_safety_card'] })).toMatchObject({ ok: false, why: 'not a fact' })
    expect(addPaper(draft, 'msa', 'safety_card')).toEqual({ ok: false, why: 'not a paper', words: 'A paper that is not on the list cannot be added.' })
    expect(addFact(draft, 'msa', 'msa_signed')).toEqual({ ok: false, why: 'picked', words: 'It is picked already.' })
  })

  it('keep a step inside its lane, and ask for a step that is there', () => {
    expect(moveStep(draft, 'invited', 'up')).toEqual({ ok: false, why: 'at the edge', words: 'It is first in its lane.' })
    expect(moveStep(draft, 'msa', 'down')).toEqual({ ok: false, why: 'at the edge', words: 'It is last in its lane.' })
    expect(setUsual(draft, 'nope', 3)).toMatchObject({ ok: false, why: 'no step' })
    expect(restoreStep(draft, 'draws')).toMatchObject({ ok: false, why: 'not removed' })
  })
})

describe('nothing stored as state', () => {
  it('leaves the draft an edit started from as it was, and Put it back returns to the saved flow', () => {
    const draft = draftFrom(SEED_FLOWS.trade)
    const copy = structuredClone(draft)
    const edited = edits(draft, (d) => removeStep(d, 'papers', 'Rosa', at(10, 2, 9)), (d) => moveStep(d, 'msa', 'up'))
    expect(draft).toEqual(copy)
    expect(edited.flow).not.toEqual(SEED_FLOWS.trade)
    expect(putBack(edited)).toEqual(draft)
    expect(PUT_BACK_WORDS).toBe('Put back as it was.')
  })

  it('keeps a removed step in Removed with who and when, and Save says which came back', () => {
    const removed = saveDraft(ok(removeStep(draftFrom(SEED_FLOWS.trade), 'papers', 'Rosa', at(10, 2, 9))), 'Rosa', at(10, 2, 9))
    expect(removedLines(removed.removed)).toEqual(['Papers in · Once · removed by Rosa, Oct 2, 9:00 AM'])
    expect(removed.history.map((h) => [h.stepId, h.what, h.after])).toEqual([['papers', '− Papers in', null]])
    const back = saveDraft(ok(restoreStep(draftFrom(removed.flow, removed.removed), 'papers')), 'Robert', at(10, 2, 10))
    expect(back.putBack).toEqual(['papers'])
    expect(back.removed).toEqual([])
    expect(back.flow.lanes[0]?.steps.slice(-1).map((s) => s.id)).toEqual(['papers'])
  })

  it('reads a flow from its rows as it wrote them', () => {
    for (const flow of Object.values(SEED_FLOWS)) expect(flowFromRows(flow.kind, flowRows(flow))).toEqual(flow)
    expect(flowRows(SEED_FLOWS.trade).filter((r) => r.lane === 'per_job').map((r) => [r.step_key, r.position])).toEqual([
      ['ask', 0],
      ['compare', 1],
      ['sow', 2],
      ['draws', 3],
      ['closeout', 4],
    ])
  })

  it('makes a step key from the name, unlike any other', () => {
    const draft = draftFrom(SEED_FLOWS.trade)
    expect(stepKeyFor(draft, 'Safety orientation')).toBe('safety_orientation')
    expect(stepKeyFor(draft, 'Papers in')).toBe('papers_in')
    expect(stepKeyFor(draft, 'Draws')).toBe('draws_2')
    expect(stepKeyFor(draft, '2nd walk')).toBe('s_2nd_walk')
  })
})

describe('Before you save · who moves', () => {
  it('tries the edit on every trade partner in the demo first, and says who moves', () => {
    const draft = ok(removeStep(draftFrom(SEED_FLOWS.trade), 'papers', 'Rosa', at(10, 2, 9)))
    const preview = whoMovesPreview(draft, FLOW_FIXTURE_PEOPLE, FLOW_FIXTURE_NOW)
    const line = (id: string) => preview.lines.find((l) => l.contactId === id)
    expect(line('tom')).toEqual({ contactId: 'tom', name: 'Tom Riddle', moved: true, words: 'Papers in → MSA signed' })
    expect(line('greg')).toEqual({ contactId: 'greg', name: 'Greg Paulk', moved: false, words: 'Asked to quote · same' })
    expect(preview.lines.every((l) => FLOW_FIXTURE_PEOPLE.find((p) => p.contactId === l.contactId)?.stamps.kind === 'trade')).toBe(true)
    expect(preview.changes).toBe('− Papers in.')
    const moved = preview.lines.filter((l) => l.moved).length
    expect(savedWords(moved)).toBe(`Saved. ${moved} people moved with it.`)
    expect(WHO_MOVES_NOTE).toBe('The flow is a read over the stamps, so the edit is tried on everyone first.')
  })

  it('says nobody moves, or one person, in words', () => {
    expect(savedWords(0)).toBe('Saved. Nobody moved.')
    expect(savedWords(1)).toBe('Saved. 1 person moved with it.')
  })
})

describe('a paper made in the Contract library', () => {
  const doc = 'doc:7d0c3f4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
  const withPaper = (d: FlowDraft) =>
    edits(
      d,
      (x) => addPaper(x, 'papers', doc, 'Safety plan'),
      (x) => addFact(x, 'papers', `${doc}:current`, 'Safety plan'),
    )

  it('goes on a step with its one fact, said by its name, and is written to the step’s row as it is', () => {
    const draft = withPaper(draftFrom(SEED_FLOWS.trade))
    expect(draftWords(draft).map((w) => w.words)).toEqual(['Papers in: + paper Safety plan', 'Papers in: + the Safety plan is current'])
    const row = saveDraft(draft, 'Rosa', at(10, 2, 9)).rows.find((r) => r.step_key === 'papers')
    expect(row?.papers.slice(-1)).toEqual([doc])
    expect(row?.facts.slice(-1)).toEqual([`${doc}:current`])
    expect(row?.join_word).toBe('and')
  })

  it('is picked once, and comes off by its name', () => {
    const on = withPaper(draftFrom(SEED_FLOWS.trade))
    expect(addPaper(on, 'papers', doc, 'Safety plan')).toEqual({ ok: false, why: 'picked', words: 'It is picked already.' })
    expect(addFact(on, 'papers', `${doc}:current`)).toEqual({ ok: false, why: 'picked', words: 'It is picked already.' })
    const off = edits(
      on,
      (x) => removeFact(x, 'papers', `${doc}:current`, 'Safety plan'),
      (x) => removePaper(x, 'papers', doc, 'Safety plan'),
    )
    expect(draftWords(off).slice(-2).map((w) => w.words)).toEqual(['Papers in: − the Safety plan is current', 'Papers in: − paper Safety plan'])
    expect(off.flow).toEqual(SEED_FLOWS.trade)
  })

  it('refuses an id that is no library document’s, and a kind of fact the library does not keep', () => {
    const draft = draftFrom(SEED_FLOWS.trade)
    expect(addPaper(draft, 'papers', 'doc:safety-plan')).toMatchObject({ ok: false, why: 'not a paper' })
    expect(addFact(draft, 'papers', `${doc}:expired`)).toMatchObject({ ok: false, why: 'not a fact' })
    expect(addStep(draft, 'once', { name: 'Safety plan in', facts: [`${doc}:on_file`], papers: [doc] })).toMatchObject({ ok: true })
  })

  it('keeps a name that has its own article, and calls a paper with no name a library paper', () => {
    const draft = edits(
      draftFrom(SEED_FLOWS.trade),
      (x) => addFact(x, 'papers', `${doc}:on_file`, 'their W-2'),
      (x) => addPaper(x, 'papers', doc),
    )
    expect(draftWords(draft).map((w) => w.words)).toEqual(['Papers in: + their W-2 is on file', 'Papers in: + paper a library paper'])
  })
})

describe('a fork, and the join it holds', () => {
  const draft = draftFrom(SEED_FLOWS.trade)

  it('marks a step a fork and back, the join moving with it in the prototype’s words', () => {
    const fork = ok(setFork(draft, 'papers', true))
    expect(stepById(fork.flow, 'papers')).toMatchObject({ fork: true, join: 'or' })
    const back = ok(setFork(fork, 'papers', false))
    expect(stepById(back.flow, 'papers')).toMatchObject({ fork: false, join: 'and' })
    expect(draftWords(back).map((w) => w.words)).toEqual(['Papers in: facts joined with or', 'Papers in: facts joined with and'])
    expect(ok(setFork(draft, 'compare', true))).toBe(draft)
  })

  it('refuses a join the fork does not hold, in words, for a step and for a new one', () => {
    expect(setJoin(draft, 'papers', 'or')).toEqual({ ok: false, why: 'not a fork', words: 'Only a fork finishes on either fact. Mark the step a fork first.' })
    expect(setJoin(draft, 'compare', 'and')).toEqual({ ok: false, why: 'a fork', words: 'A fork finishes on either fact. Unmark the fork to need every fact.' })
    expect(ok(setJoin(draft, 'compare', 'or'))).toBe(draft)
    expect(addStep(draft, 'once', { name: 'Either way', facts: ['portal_opened', 'tab_seen'], join: 'or' })).toMatchObject({ ok: false, why: 'not a fork' })
    const fork = ok(addStep(draft, 'once', { name: 'Either way', facts: ['portal_opened', 'tab_seen'], fork: true }))
    expect(stepById(fork.flow, 'either_way')).toMatchObject({ fork: true, join: 'or' })
  })

  it('sets right a step read from a row whose join its fork does not hold', () => {
    const rows = flowRows(SEED_FLOWS.trade).map((r) => (r.step_key === 'papers' ? { ...r, join_word: 'or' as const } : r))
    const fixed = ok(setJoin(draftFrom(flowFromRows('trade', rows)), 'papers', 'and'))
    expect(stepById(fixed.flow, 'papers')).toMatchObject({ fork: false, join: 'and' })
    expect(draftWords(fixed).map((w) => w.words)).toEqual(['Papers in: facts joined with and'])
  })
})

describe('History past 500 characters', () => {
  it('begins a second line for the step where the next change would pass the column, splitting at a change', () => {
    const a = 'Papers in from the trade partner before they start any work on the job'
    const b = 'Papers on file from the trade partner before they start any work on site'
    const rename = (name: string) => (d: FlowDraft) => renameStep(d, 'papers', { name })
    const draft = edits(draftFrom(SEED_FLOWS.trade), rename(a), rename(b), rename(a), rename(b), rename(a))
    const history = saveDraft(draft, 'Rosa', at(10, 2, 9)).history
    expect(history.map((h) => h.stepId)).toEqual(['papers', 'papers'])
    expect(history.every((h) => h.what.length <= 500)).toBe(true)
    expect(history.map((h) => h.what).join('; ')).toBe(draftWords(draft).map((w) => w.words).join('; '))
  })
})
