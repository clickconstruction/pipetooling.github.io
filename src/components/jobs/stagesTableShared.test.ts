/**
 * The Pipeline lists' one shared prop (the Stages map's step 10): the bundle and a section's own props read as one
 * flat object under each list's door, and no key may live on both sides.
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import { stagesTableFlatProps, type StagesTableShared, type StagesUnifiedTableShared } from './stagesTableShared'
import type { JobsStagesTableProps } from './JobsStagesTable'
import type { JobsStagesUnifiedTableProps } from './JobsStagesUnifiedTable'

describe('stagesTableFlatProps', () => {
  it('lays the bundle beside the section’s own props and leaves the bundle itself out', () => {
    const openEdit = () => {}
    const flat = stagesTableFlatProps({ jobList: ['a'], actionLabel: 'Move to Working', shared: { authRole: 'dev', openEdit } })
    expect(flat).toEqual({ jobList: ['a'], actionLabel: 'Move to Working', authRole: 'dev', openEdit })
    expect('shared' in flat).toBe(false)
  })

  it('keeps a key whose value is undefined, on either side', () => {
    const flat = stagesTableFlatProps({ onSendBack: undefined, shared: { jobContractCoverageByJobId: undefined } })
    expect(Object.keys(flat).sort()).toEqual(['jobContractCoverageByJobId', 'onSendBack'])
  })

  it('hands back a new object and changes neither the props nor the bundle', () => {
    const shared = { authRole: 'dev' }
    const props = { jobList: [], shared }
    const flat = stagesTableFlatProps(props)
    expect(flat).not.toBe(shared)
    expect(shared).toEqual({ authRole: 'dev' })
    expect(props).toEqual({ jobList: [], shared })
  })

  it('lets the section win a key that sits on both sides, though the types allow none', () => {
    const flat = stagesTableFlatProps({ showTimeOpen: false, shared: { showTimeOpen: true } } as { showTimeOpen: boolean; shared: { showTimeOpen: boolean } })
    expect(flat.showTimeOpen).toBe(false)
  })
})

describe('the two sides of a list’s props', () => {
  it('share no key, on the job table or the bill table (held by the typecheck)', () => {
    expectTypeOf<keyof Omit<JobsStagesTableProps, 'shared'> & keyof StagesTableShared>().toBeNever()
    expectTypeOf<keyof Omit<JobsStagesUnifiedTableProps, 'shared'> & keyof StagesUnifiedTableShared>().toBeNever()
  })

  it('the bill table’s bundle is the job table’s and more, so one object can feed both', () => {
    expectTypeOf<StagesUnifiedTableShared>().toMatchTypeOf<StagesTableShared>()
  })
})
