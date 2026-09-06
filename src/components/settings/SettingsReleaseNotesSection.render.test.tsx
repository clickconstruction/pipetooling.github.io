// @vitest-environment jsdom
/**
 * Render-smoke tests for Settings → Release notes (v2.944; paged + role-aware
 * since B16). The section is self-contained (static data, no supabase/auth),
 * so it renders bare: the "Current version" line matches the newest note, each
 * visible card shows its version + title, and the tail sits behind a
 * "Show N earlier updates" pager that reveals one page per click.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SettingsReleaseNotesSection from './SettingsReleaseNotesSection'
import { RELEASE_NOTES } from '../../content/releaseNotes'
import { RELEASE_NOTES_PAGE_SIZE, releaseNotesForRole } from '../../lib/releaseNotes'

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

  it('pages the tail: one page per click, never the whole list at once', () => {
    render(<SettingsReleaseNotesSection />)
    const total = RELEASE_NOTES.length
    if (total <= RELEASE_NOTES_PAGE_SIZE * 2) return // list still short — nothing to page yet
    const oldest = RELEASE_NOTES[total - 1]
    const nextPageFirst = RELEASE_NOTES[RELEASE_NOTES_PAGE_SIZE]
    if (oldest == null || nextPageFirst == null) throw new Error('release notes are empty')
    expect(screen.queryByText(nextPageFirst.version)).toBeNull()
    const button = screen.getByRole('button', { name: new RegExp(`Show ${RELEASE_NOTES_PAGE_SIZE} earlier updates`) })
    fireEvent.click(button)
    expect(screen.getByText(nextPageFirst.version)).toBeTruthy()
    // Still paged — the oldest note is not mounted after one click.
    expect(screen.queryByText(oldest.version)).toBeNull()
    expect(screen.getByRole('button', { name: /earlier update/ })).toBeTruthy()
  })

  it('hides notes declared for other roles and says so', () => {
    const forHelpers = releaseNotesForRole(RELEASE_NOTES, 'helpers')
    render(<SettingsReleaseNotesSection role="helpers" />)
    if (forHelpers.length === RELEASE_NOTES.length) {
      expect(screen.queryByText(/apply to your role/)).toBeNull()
      return
    }
    expect(screen.getByText(/apply to your role/)).toBeTruthy()
    const hiddenNote = RELEASE_NOTES.find((n) => n.roles && !n.roles.includes('helpers'))
    if (hiddenNote) expect(screen.queryByText(hiddenNote.title)).toBeNull()
  })
})
