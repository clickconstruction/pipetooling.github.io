import { describe, expect, it } from 'vitest'
import { isHttpsLink } from './companyFile'

describe('isHttpsLink (P5b-2, gc 2)', () => {
  it('takes only an https URL', () => {
    expect(['https://drive.google.com/file/d/x/view', 'http://drive.google.com/x', 'javascript:alert(1)', 'not a url', ''].map(isHttpsLink)).toEqual([true, false, false, false, false])
  })
})
