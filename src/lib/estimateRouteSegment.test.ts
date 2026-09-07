import { describe, expect, it } from 'vitest'
import { isEstimateUuidSegment, parseEstimateQuoteNumberSegment } from './estimateRouteSegment'

describe('estimateRouteSegment', () => {
  it('recognises a legacy UUID segment', () => {
    expect(isEstimateUuidSegment('123e4567-e89b-12d3-a456-426614174000')).toBe(true)
    expect(isEstimateUuidSegment('123E4567-E89B-42D3-A456-426614174000')).toBe(true)
    expect(isEstimateUuidSegment('123e4567-e89b-12d3-c456-426614174000')).toBe(false) // variant nibble
    expect(isEstimateUuidSegment('482')).toBe(false)
  })
  it('parses a positive quote number and nothing else', () => {
    expect(parseEstimateQuoteNumberSegment('482')).toBe(482)
    expect(parseEstimateQuoteNumberSegment('0')).toBeNull()
    expect(parseEstimateQuoteNumberSegment('007')).toBeNull()
    expect(parseEstimateQuoteNumberSegment('-4')).toBeNull()
    expect(parseEstimateQuoteNumberSegment('4.5')).toBeNull()
    expect(parseEstimateQuoteNumberSegment('99999999999999999999')).toBeNull() // not a safe integer
  })
})
