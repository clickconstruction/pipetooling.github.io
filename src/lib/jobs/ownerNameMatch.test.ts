import { describe, expect, it } from 'vitest'
import { foldOwnerName, ownerNameLetterMatch } from '../../../supabase/functions/_shared/ownerNameMatch'

describe('the owner’s name, letter for letter', () => {
  it('folds case, spaces, punctuation and accents', () => {
    expect(foldOwnerName('Ulric  Karrow')).toBe('ulrickarrow')
    expect(foldOwnerName('ulric-karrow')).toBe('ulrickarrow')
    expect(foldOwnerName('José Peña, Jr.')).toBe('josepenajr')
    expect(foldOwnerName('   ')).toBe('')
  })
  it('matches the roll’s name or a second allowed name, and nothing shorter', () => {
    const allowed = ['Ulric Karrow', 'Barrowby Shelmina']
    expect(ownerNameLetterMatch('ULRIC KARROW', allowed)).toBe(true)
    expect(ownerNameLetterMatch('ulric-karrow', allowed)).toBe(true)
    expect(ownerNameLetterMatch('Barrowby Shelmina', allowed)).toBe(true)
    expect(ownerNameLetterMatch('U. Karrow', allowed)).toBe(false)
    expect(ownerNameLetterMatch('Ulric Karrow Jr', allowed)).toBe(false)
    expect(ownerNameLetterMatch('', allowed)).toBe(false)
    expect(ownerNameLetterMatch('Ulric Karrow', [''])).toBe(false)
  })
})
