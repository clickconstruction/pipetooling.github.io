import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { trainingReadError } from './trainingIo'
import { errorKindOf, formatErrorMessage } from '../../utils/errorHandling'
import { OFFLINE_ERROR_MESSAGE } from '../networkErrorMessage'

describe('trainingReadError (v2.5962)', () => {
  it('keeps the server code, so the page sentence leads the class sentence', () => {
    const e = trainingReadError({ code: '42501', message: 'permission denied for table training_passes' }, 'Could not read your training')
    expect(e).toBeInstanceOf(Error)
    expect(e.code).toBe('42501')
    expect(errorKindOf(e)).toBe('server')
    expect(formatErrorMessage(e, 'Could not read your training')).toBe("Could not read your training. You don't have access to this record.")
  })

  it('a lost signal still reads as the offline sentence', () => {
    const e = trainingReadError({ code: '', message: 'TypeError: Failed to fetch' }, 'Could not read your training')
    expect(e.code).toBeUndefined()
    expect(errorKindOf(e)).toBe('network')
    expect(formatErrorMessage(e, 'Could not read your training')).toBe(OFFLINE_ERROR_MESSAGE)
  })

  it('no words from the server reads the fallback', () => {
    expect(trainingReadError(null, 'Could not read your training').message).toBe('Could not read your training')
  })
})
