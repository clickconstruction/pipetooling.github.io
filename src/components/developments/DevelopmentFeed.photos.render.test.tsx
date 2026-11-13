// @vitest-environment jsdom
/**
 * A photos line in the History (punch list #247, PR 2): its thumbnails under the words, four whole or three and
 * a + N tile, the batch's time span at the end, a tap opening the viewer on that photo with Next inside the batch,
 * the + N tile opening it on the first photo not drawn, and the viewer's *Only X's photos* handed to the page. With
 * no io the line draws its words alone. Made-up rows; no byte is read.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { foldPhotoBatches } from '../../lib/developments/photoLines'
import type { UploadedPhotosIo } from '../../lib/photos/uploadedPhotosIo'
import type { UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import { DevelopmentFeed } from './DevelopmentFeed'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

function row(over: Partial<UploadedPhotoRow> & { id: string; taken_at: string }): UploadedPhotoRow {
  return {
    source: 'report', job_id: 'j629', bid_id: null, project_id: null, report_id: 'r1', container_id: null, question_id: null, message_id: null, contact_id: null,
    caption: `Shot ${over.id}`, stage_name: 'Rough in', by_user_id: 'u1', by_name: 'Malachi Reed', direction: null, channel: null, bytes: 1000, original_bytes: 0,
    bucket: 'report-photos', storage_path: 'p.jpg', drive_file_id: null, filed_at: null, fail_why: null, status: null, job_hcp_number: '629', job_click_number: null, job_name: 'Lot 14', customer_name: 'Ridgeway', bid_number: null,
    ...over,
  }
}
const io: UploadedPhotosIo = { list: async () => ({ rows: [], more: false }), waiting: async () => null, thumb: async () => null, full: async () => null }
const labels = { job: (id: string) => ({ kind: 'job' as const, id, label: 'JP629 Lot 14' }), bid: () => null, siteName: 'Gray Fox Trail' }
const at = (min: number) => new Date(Date.parse('2026-11-02T14:15:00Z') - min * 60_000).toISOString()

describe('DevelopmentFeed — a photos line', () => {
  it('four thumbnails under the words with the span, a tap opens the viewer on that photo, Next stays inside the batch', () => {
    const lines = foldPhotoBatches([0, 10, 20, 33].map((m) => row({ id: `p${m}`, taken_at: at(m) })), labels)
    renderWithProviders(<DevelopmentFeed lines={lines} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} photoIo={io} />)
    const line = screen.getByTestId('changed-line')
    expect(line.textContent).toContain('Photos · JP629 Lot 14 · 4 photos · Rough in · “Shot p0, Shot p10, Shot p20” · Malachi Reed · 7:42–8:15 AM')
    const tiles = within(line).getAllByTestId('photos-line-tile')
    expect(tiles).toHaveLength(4)
    expect(within(line).queryByTestId('photos-line-more')).toBeNull()
    fireEvent.click(tiles[1]!)
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('[data-uploaded-photo-open]')?.getAttribute('data-uploaded-photo-open')).toBe('p10')
    expect(within(dialog).getByText('2 of 4')).toBeTruthy()
    fireEvent.click(within(dialog).getByText('Next ›'))
    expect(dialog.querySelector('[data-uploaded-photo-open]')?.getAttribute('data-uploaded-photo-open')).toBe('p20')
  })
  it('past four: three and a + N tile that opens the viewer on the first photo not drawn; Only X’s photos goes to the page', () => {
    const lines = foldPhotoBatches(Array.from({ length: 11 }, (_, i) => row({ id: `p${i}`, taken_at: at(i) })), labels)
    const onPerson = vi.fn()
    renderWithProviders(<DevelopmentFeed lines={lines} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} photoIo={io} onPerson={onPerson} />)
    const line = screen.getByTestId('changed-line')
    expect(line.textContent).toContain('11 photos')
    expect(within(line).getAllByTestId('photos-line-tile')).toHaveLength(3)
    const more = within(line).getByTestId('photos-line-more')
    expect(more.textContent).toBe('+ 8')
    fireEvent.click(more)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('4 of 11')).toBeTruthy()
    fireEvent.click(within(dialog).getByText('Only Malachi’s photos'))
    expect(onPerson).toHaveBeenCalledWith('Malachi Reed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('the viewer’s Open the job opens the line’s piece', () => {
    const lines = foldPhotoBatches([row({ id: 'p0', taken_at: at(0) })], labels)
    const openAbout = vi.fn()
    renderWithProviders(<DevelopmentFeed lines={lines} sinceIndex={null} lastLooked={null} openAbout={openAbout} olderOpen={false} onToggleOlder={() => {}} photoIo={io} />)
    expect(screen.getByTestId('changed-line').textContent).toContain('Photo · JP629 Lot 14 · 1 photo')
    fireEvent.click(screen.getByTestId('photos-line-tile'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Open the job'))
    expect(openAbout).toHaveBeenCalledWith({ kind: 'job', id: 'j629', label: 'JP629 Lot 14' })
  })
  it('with no io the line draws its words alone', () => {
    const lines = foldPhotoBatches([row({ id: 'p0', taken_at: at(0) })], labels)
    renderWithProviders(<DevelopmentFeed lines={lines} sinceIndex={null} lastLooked={null} openAbout={() => {}} olderOpen={false} onToggleOlder={() => {}} />)
    expect(screen.queryByTestId('photos-line-tiles')).toBeNull()
    expect(screen.getByTestId('changed-line').textContent).toContain('1 photo')
  })
})
