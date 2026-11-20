import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { droppedReason, stuckReason, stuckSaidBy } from '../checklistCardEvents'
import { PASS_ANSWER_PICTURES, TASK_MAP_START_PICTURES, TASK_MORE_PICTURES, TASK_MORE_TITLE, type TaskMoreKey, FORWARD_KEEPS_WORDS, forwardPressLabel, forwardTakers, handBackLabel, handPeople, handPressLabel, handPushToGiver, handPushToTaker, handSentence, PASS_MIN_TASKS, PASS_PRESS_LABEL, passAnswers, passCountWords, passSummary, STUCK_REASONS, sortedPush, stuckChipWords, stuckListLabel, stuckPressLabel, stuckPush, stuckRowWords, stuckRule, stuckSentence, DROP_REASONS, DROP_REASON_MAX, TASK_MAP_NOT_OPENED, TASK_MAP_SHEET_FOOT, TASK_MAP_SHEET_TITLE, TASK_MORE_LABEL, addDaysYmd, dropPressLabel, dropPush, dropReasonTidy, dropRule, dropSentence, droppedLineWords, doerLineWords, moveDayPicks, moveDayPressLabel, moveDayPush, moveDayRule, moveDaySentence, movedTimesWords, taskMapStarts, taskMoreChoices } from './taskDoerActs'

describe('a map from the person doing the task', () => {
  it('offers a line by hand, a walked line and a point, in that order', () => {
    expect(taskMapStarts(true).map((r) => r.key)).toEqual(['line', 'walk', 'place'])
    expect(taskMapStarts(true).map((r) => r.label)).toEqual(['Draw it by hand', 'Walk or drive it', 'Leave a point'])
  })
  it('leaves the walk out on a device that cannot say where it is', () => {
    expect(taskMapStarts(false).map((r) => r.key)).toEqual(['line', 'place'])
  })
  it('every word a person reads is plain', () => {
    for (const row of taskMapStarts(true)) expect(plainWordsFailures(row.words)).toEqual([])
    for (const s of [TASK_MAP_SHEET_TITLE, TASK_MAP_SHEET_FOOT, TASK_MAP_NOT_OPENED]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('More', () => {
  it('offers Not today first on an open one-time task, and nothing on a repeating or a done one', () => {
    expect(taskMoreChoices({ once: true, done: false, next: true }).map((r) => r.key)[0]).toBe('move')
    expect(taskMoreChoices({ once: false, done: false }).some((r) => r.key === 'move')).toBe(false)
    expect(taskMoreChoices({ once: true, done: true })).toEqual([])
  })
  it('names itself and its rows in plain words', () => {
    expect(TASK_MORE_LABEL).toBe('⋯ More')
    for (const row of taskMoreChoices({ once: true, done: false })) expect(plainWordsFailures(row.words)).toEqual([])
  })
})

describe('a picture beside every choice (v2.8034)', () => {
  // Every list More can draw: a one-time task, a repeating one, a roadmap one, each plain, picked first, Next and stuck.
  const SHAPES = [{ once: true }, { once: false }, { once: true, roadmap: true }, { once: true, vehicle: true }].flatMap((base) => [{}, { first: true }, { next: true }, { stuck: true }].map((state) => ({ done: false, ...base, ...state })))

  it('every row of More carries the picture of its own key', () => {
    const seen = new Set<TaskMoreKey>()
    for (const shape of SHAPES) {
      for (const row of taskMoreChoices(shape)) {
        expect(row.picture).toBe(TASK_MORE_PICTURES[row.key])
        seen.add(row.key)
      }
    }
    // The shapes reach every act, so no key is left with a picture nothing draws.
    expect([...seen].sort()).toEqual(Object.keys(TASK_MORE_PICTURES).sort())
  })
  it('no two rows of one sheet share a drawing, so a picture alone picks a row out', () => {
    const lists = [...SHAPES.map((shape) => taskMoreChoices(shape)), ...SHAPES.map((shape) => passAnswers(shape)), taskMapStarts(true), taskMapStarts(false)]
    for (const rows of lists) {
      const drawings = rows.map((r) => r.picture.icon)
      expect(new Set(drawings).size).toBe(drawings.length)
    }
  })
  it('no two acts of More share a drawing at all', () => {
    const drawings = Object.values(TASK_MORE_PICTURES).map((p) => p.icon)
    expect(new Set(drawings).size).toBe(drawings.length)
  })
  it('the four ways out the owner drew are told apart by colour too', () => {
    const tones = (['move', 'stuck', 'drop', 'hand'] as const).map((k) => TASK_MORE_PICTURES[k].tone)
    expect(new Set(tones).size).toBe(4)
    // Stuck wears the amber of the stuck mark on a card, and its undoing the green of a way made clear.
    expect(TASK_MORE_PICTURES.stuck.tone).toBe('amber')
    expect(TASK_MORE_PICTURES.unstuck.tone).toBe('green')
  })
  it('an answer of the pass that is one of More\'s acts wears that act\'s picture', () => {
    for (const key of ['move', 'stuck', 'drop'] as const) expect(PASS_ANSWER_PICTURES[key]).toBe(TASK_MORE_PICTURES[key])
    for (const row of passAnswers({ once: true, done: false })) expect(row.picture).toBe(PASS_ANSWER_PICTURES[row.key])
  })
  it('each way to start a map has its own picture', () => {
    for (const row of taskMapStarts(true)) expect(row.picture).toBe(TASK_MAP_START_PICTURES[row.key])
  })
  it('the sheet is still called More for this task', () => {
    expect(TASK_MORE_TITLE).toBe('More for this task')
  })
})

describe('Not today', () => {
  it('counts days across a month end', () => {
    expect(addDaysYmd('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysYmd('2026-11-16', -30)).toBe('2026-10-17')
  })
  it('offers tomorrow and the next Monday', () => {
    // 2026-11-16 is a Monday.
    expect(moveDayPicks('2026-11-16')).toEqual([
      { key: 'tomorrow', label: 'Tomorrow', ymd: '2026-11-17' },
      { key: 'monday', label: 'Monday', ymd: '2026-11-23' },
    ])
    expect(moveDayPicks('2026-11-19')[1]!.ymd).toBe('2026-11-23')
  })
  it('on a Sunday, tomorrow is Monday, so the second pick is the Monday after', () => {
    expect(moveDayPicks('2026-11-22')).toEqual([
      { key: 'tomorrow', label: 'Tomorrow', ymd: '2026-11-23' },
      { key: 'monday', label: 'Monday', ymd: '2026-11-30' },
    ])
  })
  it('holds the press until the day is one the database will take, in its words', () => {
    expect(moveDayRule(null, '2026-11-16')).toBe('Pick a day.')
    expect(moveDayRule('2026-11-15', '2026-11-16')).toBe('Pick today or a later day.')
    expect(moveDayRule('2026-11-16', '2026-11-16')).toBeNull()
    expect(moveDayRule('2027-11-18', '2026-11-16')).toBe('Pick a day within a year.')
    expect(moveDayRule('2027-11-17', '2026-11-16')).toBeNull()
    expect(moveDayRule('2026-11-20', '2026-11-16', '2026-11-20')).toBe('This task is already due that day.')
  })
  it('the press and the sentence name the day, and who is told', () => {
    expect(moveDayPressLabel('Fri, Nov 20')).toBe('Move it to Fri, Nov 20')
    expect(moveDayPressLabel(null)).toBe('Pick a day first')
    expect(moveDaySentence('Fri, Nov 20', 'Imani')).toBe('It moves to Fri, Nov 20. Imani is told.')
    expect(moveDaySentence('Fri, Nov 20', null)).toBe('It moves to Fri, Nov 20.')
    expect(plainWordsFailures(moveDaySentence('Fri, Nov 20', 'Imani'))).toEqual([])
  })
  it('a row says how often its task was moved', () => {
    expect(movedTimesWords(0)).toBe('')
    expect(movedTimesWords(1)).toBe('moved once')
    expect(movedTimesWords(2)).toBe('moved twice')
    expect(movedTimesWords(5)).toBe('moved 5 times')
  })
  it('the giver\'s push says who moved what to when', () => {
    expect(moveDayPush('Theo', 'Give every tool a home', 'Fri, Nov 20')).toEqual({ title: 'A task was moved', body: 'Theo moved "Give every tool a home" to Fri, Nov 20.' })
  })
})

describe('the thread', () => {
  it('words each line the tools write, after the person\'s name', () => {
    expect(doerLineWords('moved', 'Fri, Nov 20')).toBe('moved it to Fri, Nov 20')
    expect(doerLineWords('stuck', 'Waiting on a part')).toBe('is stuck: Waiting on a part')
    expect(doerLineWords('unstuck', '')).toBe('is no longer stuck')
    expect(doerLineWords('dropped', 'Plans changed')).toBe('closed it as no longer applying: Plans changed')
    expect(doerLineWords('handed', 'Hal: wrong crew')).toBe('handed it to Hal: wrong crew')
    expect(doerLineWords('map', 'Shut-off run')).toBe('put a map on it: Shut-off run')
  })
  it('leaves the kinds it does not know to the thread', () => {
    expect(doerLineWords('completed', '')).toBeNull()
    expect(doerLineWords('comment', 'hello')).toBeNull()
  })
})

describe('No longer applies', () => {
  it('is offered on an open one-time task that is neither a roadmap nor a vehicle task', () => {
    const has = (t: Parameters<typeof taskMoreChoices>[0]) => taskMoreChoices(t).some((r) => r.key === 'drop')
    expect(has({ once: true, done: false, roadmap: false, vehicle: false })).toBe(true)
    expect(has({ once: true, done: false, roadmap: true, vehicle: false })).toBe(false)
    expect(has({ once: true, done: false, roadmap: false, vehicle: true })).toBe(false)
    expect(has({ once: false, done: false, roadmap: false, vehicle: false })).toBe(false)
  })
  it('holds the press until there is a reason of three characters, tidied', () => {
    expect(dropRule('')).toBe('Say why in a few words.')
    expect(dropRule('  ok ')).toBe('Say why in a few words.')
    expect(dropRule('Plans changed')).toBeNull()
    expect(dropReasonTidy('  Plans   changed  ')).toBe('Plans changed')
    expect(dropReasonTidy('x'.repeat(300)).length).toBe(DROP_REASON_MAX)
    expect(dropPressLabel(false)).toBe('Say why first')
    expect(dropPressLabel(true)).toBe('Close this task')
  })
  it('every ready-made reason is long enough to send', () => {
    for (const r of DROP_REASONS) expect(dropRule(r)).toBeNull()
  })
  it('the sentence says what happens and who can put it back', () => {
    expect(dropSentence('Imani')).toBe('It leaves your list. Imani is told and can put it back.')
    expect(dropSentence(null)).toBe('It leaves your list. You can put it back from History.')
    for (const s of [dropSentence('Imani'), dropSentence(null)]) expect(plainWordsFailures(s)).toEqual([])
  })
  it('a closed task reads when and why, with one full stop', () => {
    expect(droppedLineWords('12:22 PM', 'Plans changed')).toBe('Closed 12:22 PM as no longer applying. Plans changed.')
    expect(droppedLineWords('12:22 PM', 'Plans changed.')).toBe('Closed 12:22 PM as no longer applying. Plans changed.')
    expect(droppedLineWords('12:22 PM', '')).toBe('Closed 12:22 PM as no longer applying.')
  })
  it('the giver\'s push says who closed what and why', () => {
    expect(dropPush('Theo', 'Set a marker at every mile', ' Plans  changed ')).toEqual({ title: 'A task was closed', body: 'Theo closed "Set a marker at every mile" as no longer applying: Plans changed' })
  })
})

describe('droppedReason', () => {
  const ev = (event_type: string, created_at: string, body = '') => ({ id: `${event_type}-${created_at}`, instance_id: 'i', event_type, actor_user_id: 'u', body, created_at })
  it('reads the reason of a task closed without being done', () => {
    expect(droppedReason([ev('completed', '2026-11-16T12:00:00Z'), ev('dropped', '2026-11-16T12:00:00.1Z', 'Plans changed')])).toBe('Plans changed')
  })
  it('is nothing for a task that was done, and nothing once it is put back', () => {
    expect(droppedReason([ev('completed', '2026-11-16T12:00:00Z')])).toBeNull()
    expect(droppedReason([ev('completed', '2026-11-16T12:00:00Z'), ev('dropped', '2026-11-16T12:00:01Z', 'x'), ev('reopened', '2026-11-16T13:00:00Z')])).toBeNull()
    expect(droppedReason([])).toBeNull()
  })
  it('a note after the close does not undo it', () => {
    expect(droppedReason([ev('completed', '2026-11-16T12:00:00Z'), ev('dropped', '2026-11-16T12:00:01Z', 'A double'), ev('comment', '2026-11-16T12:05:00Z', 'ok')])).toBe('A double')
  })
})

describe("Can't do it", () => {
  it('is offered on any open task, and swaps to No longer stuck once the task is stuck', () => {
    expect(taskMoreChoices({ once: false, done: false, next: true }).map((r) => r.key)).toEqual(['stuck', 'hand'])
    expect(taskMoreChoices({ once: true, done: false, roadmap: true, next: true }).map((r) => r.key)).toEqual(['move', 'stuck'])
    expect(taskMoreChoices({ once: true, done: false, stuck: true }).map((r) => r.key)).toEqual(['move', 'unstuck', 'drop', 'hand'])
    expect(taskMoreChoices({ once: true, done: true })).toEqual([])
  })
  it('holds the press until something is said, and names who is told', () => {
    expect(stuckRule('')).toBe('Say what is in the way.')
    expect(stuckRule('Need a hand')).toBeNull()
    expect(stuckPressLabel(false, 'Imani')).toBe('Say what is in the way first')
    expect(stuckPressLabel(true, 'Imani')).toBe('Tell Imani')
    expect(stuckPressLabel(true, null)).toBe('Mark it stuck')
    for (const r of STUCK_REASONS) expect(stuckRule(r)).toBeNull()
  })
  it('says what happens, in plain words', () => {
    expect(stuckSentence('Imani')).toBe('Imani is told now. The task stays yours.')
    expect(stuckSentence(null)).toBe('The task stays yours and shows as stuck.')
    for (const s of [stuckSentence('Imani'), stuckSentence(null)]) expect(plainWordsFailures(s)).toEqual([])
  })
  it('words the chip, the two pushes and the office\'s row', () => {
    expect(stuckChipWords('Waiting on a part')).toBe('Stuck: Waiting on a part')
    expect(stuckChipWords('')).toBe('Stuck')
    expect(stuckPush('Theo', 'Check the truck fluids', 'Waiting on a part').body).toBe('Theo is stuck on "Check the truck fluids": Waiting on a part')
    expect(sortedPush('Imani', 'Check the truck fluids').body).toBe('Imani says "Check the truck fluids" is sorted. You can carry on.')
    expect(stuckRowWords('Theo', 'Need a hand')).toBe('Theo: Need a hand')
    expect(stuckRowWords('Theo', '')).toBe('Theo is stuck')
    expect(stuckListLabel(2)).toBe('Stuck · 2')
  })
})

describe('stuckReason', () => {
  const ev = (event_type: string, created_at: string, body = '', actor = 'u-theo') => ({ id: `${event_type}-${created_at}`, instance_id: 'i', event_type, actor_user_id: actor, body, created_at })
  it('stands until it is taken off or the task is finished', () => {
    expect(stuckReason([ev('stuck', '2026-11-16T12:00:00Z', 'Need a hand')])).toBe('Need a hand')
    expect(stuckReason([ev('stuck', '2026-11-16T12:00:00Z', 'Need a hand'), ev('comment', '2026-11-16T12:05:00Z', 'on my way')])).toBe('Need a hand')
    expect(stuckReason([ev('stuck', '2026-11-16T12:00:00Z', 'x'), ev('unstuck', '2026-11-16T13:00:00Z')])).toBeNull()
    expect(stuckReason([ev('stuck', '2026-11-16T12:00:00Z', 'x'), ev('completed', '2026-11-16T13:00:00Z')])).toBeNull()
    expect(stuckReason([])).toBeNull()
  })
  it('a task stuck again after it was sorted is stuck', () => {
    expect(stuckReason([ev('stuck', '2026-11-16T12:00:00Z', 'a'), ev('unstuck', '2026-11-16T13:00:00Z'), ev('stuck', '2026-11-16T14:00:00Z', 'b')])).toBe('b')
  })
  it('knows who said it and when', () => {
    expect(stuckSaidBy([ev('stuck', '2026-11-16T12:00:00Z', 'a', 'u-theo')])).toEqual({ userId: 'u-theo', at: '2026-11-16T12:00:00Z' })
    expect(stuckSaidBy([ev('stuck', '2026-11-16T12:00:00Z', 'a'), ev('unstuck', '2026-11-16T13:00:00Z')])).toBeNull()
  })
})

describe('Go through the old ones', () => {
  it('says where the pass stands', () => {
    expect(passCountWords(0, 8)).toBe('1 of 8')
    expect(passCountWords(7, 8)).toBe('8 of 8')
    expect(passCountWords(9, 8)).toBe('8 of 8')
  })
  it('offers each task the tools it allows, with Done first and Skip last', () => {
    expect(passAnswers({ once: true, done: false, roadmap: false, vehicle: false }).map((r) => r.key)).toEqual(['done', 'move', 'stuck', 'drop', 'skip'])
    expect(passAnswers({ once: true, done: false, roadmap: true }).map((r) => r.key)).toEqual(['done', 'move', 'stuck', 'skip'])
    expect(passAnswers({ once: false, done: false }).map((r) => r.key)).toEqual(['done', 'stuck', 'skip'])
    expect(passAnswers({ once: true, done: false, stuck: true }).map((r) => r.key)).toEqual(['done', 'move', 'drop', 'skip'])
  })
  it('ends by saying what it came to', () => {
    expect(passSummary(3, 8)).toBe('You sorted 3. 5 are as they were.')
    expect(passSummary(7, 8)).toBe('You sorted 7. 1 is as it was.')
    expect(passSummary(8, 8)).toBe('You sorted all 8 tasks.')
    expect(passSummary(1, 1)).toBe('You sorted the 1 task.')
    expect(passSummary(0, 8)).toBe('Nothing changed. 8 tasks are as they were.')
    expect(passSummary(0, 1)).toBe('Nothing changed. 1 task is as it was.')
    for (const [s, t] of [[3, 8], [8, 8], [0, 8], [0, 1]] as const) expect(plainWordsFailures(passSummary(s, t))).toEqual([])
  })
  it('names its press and needs two tasks', () => {
    expect(PASS_PRESS_LABEL).toBe('Go through them')
    expect(PASS_MIN_TASKS).toBe(2)
  })
})

describe('Hand it on', () => {
  const PEOPLE = [
    { id: 'u-hal', name: 'Hal' },
    { id: 'u-me', name: 'Theo' },
    { id: 'u-imani', name: 'Imani' },
    { id: 'u-blank', name: ' ' },
    { id: 'u-ava', name: 'Ava' },
  ]
  it('is offered on any open task that is not a roadmap task', () => {
    const has = (t: Parameters<typeof taskMoreChoices>[0]) => taskMoreChoices(t).some((r) => r.key === 'hand')
    expect(has({ once: true, done: false })).toBe(true)
    expect(has({ once: false, done: false })).toBe(true)
    expect(has({ once: true, done: false, roadmap: true })).toBe(false)
    expect(has({ once: true, done: true })).toBe(false)
  })
  it('lists everyone but the person handing it on, by name, narrowed by what is typed', () => {
    expect(handPeople(PEOPLE, 'u-me', '').map((p) => p.name)).toEqual(['Ava', 'Hal', 'Imani'])
    expect(handPeople(PEOPLE, 'u-me', 'ha').map((p) => p.name)).toEqual(['Hal'])
    expect(handPeople(PEOPLE, 'u-me', 'zz')).toEqual([])
  })
  it('the press names who takes it', () => {
    expect(handPressLabel('Hal')).toBe('Hand it to Hal')
    expect(handPressLabel(null)).toBe('Pick who takes it first')
    expect(handBackLabel('Imani')).toBe('Back to Imani')
  })
  it('the sentence says what goes with the task and who is told', () => {
    expect(handSentence({ takerName: 'Hal', once: true, toldName: 'Imani' })).toBe('Hal gets it with its notes and its place. Imani is told.')
    expect(handSentence({ takerName: 'Imani', once: true, toldName: null })).toBe('Imani gets it with its notes and its place.')
    expect(handSentence({ takerName: 'Hal', once: false, toldName: null })).toBe('Hal gets it for this day. The task that repeats stays yours.')
    for (const s of [handSentence({ takerName: 'Hal', once: true, toldName: 'Imani' }), handSentence({ takerName: 'Hal', once: false, toldName: 'Imani' })]) expect(plainWordsFailures(s)).toEqual([])
  })
  it('words the two pushes', () => {
    expect(handPushToTaker('Theo', 'Sort the fittings wall', 'Wrong crew')).toEqual({ title: 'A task was handed to you', body: 'Theo handed you "Sort the fittings wall": Wrong crew' })
    expect(handPushToTaker('Theo', 'Sort the fittings wall', '').body).toBe('Theo handed you "Sort the fittings wall".')
    expect(handPushToGiver('Theo', 'Sort the fittings wall', 'Hal').body).toBe('Theo handed "Sort the fittings wall" to Hal.')
  })
})

describe('Do first', () => {
  it('leads More on an open task that is not Next already, and swaps to its undo once picked', () => {
    expect(taskMoreChoices({ once: true, done: false }).map((r) => r.key)[0]).toBe('first')
    expect(taskMoreChoices({ once: true, done: false, first: true }).map((r) => r.key)[0]).toBe('unfirst')
    expect(taskMoreChoices({ once: true, done: false, next: true }).some((r) => r.key === 'first')).toBe(false)
  })
  it('is not offered on a stuck task, which is never Next, or on a done one', () => {
    expect(taskMoreChoices({ once: true, done: false, stuck: true }).some((r) => r.key === 'first' || r.key === 'unfirst')).toBe(false)
    expect(taskMoreChoices({ once: true, done: true })).toEqual([])
  })
  it('is not an answer of the pass', () => {
    expect(passAnswers({ once: true, done: false }).map((r) => r.key)).toEqual(['done', 'move', 'stuck', 'drop', 'skip'])
  })
})

describe('the Forward window (v2.7563)', () => {
  const people = [{ id: 'u-me', name: 'Theo' }, { id: 'u-2', name: 'Hal' }, { id: 'u-3', name: 'Ava' }, { id: 'u-4', name: ' ' }]

  it('offers everyone with a name but the person forwarding, by name', () => {
    expect(forwardTakers(people, 'u-me').map((p) => p.name)).toEqual(['Ava', 'Hal'])
  })

  it('names who takes it on the press, and says it is busy', () => {
    expect(forwardPressLabel(null, false)).toBe('Forward')
    expect(forwardPressLabel('Hal', false)).toBe('Forward to Hal')
    expect(forwardPressLabel('Hal', true)).toBe('Forwarding…')
  })

  it('says the task goes as it is and that the taker is told', () => {
    expect(FORWARD_KEEPS_WORDS).toBe('The task goes as it is, with its notes, place and photos. Whoever takes it gets a message.')
  })
})
