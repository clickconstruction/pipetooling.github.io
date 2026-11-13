import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { TODO_FOOT, TODO_LINES_MAX, TODO_TAG_PARAM, billTodo, payerTodo, pctTodo, priceTodo, projectTodo, supplyTodo, todoLinkPaths } from './callTodo'

// Made-up customers, jobs and a made-up supply house.
const dayLabel = (ymd: string): string => `d${ymd.slice(8)}`

describe('a to-do card for one thing on What to do now', () => {
  it('names the customer, what they owe, and a line for each bill with no pay date', () => {
    const todo = payerTodo({
      payerId: 'c1',
      name: 'Alder Builders',
      usd: 52_000,
      lateUsd: 40_000,
      projects: [
        { label: '201 · Maple Lofts', promisedYmd: null },
        { label: '202 · Oak Court', promisedYmd: '2026-03-20' },
        { label: '203 · Elm Row', promisedYmd: null },
      ],
    })
    expect(todo).toEqual({
      key: 'payer.c1',
      title: 'Call Alder Builders about $40.0k late. Get a pay date for each bill.',
      paths: ['/customers/c1'],
      // The bill that already has a day is not asked for again.
      doneWhen: ['201 · Maple Lofts: pay date written down', '203 · Elm Row: pay date written down'],
    })
  })

  it('asks to confirm the days when every bill already has one', () => {
    const todo = payerTodo({ payerId: 'c1', name: 'Alder Builders', usd: 52_000, lateUsd: 0, projects: [{ label: '201 · Maple Lofts', promisedYmd: '2026-03-20' }, { label: '202 · Oak Court', promisedYmd: '2026-03-25' }] })
    expect(todo.title).toBe('Call Alder Builders about $52.0k open. Confirm each pay date still holds.')
    expect(todo.doneWhen).toEqual(['201 · Maple Lofts: pay date confirmed', '202 · Oak Court: pay date confirmed'])
  })

  it('says open when nothing is late yet, and links nowhere for a customer with no record', () => {
    const todo = payerTodo({ payerId: null, name: 'Cedar Homes', usd: 9_000, lateUsd: 0, projects: [] })
    expect(todo.title).toBe('Call Cedar Homes about $9.0k open. Get a pay date for each bill.')
    expect(todo.paths).toEqual([])
    expect(todo.doneWhen).toEqual(['Every bill has a pay date written down'])
  })

  it('keeps to the card’s limit of lines, the rest sharing the last one', () => {
    const projects = Array.from({ length: 18 }, (_, i) => ({ label: `${300 + i} · Job ${i}`, promisedYmd: null }))
    const todo = payerTodo({ payerId: 'c1', name: 'Alder Builders', usd: 1, lateUsd: 1, projects })
    expect(todo.doneWhen.length).toBe(TODO_LINES_MAX)
    expect(todo.doneWhen[TODO_LINES_MAX - 1]).toBe('The other 7 bills: pay date written down')
  })

  it('asks one project for its pay date, with what is owed and how long ago it was billed', () => {
    const job = { payerName: 'Alder Builders', jobId: 'j201', label: '201 · Maple Lofts', usd: 30_000, ageDays: 71, promisedYmd: null, broken: false }
    expect(projectTodo(job, dayLabel)).toEqual({ key: 'paydate.j201', title: 'Get a pay date from Alder Builders for 201 · Maple Lofts. $30.0k owed, billed 71 days ago.', paths: ['/jobs?jobDetail=j201'], doneWhen: ['The pay date is written down on the bill'] })
    // A day already named: confirm it. A day that passed: get a new one.
    expect(projectTodo({ ...job, promisedYmd: '2026-03-20' }, dayLabel).title).toBe('Confirm with Alder Builders that 201 · Maple Lofts still pays d20. $30.0k owed, billed 71 days ago.')
    expect(projectTodo({ ...job, promisedYmd: '2026-03-20' }, dayLabel).doneWhen).toEqual(['The day is confirmed or a new one is written down'])
    expect(projectTodo({ ...job, promisedYmd: '2026-03-01', broken: true }, dayLabel)).toMatchObject({ title: 'Get a new pay date from Alder Builders for 201 · Maple Lofts. They said d01 and it has passed. $30.0k owed, billed 71 days ago.', doneWhen: ['The new pay date is written down on the bill'] })
    expect(projectTodo({ ...job, jobId: null, ageDays: null }, dayLabel)).toMatchObject({ title: 'Get a pay date from Alder Builders for 201 · Maple Lofts. $30.0k owed.', paths: [] })
  })

  it('writes a job’s card for its percent, its price or its bill', () => {
    expect(pctTodo({ id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000 })).toEqual({ key: 'pct.j301', title: 'Set the percent done on 301 · Pine Row. It is a $30.0k contract.', paths: ['/jobs?jobDetail=j301'], doneWhen: ['The job has a percent done'] })
    expect(pctTodo({ id: 'j302', label: '302 · Spruce Hall', revenueUsd: null }).title).toBe('Set the percent done on 302 · Spruce Hall.')
    expect(priceTodo({ id: 'j401', label: '401 · Willow Walk' })).toEqual({ key: 'price.j401', title: 'Put a price on 401 · Willow Walk. Its hours earn nothing until then.', paths: ['/jobs?jobDetail=j401'], doneWhen: ['The job has a price'] })
    expect(billTodo({ id: 'j201', label: '201 · Maple Lofts', usd: 18_000 })).toEqual({ key: 'bill.j201', title: 'Bill 201 · Maple Lofts. $18.0k is finished and not billed.', paths: ['/jobs?jobDetail=j201'], doneWhen: ['The bill is sent'] })
  })

  it('asks one supply house for more days on what falls due', () => {
    expect(supplyTodo({ housePath: '/materials?tab=supply-houses&house=h1', name: 'Northside Supply', usd: 7_200, dueYmd: '2026-03-04', bills: 4 }, dayLabel)).toEqual({
      key: 'supply.northside-supply.2026-03-04',
      title: 'Ask Northside Supply for more days on $7.2k due d04, on 4 bills.',
      paths: ['/materials?tab=supply-houses&house=h1'],
      doneWhen: ['Northside Supply has said yes or no', 'The new due day is on the bills'],
    })
    expect(supplyTodo({ housePath: null, name: 'Riverbend Pipe', usd: 1_100, dueYmd: null, bills: 1 }, dayLabel).title).toBe('Ask Riverbend Pipe for more days on $1.1k.')
  })

  it('says on the card’s foot how a line reaches a person, in plain words', () => {
    expect(TODO_FOOT).toBe('Press a grey check to hand that line to one person. A blue check is with someone.')
    expect(plainWordsFailures(TODO_FOOT)).toEqual([])
    expect(TODO_FOOT).not.toMatch(/Friday|call/)
    expect(TODO_TAG_PARAM).toBe('todo')
  })

  it('tags the card’s first link with its key, and links to the Bridge when the thing has no page', () => {
    expect(todoLinkPaths(pctTodo({ id: 'j301', label: '301 · Pine Row', revenueUsd: null }))).toEqual(['/jobs?jobDetail=j301&todo=pct.j301'])
    expect(todoLinkPaths(payerTodo({ payerId: 'c1', name: 'Alder Builders', usd: 1, lateUsd: 1, projects: [] }))).toEqual(['/customers/c1?todo=payer.c1'])
    // No customer record: the key is made from the name, and the card links to the Bridge.
    expect(todoLinkPaths(payerTodo({ payerId: null, name: 'Cedar Homes', usd: 1, lateUsd: 0, projects: [] }))).toEqual(['/bridge?todo=payer.cedar-homes'])
    // A job's percent card and its pay-date card do not share a tag.
    const job = { payerName: 'Alder Builders', jobId: 'j301', label: '301 · Pine Row', usd: 1, ageDays: null, promisedYmd: null, broken: false }
    expect(todoLinkPaths(projectTodo(job, dayLabel))[0]).not.toBe(todoLinkPaths(pctTodo({ id: 'j301', label: '301 · Pine Row', revenueUsd: null }))[0])
  })
})
