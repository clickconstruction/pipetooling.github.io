import { describe, expect, it } from 'vitest'
import { defaultJobFieldsFromEstimate } from './jobFromEstimateDefaults'

describe('defaultJobFieldsFromEstimate', () => {
  it('seeds the customer name when the title is still the app default', () => {
    expect(
      defaultJobFieldsFromEstimate(
        { title: 'Estimate for Kimberly Corl', for_address: ' 9614 Legislation Drive, Converse, TX ' },
        { customerName: ' Kimberly Corl ' },
      ),
    ).toEqual({ jobName: 'Kimberly Corl', jobAddress: '9614 Legislation Drive, Converse, TX' })
  })

  it('keeps a title someone typed for the work', () => {
    expect(
      defaultJobFieldsFromEstimate({ title: 'Second-floor rough-in', for_address: '1 Main St' }, { customerName: 'Kimberly Corl' }),
    ).toEqual({ jobName: 'Second-floor rough-in', jobAddress: '1 Main St' })
  })

  it('falls back to the title when no customer name is known', () => {
    expect(defaultJobFieldsFromEstimate({ title: ' Estimate for Kimberly Corl ', for_address: null })).toEqual({
      jobName: 'Estimate for Kimberly Corl',
      jobAddress: '',
    })
    expect(defaultJobFieldsFromEstimate({ title: 'Estimate for Kimberly Corl', for_address: null }, { customerName: '  ' })).toEqual({
      jobName: 'Estimate for Kimberly Corl',
      jobAddress: '',
    })
  })

  it('names a placeholder-titled estimate for the customer too', () => {
    expect(defaultJobFieldsFromEstimate({ title: '', for_address: null }, { customerName: 'Kimberly Corl' }).jobName).toBe(
      'Kimberly Corl',
    )
    expect(defaultJobFieldsFromEstimate({ title: '', for_address: null }).jobName).toBe('')
  })
})

describe('defaultJobFieldsFromEstimate — the work (v2.3766)', () => {
  it('adds the work when the estimate has one specific line', () => {
    expect(
      defaultJobFieldsFromEstimate(
        {
          title: 'Estimate for Kimberly Corl',
          for_address: null,
          line_items_snapshot: [{ line_item: 'Pretest', description: '', quantity: 1, unit_price_cents: 25000, amount_cents: 25000 }],
        },
        { customerName: 'Kimberly Corl' },
      ).jobName,
    ).toBe('Kimberly Corl — Pretest')
  })
  it('stays the customer alone for several lines or a generic line', () => {
    expect(
      defaultJobFieldsFromEstimate(
        {
          title: 'Estimate for Kimberly Corl',
          for_address: null,
          line_items_snapshot: [{ line_item: 'Pretest' }, { line_item: 'Post test' }],
        },
        { customerName: 'Kimberly Corl' },
      ).jobName,
    ).toBe('Kimberly Corl')
    expect(
      defaultJobFieldsFromEstimate(
        { title: 'Estimate for Kimberly Corl', for_address: null, line_items_snapshot: [{ line_item: 'Custom Service Visit' }] },
        { customerName: 'Kimberly Corl' },
      ).jobName,
    ).toBe('Kimberly Corl')
  })
  it('never touches a typed title, even with one line', () => {
    expect(
      defaultJobFieldsFromEstimate(
        { title: 'Corl — back bath', for_address: null, line_items_snapshot: [{ line_item: 'Pretest' }] },
        { customerName: 'Kimberly Corl' },
      ).jobName,
    ).toBe('Corl — back bath')
  })
})
