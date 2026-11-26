import { describe, expect, it } from 'vitest'
import { GOOGLE_NO_ACCOUNT_WORDS, googleIsOn, googleRedirectTo, googleRefusalWords, withoutGoogleRefusal } from './signInGoogle'

describe('Continue with Google', () => {
  it('shows only when the Auth server says Google is on', () => {
    expect(googleIsOn({ external: { email: true, google: true } })).toBe(true)
    expect(googleIsOn({ external: { email: true, google: false } })).toBe(false)
    expect(googleIsOn({ external: { email: true } })).toBe(false)
    expect(googleIsOn({})).toBe(false)
    expect(googleIsOn(null)).toBe(false)
    expect(googleIsOn('google')).toBe(false)
  })

  it('comes back to the sign-in page, carrying the address that was waiting', () => {
    expect(googleRedirectTo('https://clicktooling.com', null)).toBe('https://clicktooling.com/sign-in')
    expect(googleRedirectTo('https://clicktooling.com', '/jobs?tab=stages')).toBe('https://clicktooling.com/sign-in?next=%2Fjobs%3Ftab%3Dstages')
  })

  it('says there is no account when sign-ups are closed and the address matches nobody', () => {
    expect(googleRefusalWords('?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed+for+this+instance', '')).toBe(GOOGLE_NO_ACCOUNT_WORDS)
    expect(googleRefusalWords('', '#error=access_denied&error_description=Signups+not+allowed+for+this+instance')).toBe(GOOGLE_NO_ACCOUNT_WORDS)
  })

  it('says an archived account is turned off, a stopped sign-in was stopped, and anything else in its own words', () => {
    expect(googleRefusalWords('?error=access_denied&error_code=user_banned&error_description=User+is+banned', '')).toBe('This account is turned off. Ask the office.')
    expect(googleRefusalWords('?error=access_denied', '')).toBe('Google did not sign you in, because the sign-in was stopped before it finished. Press Continue with Google to try again.')
    expect(googleRefusalWords('?error=server_error&error_code=unexpected_failure&error_description=Unable+to+exchange+external+code', '')).toBe(
      'Google did not sign you in. Unable to exchange external code. Press Continue with Google to try again, or use your password.',
    )
  })

  it('says nothing when the address carries no refusal', () => {
    expect(googleRefusalWords('?next=%2Fjobs', '')).toBeNull()
    expect(googleRefusalWords('', '#access_token=abc&type=bearer')).toBeNull()
    expect(googleRefusalWords(null, undefined)).toBeNull()
  })

  it('takes the refusal out of the address and keeps the waiting address', () => {
    expect(withoutGoogleRefusal('?next=%2Fjobs&error=access_denied&error_code=signup_disabled&error_description=x')).toBe('?next=%2Fjobs')
    expect(withoutGoogleRefusal('?error=access_denied')).toBe('')
  })
})
