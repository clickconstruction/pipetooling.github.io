import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  parseQuoSeats,
  QUO_SEATS_INTRO,
  QUO_SEATS_NONE,
  QUO_SEATS_SAVED_TOAST,
  QUO_SEATS_WHY,
  quoSeatsProblem,
  quoSeatsText,
  sameQuoSeats,
} from './seatsCard'

describe('the company phone seats, as the Settings row keeps them', () => {
  it('reads the row’s ids in order, trimmed, and nothing from words that are not an object of ids', () => {
    expect(parseQuoSeats('{" USrobert1 ": "u-robert", "USrosa2": "u-rosa"}')).toEqual([
      { quoUserId: 'USrobert1', userId: 'u-robert' },
      { quoUserId: 'USrosa2', userId: 'u-rosa' },
    ])
    expect(parseQuoSeats('{}')).toEqual([])
    expect(parseQuoSeats(null)).toEqual([])
    expect(parseQuoSeats('not json')).toEqual([])
    expect(parseQuoSeats('["USrobert1"]')).toEqual([])
    expect(parseQuoSeats('{"USx": 3, "USy": " "}')).toEqual([])
  })

  it('writes them back the way the functions read them, and reads its own words again', () => {
    const rows = [
      { quoUserId: ' USrobert1', userId: 'u-robert' },
      { quoUserId: 'USrosa2', userId: 'u-rosa' },
    ]
    expect(quoSeatsText(rows)).toBe('{"USrobert1":"u-robert","USrosa2":"u-rosa"}')
    expect(parseQuoSeats(quoSeatsText(rows))).toEqual([
      { quoUserId: 'USrobert1', userId: 'u-robert' },
      { quoUserId: 'USrosa2', userId: 'u-rosa' },
    ])
    expect(sameQuoSeats(rows, parseQuoSeats(quoSeatsText(rows)))).toBe(true)
    expect(sameQuoSeats(rows, rows.slice(1))).toBe(false)
  })
})

describe('what stops a save', () => {
  it('saves no seats at all, and seats that are whole', () => {
    expect(quoSeatsProblem([])).toBeNull()
    expect(quoSeatsProblem([{ quoUserId: 'USrobert1', userId: 'u-robert' }])).toBeNull()
  })

  it('asks for Quo’s id, one id a seat, a person on each seat, and one seat a person', () => {
    expect(quoSeatsProblem([{ quoUserId: 'robert', userId: 'u-robert' }])).toBe('Give each seat its Quo user id. They start with US.')
    expect(quoSeatsProblem([{ quoUserId: '', userId: 'u-robert' }])).toBe('Give each seat its Quo user id. They start with US.')
    expect(
      quoSeatsProblem([
        { quoUserId: 'USrobert1', userId: 'u-robert' },
        { quoUserId: ' USrobert1', userId: 'u-rosa' },
      ]),
    ).toBe('A Quo user id is on two seats. Each seat is one id.')
    expect(quoSeatsProblem([{ quoUserId: 'USrosa2', userId: '' }])).toBe('Pick who answers on each seat.')
    expect(
      quoSeatsProblem([
        { quoUserId: 'USrobert1', userId: 'u-robert' },
        { quoUserId: 'USrobert2', userId: 'u-robert' },
      ]),
    ).toBe('A person is on two seats. Each person has one seat.')
  })

  it('lets the shared office seat sit on more than one login, and still holds a person to one (v2.5548)', () => {
    expect(
      quoSeatsProblem([
        { quoUserId: 'USoffice1', userId: 'office' },
        { quoUserId: 'USoffice2', userId: 'office' },
      ]),
    ).toBeNull()
    expect(
      quoSeatsProblem([
        { quoUserId: 'USoffice1', userId: 'office' },
        { quoUserId: 'USrobert1', userId: 'u-robert' },
        { quoUserId: 'USrobert2', userId: 'u-robert' },
      ]),
    ).toBe('A person is on two seats. Each person has one seat.')
  })
})

describe('the card’s words', () => {
  it('are plain words', () => {
    const problems = [QUO_SEATS_INTRO, QUO_SEATS_WHY, QUO_SEATS_NONE, QUO_SEATS_SAVED_TOAST, quoSeatsProblem([{ quoUserId: 'x', userId: '' }]) ?? ''].flatMap(plainWordsFailures)
    expect(problems).toEqual([])
  })
})
