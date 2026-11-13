import { describe, expect, it } from 'vitest'
import { onSiteJobNumber, onSiteJobWords } from './onSiteJobWords'

describe('onSiteJobWords', () => {
  it('a job made in the app reads by the number the app gave it', () => {
    expect(onSiteJobWords({ hcp_number: '', click_number: '224', job_name: 'ZZ Test phase 2' })).toBe('224 · ZZ Test phase 2')
    expect(onSiteJobWords({ hcp_number: null, click_number: '1091', job_name: 'ZZ Test lift stations' })).toBe('1091 · ZZ Test lift stations')
  })
  it('the HCP number wins when the job has both', () => {
    expect(onSiteJobWords({ hcp_number: '972', click_number: '15', job_name: 'ZZ Test' })).toBe('972 · ZZ Test')
  })
  it('a dash stands for a missing number or name, and the customer stands in for the name', () => {
    expect(onSiteJobWords({ hcp_number: ' ', click_number: null, job_name: 'ZZ Test' })).toBe('— · ZZ Test')
    expect(onSiteJobWords({ click_number: '7', job_name: '', customer_name: 'ZZ Test Customer' })).toBe('7 · ZZ Test Customer')
    expect(onSiteJobWords({})).toBe('— · —')
  })
})

describe('onSiteJobNumber', () => {
  it('is empty for a job with no number, or no job', () => {
    expect(onSiteJobNumber({ hcp_number: '', click_number: '' })).toBe('')
    expect(onSiteJobNumber(undefined)).toBe('')
    expect(onSiteJobNumber({ click_number: ' 224 ' })).toBe('224')
  })
})
