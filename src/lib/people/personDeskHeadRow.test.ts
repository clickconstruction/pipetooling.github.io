import { describe, expect, it } from 'vitest'
import { deskHeadPresses } from './personDeskHeadRow'

const all = { hasAccount: true, email: 'kai@example.com', loginAttached: true, mayImitate: true, mayOpenFlow: true }

describe('deskHeadPresses', () => {
  it('draws all four for a dev on a person who can sign in', () => {
    expect(deskHeadPresses(all)).toEqual(['review', 'email', 'imitate', 'more'])
  })

  it('leaves Imitate off a person with no login attached, since there is no one to sign in as', () => {
    expect(deskHeadPresses({ ...all, loginAttached: false })).toEqual(['review', 'email', 'more'])
  })

  it('leaves Imitate off for anyone who is not a dev', () => {
    expect(deskHeadPresses({ ...all, mayImitate: false })).toEqual(['review', 'email', 'more'])
  })

  it('draws the menu alone for a roster row with no account', () => {
    expect(deskHeadPresses({ hasAccount: false, email: null, loginAttached: false, mayImitate: true, mayOpenFlow: true })).toEqual(['more'])
  })

  it('draws nothing the viewer cannot use', () => {
    expect(deskHeadPresses({ ...all, mayImitate: false, mayOpenFlow: false })).toEqual(['review', 'email'])
    expect(deskHeadPresses({ hasAccount: false, email: '', loginAttached: false, mayImitate: false, mayOpenFlow: false })).toEqual([])
  })
})
