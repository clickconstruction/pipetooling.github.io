import { describe, expect, it } from 'vitest'
import {
  archiveChoiceBlocker,
  archiveRequestBody,
  eligibleReassignTargets,
} from './archiveUserDialog'

const master = { id: 'm1', name: 'Malachi', email: 'malachi@x.com', role: 'master_technician' }
const dev = { id: 'd1', name: 'Robert', email: 'robert@x.com', role: 'dev' }
const sub = { id: 's1', name: 'Abraham', email: 'abraham@x.com', role: 'subcontractor' }
const helper = { id: 'h1', name: 'Paige', email: 'paige@x.com', role: 'helpers' }

describe('eligibleReassignTargets', () => {
  it('offers only masters and devs, never the account being archived', () => {
    expect(eligibleReassignTargets([master, dev, sub, helper], 'm1').map((u) => u.id)).toEqual(['d1'])
    expect(eligibleReassignTargets([master, dev, sub, helper], 's1').map((u) => u.id)).toEqual(['m1', 'd1'])
    expect(eligibleReassignTargets([master, dev, sub, helper], null).map((u) => u.id)).toEqual(['m1', 'd1'])
  })
})

describe('archiveChoiceBlocker (one company, v2.3063: no target to pick)', () => {
  it('blocks until an account is picked', () => {
    expect(archiveChoiceBlocker({ userSelected: false, customerCount: null })).toMatch(/Pick the account/)
  })
  it('blocks while the customer count is loading', () => {
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: null })).toMatch(/Counting/)
  })
  it('passes once the count is in — reassign needs no leader, the company owner account inherits', () => {
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: 3 })).toBeNull()
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: 0 })).toBeNull()
  })
})

describe('archiveRequestBody', () => {
  it('trims identity fields and omits reassignment by default', () => {
    expect(archiveRequestBody({ email: ' a@x.com ', name: ' Al ' }, 0, 'keep', '')).toEqual({ email: 'a@x.com', name: 'Al' })
  })
  it('tolerates a null name', () => {
    expect(archiveRequestBody({ email: 'a@x.com', name: null }, 2, 'keep', '')).toEqual({ email: 'a@x.com', name: '' })
  })
  it('adds reassign_customers_to only when chosen, targeted, and there are customers', () => {
    expect(archiveRequestBody({ email: 'a@x.com', name: 'Al' }, 2, 'reassign', 'm1')).toEqual({ email: 'a@x.com', name: 'Al', reassign_customers_to: 'm1' })
    expect(archiveRequestBody({ email: 'a@x.com', name: 'Al' }, 0, 'reassign', 'm1')).toEqual({ email: 'a@x.com', name: 'Al' })
    expect(archiveRequestBody({ email: 'a@x.com', name: 'Al' }, null, 'reassign', 'm1')).toEqual({ email: 'a@x.com', name: 'Al' })
    expect(archiveRequestBody({ email: 'a@x.com', name: 'Al' }, 2, 'reassign', '')).toEqual({ email: 'a@x.com', name: 'Al' })
  })
})
