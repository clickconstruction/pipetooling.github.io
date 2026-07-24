import { describe, expect, it } from 'vitest'
import {
  mergeEstimateAcceptNotifyRecipients,
  parseEstimateAcceptedNotifyRecipients,
  serializeEstimateAcceptedNotifyRecipients,
} from './estimateAcceptedNotify'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

describe('parseEstimateAcceptedNotifyRecipients', () => {
  it('parses a JSON array of uuids', () => {
    expect(parseEstimateAcceptedNotifyRecipients(JSON.stringify([A, B]))).toEqual([A, B])
  })

  it('returns [] for empty / null / whitespace', () => {
    expect(parseEstimateAcceptedNotifyRecipients(null)).toEqual([])
    expect(parseEstimateAcceptedNotifyRecipients(undefined)).toEqual([])
    expect(parseEstimateAcceptedNotifyRecipients('')).toEqual([])
    expect(parseEstimateAcceptedNotifyRecipients('   ')).toEqual([])
  })

  it('returns [] for malformed JSON or a non-array', () => {
    expect(parseEstimateAcceptedNotifyRecipients('{oops')).toEqual([])
    expect(parseEstimateAcceptedNotifyRecipients('{"a":1}')).toEqual([])
    expect(parseEstimateAcceptedNotifyRecipients('"just-a-string"')).toEqual([])
  })

  it('drops non-uuid entries and dedupes, trimming whitespace', () => {
    expect(parseEstimateAcceptedNotifyRecipients(JSON.stringify([A, 'nope', 42, null, ` ${A} `, B]))).toEqual([A, B])
  })
})

describe('serializeEstimateAcceptedNotifyRecipients', () => {
  it('round-trips through parse', () => {
    expect(parseEstimateAcceptedNotifyRecipients(serializeEstimateAcceptedNotifyRecipients([A, B]))).toEqual([A, B])
  })

  it('serializes an empty list', () => {
    expect(serializeEstimateAcceptedNotifyRecipients([])).toBe('[]')
  })
})

describe('mergeEstimateAcceptNotifyRecipients (always-notify union)', () => {
  it('unions per-estimate and org-wide ids, per-estimate first', () => {
    expect(mergeEstimateAcceptNotifyRecipients([A], [B])).toEqual([A, B])
  })

  it('dedupes someone on both lists, keeping the per-estimate position', () => {
    expect(mergeEstimateAcceptNotifyRecipients([A, B], [B, C])).toEqual([A, B, C])
  })

  it('works when the estimate has nobody (the org-wide list still fires)', () => {
    expect(mergeEstimateAcceptNotifyRecipients([], [A, B])).toEqual([A, B])
    expect(mergeEstimateAcceptNotifyRecipients(null, [A])).toEqual([A])
    expect(mergeEstimateAcceptNotifyRecipients(undefined, [A])).toEqual([A])
  })

  it('works when the org-wide list is unset (per-estimate behavior is unchanged)', () => {
    expect(mergeEstimateAcceptNotifyRecipients([A], [])).toEqual([A])
    expect(mergeEstimateAcceptNotifyRecipients([A], null)).toEqual([A])
    expect(mergeEstimateAcceptNotifyRecipients([A], undefined)).toEqual([A])
  })

  it('is empty when both sides are empty', () => {
    expect(mergeEstimateAcceptNotifyRecipients([], [])).toEqual([])
    expect(mergeEstimateAcceptNotifyRecipients(null, null)).toEqual([])
  })

  it('drops blanks, non-strings, and non-uuids from either side', () => {
    expect(
      mergeEstimateAcceptNotifyRecipients([A, '', '  ', 'not-a-uuid', null], [B, undefined, 'nope']),
    ).toEqual([A, B])
  })

  it('trims whitespace so a padded duplicate is not emailed twice', () => {
    expect(mergeEstimateAcceptNotifyRecipients([` ${A} `], [A])).toEqual([A])
  })
})
