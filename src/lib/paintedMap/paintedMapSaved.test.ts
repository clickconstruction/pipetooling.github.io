/**
 * The Saved band's words and its text press (punch list #392, step 3). Every job here is made up.
 */
import { describe, expect, it } from 'vitest'
import { paintedMapSavedOffersText, paintedMapSavedWords } from './paintedMapSaved'

describe('paintedMapSavedWords', () => {
  it('names the job when the window knows its words', () => {
    expect(paintedMapSavedWords({ jobLabel: 'J2417 · Cedar Hollow 12', onJob: true, onDevelopment: false, summary: 'about 640 ft · 2 places' })).toEqual({
      head: 'Saved on J2417 · Cedar Hollow 12',
      under: 'About 640 ft · 2 places. Anyone on the job can open it.',
    })
  })

  it('says it is on its job when the words are not known', () => {
    expect(paintedMapSavedWords({ jobLabel: null, onJob: true, onDevelopment: false, summary: 'about 640 ft' }).head).toBe('Saved on its job')
    expect(paintedMapSavedWords({ jobLabel: '  ', onJob: true, onDevelopment: false, summary: '' })).toEqual({ head: 'Saved on its job', under: 'Anyone on the job can open it.' })
  })

  it('a map for every lot says so', () => {
    expect(paintedMapSavedWords({ developmentLabel: 'Dry Creek Ridge', onJob: false, onDevelopment: true, summary: '1 place' })).toEqual({
      head: 'Saved for Dry Creek Ridge, every lot',
      under: '1 place. It shows on every job in the development.',
    })
    expect(paintedMapSavedWords({ onJob: false, onDevelopment: true, summary: '' }).head).toBe('Saved for every lot')
  })

  it('a map on no job says who can open it', () => {
    expect(paintedMapSavedWords({ onJob: false, onDevelopment: false, summary: 'about 690 ft · 1 place' })).toEqual({ head: 'Saved', under: 'About 690 ft · 1 place. Only you and the office can open it.' })
  })

  it('a job wins over a development on a map that somehow has both', () => {
    expect(paintedMapSavedWords({ jobLabel: 'J1', developmentLabel: 'Site', onJob: true, onDevelopment: true, summary: '' }).head).toBe('Saved on J1')
  })
})

describe('paintedMapSavedOffersText', () => {
  it('is a phone press, for whoever may share, on a map with something on it', () => {
    expect(paintedMapSavedOffersText({ phone: true, mayShare: true, hasSomething: true })).toBe(true)
    expect(paintedMapSavedOffersText({ phone: false, mayShare: true, hasSomething: true })).toBe(false)
    expect(paintedMapSavedOffersText({ phone: true, mayShare: false, hasSomething: true })).toBe(false)
    expect(paintedMapSavedOffersText({ phone: true, mayShare: true, hasSomething: false })).toBe(false)
  })
})
