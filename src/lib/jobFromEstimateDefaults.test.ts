import { describe, expect, it } from 'vitest'
import { defaultJobFieldsFromEstimate } from './jobFromEstimateDefaults'

describe('defaultJobFieldsFromEstimate', () => {
  it('seeds the customer name when the title is still the app default', () => {
    expect(
      defaultJobFieldsFromEstimate(
        { title: 'Estimate for Kimberly Coe', for_address: ' 9614 Legislation Drive, Converse, TX ' },
        { customerName: ' Kimberly Coe ' },
      ),
    ).toEqual({ jobName: 'Kimberly Coe', jobAddress: '9614 Legislation Drive, Converse, TX' })
  })

  it('keeps a title someone typed for the work', () => {
    expect(
      defaultJobFieldsFromEstimate({ title: 'Second-floor rough-in', for_address: '1 Main St' }, { customerName: 'Kimberly Coe' }),
    ).toEqual({ jobName: 'Second-floor rough-in', jobAddress: '1 Main St' })
  })

  it('falls back to the title when no customer name is known', () => {
    expect(defaultJobFieldsFromEstimate({ title: ' Estimate for Kimberly Coe ', for_address: null })).toEqual({
      jobName: 'Estimate for Kimberly Coe',
      jobAddress: '',
    })
    expect(defaultJobFieldsFromEstimate({ title: 'Estimate for Kimberly Coe', for_address: null }, { customerName: '  ' })).toEqual({
      jobName: 'Estimate for Kimberly Coe',
      jobAddress: '',
    })
  })

  it('names a placeholder-titled estimate for the customer too', () => {
    expect(defaultJobFieldsFromEstimate({ title: '', for_address: null }, { customerName: 'Kimberly Coe' }).jobName).toBe(
      'Kimberly Coe',
    )
    expect(defaultJobFieldsFromEstimate({ title: '', for_address: null }).jobName).toBe('')
  })
})
