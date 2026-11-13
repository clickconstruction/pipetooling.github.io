import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { payerTodo, pctTodo, projectTodo, todoLinkPaths } from './callTodo'
import { NO_TODO, TODO_DONE_SHOWN_DAYS, handedOutWords, todoCheckLabel, todoKeyOfLink, todoStateFor, todoStateWords, todoStates, todoWindowLines, whoWords, type TodoCard } from './callTodoState'

// Made-up customers, jobs and people.
const dayLabel = (ymd: string): string => `d${ymd.slice(8)}`
const TODAY = '2026-03-12'
const payer = payerTodo({ payerId: 'c1', name: 'Alder Builders', usd: 52_000, lateUsd: 40_000, projects: [] })
const project = (jobId: string, label: string) => projectTodo({ payerName: 'Alder Builders', jobId, label, usd: 1_000, ageDays: 40, promisedYmd: null, broken: false }, dayLabel)
const maple = project('j201', '201 · Maple Lofts')
const oak = project('j202', '202 · Oak Court')
const pct = pctTodo({ id: 'j201', label: '201 · Maple Lofts', revenueUsd: null })
const link = (todo: { key: string; paths: string[] }) => `https://app.example${todoLinkPaths({ ...todo, title: '', doneWhen: [] })[0]}`
const card = (over: Partial<TodoCard> & { for: { key: string; paths: string[] } }): TodoCard => {
  const { for: todo, ...rest } = over
  return { itemId: 'i1', title: 'A card', links: [link(todo)], madeYmd: '2026-03-10', dueYmd: null, who: ['Dana Reyes'], instances: [{ id: 'n1', doneYmd: null, doneBy: null }], ...rest }
}

describe('where a line stands as a to-do', () => {
  it('reads the tag off a card’s link, and nothing off any other link', () => {
    expect(todoKeyOfLink('https://app.example/jobs?jobDetail=j201&todo=pct.j201')).toBe('pct.j201')
    expect(todoKeyOfLink('https://app.example/customers/c1?todo=payer.c1#top')).toBe('payer.c1')
    expect(todoKeyOfLink('https://app.example/customers/c1')).toBeNull()
    expect(todoKeyOfLink('https://app.example/jobs?jobDetail=j201')).toBeNull()
  })

  it('reads a card with an open day as with its person, and counts the days', () => {
    const states = todoStates([card({ for: payer })], TODAY)
    expect(states.get('payer.c1')).toMatchObject({ kind: 'open', who: 'Dana', days: 2, late: false })
    expect(todoStateWords(states.get('payer.c1')!, dayLabel)).toBe('Dana, 2 days')
    expect(todoStateWords(todoStates([card({ for: payer, madeYmd: TODAY })], TODAY).get('payer.c1')!, dayLabel)).toBe('Dana, today')
    expect(todoStateWords(todoStates([card({ for: payer, madeYmd: '2026-03-11' })], TODAY).get('payer.c1')!, dayLabel)).toBe('Dana, 1 day')
    // A card with no day rows yet is still open.
    expect(todoStates([card({ for: payer, instances: [] })], TODAY).get('payer.c1')?.kind).toBe('open')
  })

  it('turns late past the due day, or after three days when the card has none', () => {
    const late = (over: Partial<TodoCard>) => todoStates([card({ for: payer, ...over })], TODAY).get('payer.c1')
    expect(late({ madeYmd: '2026-03-09' })).toMatchObject({ kind: 'open', days: 3, late: true })
    expect(late({ madeYmd: '2026-03-10' })).toMatchObject({ late: false })
    // Its own due day rules: a week-old card due tomorrow is not late, a card from yesterday due yesterday is.
    expect(late({ madeYmd: '2026-03-05', dueYmd: '2026-03-13' })).toMatchObject({ late: false })
    expect(late({ madeYmd: '2026-03-11', dueYmd: '2026-03-11' })).toMatchObject({ late: true })
  })

  it('goes back to grey once finished, and remembers who finished it for two weeks', () => {
    const done = (doneYmd: string) => todoStates([card({ for: payer, instances: [{ id: 'n1', doneYmd, doneBy: 'Sam Holt' }] })], TODAY).get('payer.c1')
    expect(done('2026-03-10')).toMatchObject({ kind: 'done', who: 'Sam', doneYmd: '2026-03-10' })
    expect(todoStateWords(done('2026-03-10')!, dayLabel)).toBe('Sam finished d10')
    // Past the window the line is as if nothing was ever made.
    expect(TODO_DONE_SHOWN_DAYS).toBe(14)
    expect(done('2026-02-26')?.kind).toBe('done')
    expect(done('2026-02-25')).toBeUndefined()
    // No name on the finish: the person the card was with.
    expect(todoStates([card({ for: payer, instances: [{ id: 'n1', doneYmd: '2026-03-11', doneBy: null }] })], TODAY).get('payer.c1')).toMatchObject({ kind: 'done', who: 'Dana' })
  })

  it('lets an open card win over a finished one for the same thing', () => {
    const states = todoStates([card({ for: payer, itemId: 'old', madeYmd: '2026-03-01', instances: [{ id: 'n0', doneYmd: '2026-03-05', doneBy: 'Sam Holt' }] }), card({ for: payer, itemId: 'new', madeYmd: '2026-03-11' })], TODAY)
    expect(states.get('payer.c1')).toMatchObject({ kind: 'open', card: { itemId: 'new' } })
  })

  it('keeps a job’s percent card apart from its pay-date card', () => {
    const states = todoStates([card({ for: pct })], TODAY)
    expect(todoStateFor(states, pct).kind).toBe('open')
    expect(todoStateFor(states, maple)).toBe(NO_TODO)
  })

  it('reads a project under a customer’s open card as covered, unless it has its own', () => {
    const states = todoStates([card({ for: payer, itemId: 'customer' }), card({ for: oak, itemId: 'oak', who: ['Sam Holt'] })], TODAY)
    expect(todoStateFor(states, maple, payer)).toMatchObject({ kind: 'covered', who: 'Dana', card: { itemId: 'customer' } })
    expect(todoStateWords(todoStateFor(states, maple, payer), dayLabel)).toBe('With Dana')
    expect(todoStateFor(states, oak, payer)).toMatchObject({ kind: 'open', who: 'Sam', card: { itemId: 'oak' } })
    // Nothing read yet, or no to-do for the line: grey.
    expect(todoStateFor(null, maple, payer)).toBe(NO_TODO)
    expect(todoStateFor(states, undefined)).toBe(NO_TODO)
  })

  it('counts a customer’s projects that are with someone', () => {
    const states = todoStates([card({ for: oak })], TODAY)
    expect(handedOutWords(states, [maple, oak, undefined])).toBe('1 of 3 handed out')
    expect(handedOutWords(states, [maple])).toBe('')
    expect(handedOutWords(null, [maple, oak])).toBe('')
  })

  it('names the people on a card in a few words', () => {
    expect(whoWords([])).toBe('Nobody yet')
    expect(whoWords(['Dana Reyes'])).toBe('Dana')
    expect(whoWords(['Dana Reyes', 'Sam Holt'])).toBe('Dana and Sam')
    expect(whoWords(['Dana Reyes', 'Sam Holt', 'Lee Park'])).toBe('Dana and 2 more')
  })

  it('says on the check what a press will do', () => {
    const open = todoStates([card({ for: payer, title: 'Call Alder Builders.' })], TODAY).get('payer.c1')!
    expect(todoCheckLabel(payer, NO_TODO, dayLabel)).toBe(`Make a to-do: ${payer.title}`)
    expect(todoCheckLabel(payer, open, dayLabel)).toBe('See the to-do. Dana has had it for 2 days: Call Alder Builders.')
    const late = todoStates([card({ for: payer, title: 'Call Alder Builders.', madeYmd: '2026-03-01' })], TODAY).get('payer.c1')!
    expect(todoCheckLabel(payer, late, dayLabel)).toBe('See the to-do. Dana has had it for 11 days, and it has waited too long: Call Alder Builders.')
    const done = todoStates([card({ for: payer, instances: [{ id: 'n1', doneYmd: '2026-03-10', doneBy: 'Sam Holt' }] })], TODAY).get('payer.c1')!
    expect(todoCheckLabel(payer, done, dayLabel)).toBe(`Make a to-do again. Sam finished the last one d10: ${payer.title}`)
  })

  it('writes the window’s lines in plain words: who, since when, and when it is due', () => {
    const open = todoStates([card({ for: payer })], TODAY).get('payer.c1')! as Parameters<typeof todoWindowLines>[0]
    expect(todoWindowLines(open, TODAY, dayLabel)).toEqual(['Dana has it.', 'Handed over d10, 2 days ago.'])
    const due = todoStates([card({ for: payer, dueYmd: '2026-03-11', who: ['Dana Reyes', 'Sam Holt'] })], TODAY).get('payer.c1')! as Parameters<typeof todoWindowLines>[0]
    expect(todoWindowLines(due, TODAY, dayLabel)).toEqual(['Dana and Sam have it.', 'Handed over d10, 2 days ago.', 'It was due d11.'])
    const late = todoStates([card({ for: payer, madeYmd: '2026-03-02', who: [] })], TODAY).get('payer.c1')! as Parameters<typeof todoWindowLines>[0]
    expect(todoWindowLines(late, TODAY, dayLabel)).toEqual(['Nobody is on it yet.', 'Handed over d02, 10 days ago.', 'It has waited more than 2 days.'])
    for (const l of [...todoWindowLines(open, TODAY, dayLabel), ...todoWindowLines(due, TODAY, dayLabel), ...todoWindowLines(late, TODAY, dayLabel)]) expect(plainWordsFailures(l), l).toEqual([])
  })
})
