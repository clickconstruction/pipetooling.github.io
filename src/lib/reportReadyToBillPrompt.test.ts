import { describe, expect, it } from 'vitest'
import { reportSaysJobComplete } from './reportReadyToBillPrompt'

const NEW = 'How complete is the job?'
const LEGACY = 'Who was on the job?'

describe('reportSaysJobComplete', () => {
  it('true when the completion field is exactly "100"', () => {
    expect(reportSaysJobComplete({ [NEW]: '100' })).toBe(true)
  })

  it('tolerates whitespace and numeric 100', () => {
    expect(reportSaysJobComplete({ [NEW]: ' 100 ' })).toBe(true)
    expect(reportSaysJobComplete({ [NEW]: 100 })).toBe(true)
  })

  it('false for anything below 100', () => {
    expect(reportSaysJobComplete({ [NEW]: '99' })).toBe(false)
    expect(reportSaysJobComplete({ [NEW]: '0' })).toBe(false)
  })

  it('false when the field is missing, empty, or unparseable', () => {
    expect(reportSaysJobComplete({})).toBe(false)
    expect(reportSaysJobComplete({ [NEW]: '' })).toBe(false)
    expect(reportSaysJobComplete({ [NEW]: 'done' })).toBe(false)
    expect(reportSaysJobComplete(null)).toBe(false)
    expect(reportSaysJobComplete(undefined)).toBe(false)
  })

  it('reads the legacy key when the new key is absent', () => {
    expect(reportSaysJobComplete({ [LEGACY]: '100' })).toBe(true)
    expect(reportSaysJobComplete({ [LEGACY]: '50' })).toBe(false)
  })

  it('prefers the new key over the legacy key when both exist', () => {
    expect(reportSaysJobComplete({ [NEW]: '50', [LEGACY]: '100' })).toBe(false)
    expect(reportSaysJobComplete({ [NEW]: '100', [LEGACY]: '0' })).toBe(true)
  })

  it('ignores other report fields', () => {
    expect(reportSaysJobComplete({ Notes: 'all done 100', [NEW]: '80' })).toBe(false)
  })
})
