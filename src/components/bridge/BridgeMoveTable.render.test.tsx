// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeMoveTable } from './BridgeMoveTable'
import { moveDive, type DiveFacts } from '../../lib/bridge/callDive'
import { todoStates, type TodoCard } from '../../lib/bridge/callTodoState'

// Made-up customers, jobs and people. The table is drawn from the kernel's own lines, so the columns are the real ones.
const dayLabel = (ymd: string): string => `Mar ${Number(ymd.slice(8))}`
const facts: DiveFacts = {
  payers: [
    {
      key: 'c1',
      payerId: 'c1',
      name: 'Alder Builders',
      lateUsd: 40_000,
      usd: 52_000,
      oldestAgeDays: 71,
      promise: { state: 'none', ymd: null },
      projects: [
        { key: 'b1', jobId: 'j201', label: '201 · Maple Lofts', usd: 30_000, ageDays: 71, broken: false, promisedYmd: null, promisedBy: null },
        { key: 'b2', jobId: 'j202', label: '202 · Oak Court', usd: 10_000, ageDays: 40, broken: true, promisedYmd: '2026-03-01', promisedBy: null },
      ],
    },
    { key: 'c2', payerId: 'c2', name: 'Birch and Sons', lateUsd: 0, usd: 9_000, oldestAgeDays: 12, promise: { state: 'promised', ymd: '2026-03-20' } },
    { key: 'c3', name: 'Cedar Homes', lateUsd: 3_000, usd: 3_000, oldestAgeDays: 33, promise: { state: 'none', ymd: null } },
    { key: 'c4', name: 'Dogwood Group', lateUsd: 900, usd: 900, oldestAgeDays: 31, promise: { state: 'none', ymd: null } },
  ],
  billJobs: [],
  noPctJobs: [
    { id: 'j301', label: '301 · Pine Row', revenueUsd: 30_000, pctJob: { id: 'j301', hcpNumber: '301', jobName: 'Pine Row', label: '301 · Pine Row' }, hoursLine: '24 hours by Dana and Sam', hoursCell: { text: '24', phone: '24 hours', by: 'Dana and Sam' } },
    { id: 'j302', label: '302 · Spruce Hall', revenueUsd: null, pctJob: { id: 'j302', hcpNumber: '302', jobName: 'Spruce Hall', label: '302 · Spruce Hall' }, setPct: 60, hoursLine: 'No hours yet', hoursCell: { text: '0', phone: 'No hours yet', by: '' } },
  ],
  noPriceJobs: [{ id: 'j401', label: '401 · Willow Walk' }],
  supplyBills: [{ houseId: 'h-north', name: 'Northside Supply', usd: 7_200, dueYmd: '2026-03-04', bills: 4 }],
  dayLabel,
}
const chase = moveDive({ key: 'chase', title: 'Chase the late invoices.', door: null }, facts)!
const pct = moveDive({ key: 'pct', title: 'Set a percent.', door: null }, facts)!
const price = moveDive({ key: 'price', title: 'Price the jobs.', door: null }, facts)!
const supply = moveDive({ key: 'other', title: 'Ask the supply houses for more days.', door: null }, facts)!
const texts = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent)

describe('BridgeMoveTable at a desk', () => {
  it('draws the customers under their headings, one row a customer, three then Show all', () => {
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={chase} narrow={false} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['Customer', 'Late', 'Oldest bill', 'Pay date'])
    const rows = screen.getAllByTestId('bridge-week-dive-item')
    expect(rows.length).toBe(3)
    expect(texts(rows[0]!)).toEqual(['Alder Builders', '$40.0k', '71 days', 'None yet', '2 projects ▾', ''])
    // Nothing late yet: the amount says it is open, so the heading does not call it late.
    expect(texts(rows[1]!)).toEqual(['Birch and Sons', '$9.0k open', '12 days', 'Said Mar 20', '', ''])
    expect(screen.queryByTestId('bridge-week-dive-project')).toBeNull()
    // The rest are one press away, here, and one press back.
    fireEvent.click(screen.getByRole('button', { name: 'Show all 4' }))
    expect(screen.getAllByTestId('bridge-week-dive-item').length).toBe(4)
    fireEvent.click(screen.getByRole('button', { name: 'Show the first 3' }))
    expect(screen.getAllByTestId('bridge-week-dive-item').length).toBe(3)
  })

  it('opens a customer’s projects under the same headings, each with its own press and check', () => {
    const onDive = vi.fn()
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={chase} narrow={false} onDive={onDive} />)
    const toggle = screen.getByRole('button', { name: /2 projects/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const projects = screen.getAllByTestId('bridge-week-dive-project')
    expect(texts(projects[0]!)).toEqual(['201 · Maple Lofts', '$30.0k', '71 days', 'None yet', 'Set a pay date', ''])
    expect(texts(projects[1]!)).toEqual(['202 · Oak Court', '$10.0k', '40 days', 'Said Mar 1, passed', 'Change the pay date', ''])
    fireEvent.click(within(projects[0]!).getByRole('button', { name: 'Set a pay date' }))
    expect(onDive).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'promise', jobId: 'j201' }))
    // The customer's name opens the Collect window on that customer.
    fireEvent.click(screen.getByRole('button', { name: 'Alder Builders' }))
    expect(onDive).toHaveBeenLastCalledWith({ kind: 'desk', stage: 'collect', payerKey: 'c1' })
  })

  it('draws the jobs with their hours as the press that opens them, Set the percent as a word, and a job set on this visit saying so', () => {
    const onDive = vi.fn()
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={pct} narrow={false} onDive={onDive} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['Job', 'Hours', 'Contract', 'Worked by'])
    const rows = screen.getAllByTestId('bridge-week-dive-item')
    expect(texts(rows[0]!)).toEqual(['301 · Pine Row', '24', '$30.0k', 'Dana and Sam', 'Set the percent', ''])
    expect(texts(rows[1]!)).toEqual(['302 · Spruce Hall', '0', '', 'Set to 60% just now', 'Change the percent', ''])
    // The hours are a press of their own: who worked them and when.
    fireEvent.click(screen.getByRole('button', { name: 'See the hours on 301 · Pine Row: 24 hours by Dana and Sam' }))
    expect(onDive).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'hours', jobId: 'j301', jobLabel: '301 · Pine Row' }))
    fireEvent.click(within(rows[0]!).getByRole('button', { name: 'Set the percent' }))
    expect(onDive).toHaveBeenLastCalledWith({ kind: 'pct', job: { id: 'j301', hcpNumber: '301', jobName: 'Pine Row', label: '301 · Pine Row' } })
    // A grey check makes the to-do for that one job. A job set on this visit has no check: it needs no card.
    fireEvent.click(within(rows[0]!).getByTestId('bridge-week-dive-todo'))
    expect(onDive).toHaveBeenLastCalledWith({ kind: 'todo', todo: expect.objectContaining({ key: 'pct.j301', title: 'Set the percent done on 301 · Pine Row. It is a $30.0k contract.' }) })
    expect(within(rows[1]!).queryByTestId('bridge-week-dive-todo')).toBeNull()
    // The job's name is a link to the job itself.
    expect(within(rows[0]!).getByRole('link', { name: '301 · Pine Row' }).getAttribute('href')).toBe('/jobs?tab=stages&edit=j301')
  })

  it('opens a supply house on the day its bills fall due', () => {
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={supply} narrow={false} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['Supply house', 'Due', 'Bills', 'Due day'])
    const row = screen.getByTestId('bridge-week-dive-item')
    expect(texts(row)).toEqual(['Northside Supply', '$7.2k', '4', 'Mar 4', '', ''])
    expect(within(row).getByRole('link', { name: 'Northside Supply' }).getAttribute('href')).toBe('/materials?tab=supply-houses&house=h-north&due=2026-03-04')
  })

  it('gives no heading and no room to a column no line fills', () => {
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={price} narrow={false} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['Job'])
    expect(screen.getByRole('table').style.gridTemplateColumns).toBe('minmax(0, 1.6fr) 0px 0px 0px auto 52px')
    expect(screen.queryByTestId('bridge-week-dive-all')).toBeNull()
  })

  it('says under a row who has its to-do, and how many of a customer’s projects are handed out (#334, PR 9)', () => {
    const card = (itemId: string, link: string, who: string): TodoCard => ({ itemId, title: 'A card', links: [link], madeYmd: '2026-03-10', dueYmd: null, who: [who], instances: [{ id: `n-${itemId}`, doneYmd: null, doneBy: null }] })
    const states = todoStates([card('i1', 'https://app.example/jobs?jobDetail=j201&todo=paydate.j201', 'Sam Holt'), card('i2', 'https://app.example/customers/c2?todo=payer.c2', 'Dana Reyes')], '2026-03-12')
    const onTodoSee = vi.fn()
    renderWithProviders(<BridgeMoveTable todoStates={states} dayLabel={dayLabel} dive={chase} narrow={false} onTodoSee={onTodoSee} />)
    expect(screen.getAllByTestId('bridge-week-dive-under').map((u) => u.textContent)).toEqual(['1 of 2 handed out', 'Dana, 2 days'])
    // A blue check shows the card it stands for. A grey one would make a card.
    const rows = screen.getAllByTestId('bridge-week-dive-item')
    expect(within(rows[1]!).getByTestId('bridge-week-dive-todo-state').getAttribute('data-todo-state')).toBe('open')
    fireEvent.click(within(rows[1]!).getByTestId('bridge-week-dive-todo'))
    expect(onTodoSee).toHaveBeenCalledWith(expect.objectContaining({ kind: 'open', who: 'Dana' }))
    expect(within(rows[0]!).getByTestId('bridge-week-dive-todo-state').getAttribute('data-todo-state')).toBe('none')
  })
})

describe('BridgeMoveTable on a phone', () => {
  it('draws a line as its name and figure, then the rest with its press, with no headings', () => {
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={pct} narrow />)
    expect(screen.queryByRole('columnheader')).toBeNull()
    const rows = screen.getAllByTestId('bridge-week-dive-item')
    expect(rows[0]!.textContent).toBe('301 · Pine Row24 hours$30.0k contract · Dana and SamSet the percent')
    expect(rows[1]!.textContent).toBe('302 · Spruce HallNo hours yetSet to 60% just nowChange the percent')
    // A word press is tall enough for a thumb, and so are the check and the name that opens the line's own thing.
    expect((within(rows[0]!).getByRole('button', { name: 'Set the percent' }) as HTMLButtonElement).style.minHeight).toBe('44px')
    expect(within(rows[0]!).getByTestId('bridge-week-dive-todo').style.height).toBe('44px')
    expect(within(rows[0]!).getByTestId('bridge-week-dive-name').style.minHeight).toBe('44px')
  })

  it('keeps a name one line high at a desk, where a pointer needs no more', () => {
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={pct} narrow={false} />)
    const name = screen.getAllByTestId('bridge-week-dive-name')[0]!
    expect(name.style.minHeight).toBe('')
    expect(name.style.whiteSpace).toBe('nowrap')
  })

  it('opens a customer’s projects under the customer', () => {
    renderWithProviders(<BridgeMoveTable todoStates={null} dayLabel={dayLabel} dive={chase} narrow />)
    expect(screen.getAllByTestId('bridge-week-dive-item')[0]!.textContent).toBe('Alder Builders$40.0k lateoldest bill 71 days · None yet2 projects ▾')
    fireEvent.click(screen.getByRole('button', { name: /2 projects/ }))
    expect(screen.getAllByTestId('bridge-week-dive-project').map((p) => p.textContent)).toEqual(['201 · Maple Lofts$30.0k owedbilled 71 days ago · None yetSet a pay date', '202 · Oak Court$10.0k owedbilled 40 days ago · Said Mar 1, passedChange the pay date'])
  })
})
