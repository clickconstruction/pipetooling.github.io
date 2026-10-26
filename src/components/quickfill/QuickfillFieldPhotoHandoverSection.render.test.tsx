// @vitest-environment jsdom
/**
 * Field photos → Drive with an age (v2.5888, punch list #180): the body draws the page's groups with
 * each estimate's days in storage, the count line and the since-last-look line; a clean day says so.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { QuickfillFieldPhotoHandoverSection } from './QuickfillFieldPhotoHandoverSection'
import type { HandoverGroup } from '../../lib/quickfill/fieldPhotoHandover'

const DAY = 86_400_000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://signed.example/${path}` } }), remove: async () => ({ error: null }) }) },
    from: () => ({ upsert: async () => ({ error: null }), delete: () => ({ eq: async () => ({ error: null }) }) }),
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  },
}))

function group(id: string, label: string, days: number, n: number): HandoverGroup {
  return {
    estimateId: id,
    estimateNumber: Number(id.replace('e', '')),
    label,
    status: 'draft',
    oldestAt: ago(days),
    photos: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, estimate_id: id, storage_path: `${id}/${i}.jpg`, filename: `${i}.jpg`, created_at: ago(days - i * 0.1) })),
  }
}

beforeAll(installDomShims)
afterEach(cleanup)

describe('Field photos → Drive with an age (v2.5888)', () => {
  it('draws each estimate with its days in storage, the count line and what moved since the last look', async () => {
    const groups = [group('e1042', 'Estimate #1042 — Ridgeway Builders', 12, 6), group('e1051', 'Estimate #1051 — Cedar Bend Partners', 4, 3), group('e1057', 'CO #1057 — Harlan Freight', 1, 2)]
    renderWithProviders(<QuickfillFieldPhotoHandoverSection groups={groups} handovers={[{ moved_at: ago(1) }, { moved_at: ago(20) }]} loading={false} onMoved={() => undefined} lastMarkedAt={ago(3)} />)
    await screen.findByText('Estimate #1042 — Ridgeway Builders')
    await settle()
    expect(document.querySelector('[data-field-photos-count-line]')!.textContent).toContain('3 estimates holding photos')
    expect(document.querySelector('[data-field-photos-count-line]')!.textContent).toContain('1 past 7 days')
    expect(document.querySelector('[data-field-photos-count-line]')!.textContent).toContain('oldest 12d · 11 photos')
    expect(screen.getByText('12d in storage').getAttribute('data-field-photos-age')).toBe('past')
    expect(screen.getByText('4d in storage').getAttribute('data-field-photos-age')).toBe('fresh')
    expect(document.querySelector('[data-field-photos-since]')!.textContent).toContain('+1 new')
    expect(document.querySelector('[data-field-photos-since]')!.textContent).toContain('1 moved to Drive')
    expect(document.querySelector('[data-field-photos-since]')!.textContent).toContain('2 still here')
    // The photos open full size through the signed URLs.
    expect(document.querySelectorAll('img')).toHaveLength(11)
  })

  it('a clean day says so, and a loading page says loading', async () => {
    renderWithProviders(<QuickfillFieldPhotoHandoverSection groups={[]} loading={false} onMoved={() => undefined} />)
    await screen.findByText(/every write-up's photos are in Google Drive/)
    cleanup()
    renderWithProviders(<QuickfillFieldPhotoHandoverSection groups={null} loading onMoved={() => undefined} />)
    expect(screen.getByText('Loading field photos…')).toBeTruthy()
  })
})
