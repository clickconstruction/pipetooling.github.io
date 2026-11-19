import { describe, expect, it } from 'vitest'
import { RESEARCH_CITIES } from './permitResearch'
import { CITIES_WITH_OWN_ALLOWANCE, QUIET_AFTER_DAYS, cityPickerTitle, cityPickerWords, cityQuiet, isQuiet, newestPermitDay, quietAfterDays, type CityPull } from './permitQuiet'

const TODAY = '2026-11-18'
/** The nightly pull of the morning of the 18th, 5:30 AM in Texas. */
const RAN = '2026-11-18T11:30:11Z'
const NOW = Date.parse('2026-11-18T18:00:00Z')
const CLEAN: CityPull = { ranAt: RAN, error: null }

function quiet(city: string, newestDay: string | null, pull: CityPull | null = CLEAN, todayYmd = TODAY, nowMs = NOW) {
  return cityQuiet({ city, newestDay, todayYmd, pull, nowMs })
}

describe('quietAfterDays', () => {
  it('gives a daily city a week and San Antonio ten days', () => {
    expect(quietAfterDays('Austin')).toBe(QUIET_AFTER_DAYS)
    expect(quietAfterDays('New Braunfels')).toBe(7)
    expect(quietAfterDays('San Antonio')).toBe(10)
  })

  it('names only cities the pull reads, so a renamed city cannot lose its allowance unseen', () => {
    for (const city of CITIES_WITH_OWN_ALLOWANCE) expect(RESEARCH_CITIES).toContain(city)
  })
})

describe('newestPermitDay', () => {
  it('takes the newest of the submitted and the issued day', () => {
    expect(newestPermitDay(['2026-11-02', '2026-11-03'], TODAY)).toBe('2026-11-03')
    expect(newestPermitDay(['2026-11-17', null], TODAY)).toBe('2026-11-17')
  })

  it('never counts a day after today, which is a typing slip at the city', () => {
    expect(newestPermitDay(['2027-11-03', '2026-11-13'], TODAY)).toBe('2026-11-13')
    expect(newestPermitDay([TODAY], TODAY)).toBe(TODAY)
  })

  it('answers null when no day was read', () => {
    expect(newestPermitDay([null, undefined, '', 'not a day'], TODAY)).toBeNull()
  })
})

describe('cityQuiet, on the days read on 2026-11-18', () => {
  it('names New Braunfels quiet since Nov 3', () => {
    expect(quiet('New Braunfels', '2026-11-03')).toEqual({ state: 'quiet', newestDay: '2026-11-03', daysBack: 15 })
  })

  it('says nothing false about San Antonio, five days back on a weekly rhythm', () => {
    expect(quiet('San Antonio', '2026-11-13').state).toBe('fresh')
  })

  it('reads Austin, San Marcos and Seguin as fresh', () => {
    expect(quiet('Austin', '2026-11-16').state).toBe('fresh')
    expect(quiet('San Marcos', '2026-11-17').state).toBe('fresh')
    expect(quiet('Seguin', '2026-11-17').state).toBe('fresh')
  })
})

describe('cityQuiet, at the edges', () => {
  it('leaves a daily city alone at seven days and flags it at eight', () => {
    expect(quiet('Seguin', '2026-11-11').state).toBe('fresh')
    expect(quiet('Seguin', '2026-11-10').state).toBe('quiet')
  })

  it('leaves San Antonio alone through its widest week and one late day', () => {
    expect(quiet('San Antonio', '2026-11-09').state).toBe('fresh')
    expect(quiet('San Antonio', '2026-11-08').state).toBe('fresh')
    expect(quiet('San Antonio', '2026-11-07').state).toBe('quiet')
  })

  it('would have flagged New Braunfels on Nov 11, the day after it joined', () => {
    const ran = { ranAt: '2026-11-10T11:30:00Z', error: null }
    expect(quiet('New Braunfels', '2026-11-03', ran, '2026-11-10', Date.parse('2026-11-10T18:00:00Z')).state).toBe('fresh')
    const next = { ranAt: '2026-11-11T11:30:00Z', error: null }
    expect(quiet('New Braunfels', '2026-11-03', next, '2026-11-11', Date.parse('2026-11-11T18:00:00Z')).state).toBe('quiet')
  })

  it('answers unknown when no day was read', () => {
    expect(quiet('Seguin', null)).toEqual({ state: 'unknown', newestDay: null, daysBack: null })
  })
})

describe('cityQuiet, when the trouble is ours', () => {
  it('does not blame the city for a pull that stopped', () => {
    expect(quiet('San Marcos', '2026-11-03', { ranAt: RAN, error: 'the feed answered 500' }).state).toBe('ours')
  })

  it('does not blame the city when the pull never ran, or could not be read', () => {
    expect(quiet('Seguin', '2026-11-03', { ranAt: null, error: null }).state).toBe('ours')
    expect(quiet('Seguin', '2026-11-03', null).state).toBe('ours')
  })

  it('does not blame the city when the pull has not run for two days', () => {
    expect(quiet('Seguin', '2026-11-03', { ranAt: '2026-11-16T11:30:00Z', error: null }).state).toBe('ours')
    expect(quiet('Seguin', '2026-11-03', { ranAt: '2026-11-17T11:30:00Z', error: null }).state).toBe('quiet')
  })

  it('reads a fresh city as fresh whatever the pull did', () => {
    expect(quiet('Seguin', '2026-11-17', { ranAt: RAN, error: 'the feed answered 500' }).state).toBe('fresh')
  })
})

describe('cityPickerWords', () => {
  it('puts the newest day on a city that is moving', () => {
    expect(cityPickerWords('Seguin', quiet('Seguin', '2026-11-17'), TODAY)).toBe('Seguin · newest Nov 17')
    expect(cityPickerWords('San Antonio', quiet('San Antonio', '2026-11-13'), TODAY)).toBe('San Antonio · newest Nov 13')
  })

  it('names the day a quiet city stopped', () => {
    expect(cityPickerWords('New Braunfels', quiet('New Braunfels', '2026-11-03'), TODAY)).toBe('New Braunfels · quiet since Nov 3')
  })

  it('never calls a city quiet when the trouble is ours', () => {
    const ours = quiet('San Marcos', '2026-11-03', { ranAt: RAN, error: 'the feed answered 500' })
    expect(cityPickerWords('San Marcos', ours, TODAY)).toBe('San Marcos · newest Nov 3')
  })

  it('is the name alone before the day is read', () => {
    expect(cityPickerWords('Austin', undefined, TODAY)).toBe('Austin')
    expect(cityPickerWords('Austin', null, TODAY)).toBe('Austin')
    expect(cityPickerWords('Austin', quiet('Austin', null), TODAY)).toBe('Austin')
  })

  it('keeps the phone chip to the name, except for a quiet city', () => {
    expect(cityPickerWords('Seguin', quiet('Seguin', '2026-11-17'), TODAY, true)).toBe('Seguin')
    expect(cityPickerWords('New Braunfels', quiet('New Braunfels', '2026-11-03'), TODAY, true)).toBe('New Braunfels · quiet since Nov 3')
  })

  it('writes the year on a day from another year', () => {
    const old = quiet('Seguin', '2025-12-17', CLEAN, '2026-01-20', Date.parse('2026-01-20T18:00:00Z'))
    expect(cityPickerWords('Seguin', old, '2026-01-20')).toBe('Seguin · quiet since Dec 17, 2025')
  })
})

describe('cityPickerTitle and isQuiet', () => {
  it('says on hover why the city on screen reads quiet', () => {
    expect(cityPickerTitle('New Braunfels', quiet('New Braunfels', '2026-11-03'), TODAY)).toBe('New Braunfels has published nothing since Nov 3. Our pull ran and found nothing newer.')
    expect(cityPickerTitle('Seguin', quiet('Seguin', '2026-11-17'), TODAY)).toBe('Each city with its newest permit day')
    expect(cityPickerTitle('Seguin', undefined, TODAY)).toBe('Each city with its newest permit day')
  })

  it('is true only for a quiet city', () => {
    expect(isQuiet(quiet('New Braunfels', '2026-11-03'))).toBe(true)
    expect(isQuiet(quiet('Seguin', '2026-11-17'))).toBe(false)
    expect(isQuiet(quiet('Seguin', '2026-11-03', null))).toBe(false)
    expect(isQuiet(undefined)).toBe(false)
  })
})
