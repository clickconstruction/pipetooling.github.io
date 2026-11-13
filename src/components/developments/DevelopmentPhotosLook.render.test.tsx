// @vitest-environment jsdom
/**
 * The Photos look (punch list #247, PR 1): the row of tiles newest first with a tick where the day changes and
 * Show more at the end, the job picker and the source chips narrowing the read, a tile opening the viewer on
 * that photo with Next walking the row, the viewer's *Only X's photos* narrowing the row, and the empty state
 * naming the door. Gray Fox Trail's made-up rows over a fake io; no byte is read.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { useSitePhotos } from '../../hooks/useSitePhotos'
import type { SitePhotosIo, SitePhotosRead } from '../../lib/photos/sitePhotosIo'
import type { SitePhotosQuery } from '../../lib/photos/sitePhotos'
import type { UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { DevelopmentPhotosLook } from './DevelopmentPhotosLook'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const J1 = '11111111-1111-4111-8111-111111111111'
const J2 = '22222222-2222-4222-8222-222222222222'
const PIECES = [
  { id: J1, label: 'JP629' },
  { id: J2, label: 'JP631' },
]

function row(over: Partial<UploadedPhotoRow> & { id: string; taken_at: string }): UploadedPhotoRow {
  return {
    source: 'report',
    job_id: J1,
    bid_id: null,
    project_id: null,
    report_id: 'r1',
    container_id: null,
    question_id: null,
    message_id: null,
    contact_id: null,
    caption: `Shot ${over.id}`,
    stage_name: 'Rough in',
    by_user_id: 'u1',
    by_name: 'Malachi Reed',
    direction: null,
    channel: null,
    bytes: 1000,
    original_bytes: 0,
    bucket: 'report-photos',
    storage_path: `p/${over.id}.jpg`,
    drive_file_id: null,
    filed_at: null,
    fail_why: null,
    status: null,
    job_hcp_number: '629',
    job_click_number: null,
    job_name: 'Lot 14',
    customer_name: 'Ridgeway',
    bid_number: null,
    ...over,
  }
}

/**
 * Two days of rows: three today on JP629 by Malachi, two the day before on JP631 by Deon, in Chicago. Today is
 * Chicago's date, not the UTC one, which runs a day ahead every evening from 18:00 Central.
 */
const TODAY = new Date(`${todayYmdInAppTz()}T12:00:00Z`)
const iso = (daysAgo: number, hour: number) => {
  const d = new Date(TODAY)
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hour + 6, 0, 0, 0) // noon-ish Chicago, never across midnight
  return d.toISOString()
}
const ROWS: UploadedPhotoRow[] = [
  row({ id: 'a', taken_at: iso(0, 12) }),
  row({ id: 'b', taken_at: iso(0, 11) }),
  row({ id: 'c', taken_at: iso(0, 10) }),
  row({ id: 'd', taken_at: iso(1, 12), job_id: J2, by_name: 'Deon Price', job_hcp_number: '631' }),
  row({ id: 'e', taken_at: iso(1, 11), job_id: J2, by_name: 'Deon Price', job_hcp_number: '631', source: 'box', container_id: 'k1' }),
]

function fakeIo(rows: UploadedPhotoRow[], pageSize = 100): { io: SitePhotosIo; asked: SitePhotosQuery[] } {
  const asked: SitePhotosQuery[] = []
  const io: SitePhotosIo = {
    list: async (q): Promise<SitePhotosRead> => {
      asked.push(q)
      let out = rows
      if (q.jobId) out = out.filter((r) => r.job_id === q.jobId)
      if (q.source !== 'all') out = out.filter((r) => r.source === q.source)
      const page = out.slice(0, Math.min(q.limit, pageSize))
      return { rows: page, more: page.length < out.length }
    },
    census: async () => rows.map((r) => ({ id: r.id, job_id: r.job_id, bid_id: r.bid_id, taken_at: r.taken_at })),
    photos: { list: async () => ({ rows: [], more: false }), waiting: async () => null, thumb: async () => null, full: async () => null },
  }
  return { io, asked }
}

function Harness({ io, phone = false, openJob = () => {}, goToPieces = () => {}, door = 'office', role = 'dev' }: { io: SitePhotosIo; phone?: boolean; openJob?: (id: string) => void; goToPieces?: () => void; door?: 'office' | 'overview'; role?: string }) {
  const state = useSitePhotos({ jobIds: [J1, J2], bidIds: [], enabled: true, io })
  return <DevelopmentPhotosLook state={state} pieces={PIECES} role={role} phone={phone} siteName="Gray Fox Trail" openJob={openJob} goToPieces={goToPieces} door={door} />
}

async function draw(io: SitePhotosIo, over: Partial<Parameters<typeof Harness>[0]> = {}) {
  renderWithProviders(<Harness io={io} {...over} />)
  await settle()
  await settle()
}

describe('DevelopmentPhotosLook', () => {
  it('the row newest first, a tick over the first tile of each day, and the foot', async () => {
    const { io } = fakeIo(ROWS)
    await draw(io)
    const rowEl = await screen.findByTestId('site-photos-row')
    const tiles = within(rowEl).getAllByTestId('site-photos-tile')
    expect(tiles).toHaveLength(5)
    expect(tiles.map((t) => t.getAttribute('data-day-start'))).toEqual(['1', null, null, '1', null])
    expect(within(rowEl).getAllByTestId('site-photos-tick').map((t) => t.textContent)).toEqual(['Today', 'Yesterday'])
    expect(within(tiles[0]!).getByRole('button').textContent).toBe('JP629 · Malachi')
    expect(within(tiles[3]!).getByRole('button').textContent).toBe('JP631 · Deon')
    expect(screen.queryByTestId('site-photos-more')).toBeNull()
    expect(screen.getByTestId('site-photos-foot').textContent).toContain('5 photos · scroll sideways · a tile opens the photo')
  })

  it('Show more at the right end reads the next page, with how many are left', async () => {
    const { io, asked } = fakeIo(ROWS, 2)
    await draw(io)
    const more = await screen.findByTestId('site-photos-more')
    expect(more.textContent).toBe('Show more3 older')
    expect(screen.getByTestId('site-photos-foot').textContent).toContain('2 of 5')
    fireEvent.click(more)
    await settle()
    expect(asked[asked.length - 1]!.limit).toBe(120)
  })

  it('the job picker and the source chips narrow the read on the server, All jobs first by count', async () => {
    const { io, asked } = fakeIo(ROWS)
    await draw(io)
    const jobs = await screen.findByTestId('site-photos-jobs')
    expect(within(jobs).getAllByRole('button').map((b) => b.textContent)).toEqual(['All jobs · 5', 'JP629 · 3', 'JP631 · 2'])
    fireEvent.click(within(jobs).getByTestId(`site-photos-job-${J2}`))
    await settle()
    expect(asked[asked.length - 1]!.jobId).toBe(J2)
    expect(screen.getAllByTestId('site-photos-tile')).toHaveLength(2)
    fireEvent.click(screen.getByTestId('site-photos-source-box'))
    await settle()
    expect(asked[asked.length - 1]).toMatchObject({ jobId: J2, source: 'box' })
    expect(screen.getAllByTestId('site-photos-tile')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('site-photos-source-report'))
    await settle()
    fireEvent.click(screen.getByTestId('site-photos-job-all'))
    await settle()
    expect(asked[asked.length - 1]).toMatchObject({ jobId: null, source: 'report' })
    // Nothing matches: the empty words say what to change, no door to the jobs.
    fireEvent.click(screen.getByTestId('site-photos-source-checklist'))
    await settle()
    const empty = await screen.findByTestId('site-photos-empty')
    expect(empty.textContent).toBe('No photo matches. Pick another job or another source.')
  })

  it('a tile opens the viewer on that photo, Next walks the row, Only X’s photos narrows it', async () => {
    const { io } = fakeIo(ROWS)
    await draw(io)
    const tiles = await screen.findAllByTestId('site-photos-tile')
    fireEvent.click(within(tiles[3]!).getByRole('button'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.querySelector('[data-uploaded-photo-open]')?.getAttribute('data-uploaded-photo-open')).toBe('d')
    expect(within(dialog).getByText('4 of 5')).toBeTruthy()
    fireEvent.click(within(dialog).getByText('Next ›'))
    expect(dialog.querySelector('[data-uploaded-photo-open]')?.getAttribute('data-uploaded-photo-open')).toBe('e')
    fireEvent.click(within(dialog).getByText('Only Deon’s photos'))
    await settle()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByTestId('site-photos-tile')).toHaveLength(2)
    const chip = screen.getByTestId('site-photos-person')
    expect(chip.textContent).toContain('Only Deon’s photos')
    fireEvent.click(chip)
    expect(screen.getAllByTestId('site-photos-tile')).toHaveLength(5)
  })

  it('the viewer’s Open the job hands the job to the page', async () => {
    const { io } = fakeIo(ROWS)
    const openJob = vi.fn()
    await draw(io, { openJob })
    const tiles = await screen.findAllByTestId('site-photos-tile')
    fireEvent.click(within(tiles[0]!).getByRole('button'))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByText('Open the job'))
    expect(openJob).toHaveBeenCalledWith(J1)
  })

  it('nothing on the site: the empty state names the site and the Jobs & bids door', async () => {
    const { io } = fakeIo([])
    const goToPieces = vi.fn()
    await draw(io, { goToPieces })
    const empty = await screen.findByTestId('site-photos-empty')
    expect(empty.textContent).toBe('Nothing filed yet on Gray Fox Trail. Jobs & bids lists its jobs. A photo on a report, a box or a checklist on one of them shows here within a minute.')
    fireEvent.click(within(empty).getByText('Jobs & bids'))
    expect(goToPieces).toHaveBeenCalled()
    expect(screen.queryByTestId('site-photos-jobs')).toBeNull()
    expect(screen.queryByTestId('site-photos-sources')).toBeNull()
  })

  it('on a phone the tiles are smaller and the chip rows slide sideways', async () => {
    const { io } = fakeIo(ROWS)
    await draw(io, { phone: true })
    const tiles = await screen.findAllByTestId('site-photos-tile')
    expect((within(tiles[0]!).getByRole('button') as HTMLElement).style.width).toBe('96px')
    expect((screen.getByTestId('site-photos-jobs') as HTMLElement).style.overflowX).toBe('auto')
  })

  it('an estimator: the text and email pictures with no source chips, since the view hands an estimator nothing else', async () => {
    const texts = [row({ id: 't1', taken_at: iso(0, 12), source: 'message', channel: 'text', direction: 'in', job_id: null, bid_id: 'b1', report_id: null, by_name: 'Greg Paulk', caption: 'IMG_2231.jpg' })]
    const { io } = fakeIo(texts)
    await draw(io, { door: 'overview', role: 'estimator' })
    expect(await screen.findAllByTestId('site-photos-tile')).toHaveLength(1)
    expect(screen.queryByTestId('site-photos-sources')).toBeNull()
  })

  it('an estimator with no picture: the words say where the crews’ photos are, and no door to the jobs', async () => {
    const { io } = fakeIo([])
    const goToPieces = vi.fn()
    await draw(io, { door: 'overview', role: 'estimator', goToPieces })
    const empty = await screen.findByTestId('site-photos-empty')
    expect(empty.textContent).toBe('No picture sent by text or email on Gray Fox Trail yet. The crews’ photos on the jobs are for the office.')
    expect(within(empty).queryByRole('button')).toBeNull()
  })
})
