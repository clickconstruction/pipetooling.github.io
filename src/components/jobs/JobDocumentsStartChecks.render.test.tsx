// @vitest-environment jsdom
/**
 * Render smokes for Before we start on the job window's Documents tab (punch list #382, PR 4), over an io that
 * keeps its rows in memory. A person who is not on the job's desk sees no section. Each stage is a line with its
 * ready bar. An open stage draws the four lines with their values in place, the two lists by standing, a tick that
 * records their word today, a yes whose who, how and day change where they sit, a bullet that asks for a photo, a
 * bullet of ours ticked by hand, the starter, the company's list, and what a role may not change.
 * Every site, person and day here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderSettled, settle } from '../../test/renderSmokeMocks'
import { memoryStart, memoryStartChecksIo, type MemoryStart } from '../../test/startChecksMemoryIo'
import type { StartBulletRow, StartMarkRow } from '../../lib/startChecks/startCheckRows'
import type { ReadsAsked, StartReadersIo } from '../../lib/startChecks/startCheckReadersIo'
import { JobDocumentsStartChecks } from './JobDocumentsStartChecks'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
let authRole = 'assistant'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: authRole, profileName: 'Dana', user: { id: 'u-dana', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})
let far = false
vi.mock('../../hooks/useSiteIsFar', () => ({ useSiteIsFar: () => far }))
vi.mock('../../lib/materials/photoShrink', () => ({ shrinkPhoto: async (file: File) => ({ blob: file, width: 10, height: 10, shrunk: false }) }))

const TODAY = '2026-11-17'
const JOB = { id: 'job-zz-1', hcp_number: 'J2101', customer_name: 'Heron Point LLC', gcName: 'Northgate Builders', bid_id: 'bid-1', development_id: null as string | null }

let n = 0
const at = () => `2026-11-${String(1 + (++n % 27)).padStart(2, '0')}T15:00:00Z`
const bullet = (id: string, o: Partial<StartBulletRow> = {}): StartBulletRow => ({ id, job_id: JOB.id, fixture_id: 'f1', sort_order: n + 1, words: `Bullet ${id}.`, waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: at(), ...o })
const mark = (id: string, bulletId: string, o: Partial<StartMarkRow> = {}): StartMarkRow => ({ id, bullet_id: bulletId, job_id: JOB.id, know: 'word', who_name: 'Ray', how: 'by phone', said_on: '2026-11-14', source: 'office', photo_storage_path: null, photo_file_name: null, taken_back_at: null, created_at: at(), ...o })

const topOut = { fixtureId: 'f1', jobId: JOB.id, name: 'Top Out', order: 1, finished: false, window: ['2026-12-08', '2026-12-12'] as [string, string] }
const trim = { fixtureId: 'f2', jobId: JOB.id, name: 'Trim Set', order: 2, finished: false, window: null }

function seeded(over: Partial<MemoryStart> = {}): MemoryStart {
  return memoryStart({
    lines: [topOut, trim],
    rows: {
      bullets: [
        bullet('framing', { words: 'Framing is done and the roof is dried in.', wants_photo: true }),
        bullet('inspection', { words: 'The framing inspection has passed.', by_day: '2026-11-26' }),
        bullet('power', { words: 'Power is on for our tools.' }),
        bullet('material', { words: 'Our material lands before day one.', waits_on: 'us', reads: 'hand', shown_to_gc: false }),
      ],
      marks: [mark('m-framing', 'framing'), mark('m-power', 'power', { know: 'saw', who_name: 'Luis', how: 'on site', said_on: '2026-11-03' })],
      asks: [{ id: 'k1', batch_id: 'b1', job_id: JOB.id, fixture_id: 'f1', bullet_id: 'inspection', kind: 'ask', how: 'text', to_name: 'Ray', asked_on: '2026-11-14', created_at: '2026-11-14T15:00:00Z' }],
      theirDays: [],
      decisions: [],
      arrivals: [],
    },
    ...over,
  })
}

async function mount(db: MemoryStart, job = JOB, readers?: StartReadersIo) {
  const onRequestTab = vi.fn()
  await renderSettled(<JobDocumentsStartChecks job={job} io={memoryStartChecksIo(db)} readers={readers} todayYmd={TODAY} onRequestTab={onRequestTab} />, { loaded: async () => void (db.onDesk ? await screen.findAllByRole('button', { name: /Top Out|Bill/ }) : await settle()) })
  return { onRequestTab }
}
const openStage = async (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }))
  await settle()
  return document.querySelector(`[data-start-check-card] [data-start-check-stage]`) as HTMLElement
}
const row = (id: string) => document.querySelector(`[data-start-check-bullet="${id}"]`) as HTMLElement
const keep = async (label: string | RegExp, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
  fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep' })).toBeNull())
}

beforeEach(() => {
  authRole = 'assistant'
  far = false
})
afterEach(cleanup)

describe('JobDocumentsStartChecks', () => {
  it('draws no section for a person who is not on the job’s desk', async () => {
    await mount(seeded({ onDesk: false }))
    expect(screen.queryByTestId('job-documents-start-checks')).toBeNull()
  })

  it('a desk check that fails on a lost signal draws the heading with Retry, and Retry asks again and draws the list', async () => {
    const db = seeded({ failDesk: new TypeError('Failed to fetch') })
    await renderSettled(<JobDocumentsStartChecks job={JOB} io={memoryStartChecksIo(db)} todayYmd={TODAY} />, { loaded: () => screen.findByRole('button', { name: 'Retry' }) })
    const section = screen.getByTestId('job-documents-start-checks')
    expect(within(section).getByRole('heading', { name: 'Before we start' })).toBeTruthy()
    expect(within(section).getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Top Out/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: /^Top Out/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('after a desk check that failed, a no on Retry draws no section', async () => {
    const db = seeded({ onDesk: false, failDesk: new TypeError('Failed to fetch') })
    await renderSettled(<JobDocumentsStartChecks job={JOB} io={memoryStartChecksIo(db)} todayYmd={TODAY} />, { loaded: () => screen.findByRole('button', { name: 'Retry' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByTestId('job-documents-start-checks')).toBeNull())
  })

  it('draws each stage as a line with its days and its ready bar', async () => {
    await mount(seeded())
    expect(screen.getByRole('heading', { name: 'Before we start' })).toBeTruthy()
    const cards = Array.from(document.querySelectorAll('[data-start-check-card]')) as HTMLElement[]
    expect(cards.map((c) => c.dataset.startCheckCard)).toEqual(['f1', 'f2'])
    // One of four has a yes that stands: the framing bullet asks for a photo and has only their word.
    expect(within(cards[0] as HTMLElement).getByRole('img', { name: '25% ready, 1 of 4' })).toBeTruthy()
    expect(Array.from((cards[0] as HTMLElement).querySelectorAll('[data-ready-mark]')).map((m) => (m as HTMLElement).dataset.readyMark)).toEqual(['yes', 'open', 'open', 'open'])
    expect((cards[0] as HTMLElement).textContent).toContain('Dec 8 to 12')
    // A stage with no list has no bar, and says what the press does.
    expect((cards[1] as HTMLElement).querySelector('[data-ready-percent]')).toBeNull()
    expect((cards[1] as HTMLElement).textContent).toContain('no days yet')
    expect((cards[1] as HTMLElement).textContent).toContain('Write the list')
  })

  it('says where a job with no stage line gets one', async () => {
    const { onRequestTab } = await mount(seeded({ lines: [] }))
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('No stage lines on this job yet. Bill is the tab that adds one.')
    fireEvent.click(screen.getByRole('button', { name: 'Bill' }))
    expect(onRequestTab).toHaveBeenCalledWith('bill')
  })

  it('opens a stage to four lines, one fact each, with the values in place', async () => {
    await mount(seeded())
    const stage = await openStage('Top Out')
    const lines = stage.querySelector('[data-value-lines]') as HTMLElement
    expect(Array.from(lines.querySelectorAll('.vipLineLabel')).map((l) => l.textContent)).toEqual(['We start', 'Ray says ready', 'Notice we need', 'We decide by'])
    expect(within(lines).getByRole('button', { name: 'Tue Dec 8, our first day, press to change' })).toBeTruthy()
    expect(within(lines).getByRole('button', { name: 'Sat Dec 12, our last day, press to change' })).toBeTruthy()
    expect(within(lines).getByRole('button', { name: 'no day yet, the day they say ready, press to change' })).toBeTruthy()
    // The notice is the default for a near site, so it is bold with the small word and a press that sets this job's own.
    expect(within(lines).getByText('2 days').dataset.value).toBe('worked-out')
    expect(within(lines).getByText('default')).toBeTruthy()
    expect(within(lines).getByRole('button', { name: 'Set this job’s own, days of notice' })).toBeTruthy()
    // We decide by is worked out: our first day less the notice.
    expect(within(lines).getByText('Sun Dec 6').dataset.value).toBe('worked-out')
    expect(lines.textContent).toContain('in 19 days')
    expect(stage.querySelector('[data-values-legend]')).toBeTruthy()
  })

  it('a far site reads ten days of notice by default', async () => {
    far = true
    await mount(seeded())
    const stage = await openStage('Top Out')
    expect(within(stage).getByText('10 days')).toBeTruthy()
    expect(within(stage).getByText('Sat Nov 28')).toBeTruthy()
  })

  it('splits the bullets by standing: still open on top, has a yes below and dulled', async () => {
    await mount(seeded())
    const stage = await openStage('Top Out')
    expect((stage.querySelector('[data-start-check-open]') as HTMLElement).textContent).toBe('Still open · 3')
    const met = stage.querySelector('[data-start-check-met]') as HTMLElement
    expect(met.textContent).toContain('Has a yes · 1')
    expect(met.style.opacity).toBe('0.62')
    expect(Array.from(met.querySelectorAll('[data-start-check-bullet]')).map((r) => (r as HTMLElement).dataset.startCheckBullet)).toEqual(['power'])
    expect(Array.from(stage.querySelectorAll('[data-start-check-bullet]')).map((r) => (r as HTMLElement).dataset.startCheckBullet)).toEqual(['framing', 'inspection', 'material', 'power'])
    expect(row('inspection').textContent).toContain('Asked Nov 14 by text. No answer yet. They say by Nov 26.')
    expect(row('inspection').textContent).toContain('from Ray')
    expect(row('material').textContent).toContain('ours, ticked by hand')
  })

  it('on a phone a bullet’s words keep the width: whose it is and its ⋯ wrap under them as one', async () => {
    await mount(seeded())
    await openStage('Top Out')
    for (const [id, words, tag] of [
      ['material', 'Our material lands before day one.', 'ours, ticked by hand'],
      ['inspection', 'The framing inspection has passed.', 'from Ray'],
    ] as const) {
      const line = row(id).firstElementChild as HTMLElement
      // The row wraps, and the words ask for a width a phone cannot give beside a long tag.
      expect(line.style.display).toBe('flex')
      expect(line.style.flexWrap).toBe('wrap')
      const more = within(row(id)).getByRole('button', { name: `More on: ${words}` })
      const pair = more.parentElement as HTMLElement
      // The ⋯ and the whose-tag share one parent that is neither the row nor its line, so the ⋯ never drops alone.
      expect(pair).not.toBe(line)
      expect(pair).not.toBe(row(id))
      expect(pair.parentElement).toBe(line)
      expect(pair.textContent).toBe(`${tag}⋯`)
      expect(pair.style.display).toBe('flex')
      expect(pair.style.flexWrap).toBe('')
      expect(pair.style.marginLeft).toBe('auto')
      // The tick box is still the line's first piece and the words sit between the two.
      expect((line.firstElementChild as HTMLElement).getAttribute('aria-label')).toBe(words)
      expect((line.children[1] as HTMLElement).textContent).toContain(words)
      expect(line.children[2]).toBe(pair)
    }
    // Their photo's hidden picker stays inside the line.
    expect((row('inspection').firstElementChild as HTMLElement).querySelector(':scope > input[type="file"]')).toBeTruthy()
  })

  it('one tap on a bullet records their word, today, and drops it into the dulled list', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'The framing inspection has passed.' }))
    await waitFor(() => expect(row('inspection').dataset.standing).toBe('yes'))
    expect(db.rows.marks.find((m) => m.bullet_id === 'inspection')).toMatchObject({ know: 'word', who_name: 'Ray', how: 'told us', said_on: TODAY, source: 'office' })
    expect((document.querySelector('[data-start-check-met]') as HTMLElement).contains(row('inspection'))).toBe(true)
    expect(screen.getByRole('img', { name: '50% ready, 2 of 4' })).toBeTruthy()
    // A second tap takes the yes back, and the row keeps it as a row.
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'The framing inspection has passed.' }))
    await waitFor(() => expect(row('inspection').dataset.standing).toBe('open'))
    expect(db.rows.marks.filter((m) => m.bullet_id === 'inspection').map((m) => !!m.taken_back_at)).toEqual([true])
  })

  it('a yes says who, how and the day, each changed where it sits', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    const power = row('power')
    fireEvent.click(within(power).getByRole('button', { name: 'Luis, who said it, press to change' }))
    await keep('who said it', 'Luis Vega')
    fireEvent.click(within(row('power')).getByRole('button', { name: 'Nov 3, the day, press to change' }))
    await keep('the day', '2026-11-05')
    expect(db.rows.marks.find((m) => m.id === 'm-power')).toMatchObject({ who_name: 'Luis Vega', said_on: '2026-11-05', how: 'on site' })
    expect(db.calls.filter((c) => c === 'changeYes')).toHaveLength(2)
    // Escape on a third saves nothing.
    fireEvent.click(within(row('power')).getByRole('button', { name: 'on site, how it reached us, press to change' }))
    fireEvent.change(screen.getByLabelText('how it reached us'), { target: { value: 'by text' } })
    fireEvent.keyDown(screen.getByLabelText('how it reached us'), { key: 'Escape' })
    expect(db.calls.filter((c) => c === 'changeYes')).toHaveLength(2)
  })

  it('a bullet that asks for a photo stays open on their word, and a photo or our own eyes settle it', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    expect(row('framing').dataset.standing).toBe('open')
    expect(row('framing').textContent).toContain('Still needs a photo.')
    // Their photo is a real one: it is picked and kept before the yes says photo.
    const file = new File(['x'], 'roof.jpg', { type: 'image/jpeg' })
    fireEvent.change(within(row('framing')).getByLabelText('Their photo for: Framing is done and the roof is dried in.'), { target: { files: [file] } })
    await waitFor(() => expect(row('framing').dataset.standing).toBe('yes'))
    const live = db.rows.marks.filter((m) => m.bullet_id === 'framing' && !m.taken_back_at)
    expect(live).toHaveLength(1)
    expect(live[0]).toMatchObject({ know: 'photo', who_name: 'Ray', how: 'sent a photo', photo_file_name: 'roof.jpg' })
    expect(live[0]?.photo_storage_path).toBe(`${JOB.id}/${live[0]?.id}-1.jpg`)
    expect(db.rows.marks.find((m) => m.id === 'm-framing')?.taken_back_at).toBeTruthy()
    expect(within(row('framing')).getByRole('button', { name: 'See the photo' })).toBeTruthy()
  })

  it('We saw it settles a photo bullet in the name of the person pressing', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    fireEvent.click(within(row('framing')).getByRole('button', { name: 'We saw it' }))
    await waitFor(() => expect(row('framing').dataset.standing).toBe('yes'))
    expect(db.rows.marks.find((m) => m.bullet_id === 'framing' && !m.taken_back_at)).toMatchObject({ know: 'saw', who_name: 'Dana', how: 'on site' })
  })

  it('a bullet of ours is ticked by nobody but its own press', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    const box = within(row('material')).getByRole('button', { name: 'Our material lands before day one.' }) as HTMLButtonElement
    expect(box.disabled).toBe(true)
    expect(row('material').textContent).toContain('Not marked done yet.')
    fireEvent.click(within(row('material')).getByRole('button', { name: 'Mark it done' }))
    await waitFor(() => expect(row('material').dataset.standing).toBe('yes'))
    expect(row('material').textContent).toContain('Marked done by Dana')
    expect(db.rows.bullets.find((b) => b.id === 'material')?.hand_ok).toBe(true)
  })

  it('a bullet of ours says where it is read from, and one read from the order log shows the fact and its door', async () => {
    const db = seeded()
    const asked: ReadsAsked[] = []
    const readers: StartReadersIo = {
      read: async (a) => {
        asked.push(a)
        return new Map([[JOB.id, { orderLog: { state: 'read' as const, bidId: 'bid-1', lines: [{ stage: 'top_out' as const, orderedOn: '2026-11-10', expectedOn: '2026-12-02', deliveredOn: null }] } }]])
      },
    }
    await mount(db, JOB, readers)
    await openStage('Top Out')
    // Ticked by hand, nothing is read.
    expect(asked).toEqual([])
    fireEvent.click(within(row('material')).getByRole('button', { name: 'ticked by hand, where this is read from, press to change' }))
    await keep('where this is read from', 'order_log')
    await waitFor(() => expect(row('material').textContent).toContain('0 of 1 line on site. The last lands Dec 2, 6 days ahead.'))
    expect(row('material').dataset.standing).toBe('yes')
    expect(db.rows.bullets.find((b) => b.id === 'material')?.reads).toBe('order_log')
    expect(asked[0]).toMatchObject({ orderLog: [JOB.id], trips: [], permits: [], role: 'assistant', todayYmd: TODAY, jobs: [{ id: JOB.id, bidId: 'bid-1' }] })
    expect(within(row('material')).getByRole('link', { name: 'Open the order log' }).getAttribute('href')).toBe('/bids?tab=submittals&bidId=bid-1')
    // No hand tick is offered on a bullet the app reads.
    expect(within(row('material')).queryByRole('button', { name: /Mark it/ })).toBeNull()
  })

  it('a line of the order log whose day to land has gone by reads open, however far ahead of day one it is', async () => {
    // Expected Nov 3, never marked on site. Today is Nov 17 and day one is Dec 8.
    const db = seeded()
    db.rows = { ...db.rows, bullets: db.rows.bullets.map((b) => (b.id === 'material' ? { ...b, reads: 'order_log' as const } : b)) }
    const readers: StartReadersIo = { read: async () => new Map([[JOB.id, { orderLog: { state: 'read' as const, bidId: 'bid-1', lines: [{ stage: 'top_out' as const, orderedOn: '2026-10-20', expectedOn: '2026-11-03', deliveredOn: null }] } }]]) }
    await mount(db, JOB, readers)
    await openStage('Top Out')
    await waitFor(() => expect(row('material').textContent).toContain('1 of 1 line was due Nov 3 and is not on site.'))
    expect(row('material').dataset.standing).toBe('open')
    expect(within(row('material')).getByRole('link', { name: 'Open the order log' }).getAttribute('href')).toBe('/bids?tab=submittals&bidId=bid-1')
  })

  it('a bullet turned to the app drops its hand tick, and one with no reads beside it says the app does not read it', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    fireEvent.click(within(row('material')).getByRole('button', { name: 'Mark it done' }))
    await waitFor(() => expect(row('material').dataset.standing).toBe('yes'))
    fireEvent.click(within(row('material')).getByRole('button', { name: 'ticked by hand, where this is read from, press to change' }))
    await keep('where this is read from', 'trip')
    await waitFor(() => expect(row('material').dataset.standing).toBe('open'))
    expect(db.rows.bullets.find((b) => b.id === 'material')).toMatchObject({ reads: 'trip', hand_ok: false })
    expect(row('material').textContent).toContain('The app does not read this yet.')
  })

  it('the job’s second switch sits in place for the office on a job with a GC, and says what else their page needs', async () => {
    const db = seeded()
    await mount(db, { ...JOB, hasGc: true, sharesStageDates: false } as typeof JOB)
    const lineOf = () => document.querySelector('[data-start-check-gc-page]') as HTMLElement
    expect(lineOf().textContent).toBe('The GC’s page does not show what we need from them before each stage.')
    fireEvent.click(screen.getByRole('button', { name: 'does not show, what the GC’s page shows, press to change' }))
    await keep('what the GC’s page shows', 'on')
    await waitFor(() => expect(lineOf().dataset.startCheckGcPage).toBe('on'))
    expect(db.job?.shows_on_gc_page).toBe(true)
    expect(lineOf().textContent).toContain('It shows nothing until Share stage dates is on, under the GC on the job’s form.')
    // A bullet's eye, on its more press. One on them starts shown.
    await openStage('Top Out')
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'More on: The framing inspection has passed.' }))
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'Shows on the GC’s page' }))
    await waitFor(() => expect(db.rows.bullets.find((b) => b.id === 'inspection')?.shown_to_gc).toBe(false))
    expect(within(row('inspection')).getByRole('button', { name: 'Hidden from the GC’s page' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('offers no switch on a job with no GC, or to a seat outside the office', async () => {
    await mount(seeded())
    expect(document.querySelector('[data-start-check-gc-page]')).toBeNull()
    cleanup()
    authRole = 'superintendent'
    await mount(seeded(), { ...JOB, hasGc: true } as typeof JOB)
    expect(document.querySelector('[data-start-check-gc-page]')).toBeNull()
  })

  it('a No on arrival reads on its row with who said it, and the office is offered it for the company’s list', async () => {
    const db = seeded()
    // Two arrivals: Luis said No on the inspection, and Sam got there later and said No on the power. Each row names
    // its own arrival; the earlier one's line was not drawn when the stage read the newest arrival alone.
    db.rows = {
      ...db.rows,
      // Sam's No took Luis's yes on the power back, as the door does.
      marks: db.rows.marks.map((m) => (m.bullet_id === 'power' ? { ...m, taken_back_at: '2026-11-17T15:00:00Z' } : m)),
      arrivals: [
        { id: 'a1', job_id: JOB.id, fixture_id: 'f1', arrived_on: '2026-11-16', not_as_told: ['inspection'], by_name: 'Luis', created_at: '2026-11-16T15:00:00Z' },
        { id: 'a2', job_id: JOB.id, fixture_id: 'f1', arrived_on: '2026-11-17', not_as_told: ['power'], by_name: 'Sam', created_at: '2026-11-17T15:00:00Z' },
      ],
    }
    await mount(db)
    await openStage('Top Out')
    expect(row('inspection').textContent).toContain('Luis said No on site, Nov 16. It was not as told.')
    expect(row('power').textContent).toContain('Sam said No on site, Nov 17. It was not as told.')
    // Values in place: who said it and the day are values the app works out, drawn apart from the words.
    expect(Array.from(row('inspection').querySelectorAll('[data-value="worked-out"][data-tone="red"]')).map((v) => v.textContent)).toEqual(['Luis', 'Nov 16'])
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'Add to the company’s list for Top Out' }))
    await waitFor(() => expect(db.templates.map((t) => `${t.stage_kind}: ${t.words}`)).toEqual(['top_out: The framing inspection has passed.']))
    // Once it is on the list it is not offered again.
    await waitFor(() => expect(within(row('inspection')).queryByRole('button', { name: 'Add to the company’s list for Top Out' })).toBeNull())
  })

  it('the row’s more press asks for a photo, takes a bullet off, and keeps the day they promised', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'More on: The framing inspection has passed.' }))
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'Ask for a photo' }))
    await waitFor(() => expect(db.rows.bullets.find((b) => b.id === 'inspection')?.wants_photo).toBe(true))
    expect(row('inspection').textContent).toContain('A photo is asked for.')
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'Nov 26, the day they say it will be true, press to change' }))
    await keep('the day they say it will be true', '2026-11-30')
    expect(db.rows.bullets.find((b) => b.id === 'inspection')?.by_day).toBe('2026-11-30')
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'Take off the list' }))
    await waitFor(() => expect(row('inspection')).toBeNull())
    expect(db.rows.bullets.find((b) => b.id === 'inspection')?.removed_at).toBeTruthy()
    // Nothing reaches the GC before their page is built, so no press here speaks of it.
    expect(document.body.textContent).not.toContain('GC’s page')
  })

  it('adds a bullet in plain words, from them or ours', async () => {
    const db = seeded()
    await mount(db)
    const stage = await openStage('Top Out')
    const box = within(stage).getByLabelText('Add a bullet, in plain words')
    expect((within(stage).getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'Water is on site.' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(db.rows.bullets.some((b) => b.words === 'Water is on site.')).toBe(true))
    expect(db.rows.bullets.find((b) => b.words === 'Water is on site.')).toMatchObject({ waits_on: 'them', shown_to_gc: true, fixture_id: 'f1', reads: null })
    fireEvent.click(within(stage).getByRole('button', { name: 'ours' }))
    fireEvent.change(within(stage).getByLabelText('Add a bullet, in plain words'), { target: { value: 'The lift is booked.' } })
    fireEvent.click(within(stage).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(db.rows.bullets.some((b) => b.words === 'The lift is booked.')).toBe(true))
    expect(db.rows.bullets.find((b) => b.words === 'The lift is booked.')).toMatchObject({ waits_on: 'us', reads: 'hand', shown_to_gc: false, wants_photo: false })
  })

  it('a bullet that did not save keeps its words in the box, and one that saved empties it', async () => {
    const db = seeded()
    await mount(db)
    const stage = await openStage('Top Out')
    const box = () => within(stage).getByLabelText('Add a bullet, in plain words') as HTMLInputElement
    db.failNext = 'The signal dropped.'
    fireEvent.change(box(), { target: { value: 'The gate code works for our truck.' } })
    fireEvent.click(within(stage).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(db.calls.filter((c) => c === 'addBullets').length).toBe(1))
    await waitFor(() => expect((within(stage).getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(false))
    // Nothing was kept, so the words are still there to send again.
    expect(db.rows.bullets.some((b) => b.words === 'The gate code works for our truck.')).toBe(false)
    expect(box().value).toBe('The gate code works for our truck.')
    fireEvent.click(within(stage).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(db.rows.bullets.some((b) => b.words === 'The gate code works for our truck.')).toBe(true))
    await waitFor(() => expect(box().value).toBe(''))
  })

  it('moves our days where they sit, keeping the window’s length, and keeps a new day from them beside the old', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    fireEvent.click(screen.getByRole('button', { name: 'Tue Dec 8, our first day, press to change' }))
    await keep('our first day', '2026-12-10')
    expect(db.lines[0]?.window).toEqual(['2026-12-10', '2026-12-14'])
    fireEvent.click(screen.getByRole('button', { name: 'no day yet, the day they say ready, press to change' }))
    await keep('the day they say ready', '2026-12-05')
    fireEvent.click(screen.getByRole('button', { name: 'Sat Dec 5, the day they say ready, press to change' }))
    await keep('the day they say ready', '2026-12-12')
    expect(db.rows.theirDays.map((d) => `${d.ready_day} ${d.who_name} ${d.said_on}`)).toEqual(['2026-12-05 Ray 2026-11-17', '2026-12-12 Ray 2026-11-17'])
    // Their day is now after ours: the line says by how much and how far it has moved, and one press moves our start.
    const lines = document.querySelector('[data-value-lines]') as HTMLElement
    expect(lines.textContent).toContain('2 days after our start')
    expect(lines.textContent).toContain('first said Dec 5, so it has moved 7 days')
    fireEvent.click(screen.getByRole('button', { name: 'Move our start to Tue Dec 15, three days after theirs' }))
    await waitFor(() => expect(db.lines[0]?.window).toEqual(['2026-12-15', '2026-12-19']))
  })

  it('sets this job’s own days of notice, holds a number out of range, and puts the default back', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    fireEvent.click(screen.getByRole('button', { name: 'Set this job’s own, days of notice' }))
    fireEvent.change(screen.getByLabelText('days of notice'), { target: { value: '61' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect(screen.getByRole('alert').textContent).toBe('Type 60 or less.')
    await keep('days of notice', '5')
    expect(db.job?.notice_days).toBe(5)
    fireEvent.click(screen.getByRole('button', { name: '5 days, days of notice, press to change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to the default, 2 days' }))
    await waitFor(() => expect(db.job?.notice_days).toBeNull())
    expect(screen.getByText('default')).toBeTruthy()
  })

  it('a job on a site keeps its notice on the site’s row', async () => {
    const db = seeded()
    await mount(db, { ...JOB, development_id: 'dev-1' })
    await openStage('Top Out')
    fireEvent.click(screen.getByRole('button', { name: 'Set this site’s own, days of notice' }))
    await keep('days of notice', '7')
    expect(db.site).toMatchObject({ development_id: 'dev-1', notice_days: 7 })
    expect(db.job).toBeNull()
  })

  it('a stage with no list is offered the four, once, or a list of the office’s own', async () => {
    const db = seeded()
    await mount(db)
    fireEvent.click(screen.getByRole('button', { name: /^Trim Set/ }))
    await settle()
    const starter = document.querySelector('[data-start-check-starter]') as HTMLElement
    expect(starter.textContent).toContain('No list yet for Trim Set. Start from four common bullets, then change them.')
    expect(starter.querySelectorAll('li')).toHaveLength(4)
    fireEvent.click(within(starter).getByRole('button', { name: 'Write my own' }))
    expect(within(starter).getByLabelText('Add a bullet, in plain words')).toBeTruthy()
    fireEvent.click(within(starter).getByRole('button', { name: 'Use the four' }))
    await waitFor(() => expect(db.rows.bullets.filter((b) => b.fixture_id === 'f2')).toHaveLength(4))
    expect(db.rows.bullets.filter((b) => b.fixture_id === 'f2').map((b) => `${b.waits_on}${b.wants_photo ? ' photo' : ''}${b.reads ? ` ${b.reads}` : ''}`)).toEqual(['them photo', 'them', 'them', 'us hand'])
    expect(document.querySelector('[data-start-check-starter]')).toBeNull()
    // The stage has no days yet, so the first line offers them and the day to decide waits.
    expect(screen.getByRole('button', { name: 'no day yet, our first day, press to change' })).toBeTruthy()
    expect(document.body.textContent).toContain('after we plan our days')
  })

  it('a press that landed is never called lost: when the read after it fails the list offers Retry, and the four cannot be added twice', async () => {
    const db = seeded()
    const io = memoryStartChecksIo(db)
    // The signal drops between the write and the read after it: the four are kept, and the read never arrives.
    let dropNextRead = false
    const flaky: ReturnType<typeof memoryStartChecksIo> = {
      ...io,
      addBullets: async (...args) => {
        await io.addBullets(...args)
        dropNextRead = true
      },
      readRows: async (jobIds) => {
        if (dropNextRead) {
          dropNextRead = false
          throw new TypeError('Failed to fetch')
        }
        return io.readRows(jobIds)
      },
    }
    await renderSettled(<JobDocumentsStartChecks job={JOB} io={flaky} todayYmd={TODAY} />, { loaded: () => screen.findAllByRole('button', { name: /Top Out/ }) })
    fireEvent.click(screen.getByRole('button', { name: /^Trim Set/ }))
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Use the four' }))
    // The read failed, so the section says so and offers to read again. Nothing says the press failed.
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('No connection, so this could not load. Nothing was lost.')
    expect(document.body.textContent).not.toContain('was not added')
    expect(db.calls).toEqual(['addBullets'])
    // The starter is gone with the list that is out of date, so its press cannot write a second four.
    expect(screen.queryByRole('button', { name: 'Use the four' })).toBeNull()
    expect(document.querySelector('[data-start-check-starter]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(document.querySelectorAll('[data-start-check-stage="f2"] [data-start-check-bullet]')).toHaveLength(4))
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Use the four' })).toBeNull()
    expect(db.rows.bullets.filter((b) => b.fixture_id === 'f2')).toHaveLength(4)
    expect(db.calls).toEqual(['addBullets'])
  })

  it('offers the company’s list for the stage’s kind, and the office adds to it and takes off it', async () => {
    const db = seeded({ templates: [{ id: 't1', stage_kind: 'trim_set', sort_order: 1, words: 'The rooms are painted.', waits_on: 'them', wants_photo: true, reads: null, retired_at: null }] })
    await mount(db)
    fireEvent.click(screen.getByRole('button', { name: /^Trim Set/ }))
    await settle()
    const starter = document.querySelector('[data-start-check-starter]') as HTMLElement
    expect(starter.textContent).toContain('Start from the company’s list for Trim Set, then change it.')
    expect(within(starter).getByRole('button', { name: 'Use the company’s one' })).toBeTruthy()
    fireEvent.click(within(starter).getByRole('button', { name: 'Take off the company’s list' }))
    await waitFor(() => expect(db.templates[0]?.retired_at).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use the four' })).toBeTruthy())
    // A bullet on a Top Out stage joins the company's Top Out list from its more press.
    fireEvent.click(screen.getByRole('button', { name: /^Top Out/ }))
    await settle()
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'More on: The framing inspection has passed.' }))
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'Add to the company’s list for Top Out' }))
    await waitFor(() => expect(db.templates.find((t) => t.stage_kind === 'top_out')).toMatchObject({ words: 'The framing inspection has passed.', waits_on: 'them' }))
  })

  it('a superintendent reads our days and the site’s notice without a press, and is offered no company list', async () => {
    authRole = 'superintendent'
    const db = seeded()
    await mount(db, { ...JOB, development_id: 'dev-1' })
    await openStage('Top Out')
    const lines = document.querySelector('[data-value-lines]') as HTMLElement
    expect(within(lines).queryByRole('button', { name: /our first day/ })).toBeNull()
    expect(within(lines).getByText('Tue Dec 8').dataset.value).toBe('locked')
    expect(within(lines).getAllByText('office only').length).toBeGreaterThan(0)
    expect(within(lines).queryByRole('button', { name: /days of notice/ })).toBeNull()
    // The list itself is theirs to write.
    expect(within(lines).getByRole('button', { name: 'no day yet, the day they say ready, press to change' })).toBeTruthy()
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'More on: The framing inspection has passed.' }))
    expect(within(row('inspection')).queryByRole('button', { name: /company’s list/ })).toBeNull()
  })

  it('an open stage offers Ask for what is open on them, tied to the job and its customer’s thread', async () => {
    const db = seeded()
    await mount(db, { ...JOB, job_name: 'Lodge plumbing', askCustomerId: 'cust-9' } as typeof JOB)
    const stage = await openStage('Top Out')
    // Two are open on them: the inspection, and the framing bullet that still needs its photo.
    fireEvent.click(within(stage).getByRole('button', { name: 'Ask Ray about 2' }))
    const panel = document.querySelector('[data-start-check-ask]') as HTMLElement
    expect((within(panel).getByLabelText('The ask') as HTMLTextAreaElement).value).toContain('1. Framing is done and the roof is dried in. A photo would settle it.')
    fireEvent.click(within(panel).getByRole('button', { name: 'I emailed it' }))
    await waitFor(() => expect(db.rows.asks.filter((a) => a.how === 'email').map((a) => a.bullet_id).sort()).toEqual(['framing', 'inspection']))
    await waitFor(() => expect(row('inspection').textContent).toContain('by email. No answer yet.'))
  })

  it('the job’s superintendent may press Go, and a primary on the desk is offered no decision', async () => {
    authRole = 'superintendent'
    const db = seeded({ decider: 'Sam' })
    await mount(db)
    const stage = await openStage('Top Out')
    fireEvent.click(within(stage).getByRole('button', { name: 'Go or hold' }))
    fireEvent.click(within(stage).getByRole('button', { name: 'Go, on their promise' }))
    await waitFor(() => expect(db.rows.decisions[0]).toMatchObject({ kind: 'go', by_name: 'Sam' }))
    await waitFor(() => expect((document.querySelector('[data-start-check-decision="go"]') as HTMLElement).textContent).toBe('Go. Sam, Nov 17.'))
    cleanup()
    authRole = 'primary'
    await mount(seeded())
    const again = await openStage('Top Out')
    expect(within(again).queryByRole('button', { name: 'Go or hold' })).toBeNull()
    expect(within(again).getByRole('button', { name: 'Ask Ray about 2' })).toBeTruthy()
  })

  it('a press that fails says why, and the row stands as it was', async () => {
    const db = seeded()
    await mount(db)
    await openStage('Top Out')
    db.failNext = 'The job is shut until its papers are signed.'
    fireEvent.click(within(row('inspection')).getByRole('button', { name: 'The framing inspection has passed.' }))
    expect(await screen.findByText(/The yes was not kept\. .*The job is shut until its papers are signed\./)).toBeTruthy()
    expect(row('inspection').dataset.standing).toBe('open')
    // A value that fails to save says so under its own field, with what was typed still in it.
    db.failNext = 'Our days could not be moved.'
    fireEvent.click(screen.getByRole('button', { name: 'Tue Dec 8, our first day, press to change' }))
    fireEvent.change(screen.getByLabelText('our first day'), { target: { value: '2026-12-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Our days could not be moved.')
    expect((screen.getByLabelText('our first day') as HTMLInputElement).value).toBe('2026-12-10')
  })
})
