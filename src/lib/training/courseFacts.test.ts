/**
 * The one sentence for a course's size (v2.8031): what it says for the real courses, that it stays short enough
 * for one line beside the press on a phone, that it holds to the plain-words rules, and its edges.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { SHORT_LESSON_MINUTES, TRAINING_COURSE_FACTS, courseSizeWords } from './courseFacts'

/**
 * The Dashboard card's line is 12.8 px beside the press. At 390 px wide the column holds about 42 characters and
 * at 375 px about 40. The line of v2.5575 was 55 and wrapped.
 */
const ONE_LINE_ON_A_PHONE = 36

describe('courseSizeWords', () => {
  it('says the lessons and the hours of the three courses in the app', () => {
    expect(courseSizeWords(TRAINING_COURSE_FACTS['osha-30-refresher'])).toBe('30 short lessons, about 3 hours')
    expect(courseSizeWords(TRAINING_COURSE_FACTS['intro-to-plumbing'])).toBe('30 short lessons, about 3 hours')
    expect(courseSizeWords(TRAINING_COURSE_FACTS['intro-electrical'])).toBe('30 short lessons, about 3 hours')
  })

  it('every course on disk reads in one line on a phone and in plain words', () => {
    const all = Object.values(TRAINING_COURSE_FACTS)
    expect(all.length).toBeGreaterThanOrEqual(3)
    for (const f of all) {
      const words = courseSizeWords(f)
      expect(words, f.slug).not.toBeNull()
      expect(words!.length, `${f.slug}: "${words}"`).toBeLessThanOrEqual(ONE_LINE_ON_A_PHONE)
      expect(plainWordsFailures(words!), f.slug).toEqual([])
    }
  })

  it('stays one line for the largest course it could meet', () => {
    expect(courseSizeWords({ lessons: 120, minutes: 120 * 5 + 15 })).toBe('120 short lessons, about 10 hours')
    expect(courseSizeWords({ lessons: 120, minutes: 120 * 5 + 15 })!.length).toBeLessThanOrEqual(ONE_LINE_ON_A_PHONE)
  })

  it('a lesson is short up to seven minutes, and a longer one is a plain lesson', () => {
    expect(SHORT_LESSON_MINUTES).toBe(7)
    expect(courseSizeWords({ lessons: 10, minutes: 10 * 7 + 15 })).toBe('10 short lessons, about 1 hour')
    expect(courseSizeWords({ lessons: 12, minutes: 12 * 10 + 15 })).toBe('12 lessons, about 2 hours')
  })

  it('one lesson and one hour are singular, and under an hour still reads about 1 hour', () => {
    expect(courseSizeWords({ lessons: 1, minutes: 20 })).toBe('1 short lesson, about 1 hour')
    expect(courseSizeWords({ lessons: 10, minutes: 65 })).toBe('10 short lessons, about 1 hour')
  })

  it('with no minutes it is the lesson count alone, and with no lessons it is nothing', () => {
    expect(courseSizeWords({ lessons: 30, minutes: 0 })).toBe('30 lessons')
    expect(courseSizeWords({ lessons: 0, minutes: 165 })).toBeNull()
    expect(courseSizeWords(undefined)).toBeNull()
  })
})
