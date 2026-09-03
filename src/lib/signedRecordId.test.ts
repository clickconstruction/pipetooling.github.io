import { describe, expect, it } from 'vitest'
import { describeUserAgent, signatureMethodLabel, signedRecordId } from './signedRecordId'

describe('signedRecordId', () => {
  it('prefixes the number and takes six hex of the row id', () => {
    expect(signedRecordId('E', 84, '9f3a2c11-0000-4000-8000-000000000000')).toBe('E84-9F3A2C')
    expect(signedRecordId('J', '922', '1b0c4d7e-aaaa-bbbb-cccc-dddddddddddd')).toBe('J922-1B0C4D')
  })
  it('degrades without a number or id', () => {
    expect(signedRecordId('J', null, null)).toBe('J0-000000')
    expect(signedRecordId('J', '—', 'ab')).toBe('J0-AB')
  })
})

describe('describeUserAgent', () => {
  it('names the OS and browser', () => {
    expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128 Mobile/15E148 Safari/604.1')).toBe('iPhone · Chrome')
    expect(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36')).toBe('Mac · Chrome')
    expect(describeUserAgent('')).toBeNull()
  })
})

describe('signatureMethodLabel', () => {
  it('reads per surface', () => {
    expect(signatureMethodLabel('type', 'estimate')).toBe('Typed on the estimate page')
    expect(signatureMethodLabel('draw')).toBe('Drawn on their phone')
    expect(signatureMethodLabel('paper')).toBe('Signed on paper, uploaded by the office')
  })
})
