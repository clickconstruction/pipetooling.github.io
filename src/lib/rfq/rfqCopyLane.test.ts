import { describe, expect, it } from 'vitest'
import { buildQuoteLinkPaste, quoteLinkUrl, rfqCopyLaneMayInsert, rfqCopyLaneNext, rfqCopyLaneRun } from './rfqCopyLane'

describe('rfqCopyLane — the row is inserted only after the link is in hand (J12-N1)', () => {
  it('happy path: prepare → clipboard → insert → minted', () => {
    expect(rfqCopyLaneRun(['prepare'])).toBe('prepared')
    expect(rfqCopyLaneRun(['prepare', 'clipboard_ok'])).toBe('copied')
    expect(rfqCopyLaneRun(['prepare', 'clipboard_ok', 'insert_ok'])).toBe('minted')
  })

  it('the INSERT is legal in exactly one state', () => {
    const states = ['idle', 'prepared', 'copied', 'copy_failed', 'minted'] as const
    expect(states.filter(rfqCopyLaneMayInsert)).toEqual(['copied'])
  })

  it('clipboard failure parks the lane; nothing may be inserted until the user confirms they copied', () => {
    const parked = rfqCopyLaneRun(['prepare', 'clipboard_failed'])
    expect(parked).toBe('copy_failed')
    expect(rfqCopyLaneMayInsert(parked)).toBe(false)
    expect(rfqCopyLaneNext(parked, 'insert_ok')).toBe('copy_failed') // illegal, ignored
    expect(rfqCopyLaneNext(parked, 'confirm_copied')).toBe('copied')
    expect(rfqCopyLaneMayInsert(rfqCopyLaneNext(parked, 'confirm_copied'))).toBe(true)
  })

  it('cancel from the failure panel leaves nothing behind', () => {
    expect(rfqCopyLaneRun(['prepare', 'clipboard_failed', 'cancel'])).toBe('idle')
    expect(rfqCopyLaneRun(['prepare', 'cancel'])).toBe('idle')
  })

  it('a failed insert stays in copied so the retry reuses the token already on the clipboard', () => {
    expect(rfqCopyLaneRun(['prepare', 'clipboard_ok', 'insert_failed'])).toBe('copied')
    expect(rfqCopyLaneRun(['prepare', 'clipboard_ok', 'insert_failed', 'insert_ok'])).toBe('minted')
  })

  it('minted is terminal and idle ignores everything but prepare', () => {
    expect(rfqCopyLaneNext('minted', 'prepare')).toBe('minted')
    expect(rfqCopyLaneNext('idle', 'clipboard_ok')).toBe('idle')
    expect(rfqCopyLaneNext('idle', 'insert_ok')).toBe('idle')
  })

  it('paste text ends with the public quote page for the token', () => {
    expect(quoteLinkUrl('abc123')).toBe('https://clicktooling.com/q/abc123')
    expect(buildQuoteLinkPaste('WC-1 ×4\nLAV-2 ×2', 'abc123')).toBe('WC-1 ×4\nLAV-2 ×2\n\nPrice it here: https://clicktooling.com/q/abc123')
  })
})
