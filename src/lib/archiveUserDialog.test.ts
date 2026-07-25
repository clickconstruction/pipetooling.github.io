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

describe('archiveChoiceBlocker', () => {
  it('blocks until an account is picked', () => {
    expect(archiveChoiceBlocker({ userSelected: false, customerCount: null, mode: 'keep', reassignTargetId: '' })).toMatch(/Pick the account/)
  })
  it('blocks while the customer count is loading', () => {
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: null, mode: 'keep', reassignTargetId: '' })).toMatch(/Counting/)
  })
  it('blocks reassign mode without a target only when customers exist', () => {
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: 3, mode: 'reassign', reassignTargetId: '' })).toMatch(/inherits/)
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: 0, mode: 'reassign', reassignTargetId: '' })).toBeNull()
  })
  it('passes for keep mode and for reassign with a target', () => {
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: 3, mode: 'keep', reassignTargetId: '' })).toBeNull()
    expect(archiveChoiceBlocker({ userSelected: true, customerCount: 3, mode: 'reassign', reassignTargetId: 'm1' })).toBeNull()
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
