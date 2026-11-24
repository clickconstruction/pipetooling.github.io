// @vitest-environment jsdom
/**
 * Settings → Advanced: Global Reload sits here for a dev (v2.8527), inside the folded Advanced group, and its deep
 * link opens the group.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import SettingsAdvancedTab from './SettingsAdvancedTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'

describe('SettingsAdvancedTab: Global Reload', () => {
  afterEach(() => {
    cleanup()
    window.location.hash = ''
  })
  const draw = (isDev: boolean) => renderWithProviders(<SettingsAdvancedTab active isDev={isDev} onRoleMaybeChanged={() => {}} />)

  it('a dev finds Global Reload under Advanced, after Fix app', () => {
    draw(true)
    expect(screen.queryByRole('button', { name: 'Global Reload' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Fix app', 'Global Reload', 'Email domain monitoring'])
    expect(screen.getByRole('button', { name: 'Global Reload' })).toBeTruthy()
  })

  it('nobody else is shown it', () => {
    draw(false)
    fireEvent.click(screen.getByRole('button', { name: /Advanced/ }))
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Fix app'])
    expect(screen.queryByRole('button', { name: 'Global Reload' })).toBeNull()
    expect(document.getElementById('settings-global-reload')).toBeNull()
  })

  it('its link from the dev doors list opens the folded group', () => {
    window.location.hash = '#settings-global-reload'
    draw(true)
    expect(screen.getByRole('button', { name: 'Global Reload' })).toBeTruthy()
    expect(document.getElementById('settings-global-reload')).toBeTruthy()
  })
})
