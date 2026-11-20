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
      asks: [{ id: 'k1', batch_id: 'b1', job_id: JOB.id, fixture_id: 'f1', bullet_id: 'inspection', kind: 'ask', how: 'text', to_name: 'Ray', asked_on: '2026-11-14', created_at: at() }],
      theirDays: [],
      decisions: [],
      arrivals: [],
    },
    ...over,
  })
}

async function mount(db: MemoryStart, job = JOB) {
  const onRequestTab = vi.fn()
  await renderSettled(<JobDocumentsStartChecks job={job} io={memoryStartChecksIo(db)} todayYmd={TODAY} onRequestTab={onRequestTab} />, { loaded: async () => void (db.onDesk ? await screen.findAllByRole('button', { name: /Top Out|Bill/ }) : await settle()) })
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
