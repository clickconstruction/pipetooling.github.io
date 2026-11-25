/**
 * The line a person reads when the map services did not place an address (punch list #441). The walk of
 * 2026-11-25 met *Address not found — OpenStreetMap (Nominatim) HTTP 403; no match from Google; no match from US
 * Census* on the Bid Board's sheet: the stored detail, drawn as it came. This holds the rule that mended it: every
 * code reads as a plain sentence, and nothing of the detail is drawn.
 */
import { describe, expect, it } from 'vitest'
import { mapGeocodeErrorMessage } from './geocodeErrorMessage'

const CODES = ['not_found', 'upstream', 'invalid_coordinates', 'google_denied', 'google_over_query', 'google_invalid', 'google_unknown', 'google_no_results', 'google_upstream', 'google_unconfigured', 'census_upstream']

/** Details the two functions really write, and the one an old kept miss still holds. */
const DETAILS = [
  'OpenStreetMap (Nominatim) HTTP 403; no match from Google; no match from US Census',
  'HTTP 500',
  'HTTP 429; US Census: HTTP 503',
  'Response was not valid JSON',
  'No match from Google; no match from US Census',
  'Google Geocoding request failed',
  'GOOGLE_MAPS_API_KEY is not set for Edge Functions',
  'This API project is not authorized to use this API.',
]

describe('mapGeocodeErrorMessage', () => {
  it('a miss reads as one plain sentence, with or without a detail', () => {
    expect(mapGeocodeErrorMessage('not_found')).toBe('No map service could find this address.')
    expect(mapGeocodeErrorMessage('not_found', 'OpenStreetMap (Nominatim) HTTP 403; no match from Google; no match from US Census')).toBe('No map service could find this address.')
    expect(mapGeocodeErrorMessage('not_found', null)).toBe('No map service could find this address.')
  })

  it('no code with any detail draws a status code, a service’s own name for the look-up, or a setting’s name', () => {
    for (const code of [...CODES, 'unknown', 'something_new']) {
      for (const detail of [undefined, ...DETAILS]) {
        const line = mapGeocodeErrorMessage(code, detail)
        expect(line, `${code} / ${detail}`).not.toMatch(/HTTP|\d{3}|Nominatim|OpenStreetMap|JSON|API|GOOGLE_|Geocod|geocod/)
        // Whole sentences: each caller draws the line after its own words or alone.
        expect(line.endsWith('.'), line).toBe(true)
        expect(line).not.toContain('—')
        expect(line).not.toContain(';')
      }
    }
  })

  it('every sentence is twenty words or fewer', () => {
    for (const code of [...CODES, 'unknown']) {
      for (const sentence of mapGeocodeErrorMessage(code).split(/(?<=\.)\s+/)) {
        expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
      }
    }
    for (const sentence of mapGeocodeErrorMessage('not_found', 'Google placed it outside the lower 48 (19.4326, -99.1332)').split(/(?<=\.)\s+/)) {
      expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
    }
  })

  it('a code it does not know reads as a miss, never as the code', () => {
    expect(mapGeocodeErrorMessage('unknown')).toBe('The map services could not place this address.')
    expect(mapGeocodeErrorMessage('something_new', 'HTTP 418')).toBe('The map services could not place this address.')
  })

  it('a service that placed the address outside the lower 48 says so in plain words, without the point', () => {
    const line = mapGeocodeErrorMessage('not_found', 'Google placed it outside the lower 48 (19.4326, -99.1332); no match from US Census')
    expect(line).toBe('A map service placed this address outside the lower 48 states. Check the city, the state and the ZIP.')
    expect(line).not.toContain('19.4326')
  })

  it('a service that did not answer says to try again', () => {
    for (const code of ['upstream', 'google_upstream', 'census_upstream']) {
      expect(mapGeocodeErrorMessage(code, 'HTTP 503')).toBe('A map service had a problem and did not place this address. Try again in a minute.')
    }
  })
})
