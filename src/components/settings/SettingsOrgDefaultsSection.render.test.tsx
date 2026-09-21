// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { ORG_DEFAULTS, ORG_DEFAULT_KEYS, ORG_DEFAULT_ROLE_GROUPS } from '../../lib/orgDefaults'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/orgDefaultsStore', () => ({
  loadOrgDefaults: async () => [{ key: 'mobile_cards', role: '*', value: 'true' }],
  saveOrgDefault: async () => null,
  subscribeOrgDefaults: () => () => {},
}))

import { SettingsOrgDefaultsSection } from './SettingsOrgDefaultsSection'

describe('SettingsOrgDefaultsSection', () => {
  it('lays each setting out as a block — never a table, whose select columns squeeze the text and push Office roles off the page', async () => {
    const { container } = renderWithProviders(<SettingsOrgDefaultsSection />)
    await waitFor(() => expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).disabled).toBe(false))
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('#settings-org-defaults')).toBeTruthy() // Settings search deep-links here

    const audiences = ['everyone', ...Object.values(ORG_DEFAULT_ROLE_GROUPS).map((g) => g.label)]
    for (const key of ORG_DEFAULT_KEYS) {
      const block = screen.getByRole('group', { name: ORG_DEFAULTS[key].label })
      expect(within(block).getByText(ORG_DEFAULTS[key].hint)).toBeTruthy()
      for (const audience of audiences) expect(within(block).getByRole('combobox', { name: `${ORG_DEFAULTS[key].label} — ${audience}` })).toBeTruthy()
    }
  })

  it('offers a short "No default" so the closed select is never clipped mid-word', async () => {
    renderWithProviders(<SettingsOrgDefaultsSection />)
    const first = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    expect([...first.options].map((o) => o.text)).toContain('No default')
  })
})
