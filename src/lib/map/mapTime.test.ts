import { describe, expect, it } from 'vitest'
import { olderPhotoChoices, type OlderPhotoFound } from './olderPhotos'
import {
  MAP_TIME_NO_OLDER_WORDS,
  mapTimeButtonLabel,
  mapTimeCaption,
  mapTimeOlder,
  mapTimePickFor,
  mapTimeShown,
  mapTimeSpotFromPins,
  mapTimeStep,
  mapTimeToday,
} from './mapTime'

// Newest first, as the walk hands them over. 700 and 650 are one photograph, published twice.
const FOUND: OlderPhotoFound[] = [
  { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2025-02-09' },
  { release: 800, publishedYmd: '2024-05-09', size: 4, takenYmd: '2024-01-31' },
  { release: 700, publishedYmd: '2022-03-01', size: 3, takenYmd: '2021-03-20' },
  { release: 650, publishedYmd: '2021-08-01', size: 8, takenYmd: '2021-03-20' },
  { release: 500, publishedYmd: '2018-01-10', size: 1, takenYmd: null },
]
const CHOICES = olderPhotoChoices(FOUND)
const of = (release: number) => CHOICES.find((c) => c.release === release)!

describe('the spot Time looks at', () => {
  const pins = [
    { id: 'a', lat: 29.55, lng: -98.3, title: 'Pump house' },
    { id: 'b', lat: 29.56, lng: -98.31, title: 'North gate' },
  ]

  it('is the open dot', () => {
    expect(mapTimeSpotFromPins(pins, 'b')).toEqual({ lat: 29.56, lng: -98.31, name: 'North gate' })
  })

  it('is the only dot when none is open', () => {
    expect(mapTimeSpotFromPins(pins.slice(0, 1), null)).toEqual({ lat: 29.55, lng: -98.3, name: 'Pump house' })
  })

  it('is nothing with several dots and none open, or with no dot', () => {
    expect(mapTimeSpotFromPins(pins, null)).toBeNull()
    expect(mapTimeSpotFromPins(pins, 'gone')).toBeNull()
    expect(mapTimeSpotFromPins([], null)).toBeNull()
  })
})

describe('Today and the dates', () => {
  it('Today is the newest photograph the archive has, and the row is every other, oldest first', () => {
    expect(mapTimeToday(FOUND, CHOICES)?.release).toBe(900)
    expect(mapTimeOlder(FOUND, CHOICES).map((c) => [c.release, c.label])).toEqual([
      [500, 'Before Jan 2018'],
      [700, 'Mar 2021'],
      [800, 'Jan 2024'],
    ])
  })

  it('an archive with one photograph has Today and no dates, and an empty one has neither', () => {
    const one = FOUND.slice(0, 1)
    expect(mapTimeToday(one, olderPhotoChoices(one))?.release).toBe(900)
    expect(mapTimeOlder(one, olderPhotoChoices(one))).toEqual([])
    expect(mapTimeToday([], [])).toBeNull()
    expect(mapTimeOlder([], [])).toEqual([])
  })

  it('Today takes the older stop too when the two were taken on one day', () => {
    const twin: OlderPhotoFound[] = [
      { release: 900, publishedYmd: '2026-10-29', size: 5, takenYmd: '2024-01-31' },
      { release: 800, publishedYmd: '2024-05-09', size: 4, takenYmd: '2024-01-31' },
      { release: 500, publishedYmd: '2018-01-10', size: 1, takenYmd: '2017-06-02' },
    ]
    const choices = olderPhotoChoices(twin)
    expect(mapTimeToday(twin, choices)?.releases).toEqual([900, 800])
    expect(mapTimeOlder(twin, choices).map((c) => c.release)).toEqual([500])
  })
})

describe('a pick', () => {
  it('keeps the release that draws it and the day its photograph first went up', () => {
    expect(mapTimePickFor(FOUND, of(700))).toEqual({ release: 700, publishedYmd: '2022-03-01' })
    expect(mapTimePickFor(FOUND, of(500))).toEqual({ release: 500, publishedYmd: '2018-01-10' })
  })

  it('shows its own date at the spot where it was pressed, and the photograph a second stop joined', () => {
    expect(mapTimeShown(FOUND, CHOICES, { release: 700, publishedYmd: '2022-03-01' }, true)?.release).toBe(700)
    expect(mapTimeShown(FOUND, CHOICES, { release: 650, publishedYmd: '2021-08-01' }, true)?.release).toBe(700)
    expect(mapTimeShown(FOUND, CHOICES, null, true)).toBeNull()
  })

  describe('carried to another spot', () => {
    // Another spot's walk: none of its releases is the pressed one.
    const THERE: OlderPhotoFound[] = [
      { release: 880, publishedYmd: '2026-08-12', size: 7, takenYmd: '2026-01-02' },
      { release: 610, publishedYmd: '2021-06-15', size: 6, takenYmd: '2020-11-30' },
      { release: 300, publishedYmd: '2015-04-01', size: 2, takenYmd: '2014-09-09' },
    ]
    const there = olderPhotoChoices(THERE)

    it('shows the photograph that was up there on the day the pressed one first went up', () => {
      // Pressed: a photograph first published March 2022. There, the June 2021 one was up that day.
      expect(mapTimeShown(THERE, there, { release: 700, publishedYmd: '2022-03-01' }, true)?.release).toBe(610)
      expect(mapTimeShown(THERE, there, { release: 800, publishedYmd: '2024-05-09' }, true)?.release).toBe(610)
      expect(mapTimeShown(THERE, there, { release: 400, publishedYmd: '2016-02-02' }, true)?.release).toBe(300)
    })

    it('shows the oldest when the spot has nothing that old', () => {
      expect(mapTimeShown(THERE, there, { release: 100, publishedYmd: '2014-02-20' }, true)?.release).toBe(300)
    })

    it('says nothing until the walk has gone far enough, and does not change its answer after', () => {
      const pick = { release: 700, publishedYmd: '2022-03-01' }
      // Nothing found yet.
      expect(mapTimeShown([], [], pick, false)).toBeNull()
      // The newest stop is newer than the pick: no answer yet.
      const one = THERE.slice(0, 1)
      expect(mapTimeShown(one, olderPhotoChoices(one), pick, false)).toBeNull()
      // A stop old enough is the walk's last, and its day may still move back: not yet.
      const two = THERE.slice(0, 2)
      expect(mapTimeShown(two, olderPhotoChoices(two), pick, false)).toBeNull()
      // An older stop after it settles it, and the end of the walk settles the last stop.
      expect(mapTimeShown(THERE, there, pick, false)?.release).toBe(610)
      expect(mapTimeShown(two, olderPhotoChoices(two), pick, true)?.release).toBe(610)
    })

    it('has no answer at a spot with no photograph', () => {
      expect(mapTimeShown([], [], { release: 700, publishedYmd: '2022-03-01' }, true)).toBeNull()
    })
  })
})

describe('a step along the row', () => {
  const older = mapTimeOlder(FOUND, CHOICES)

  it('goes from Today to the newest date, and back', () => {
    expect(mapTimeStep(older, null, -1)).toBe(of(800))
    expect(mapTimeStep(older, of(800), 1)).toBe('today')
  })

  it('walks the dates in order and stops at each end', () => {
    expect(mapTimeStep(older, of(800), -1)).toBe(of(700))
    expect(mapTimeStep(older, of(700), -1)).toBe(of(500))
    expect(mapTimeStep(older, of(500), -1)).toBeNull()
    expect(mapTimeStep(older, of(500), 1)).toBe(of(700))
    expect(mapTimeStep(older, null, 1)).toBeNull()
  })

  it('goes nowhere with no dates, or from a date the row does not hold', () => {
    expect(mapTimeStep([], null, -1)).toBeNull()
    expect(mapTimeStep(older.slice(0, 1), of(800), -1)).toBeNull()
  })
})

describe('the words', () => {
  it('the press reads Time, then the date, and the date alone on a phone', () => {
    expect(mapTimeButtonLabel(null, false)).toBe('Time')
    expect(mapTimeButtonLabel(null, true)).toBe('Time')
    expect(mapTimeButtonLabel(of(700), false)).toBe('Time · Mar 2021')
    expect(mapTimeButtonLabel(of(700), true)).toBe('Mar 2021')
  })

  it('Today names the spot and the day its photograph was taken, then counts what is older', () => {
    const today = mapTimeToday(FOUND, CHOICES)
    expect(mapTimeCaption({ spotName: 'Pump house', today, olderCount: 3, shown: null, walking: false })).toBe('Today’s photo of Pump house, taken February 9, 2025. 3 older photos.')
    expect(mapTimeCaption({ spotName: 'Pump house', today, olderCount: 1, shown: null, walking: false })).toBe('Today’s photo of Pump house, taken February 9, 2025. 1 older photo.')
    expect(mapTimeCaption({ spotName: 'Pump house', today, olderCount: 0, shown: null, walking: false })).toBe(`Today’s photo of Pump house, taken February 9, 2025. ${MAP_TIME_NO_OLDER_WORDS}`)
  })

  it('Today counts nothing while the walk is still going, and names no day it does not know', () => {
    expect(mapTimeCaption({ spotName: 'Pump house', today: null, olderCount: 0, shown: null, walking: true })).toBe('Today’s photo of Pump house.')
    const unknown = olderPhotoChoices([{ release: 900, publishedYmd: '2026-10-29', size: 5 }])
    expect(mapTimeCaption({ spotName: 'Pump house', today: unknown[0]!, olderCount: 0, shown: null, walking: false })).toBe(`Today’s photo of Pump house. ${MAP_TIME_NO_OLDER_WORDS}`)
  })

  it('a date says its own sentence, and that the dots are not from that day', () => {
    expect(mapTimeCaption({ spotName: 'Pump house', today: null, olderCount: 3, shown: of(700), walking: false })).toBe('Photo taken March 20, 2021. The dots are today’s.')
    expect(mapTimeCaption({ spotName: 'Pump house', today: null, olderCount: 3, shown: of(700), walking: false, dotsWords: 'The pins are as of Sep 1.' })).toBe('Photo taken March 20, 2021. The pins are as of Sep 1.')
    // A photograph whose day is not known says only what is true of it.
    expect(mapTimeCaption({ spotName: 'Pump house', today: null, olderCount: 3, shown: of(500), walking: false })).toBe('Esri published this picture on January 10, 2018. It was taken before that, and the archive did not say when.')
  })
})
