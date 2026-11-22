import { describe, expect, it } from 'vitest'
import { NOTE_PLACEHOLDER_DESK, NOTE_PLACEHOLDER_PHONE, noteComposerLook } from './noteComposerLook'

describe('noteComposerLook', () => {
  it('leaves a desk as it was, inside a host card or not', () => {
    const desk = { flat: false, placeholder: NOTE_PLACEHOLDER_DESK, boxFontSize: '0.875rem', pressMinHeight: null }
    expect(noteComposerLook({ phone: false, hostCard: false })).toEqual(desk)
    expect(noteComposerLook({ phone: false, hostCard: true })).toEqual(desk)
  })

  it('is flat on a phone only where the host draws the card', () => {
    expect(noteComposerLook({ phone: true, hostCard: true }).flat).toBe(true)
    expect(noteComposerLook({ phone: true, hostCard: false }).flat).toBe(false)
  })

  it('gives every phone the short hint, 16 px words and a thumb’s press, with or without a host card', () => {
    for (const hostCard of [true, false]) {
      const look = noteComposerLook({ phone: true, hostCard })
      expect(look.placeholder).toBe('Type a note…')
      expect(look.boxFontSize).toBe('1rem')
      expect(look.pressMinHeight).toBe(44)
    }
  })

  it('keeps the keyboard advice for a desk and off a phone', () => {
    expect(NOTE_PLACEHOLDER_DESK).toContain('Enter to post')
    expect(NOTE_PLACEHOLDER_PHONE).not.toContain('Enter')
  })
})
