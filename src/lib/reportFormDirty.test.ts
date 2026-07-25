import { describe, expect, it } from 'vitest'
import { hasUnsavedReportEntries } from './reportFormDirty'

describe('hasUnsavedReportEntries', () => {
  it('is clean for an untouched form', () => {
    expect(hasUnsavedReportEntries({})).toBe(false)
  })
  it('is clean when every value is empty or whitespace', () => {
    expect(hasUnsavedReportEntries({ 'Status': '', 'Next steps': '   ' })).toBe(false)
  })
  it('is dirty once any field has real content', () => {
    expect(hasUnsavedReportEntries({ 'Status': '', 'Next steps': 'trim set tomorrow' })).toBe(true)
    expect(hasUnsavedReportEntries({ 'How complete is the job?': '35' })).toBe(true)
    expect(hasUnsavedReportEntries({ 'Customer signature': 'data:image/png;base64,abc' })).toBe(true)
  })
})
