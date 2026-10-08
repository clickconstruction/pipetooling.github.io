import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { boardStateFromRows, type BoardRows } from './boardRows'
import { clinicBoardRows, clinicProjectRows } from './boardTestRows'
import { followUpStateFromSlice, gcFollowUpNeeds, type FollowUpSlice } from './followUpNeeds'
import { followUpsToCall } from './tradeViews'

/** The slice the Dashboard reads, cut from the same rows the board reads. */
function sliceOf(rows: BoardRows): FollowUpSlice {
  const p = clinicProjectRows()
  return {
    today: rows.today,
    gc: [{ ...p.gc, project_id: p.project.id }],
    projects: [p.project],
    packages: p.packages.map((k) => ({ ...k, project_id: p.project.id })),
    companies: rows.companies,
    invites: rows.invites,
    quotes: rows.quotes,
    contacts: rows.contacts,
  }
}

const company = (id: string, name: string) => ({ ...clinicBoardRows().companies[0]!, id, name, trades: ['Concrete'] })
const ask = (id: string, companyId: string, status: string, invitedOn: string) => ({ ...clinicBoardRows().invites[1]!, id, package_id: 'k2', company_id: companyId, status, invited_on: invitedOn })

/** The clinic with four asks to call: a promise passed, one due today, one never opened, one with no day. */
function busyRows(): BoardRows {
  const rows = clinicBoardRows()
  return {
    ...rows,
    companies: [...rows.companies, company('alamo', 'Alamo Concrete'), company('pecan', 'Pecan Valley Concrete'), company('bexar', 'Bexar Forms')],
    invites: [...rows.invites, ask('i3', 'alamo', 'opened', '2026-10-02'), ask('i4', 'pecan', 'invited', '2026-10-01'), ask('i5', 'bexar', 'opened', '2026-10-03')],
    contacts: [...rows.contacts, { ...rows.contacts[0]!, id: 'n3', company_id: 'alamo', invite_id: 'i3', promised_by: '2026-10-08' }],
  }
}

describe('Follow up on the Dashboard', () => {
  it('says the pill’s number, from the board or from the slice', () => {
    for (const rows of [clinicBoardRows(), busyRows()]) {
      const board = boardStateFromRows(rows)
      const fromBoard = gcFollowUpNeeds(board)
      expect(fromBoard?.count).toBe(followUpsToCall(board))
      expect(gcFollowUpNeeds(followUpStateFromSlice(sliceOf(rows)))).toEqual(fromBoard)
    }
  })

  it('names the one company to call, red when its day passed', () => {
    expect(gcFollowUpNeeds(boardStateFromRows(clinicBoardRows()))).toEqual({
      count: 1,
      late: true,
      title: 'A call to make about a quote',
      detail: 'Hillside Excavation is 3 days past the day it gave for its quote. Next: call them from Follow up.',
    })
  })

  it('gives the first two reasons in Follow up’s order, then how many more', () => {
    const needs = gcFollowUpNeeds(boardStateFromRows(busyRows()))!
    expect(needs.count).toBe(4)
    expect(needs.title).toBe('4 calls to make about quotes')
    expect(needs.detail).toBe('Hillside Excavation is 3 days past the day it gave for its quote. Alamo Concrete promised its quote today. And 2 more. Next: call them from Follow up.')
  })

  it('is amber when nobody is late, and says an ask nobody opened', () => {
    const rows = busyRows()
    rows.contacts = rows.contacts.filter((c) => c.id !== 'n1')
    rows.invites = rows.invites.filter((i) => i.id !== 'i4')
    expect(gcFollowUpNeeds(boardStateFromRows(rows))?.late).toBe(false)
    const silent = busyRows()
    silent.contacts = silent.contacts.filter((c) => c.id !== 'n1' && c.id !== 'n3')
    expect(gcFollowUpNeeds(boardStateFromRows(silent))?.detail).toMatch(/^Pecan Valley Concrete has not opened the ask we sent 7 days ago\. /)
  })

  it('shows no line when every ask waits on a day still to come', () => {
    const later = clinicBoardRows()
    later.contacts = later.contacts.map((c) => (c.promised_by ? { ...c, promised_by: '2026-10-12' } : c))
    expect(gcFollowUpNeeds(boardStateFromRows(later))).toBeNull()
    expect(gcFollowUpNeeds(followUpStateFromSlice({ ...sliceOf(later), gc: [], projects: [], packages: [] }))).toBeNull()
  })

  it('says it in plain words', () => {
    const needs = gcFollowUpNeeds(boardStateFromRows(busyRows()))!
    expect(plainWordsFailures(needs.title)).toEqual([])
    expect(plainWordsFailures(needs.detail)).toEqual([])
    const one = gcFollowUpNeeds(boardStateFromRows(clinicBoardRows()))!
    expect(plainWordsFailures(`${one.title}. ${one.detail}`)).toEqual([])
  })
})
