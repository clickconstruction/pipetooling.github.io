import { describe, expect, it } from 'vitest'
import { LENS_NAME_PREFIX, formatLensName, parseLensName } from './lensName'

describe('the lens frame name', () => {
  it('round-trips who, the state and the theme', () => {
    const name = formatLensName({ as: 'estimator', mood: 'empty', theme: 'dark' })
    expect(name.startsWith(LENS_NAME_PREFIX)).toBe(true)
    expect(parseLensName(name)).toEqual({ as: 'estimator', mood: 'empty', theme: 'dark' })
  })

  it('is null for every window the lens did not name', () => {
    expect(parseLensName('')).toBeNull()
    expect(parseLensName('oauth-popup')).toBeNull()
    expect(parseLensName(null)).toBeNull()
    expect(parseLensName(`${LENS_NAME_PREFIX}not json`)).toBeNull()
    expect(parseLensName(`${LENS_NAME_PREFIX}{"as":"owner"}`)).toBeNull()
  })

  it('fills a missing state and theme, and keeps the nonce that makes a new tab its own window', () => {
    expect(parseLensName(`${LENS_NAME_PREFIX}{"as":"helpers","n":"k3"}`)).toEqual({ as: 'helpers', mood: 'full', theme: 'light', n: 'k3' })
  })
})
