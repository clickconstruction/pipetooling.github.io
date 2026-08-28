// @vitest-environment jsdom
/**
 * Pins the sign-in Enter contract (v2.2448, Wendi: "can't hit enter to login have to
 * press the button"): pressing Enter in the email or password field submits the form
 * through our own keydown handler — no reliance on the browser's implicit form
 * submission, which environments like password-manager overlays and PWA webviews can
 * swallow. jsdom implements no implicit submission at all, so these tests pass only
 * through the explicit handler — exactly the environment class being defended against.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SignIn from './SignIn'
import { supabase } from '../lib/supabase'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      // An auth error keeps the component on the page (no cache clear / reload path).
      signInWithPassword: vi.fn(async () => ({ error: { message: 'Invalid login credentials' } })),
    },
  },
}))

const signInMock = vi.mocked(supabase.auth.signInWithPassword)

function renderSignIn() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SignIn />
    </MemoryRouter>,
  )
}

function fillFields() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wendi@clickplumbing.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2' } })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('SignIn Enter-to-submit', () => {
  it('Enter in the password field signs in', async () => {
    renderSignIn()
    fillFields()
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
    await waitFor(() => expect(signInMock).toHaveBeenCalledWith({ email: 'wendi@clickplumbing.com', password: 'hunter2' }))
    expect(await screen.findByText('Invalid login credentials')).toBeTruthy()
  })

  it('Enter in the email field signs in too', async () => {
    renderSignIn()
    fillFields()
    fireEvent.keyDown(screen.getByLabelText('Email'), { key: 'Enter' })
    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1))
  })

  it('other keys do not submit', () => {
    renderSignIn()
    fillFields()
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'a' })
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Tab' })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('Enter mid-IME-composition does not submit', () => {
    renderSignIn()
    fillFields()
    fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter', isComposing: true })
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('the Sign in button still submits', async () => {
    renderSignIn()
    fillFields()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(signInMock).toHaveBeenCalledTimes(1))
  })
})

// v2.2450: plaintext credentials must never live in localStorage. The email pre-fill is a
// convenience and stays; the password is the browser password manager's job
// (autoComplete="current-password").
describe('SignIn password storage', () => {
  it('purges a legacy stored password on mount and does not pre-fill from it', () => {
    window.localStorage.setItem('signin_password', 'hunter2')
    window.localStorage.setItem('signin_email', 'wendi@clickplumbing.com')
    renderSignIn()
    expect(window.localStorage.getItem('signin_password')).toBeNull()
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('wendi@clickplumbing.com')
  })

  it('a successful sign-in saves the email but never the password', async () => {
    // The legacy write lived on the SUCCESS branch, so the success path is the one that
    // must be proven clean. Stub the post-login hard reload (jsdom cannot navigate).
    signInMock.mockResolvedValueOnce({ error: null } as never)
    const reload = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    try {
      renderSignIn()
      fillFields()
      fireEvent.keyDown(screen.getByLabelText('Password'), { key: 'Enter' })
      await waitFor(() => expect(reload).toHaveBeenCalled())
      expect(window.localStorage.getItem('signin_email')).toBe('wendi@clickplumbing.com')
      expect(window.localStorage.getItem('signin_password')).toBeNull()
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    }
  })
})
