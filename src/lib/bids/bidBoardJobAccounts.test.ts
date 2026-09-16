import { describe, expect, it } from 'vitest'
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'
import {
  chipStateOf,
  countBidsMissingAccounts,
  groupStripRowsByBid,
  houseChipLabel,
  houseIsMissing,
  housesOnJob,
  missingAccountsHeaderNote,
  missingHouses,
  stripJob,
} from './bidBoardJobAccounts'

function row(over: Partial<BidJobAccountRow>): BidJobAccountRow {
  return {
    bid_id: 'b398',
    job_id: 'j1018',
    job_hcp_number: '1018',
    job_click_number: null,
    job_name: 'Pondhill Building 2',
    job_address: '4114 Pond Hill Rd',
    supply_house_id: 'h-ferg',
    house_name: 'Ferguson',
    policy: 'per_property',
    quoted: false,
    status: null,
    account_ref: null,
    opened_via: null,
    opened_at: null,
    requested_at: null,
    rep_contact_id: null,
    rep_name: null,
    rep_phone: null,
    rep_email: null,
    ...over,
  }
}

describe('house chips', () => {
  it('words each state the way the mock-up does', () => {
    expect(houseChipLabel(row({ status: 'open' }))).toBe('Ferguson ✓')
    expect(houseChipLabel(row({ house_name: 'Moore Supply', status: 'requested' }))).toBe('Moore Supply · asked')
    expect(houseChipLabel(row({ house_name: 'Reece', status: null, quoted: true }))).toBe('Reece · quoted')
    expect(houseChipLabel(row({ house_name: 'Reece', status: 'not_needed' }))).toBe('Reece · not needed')
    expect(houseChipLabel(row({ house_name: 'Reece', status: null }))).toBe('Reece')
  })

  it('maps status to a chip state, unknown values reading as none', () => {
    expect(chipStateOf({ status: 'open' })).toBe('open')
    expect(chipStateOf({ status: 'weird' })).toBe('none')
    expect(chipStateOf({ status: null })).toBe('none')
  })

  it('a house is missing unless open or not needed', () => {
    expect(houseIsMissing({ status: 'open' })).toBe(false)
    expect(houseIsMissing({ status: 'not_needed' })).toBe(false)
    expect(houseIsMissing({ status: 'requested' })).toBe(true)
    expect(houseIsMissing({ status: null })).toBe(true)
  })
})

describe('the page-wide read', () => {
  const rows = [
    row({ bid_id: 'b398', status: 'open' }),
    row({ bid_id: 'b398', supply_house_id: 'h-reece', house_name: 'Reece', status: null, quoted: true }),
    row({ bid_id: 'b401', job_id: 'j1021', job_hcp_number: '1021', supply_house_id: 'h-ferg', status: 'requested' }),
    row({ bid_id: 'b402', job_id: 'j1024', job_hcp_number: '1024', status: 'open' }),
    row({ bid_id: 'b402', job_id: 'j1024', job_hcp_number: '1024', supply_house_id: 'h-moore', house_name: 'Moore Supply', status: 'not_needed' }),
  ]

  it('groups rows per bid in RPC order', () => {
    const byBid = groupStripRowsByBid(rows)
    expect([...byBid.keys()]).toEqual(['b398', 'b401', 'b402'])
    expect(byBid.get('b398')!.map((r) => r.house_name)).toEqual(['Ferguson', 'Reece'])
  })

  it('names the job and the houses on it, and which are missing', () => {
    const byBid = groupStripRowsByBid(rows)
    expect(stripJob(byBid.get('b398')!)).toEqual({ id: 'j1018', hcpNumber: '1018', clickNumber: null, name: 'Pondhill Building 2' })
    expect(housesOnJob(byBid.get('b398')!).length).toBe(2)
    expect(missingHouses(byBid.get('b398')!).map((r) => r.house_name)).toEqual(['Reece'])
    expect(missingHouses(byBid.get('b402')!)).toEqual([])
    expect(stripJob([])).toBeNull()
    expect(housesOnJob([row({ job_id: null })])).toEqual([])
  })

  it('counts the won bids with a house still missing, for the header', () => {
    const byBid = groupStripRowsByBid(rows)
    expect(countBidsMissingAccounts(['b398', 'b401', 'b402', 'b999'], byBid)).toBe(2)
    expect(missingAccountsHeaderNote(2)).toBe('2 missing job accounts')
    expect(missingAccountsHeaderNote(1)).toBe('1 missing job account')
    expect(missingAccountsHeaderNote(0)).toBeNull()
  })
})
