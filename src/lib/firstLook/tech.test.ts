import { describe, expect, it } from 'vitest'
import { firstLookReadHref, lookTaskPreset, techLine, techReadLine } from './tech'

describe('a tech reads one look before a job exists (punch list #319 PR 7)', () => {
  it('the task carries the look: the bar names it and link 1 opens the tech’s page for it', () => {
    const preset = lookTaskPreset({ name: 'Dana Whitfield' }, { id: 'L1', place: 'Kitchen', words: 'It drips at night' }, 'https://clicktooling.com')
    expect(preset.title).toBe('Can you price this from the photos?')
    expect(preset.links).toEqual(['https://clicktooling.com/first-look/L1'])
    expect(preset.job).toMatchObject({ id: 'L1', number: 'First look', name: 'Dana Whitfield · Kitchen', path: '/first-look/L1', url: 'https://clicktooling.com/first-look/L1' })
    expect(firstLookReadHref('L1')).toBe('/first-look/L1')
  })

  it('with no place the bar takes their words, cut to a line; with neither, the name alone', () => {
    expect(lookTaskPreset({ name: 'Dana' }, { id: 'L1', place: null, words: 'It drips\nat night' }, 'o').job.name).toBe('Dana · It drips at night')
    expect(lookTaskPreset({ name: ' ' }, { id: 'L1', place: null, words: null }, 'o').job.name).toBe('A customer')
    expect(lookTaskPreset({ name: 'Dana' }, { id: 'L1', place: null, words: 'x'.repeat(200) }, 'o').job.name.length).toBe(80)
  })

  it('the answer reads with the tech’s first name and the note', () => {
    expect(techReadLine({ tech_read: 'can_price', tech_note: 'Bring a 3/4 inch stop.', tech_read_name: 'Luis Ortega' })).toBe('Luis: I can price it from this. Bring a 3/4 inch stop.')
    expect(techReadLine({ tech_read: 'needs_visit', tech_note: null, tech_read_name: null })).toBe('Needs a visit to price.')
    expect(techReadLine({ tech_read: null })).toBeNull()
    expect(techReadLine({ tech_read: 'something else' })).toBeNull()
  })

  it('the card says a tech was asked until the answer is in', () => {
    const day = () => 'Nov 12'
    expect(techLine({}, day)).toBeNull()
    expect(techLine({ asked_tech_at: '2026-11-12T15:00:00Z' }, day)).toBe('A tech was asked Nov 12. No answer yet.')
    expect(techLine({ asked_tech_at: '2026-11-12T15:00:00Z', tech_read: 'needs_visit', tech_read_name: 'Luis' }, day)).toBe('Luis: Needs a visit to price.')
  })
})
