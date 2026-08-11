import { describe, expect, it } from 'vitest'
import { splitScheduleRowLabel, stripAddressZip } from './dashboardScheduleCardLines'

describe('splitScheduleRowLabel', () => {
  it('splits "925 · Rosemary Garza" into number and name', () => {
    expect(splitScheduleRowLabel('925 · Rosemary Garza')).toEqual({
      jobNumber: '925',
      jobName: 'Rosemary Garza',
    })
  })

  it('no separator → whole label as the name', () => {
    expect(splitScheduleRowLabel('Job')).toEqual({ jobNumber: '', jobName: 'Job' })
  })

  it('empty name after the dot falls back to the whole label', () => {
    expect(splitScheduleRowLabel('925 · ')).toEqual({ jobNumber: '925', jobName: '925 ·' })
  })
})

describe('stripAddressZip', () => {
  it('drops a trailing 5-digit zip, keeping the state', () => {
    expect(stripAddressZip('750 La Paloma Dr, Canyon Lake, TX 78133')).toBe(
      '750 La Paloma Dr, Canyon Lake, TX',
    )
  })

  it('drops zip+4 and a trailing comma variant', () => {
    expect(stripAddressZip('380 TX-123 Seguin, TX, 78155-1234')).toBe('380 TX-123 Seguin, TX')
  })

  it('leaves addresses without a zip alone (and keeps road numbers)', () => {
    expect(stripAddressZip('373 Atlantis Kyle TX')).toBe('373 Atlantis Kyle TX')
    expect(stripAddressZip('12921 FM 20')).toBe('12921 FM 20')
  })
})
