import { describe, expect, it } from 'vitest'
import { jobFormDeleteGate, jobFormEffectiveHcp, jobFormLaborLinkGates, type JobFormDeleteGateInput, type JobFormLaborLinkGatesInput } from './jobFormCostGates'

const tally = (lineTotal: number) => ({ id: `t-${lineTotal}`, fixtureName: 'Lav', quantity: 1, partName: 'P-trap', lineTotal, createdAt: null, createdByName: null })
/** A card charge is a debit: the bank's amount is negative, and its cost is that amount turned over. */
const card = (costUsd: number) => ({ id: `c-${costUsd}`, mercuryTransactionId: 'tx-1', allocationAmount: -costUsd, note: null, postedAt: null, counterpartyName: null, debitCardId: null })
const blankCharge = { id: 'm-blank', description: '', amount: 0 }

/** A job with nothing on it and every read back clean: the form's one placeholder charge row is all it holds. */
const cleanGate = (over: Partial<JobFormDeleteGateInput> = {}): JobFormDeleteGateInput => ({
  materials: [blankCharge],
  supplyInvoiceTotal: 0,
  tallyPartLines: [],
  mercuryAllocLines: [],
  teamLaborRow: null,
  subLaborData: null,
  loading: { snapshot: false, teamLabor: false, subLabor: false },
  failed: { teamLabor: false, subLabor: false, supplyInvoices: false, cardCharges: false, tally: false },
  ...over,
})

describe('jobFormEffectiveHcp', () => {
  it('reads what is typed in the form before what the job was saved with', () => {
    expect(jobFormEffectiveHcp(' 912 ', '878')).toBe('912')
  })

  it('falls back to the saved number when the box is blank', () => {
    expect(jobFormEffectiveHcp('   ', ' 878 ')).toBe('878')
    expect(jobFormEffectiveHcp(null, '878')).toBe('878')
  })

  it('is empty when neither holds a number', () => {
    expect(jobFormEffectiveHcp('', null)).toBe('')
    expect(jobFormEffectiveHcp(undefined, undefined)).toBe('')
  })
})

describe('jobFormLaborLinkGates', () => {
  const loaded = (over: Partial<JobFormLaborLinkGatesInput> = {}): JobFormLaborLinkGatesInput => ({
    role: 'dev',
    effectiveHcp: '912',
    team: { loading: false, error: false, value: { jobId: 'job-1' } },
    sub: { loading: false, error: false, value: { count: 2 } },
    ...over,
  })

  it('a dev with both loaded gets both doors', () => {
    expect(jobFormLaborLinkGates(loaded())).toEqual({ team: true, sub: true })
  })

  it('the team door is not for the office, a superintendent or a primary', () => {
    for (const role of ['assistant', 'controller', 'superintendent', 'primary']) {
      expect(jobFormLaborLinkGates(loaded({ role })).team, role).toBe(false)
    }
    for (const role of ['dev', 'master_technician', 'estimator']) {
      expect(jobFormLaborLinkGates(loaded({ role })).team, role).toBe(true)
    }
  })

  it('the sub door is for everyone but a primary', () => {
    expect(jobFormLaborLinkGates(loaded({ role: 'primary' })).sub).toBe(false)
    for (const role of ['assistant', 'controller', 'superintendent', 'dev']) {
      expect(jobFormLaborLinkGates(loaded({ role })).sub, role).toBe(true)
    }
  })

  it('the team door waits for the read, and a failed read or no row shows none', () => {
    expect(jobFormLaborLinkGates(loaded({ team: { loading: true, error: false, value: { jobId: 'job-1' } } })).team).toBe(false)
    expect(jobFormLaborLinkGates(loaded({ team: { loading: false, error: true, value: { jobId: 'job-1' } } })).team).toBe(false)
    expect(jobFormLaborLinkGates(loaded({ team: { loading: false, error: false, value: null } })).team).toBe(false)
  })

  it('a team row with no hours still earns the door: any row at all', () => {
    expect(jobFormLaborLinkGates(loaded({ team: { loading: false, error: false, value: { jobCost: 0, manHours: 0 } } })).team).toBe(true)
  })

  it('the sub door needs a number to search by and at least one sheet', () => {
    expect(jobFormLaborLinkGates(loaded({ effectiveHcp: '' })).sub).toBe(false)
    expect(jobFormLaborLinkGates(loaded({ sub: { loading: false, error: false, value: { count: 0 } } })).sub).toBe(false)
    expect(jobFormLaborLinkGates(loaded({ sub: { loading: false, error: false, value: null } })).sub).toBe(false)
  })

  it('the sub door waits for the read, and a failed read shows none', () => {
    expect(jobFormLaborLinkGates(loaded({ sub: { loading: true, error: false, value: { count: 2 } } })).sub).toBe(false)
    expect(jobFormLaborLinkGates(loaded({ sub: { loading: false, error: true, value: { count: 2 } } })).sub).toBe(false)
  })

  it('one door does not wait on the other', () => {
    expect(jobFormLaborLinkGates(loaded({ sub: { loading: true, error: false, value: null } }))).toEqual({ team: true, sub: false })
    expect(jobFormLaborLinkGates(loaded({ team: { loading: true, error: false, value: null } }))).toEqual({ team: false, sub: true })
  })
})

describe('jobFormDeleteGate', () => {
  it('a job with no cost and every read clean may be deleted', () => {
    expect(jobFormDeleteGate(cleanGate())).toEqual({
      materialsBilledTotal: 0,
      partsCostStyleTotal: 0,
      costSnapshotStillLoading: false,
      hasMigrateableCosts: false,
      costCheckErrored: false,
      reassignRequired: false,
    })
  })

  it('parts are supply invoices plus tally plus card charges, and any of them forces a reassign', () => {
    const gate = jobFormDeleteGate(cleanGate({ supplyInvoiceTotal: 100, tallyPartLines: [tally(40), tally(10.5)], mercuryAllocLines: [card(25)] }))
    expect(gate.partsCostStyleTotal).toBe(175.5)
    expect(gate.hasMigrateableCosts).toBe(true)
    expect(gate.reassignRequired).toBe(true)
    expect(jobFormDeleteGate(cleanGate({ tallyPartLines: [tally(1)] })).reassignRequired).toBe(true)
    expect(jobFormDeleteGate(cleanGate({ mercuryAllocLines: [card(1)] })).reassignRequired).toBe(true)
    expect(jobFormDeleteGate(cleanGate({ supplyInvoiceTotal: 0.01 })).reassignRequired).toBe(true)
  })

  it('a card refund alone takes parts below zero, which is not a cost', () => {
    const gate = jobFormDeleteGate(cleanGate({ mercuryAllocLines: [card(-30)] }))
    expect(gate.partsCostStyleTotal).toBe(-30)
    expect(gate.reassignRequired).toBe(false)
  })

  it('other job charges sum as typed, a blank or unreadable amount counting as nothing', () => {
    const gate = jobFormDeleteGate(cleanGate({ materials: [{ id: 'a', description: 'Permit', amount: 125 }, { id: 'b', description: 'Dump fee', amount: 60.25 }, blankCharge, { id: 'c', description: '', amount: Number.NaN }] }))
    expect(gate.materialsBilledTotal).toBe(185.25)
    expect(gate.reassignRequired).toBe(true)
  })

  it('a charge with words and no amount is still a cost: it has content to lose', () => {
    const gate = jobFormDeleteGate(cleanGate({ materials: [{ id: 'a', description: 'ESTIMATE: backflow test', amount: 0 }] }))
    expect(gate.materialsBilledTotal).toBe(0)
    expect(gate.hasMigrateableCosts).toBe(true)
  })

  it('charges that net to nothing are still a cost: each row has an amount', () => {
    const gate = jobFormDeleteGate(cleanGate({ materials: [{ id: 'a', description: '', amount: 50 }, { id: 'b', description: '', amount: -50 }] }))
    expect(gate.materialsBilledTotal).toBe(0)
    expect(gate.hasMigrateableCosts).toBe(true)
  })

  it('team labor counts with dollars or with hours, and a row with neither does not', () => {
    expect(jobFormDeleteGate(cleanGate({ teamLaborRow: { jobCost: 320, manHours: 0 } })).hasMigrateableCosts).toBe(true)
    expect(jobFormDeleteGate(cleanGate({ teamLaborRow: { jobCost: 0, manHours: 1.5 } })).hasMigrateableCosts).toBe(true)
    expect(jobFormDeleteGate(cleanGate({ teamLaborRow: { jobCost: 0, manHours: 0 } })).hasMigrateableCosts).toBe(false)
  })

  it('a sub sheet counts by being there, whatever its total', () => {
    expect(jobFormDeleteGate(cleanGate({ subLaborData: { count: 1 } })).hasMigrateableCosts).toBe(true)
    expect(jobFormDeleteGate(cleanGate({ subLaborData: { count: 0 } })).hasMigrateableCosts).toBe(false)
  })

  it('any one failed read forces a reassign on a job that shows no cost', () => {
    for (const key of ['teamLabor', 'subLabor', 'supplyInvoices', 'cardCharges', 'tally'] as const) {
      const base = cleanGate()
      const gate = jobFormDeleteGate({ ...base, failed: { ...base.failed, [key]: true } })
      expect(gate.costCheckErrored, key).toBe(true)
      expect(gate.hasMigrateableCosts, key).toBe(false)
      expect(gate.reassignRequired, key).toBe(true)
    }
  })

  it('any one read in flight says the check is not done, and decides nothing by itself', () => {
    for (const key of ['snapshot', 'teamLabor', 'subLabor'] as const) {
      const base = cleanGate()
      const gate = jobFormDeleteGate({ ...base, loading: { ...base.loading, [key]: true } })
      expect(gate.costSnapshotStillLoading, key).toBe(true)
      expect(gate.reassignRequired, key).toBe(false)
    }
  })

  it('costs and a failed read together report both', () => {
    const base = cleanGate({ supplyInvoiceTotal: 80 })
    const gate = jobFormDeleteGate({ ...base, failed: { ...base.failed, tally: true } })
    expect(gate).toMatchObject({ hasMigrateableCosts: true, costCheckErrored: true, reassignRequired: true })
  })
})
