import { describe, expect, it } from 'vitest'
import { confirmationNotice } from './legalPortalNotice'

describe('confirmationNotice · v2.4624 · the portal says when a confirmation did not go', () => {
  it('a person added whose confirmation did not go: a warning that names the button', () => {
    expect(confirmationNotice('Bo Sample', 'bo@firm.example.com', { ok: true, confirmationSent: false })).toEqual({
      warn: true,
      text: 'Bo Sample is on the list, but the confirmation email to bo@firm.example.com did not go. Press Resend the confirmation next to their name in a minute.',
    })
  })

  it('a person added and sent: what happens next, no warning', () => {
    const n = confirmationNotice('Bo Sample', 'bo@firm.example.com', { ok: true, confirmationSent: true })
    expect(n.warn).toBe(false)
    expect(n.text).toBe('Bo Sample is on the list. A confirmation email went to bo@firm.example.com. Nothing else is sent until they press its button.')
  })

  it('a resend, either way', () => {
    expect(confirmationNotice('Bo', 'bo@firm.example.com', { ok: true, confirmationSent: false }, true)).toEqual({ warn: true, text: 'The confirmation email to bo@firm.example.com did not go. Press Resend the confirmation again in a minute.' })
    expect(confirmationNotice('Bo', 'bo@firm.example.com', { ok: true, confirmationSent: true }, true)).toEqual({ warn: false, text: 'A new confirmation email went to bo@firm.example.com.' })
  })
})
