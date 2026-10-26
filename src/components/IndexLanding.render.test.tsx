// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { screen } from '@testing-library/react'

const auth = vi.hoisted(() => ({ role: 'dev' as string | null }))
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return { useAuth: () => makeUseAuthValue({ role: auth.role }) }
})

import { renderWithProviders } from '../test/renderSmokeMocks'
import { IndexLanding } from './IndexLanding'

/** The index route as `App.tsx` mounts it, with the two landings as stand-ins; the router opens at `/`. */
const tree = (
  <Routes>
    <Route index element={<IndexLanding />} />
    <Route path="/bridge" element={<div data-testid="bridge-page" />} />
    <Route path="/dashboard" element={<div data-testid="dashboard-page" />} />
  </Routes>
)

describe('IndexLanding', () => {
  it('lands a dev on the Bridge', () => {
    auth.role = 'dev'
    renderWithProviders(tree)
    // first paint
    expect(screen.getByTestId('bridge-page')).toBeTruthy()
  })

  it('lands everyone else on the Dashboard, a role not yet read included', () => {
    auth.role = 'assistant'
    const r = renderWithProviders(tree)
    // first paint
    expect(screen.getByTestId('dashboard-page')).toBeTruthy()
    r.unmount()
    auth.role = null
    renderWithProviders(tree)
    // first paint
    expect(screen.getByTestId('dashboard-page')).toBeTruthy()
  })
})
