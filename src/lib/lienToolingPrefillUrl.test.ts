import { describe, expect, it } from 'vitest'
import { buildLienToolingFormUrl, utf8JsonToBase64Url } from './lienToolingPrefillUrl'

describe('utf8JsonToBase64Url', () => {
  it('matches Lien Tooling form-url-state encoding for a simple object', () => {
    const payload = utf8JsonToBase64Url({ a: 1 })
    expect(payload).toBe('eyJhIjoxfQ')
  })

  it('uses base64url alphabet (no + / =)', () => {
    const payload = utf8JsonToBase64Url({ client: 'a+b/c=' })
    expect(payload).not.toContain('+')
    expect(payload).not.toContain('/')
    expect(payload.endsWith('=')).toBe(false)
  })
})

describe('buildLienToolingFormUrl', () => {
  it('builds hash payload URL', () => {
    const url = buildLienToolingFormUrl('https://lientooling.com', 'demand-letter', {
      'client-name': 'Acme',
    })
    expect(url).toBe(
      'https://lientooling.com/demand-letter.html#d=eyJjbGllbnQtbmFtZSI6IkFjbWUifQ',
    )
  })
})
