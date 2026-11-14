// @vitest-environment jsdom
/**
 * The sign-in's return address, wired (v2.7182): a signed-out visitor's address is kept at the gate with its query, a
 * signed-in person leaves the sign-in page for it once, and StrictMode's second render lands on the same place.
 */
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { LeaveSignIn, SignedOutGate } from './SignInReturn'
import { POST_LOGIN_REDIRECT_KEY } from '../lib/iosPwa'

const JOB = '26c58929-183d-4d92-99f0-6c891f104bcd'
const LIEN_WINDOW = `/jobs?tab=stages&lienwindow=${JOB}&lientab=affidavit`
const LIEN_DESK = '/lien-desk?tab=affidavits'

function Where() {
  const { pathname, search, hash } = useLocation()
  return <div data-testid="where">{`${pathname}${search}${hash}`}</div>
}

/** A signed-out visit: every page is behind the gate, and the sign-in page says where it is. */
function gateAt(path: string, hadSession = false) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sign-in" element={<Where />} />
          <Route path="*" element={<SignedOutGate hadSession={hadSession} />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )
}

/** A signed-in person on the sign-in page: every other page says where it is. */
function leaveFrom(path: string, landing = '/dashboard') {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/sign-in" element={<LeaveSignIn landing={landing} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  )
}

const where = () => screen.getByTestId('where').textContent

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('SignedOutGate', () => {
  it('sends a signed-out visitor to sign in and keeps the whole address', () => {
    gateAt(LIEN_WINDOW)
    expect(where()).toBe('/sign-in')
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe(LIEN_WINDOW)
    cleanup()
    gateAt(LIEN_DESK)
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe(LIEN_DESK)
  })

  it('forgets an older address when the visitor asks for the root', () => {
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, LIEN_DESK)
    gateAt('/')
    expect(where()).toBe('/sign-in')
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })

  it('keeps nothing for a person who was signed in on this visit', () => {
    gateAt('/jobs?tab=stages', true)
    expect(where()).toBe('/sign-in')
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
    cleanup()
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, '/task')
    gateAt('/settings', true)
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/task')
  })
})

describe('LeaveSignIn', () => {
  it('lands on the kept address with its query, once', () => {
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, LIEN_WINDOW)
    leaveFrom('/sign-in')
    expect(where()).toBe(LIEN_WINDOW)
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
    cleanup()
    leaveFrom('/sign-in')
    expect(where()).toBe('/dashboard')
  })

  it("lands on the role's landing when nothing is waiting", () => {
    leaveFrom('/sign-in', '/bridge')
    expect(where()).toBe('/bridge')
  })

  it('lands on the address an emailed link carries, with no storage to read', () => {
    leaveFrom(`/sign-in?next=${encodeURIComponent(LIEN_DESK)}`)
    expect(where()).toBe(LIEN_DESK)
  })

  it('never leaves the site: another site in the link or in storage reads as nothing', () => {
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, '//evil.example/jobs')
    leaveFrom(`/sign-in?next=${encodeURIComponent('https://evil.example/jobs')}`)
    expect(where()).toBe('/dashboard')
    // The bad value is spent too, so it is not read again.
    expect(localStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull()
  })

  it('still serves the doors that already wrote the address', () => {
    for (const kept of ['/task', '/b/4f2a9c18', '/files/messages/att-1']) {
      localStorage.setItem(POST_LOGIN_REDIRECT_KEY, kept)
      leaveFrom('/sign-in')
      expect(where()).toBe(kept)
      cleanup()
    }
  })
})
