import { describe, expect, it } from 'vitest'

import {
  canTakeOffBidGc,
  latestSendByGcFromVersions,
  promoteConfirmCopy,
  recommendedSuccessor,
  type PromoteAlternate,
} from './promoteBidGc'

const rio: PromoteAlternate = { customerId: 'rio', name: 'Rio Grande Commercial', source: 'version' }
const mesa: PromoteAlternate = { customerId: 'mesa', name: 'Mesa & Stone GC', source: 'manual' }
const alamo: PromoteAlternate = { customerId: 'alamo', name: 'Alamo City Builders', source: 'version' }

describe('canTakeOffBidGc', () => {
  it('shows the × only while another GC is on the bid', () => {
    expect(canTakeOffBidGc([])).toBe(false)
    expect(canTakeOffBidGc([mesa])).toBe(true)
  })
})

describe('recommendedSuccessor', () => {
  it('is null with no alternates', () => {
    expect(recommendedSuccessor([])).toBeNull()
  })
  it('prefers the own-packet GC with the latest send', () => {
    expect(recommendedSuccessor([mesa, rio, alamo], { rio: '2026-09-30', alamo: '2026-10-05' })).toBe('alamo')
  })
  it('falls back to the first own-packet GC, then the first alternate', () => {
    expect(recommendedSuccessor([mesa, rio, alamo], {})).toBe('rio')
    expect(recommendedSuccessor([mesa], {})).toBe('mesa')
  })
  it('ignores sends recorded for same-letter GCs (no packet of their own)', () => {
    expect(recommendedSuccessor([mesa, rio], { mesa: '2026-10-10' })).toBe('rio')
  })
})

describe('latestSendByGcFromVersions', () => {
  it('keys the latest send by the version GC, skipping own-GC versions', () => {
    const versions = [
      { id: 'v1', customer_id: null },
      { id: 'v2', customer_id: 'rio' },
      { id: 'v3', customer_id: 'rio' },
      { id: 'v4', customer_id: 'mesa' },
    ]
    const sends = {
      v1: { sentOn: '2026-10-12' },
      v2: { sentOn: '2026-09-28' },
      v3: { sentOn: '2026-09-30' },
    }
    expect(latestSendByGcFromVersions(versions, sends)).toEqual({ rio: '2026-09-30' })
  })
})

describe('promoteConfirmCopy', () => {
  it('remove with one alternate names the successor and keeps the keep door', () => {
    const copy = promoteConfirmCopy({ mode: 'remove', oldName: 'Caldwell Builders', oldIsCustomer: true, successorName: 'Rio Grande Commercial', alternateCount: 1 })
    expect(copy.title).toBe('Take Caldwell Builders off this bid?')
    expect(copy.body).toContain("Rio Grande Commercial becomes the bid's GC")
    expect(copy.confirmLabel).toBe('Take off — Rio Grande Commercial leads')
    expect(copy.keepLabel).toBe('Keep as an alternate instead')
    expect(copy.pickPrompt).toBeNull()
  })
  it('remove with several alternates asks who steps up', () => {
    const copy = promoteConfirmCopy({ mode: 'remove', oldName: 'Caldwell Builders', oldIsCustomer: true, successorName: 'Rio Grande Commercial', alternateCount: 2 })
    expect(copy.pickPrompt).toBe('Who runs the bid now?')
    expect(copy.body).toContain('The GC you pick')
  })
  it('a legacy builder primary cannot stay as an alternate', () => {
    const copy = promoteConfirmCopy({ mode: 'remove', oldName: 'Old Builder Label', oldIsCustomer: false, successorName: 'Rio Grande Commercial', alternateCount: 1 })
    expect(copy.keepLabel).toBeNull()
  })
  it('promote keeps the old GC on the bid and says so', () => {
    const copy = promoteConfirmCopy({ mode: 'promote', oldName: 'Caldwell Builders', oldIsCustomer: true, successorName: 'Rio Grande Commercial', alternateCount: 1 })
    expect(copy.title).toBe("Make Rio Grande Commercial the bid's GC?")
    expect(copy.body).toContain('Caldwell Builders stays on the bid as an alternate')
    expect(copy.keepLabel).toBeNull()
  })
})
