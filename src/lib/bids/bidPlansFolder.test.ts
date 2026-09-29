import { describe, expect, it } from 'vitest'
import { bidPlansFolderName, DIVISION_BID_FOLDERS, divisionBidFolderFor, driveFolderUrl, findFolderWords, plansWaitingBids, plansWaitingWords } from './bidPlansFolder'

describe('bidPlansFolder (v2.4162)', () => {
  it('three division folders, each a Drive folder link', () => {
    expect(DIVISION_BID_FOLDERS.map((d) => d.key)).toEqual(['plumbing', 'electrical', 'hvac'])
    for (const d of DIVISION_BID_FOLDERS) expect(d.url).toBe(driveFolderUrl(d.folderId))
  })

  it('a service type names its division folder; none until one is picked', () => {
    expect(divisionBidFolderFor('Plumbing')?.key).toBe('plumbing')
    expect(divisionBidFolderFor('Electrical')?.key).toBe('electrical')
    expect(divisionBidFolderFor('HVAC')?.key).toBe('hvac')
    expect(divisionBidFolderFor('')).toBeNull()
    expect(divisionBidFolderFor('Roofing')).toBeNull()
  })

  it('the folder is named the way the job folder is: the project name', () => {
    expect(bidPlansFolderName({ project_name: '  Knight Contracting- Marcos Pizza Boerne ', bid_number: '367', id: 'x' })).toBe('Knight Contracting- Marcos Pizza Boerne')
    expect(bidPlansFolderName({ project_name: null, bid_number: '367', id: 'x' })).toBe('Bid 367')
  })

  it('says what Find found, in plain words', () => {
    expect(findFolderWords({ found: false }, 'Marcos')).toMatch(/^Not there yet\. Is the folder named exactly “Marcos”/)
    expect(findFolderWords({ found: true, id: 'a', link: 'l', pdfs: 0 }, 'Marcos')).toMatch(/no PDF in it yet/)
    expect(findFolderWords({ found: true, id: 'a', link: 'l', pdfs: 3 }, 'Marcos')).toBe('Found the folder · 3 PDFs. The link is filled in.')
    expect(findFolderWords({ error: 'timeout' }, 'Marcos')).toMatch(/^Could not look just now: timeout/)
  })
})

describe('the Bid Board waiting line (v2.4165)', () => {
  const st = [{ id: 'p', name: 'Plumbing' }, { id: 'e', name: 'Electrical' }]
  const bid = (o: Partial<{ bid_date_sent: string | null; plans_link: string | null; service_type_id: string | null; robot_opt_out: boolean | null; outcome: string | null }>) => ({ bid_date_sent: null, plans_link: null, service_type_id: 'p', robot_opt_out: false, outcome: null, ...o })
  it('counts live plumbing bids with no plans link, and nothing else', () => {
    const rows = [bid({}), bid({ plans_link: 'https://drive…' }), bid({ service_type_id: 'e' }), bid({ bid_date_sent: '2026-09-01' }), bid({ robot_opt_out: true }), bid({ plans_link: '  ' }), bid({ outcome: 'pending' }), { ...bid({}), project_name: 'ZZ Test' }, { ...bid({}), working_board_archived_at: '2026-09-01' }]
    expect(plansWaitingBids(rows, st)).toHaveLength(2)
  })
  it('says it in plain words, one or many', () => {
    expect(plansWaitingWords(1)).toBe('1 bid is waiting on plans. Put the PDF in its folder and a robot prices it tonight. About a minute each.')
    expect(plansWaitingWords(6)).toBe('6 bids are waiting on plans. Put the PDF in each one’s folder and a robot prices each one tonight. About a minute each.')
  })
})
