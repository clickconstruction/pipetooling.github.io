import { describe, expect, it } from 'vitest'
import { parseRemoveNotComingInResult } from './notComingInTimeOff'

describe('parseRemoveNotComingInResult', () => {
  it('returns failure with default message when payload is null', () => {
    expect(parseRemoveNotComingInResult(null)).toEqual({
      ok: false,
      message: 'Empty response from server',
    })
  })

  it('returns failure with default message when payload is not an object', () => {
    expect(parseRemoveNotComingInResult('nope')).toEqual({
      ok: false,
      message: 'Empty response from server',
    })
  })

  it('returns failure with server message when ok is false', () => {
    expect(parseRemoveNotComingInResult({ ok: false, message: 'not authorized' })).toEqual({
      ok: false,
      message: 'not authorized',
    })
  })

  it('falls back to a friendly message when ok is false and no message is given', () => {
    expect(parseRemoveNotComingInResult({ ok: false })).toEqual({
      ok: false,
      message: 'Could not undo time off',
    })
  })

  it('returns deleted=0 success on no-op (already cleared)', () => {
    expect(parseRemoveNotComingInResult({ ok: true, deleted: 0 })).toEqual({
      ok: true,
      deleted: 0,
    })
  })

  it('returns deleted count on success', () => {
    expect(parseRemoveNotComingInResult({ ok: true, deleted: 1 })).toEqual({
      ok: true,
      deleted: 1,
    })
  })

  it('coerces missing deleted to 0 on success payloads', () => {
    expect(parseRemoveNotComingInResult({ ok: true })).toEqual({
      ok: true,
      deleted: 0,
    })
  })

  it('passes through sync_warning when present', () => {
    expect(
      parseRemoveNotComingInResult({
        ok: true,
        deleted: 1,
        sync_warning: 'salary template missing',
      }),
    ).toEqual({ ok: true, deleted: 1, syncWarning: 'salary template missing' })
  })

  it('ignores empty/whitespace sync_warning', () => {
    expect(
      parseRemoveNotComingInResult({ ok: true, deleted: 1, sync_warning: '' }),
    ).toEqual({ ok: true, deleted: 1 })
  })
})
