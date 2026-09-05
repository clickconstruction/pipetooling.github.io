import { describe, expect, it } from 'vitest'
import { fieldWentBlankToSet, JOB_DISPATCH_AUTO_CLOSE_NOTES, pickJobDispatchAutoCloses } from './jobDispatchAutoClose'

describe('fieldWentBlankToSet', () => {
  it('is true only for blank → set', () => {
    expect(fieldWentBlankToSet('', '555-0100')).toBe(true)
    expect(fieldWentBlankToSet(null, '555-0100')).toBe(true)
    expect(fieldWentBlankToSet('   ', 'https://photos')).toBe(true)
  })

  it('editing, clearing, or leaving blank never qualifies', () => {
    expect(fieldWentBlankToSet('555-0100', '555-0199')).toBe(false)
    expect(fieldWentBlankToSet('555-0100', '')).toBe(false)
    expect(fieldWentBlankToSet('', '  ')).toBe(false)
    expect(fieldWentBlankToSet(undefined, null)).toBe(false)
  })
})

describe('pickJobDispatchAutoCloses', () => {
  it('the red phone now closes like the red photos icon does', () => {
    expect(
      pickJobDispatchAutoCloses({ prevPicturesLink: 'https://x', nextPicturesLink: 'https://x', prevPhone: '', nextPhone: '555-0100' }),
    ).toEqual(['add_job_phone'])
  })

  it('pictures alone, both, or neither', () => {
    expect(
      pickJobDispatchAutoCloses({ prevPicturesLink: '', nextPicturesLink: 'https://x', prevPhone: '555', nextPhone: '555' }),
    ).toEqual(['link_job_pictures'])
    expect(pickJobDispatchAutoCloses({ prevPicturesLink: null, nextPicturesLink: 'https://x', prevPhone: null, nextPhone: '555' })).toEqual([
      'link_job_pictures',
      'add_job_phone',
    ])
    expect(pickJobDispatchAutoCloses({ prevPicturesLink: 'a', nextPicturesLink: 'b', prevPhone: 'c', nextPhone: 'd' })).toEqual([])
  })

  it('each kind has its audit note', () => {
    expect(JOB_DISPATCH_AUTO_CLOSE_NOTES.link_job_pictures).toBe('Customer Pictures URL added')
    expect(JOB_DISPATCH_AUTO_CLOSE_NOTES.add_job_phone).toBe('Customer phone number added')
  })
})
