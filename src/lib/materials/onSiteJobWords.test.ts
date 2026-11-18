import { describe, expect, it } from 'vitest'
import { onSiteJobHead, onSiteJobNumber, onSiteJobWords } from './onSiteJobWords'

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

describe('onSiteJobHead', () => {
  it('the number is the press and the name is read beside it', () => {
    expect(onSiteJobHead({ click_number: '1091', job_name: 'ZZ Test lift stations' }, 'job abc')).toEqual({ press: '1091', rest: 'ZZ Test lift stations', openLabel: 'Open job 1091' })
    expect(onSiteJobHead({ hcp_number: '972', click_number: '15', job_name: '', customer_name: 'ZZ Test Customer' }, 'job abc')).toEqual({ press: '972', rest: 'ZZ Test Customer', openLabel: 'Open job 972' })
    expect(onSiteJobHead({ click_number: '7' }, 'job abc')).toEqual({ press: '7', rest: '—', openLabel: 'Open job 7' })
  })
  it('a job with no number is opened by its name, so the head always holds a press', () => {
    expect(onSiteJobHead({ hcp_number: ' ', job_name: 'ZZ Test' }, 'job abc')).toEqual({ press: 'ZZ Test', rest: '', openLabel: 'Open the job ZZ Test' })
    expect(onSiteJobHead({}, 'job abc')).toEqual({ press: '—', rest: '', openLabel: 'Open the job' })
  })
  it('a job the page could not name is opened by the words the page has for it', () => {
    expect(onSiteJobHead(undefined, 'job 1a2b3c4d')).toEqual({ press: 'job 1a2b3c4d', rest: '', openLabel: 'Open job 1a2b3c4d' })
  })
})
