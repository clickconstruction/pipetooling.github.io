import { describe, expect, it } from 'vitest'
import { coverage, hasSupervisionSwitch, isSupervisor, needsSupervision, supervisionLabel, supervisorsOf } from './supervision'

const master = { id: 'm', role: 'master_technician', needsSupervision: false }
const masterOddFlag = { id: 'm2', role: 'master_technician', needsSupervision: true }
const helperOn = { id: 'h1', role: 'helpers', needsSupervision: true }
const helperOff = { id: 'h2', role: 'helpers', needsSupervision: false }
const subOn = { id: 's1', role: 'subcontractor', needsSupervision: true }
const subOff = { id: 's2', role: 'subcontractor', needsSupervision: false }
const office = { id: 'o', role: 'assistant', needsSupervision: false }
const superintendent = { id: 'si', role: 'superintendent', needsSupervision: false }
const unknown = { id: 'u', role: null, needsSupervision: true }

describe('the rule', () => {
  it('only helpers and subs carry the switch', () => {
    expect(hasSupervisionSwitch('helpers')).toBe(true)
    expect(hasSupervisionSwitch('subcontractor')).toBe(true)
    expect(hasSupervisionSwitch('master_technician')).toBe(false)
    expect(hasSupervisionSwitch('assistant')).toBe(false)
    expect(hasSupervisionSwitch(null)).toBe(false)
  })
  it('masters always supervise, whatever the column says', () => {
    expect(isSupervisor(master)).toBe(true)
    expect(isSupervisor(masterOddFlag)).toBe(true)
    expect(needsSupervision(masterOddFlag)).toBe(false)
  })
  it('a helper or sub supervises only with the switch off', () => {
    expect(isSupervisor(helperOn)).toBe(false)
    expect(isSupervisor(helperOff)).toBe(true)
    expect(isSupervisor(subOn)).toBe(false)
    expect(isSupervisor(subOff)).toBe(true)
    expect(needsSupervision(helperOn)).toBe(true)
    expect(needsSupervision(helperOff)).toBe(false)
  })
  it('office roles, superintendents and unknowns are not supervision and do not need it', () => {
    for (const p of [office, superintendent, unknown]) {
      expect(isSupervisor(p)).toBe(false)
      expect(needsSupervision(p)).toBe(false)
    }
  })
})

describe('supervisorsOf and coverage', () => {
  it('lists every supervisor on the crew, masters first, then subs, then qualified helpers, in given order', () => {
    expect(supervisorsOf([helperOff, subOff, helperOn, master, office]).map((p) => p.id)).toEqual(['m', 's2', 'h2'])
    expect(supervisorsOf([helperOn, subOn])).toEqual([])
  })
  it('a job-day is covered by anyone who can run it, unsupervised when nobody can, empty when nobody is there', () => {
    expect(coverage([master, helperOn])).toBe('covered')
    expect(coverage([helperOff, helperOn])).toBe('covered')
    expect(coverage([subOff])).toBe('covered')
    expect(coverage([helperOn, subOn])).toBe('unsupervised')
    expect(coverage([helperOn, office])).toBe('unsupervised')
    expect(coverage([])).toBe('empty')
  })
  it('labels the switch for the row', () => {
    expect(supervisionLabel(master)).toBe('supervises')
    expect(supervisionLabel(helperOn)).toBe('needs supervision')
    expect(supervisionLabel(subOff)).toBe('can run a job')
    expect(supervisionLabel(office)).toBe('')
  })
})
