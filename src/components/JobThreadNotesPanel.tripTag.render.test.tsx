// @vitest-environment jsdom
/**
 * The tag on a clock line in the Job window's feed (punch list #379, PR 6): with `clockTripTags`, a clock line
 * wears its trip's tag or the quiet chip for a day at home for the site. Without the prop, and for a line the
 * map does not name, the line is as it was. Every name here is made up.
 */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clockSessionsToActivityItems } from '../lib/jobThreadClockActivity'
import { clockLineKey, CLOCK_TRIP_TAG_WORDS, type ClockTripTag } from '../lib/trips/jobTrips'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { JobThreadNotesPanel } from './JobThreadNotesPanel'
import { TRIP_KIND_COLOR } from './trips/TripDayBits'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const session = (id: string, name: string, day: string) => ({ id, user_id: `u-${name.toLowerCase()}`, clocked_in_at: `${day}T13:00:00Z`, clocked_out_at: `${day}T22:30:00Z`, work_date: day, notes: null, approved_at: `${day}T23:00:00Z`, rejected_at: null, users: { name } })
const activity = clockSessionsToActivityItems([session('cs-luis', 'Luis', '2026-11-03'), session('cs-priya', 'Priya', '2026-11-04'), session('cs-walt', 'Walt', '2026-11-02'), session('cs-dana', 'Dana', '2026-10-12'), session('cs-omar', 'Omar', '2026-10-13')])
const tag = (bucket: ClockTripTag['bucket']): ClockTripTag => ({ bucket, words: CLOCK_TRIP_TAG_WORDS[bucket], quiet: bucket === 'home' })

function draw(clockTripTags?: ReadonlyMap<string, ClockTripTag>) {
  renderWithProviders(<JobThreadNotesPanel activity={activity} loading={false} canPost={false} draft="" onDraftChange={() => undefined} onSubmit={() => undefined} submitting={false} showSectionTitle={false} showEmptyPlaceholder={false} {...(clockTripTags ? { clockTripTags } : {})} />)
}

describe('JobThreadNotesPanel: the tag on a clock line (punch list #379)', () => {
  it('a clock line wears its tag in the kind’s colour, grey for no place, and the quiet chip at home', () => {
    draw(new Map([[clockLineKey('cs-luis'), tag('site')], [clockLineKey('cs-priya'), tag('road')], [clockLineKey('cs-walt'), tag('noPlace')], [clockLineKey('cs-dana'), tag('home')]]))
    const tags = screen.getAllByTestId('trip-clock-tag')
    const by = (bucket: string) => tags.find((t) => t.getAttribute('data-bucket') === bucket)
    expect(tags).toHaveLength(4)
    expect(by('site')?.textContent).toBe('TRIP · AT THE SITE')
    expect(by('site')?.closest('li')?.textContent).toContain('Luis')
    expect(by('site')?.style.background).toBe('rgb(22, 163, 74)')
    expect(TRIP_KIND_COLOR.site).toBe('#16a34a')
    expect(by('road')?.textContent).toBe('TRIP · ON THE ROAD')
    expect(by('road')?.closest('li')?.textContent).toContain('Priya')
    expect(by('noPlace')?.textContent).toBe('TRIP · NO PLACE ON THE PUNCH')
    expect(by('noPlace')?.style.background).toBe('var(--bg-muted)')
    expect(by('home')?.textContent).toBe('at home for the site')
    expect(by('home')?.closest('li')?.textContent).toContain('Dana')
    // Omar's line is not in the map: it is as it was.
    expect(screen.getByText('Omar').closest('li')?.querySelector('[data-testid="trip-clock-tag"]')).toBeNull()
  })

  it('no line changes without the prop: a local job’s feed is as it was', () => {
    draw()
    expect(screen.getByText('Luis')).toBeTruthy()
    expect(screen.queryByTestId('trip-clock-tag')).toBeNull()
  })
})
