// @vitest-environment jsdom
/**
 * Render-smoke tests for Settings → Release notes (v2.944). The section is
 * self-contained (static data, no supabase/auth), so it renders bare: the
 * "Current version" line matches the newest note, each visible card shows its
 * version + title, and the tail collapses behind "Show N earlier updates".
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SettingsReleaseNotesSection from './SettingsReleaseNotesSection'
import { RELEASE_NOTES } from '../../content/releaseNotes'

describe('SettingsReleaseNotesSection', () => {
  it('shows the current version from the newest note', () => {
    render(<SettingsReleaseNotesSection />)
    expect(screen.getByText(/Current version:/)).toBeTruthy()
    const newest = RELEASE_NOTES[0]
    if (newest == null) throw new Error('release notes are empty')
    // Appears twice by design: the "Current version" line and the newest card.
    expect(screen.getAllByText(newest.version)).toHaveLength(2)
    expect(screen.getByText(newest.title)).toBeTruthy()
  })

  it('collapses the tail behind Show earlier updates and expands on click', () => {
    render(<SettingsReleaseNotesSection />)
    const hidden = RELEASE_NOTES.length - 15
    if (hidden <= 0) return // list still short — nothing to collapse yet
    const button = screen.getByRole('button', { name: new RegExp(`Show ${hidden} earlier`) })
    const oldest = RELEASE_NOTES[RELEASE_NOTES.length - 1]
    if (oldest == null) throw new Error('release notes are empty')
    expect(screen.queryByText(oldest.version)).toBeNull()
    fireEvent.click(button)
    expect(screen.getByText(oldest.version)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /earlier update/ })).toBeNull()
  })
})
