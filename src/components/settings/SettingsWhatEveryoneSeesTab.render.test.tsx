// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { parseLensName } from '../../lib/lens/lensName'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { SettingsWhatEveryoneSeesTab } from './SettingsWhatEveryoneSeesTab'

const frames = () => [...document.querySelectorAll('iframe')]

describe('Settings → What everyone sees', () => {
  it('opens on six sealed frames of the estimator\'s dashboard: three widths, light over dark', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    const f = frames()
    expect(f).toHaveLength(6)
    expect(f.map((x) => parseLensName(x.getAttribute('name'))?.theme)).toEqual(['light', 'light', 'light', 'dark', 'dark', 'dark'])
    expect(f.every((x) => x.getAttribute('src') === '/dashboard')).toBe(true)
    expect(f.map((x) => x.style.width)).toEqual(['375px', '768px', '1280px', '375px', '768px', '1280px'])
    expect(f[0]!.getAttribute('title')).toBe('Dashboard as Eli Sample, estimator, Phone 375, light, full')
  })

  it('draws a screen as all nine roles, six at a time, and swaps one in on Draw it', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Roles' }))
    expect(frames()).toHaveLength(6)
    const draw = screen.getAllByRole('button', { name: 'Draw it' })
    expect(draw).toHaveLength(3)
    fireEvent.click(draw[0]!)
    expect(frames()).toHaveLength(6)
    expect(frames().map((x) => parseLensName(x.getAttribute('name'))?.as)).toContain('superintendent')
  })

  it('holds the knobs that do not vary, and names the state on each frame across states', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'States' }))
    expect((screen.getByRole('button', { name: 'Failing' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText('Training mode').length).toBeGreaterThan(0)
    const moods = frames().map((x) => parseLensName(x.getAttribute('name'))?.mood)
    expect(moods).toEqual(['full', 'empty', 'loading', 'slow', 'error', 'offline'])
  })

  it('lists only the screens the picked role can open', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Helper' }))
    const where = screen.getByRole('combobox', { name: 'Where' }) as HTMLSelectElement
    expect([...where.options].some((o) => o.value === 'page:/dashboard')).toBe(true)
    expect([...where.options].some((o) => o.value.startsWith('page:/bids'))).toBe(false)
  })

  it('lays every screen out as cards, and Check every screen draws them six at a time', () => {
    renderWithProviders(<SettingsWhatEveryoneSeesTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Every screen' }))
    expect(frames()).toHaveLength(0)
    expect(screen.getByText(/of \d+ screens checked, 6 at a time/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Check every screen' }))
    expect(frames()).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Stop checking' })).toBeTruthy()
  })
})
