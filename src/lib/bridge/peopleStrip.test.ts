// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { buildVectors, type VectorSession } from './vectors'
import { BRIDGE_PEOPLE_OPEN_KEY, peopleSummary, readPeopleOpen, writePeopleOpen } from './peopleStrip'

const s = (userId: string, workDate: string, hours: number, pending = false): VectorSession => ({ userId, workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
const vectors = (sessions: VectorSession[]) =>
  buildVectors({
    weekStart: '2026-10-04',
    weekEnd: '2026-10-10',
    people: [
      { userId: 'u1', name: 'Malachi Jones', role: 'master_technician', archived: false },
      { userId: 'u2', name: 'Abraham Diaz', role: 'helpers', archived: false },
      { userId: 'u3', name: 'Tristen Lee', role: 'helpers', archived: false },
      { userId: 'u4', name: 'Taunya Ray', role: 'assistant', archived: false },
    ],
    wages: [
      { userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false },
      { userId: 'u2', fieldWage: 30, officeWage: null, isSalary: false },
      { userId: 'u3', fieldWage: 30, officeWage: null, isSalary: false },
      { userId: 'u4', fieldWage: null, officeWage: 25, isSalary: false },
    ],
    sessions,
    ratePerHourByJob: new Map([['j1', 100]]),
    invoiceSends: [{ userId: 'u4', ymd: '2026-10-06', usd: 22_600 }],
    payments: [
      { userId: 'u4', ymd: '2026-10-06', usd: 41_000 },
      { userId: null, ymd: '2026-10-07', usd: 11_900 },
    ],
    pctUpdates: [],
    fieldReports: [],
    bidsSent: [],
    bidsWon: [],
  })

describe('peopleSummary', () => {
  it('names the top two on approved hours, who waits, billed and collected, and nobody\'s row', () => {
    const v = vectors([s('u1', '2026-10-05', 40), s('u2', '2026-10-05', 40), s('u3', '2026-10-06', 10), s('u3', '2026-10-07', 57, true)])
    expect(peopleSummary(v, 'Oct 4–10', true)).toBe("pay week Oct 4–10 (so far) · Abraham +$2.8k, Malachi +$2.4k and 1 more on approved hours · 1 person with hours waiting · billed $22.6k, collected $41.0k · $11.9k collected on nobody's row")
  })
  it('reads with no approved field hours, and while loading', () => {
    expect(peopleSummary(vectors([s('u3', '2026-10-07', 57, true)]), 'Oct 4–10', false)).toBe("pay week Oct 4–10 · no approved field hours yet · 1 person with hours waiting · billed $22.6k, collected $41.0k · $11.9k collected on nobody's row")
    expect(peopleSummary(null, 'Oct 4–10', true)).toBe('pay week Oct 4–10 (so far) · reading…')
  })
})

describe('the remembered open state', () => {
  afterEach(() => localStorage.removeItem(BRIDGE_PEOPLE_OPEN_KEY))
  it('is closed until written, then remembered', () => {
    expect(readPeopleOpen()).toBe(false)
    writePeopleOpen(true)
    expect(readPeopleOpen()).toBe(true)
    writePeopleOpen(false)
    expect(readPeopleOpen()).toBe(false)
  })
})
