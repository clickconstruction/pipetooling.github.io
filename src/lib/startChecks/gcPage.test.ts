import { describe, expect, it } from 'vitest'
import { GC_PAGE_MAX_BULLETS, GC_PAGE_WORDS as W, gcPageAnswerProblem, gcPagePhotoPath, gcPagePhotoPathOk, gcPageStages, parseGcPageAnswer } from './gcPage'
import type { StageLine, StartBulletRow, StartCheckRows, StartDecisionRow, StartMarkRow } from './startCheckRows'

// Every site, person and day here is made up.
const JOB = '11111111-1111-4111-8111-111111111111'
const FX = '22222222-2222-4222-8222-222222222222'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const dayOf = (iso: string) => iso.slice(0, 10)
const line = (over: Partial<StageLine> = {}): StageLine => ({ fixtureId: FX, jobId: JOB, name: 'Top Out', order: 1, finished: false, window: ['2026-12-01', '2026-12-05'], ...over })
let n = 0
const bullet = (bid: string, over: Partial<StartBulletRow> = {}): StartBulletRow => ({ id: bid, job_id: JOB, fixture_id: FX, sort_order: ++n, words: `Bullet ${bid.slice(-2)}.`, waits_on: 'them', wants_photo: false, shown_to_gc: true, by_day: null, reads: null, hand_ok: false, hand_ok_at: null, hand_ok_by_name: '', template_id: null, removed_at: null, created_at: `2026-11-01T00:00:${String(n).padStart(2, '0')}Z`, ...over }) as StartBulletRow
const mark = (bulletId: string, over: Partial<StartMarkRow> = {}): StartMarkRow => ({ id: `m-${bulletId}`, bullet_id: bulletId, job_id: JOB, know: 'word', who_name: 'Ray', how: 'by phone', said_on: '2026-11-14', source: 'office', photo_storage_path: null, photo_file_name: null, taken_back_at: null, created_at: '2026-11-14T15:00:00Z', ...over }) as StartMarkRow
const rows = (over: Partial<StartCheckRows>): StartCheckRows => ({ bullets: [], marks: [], asks: [], theirDays: [], decisions: [], arrivals: [], ...over })
const ON = { sharesStageDates: true, showsWhatWeNeed: true }

describe('what the GC’s page may show', () => {
  const all = rows({
    bullets: [
      bullet(id(1), { words: 'The framing inspection has passed.' }),
      bullet(id(2), { words: 'Framing is done.', wants_photo: true }),
      bullet(id(3), { words: 'Power is on.' }),
      bullet(id(4), { words: 'Hidden from them.', shown_to_gc: false }),
      bullet(id(5), { words: 'Our material lands.', waits_on: 'us', reads: 'hand', shown_to_gc: true }),
    ],
    marks: [mark(id(2)), mark(id(3), { know: 'saw', who_name: 'Luis', how: 'on site' })],
  })

  it('shows nothing with either switch off', () => {
    expect(gcPageStages([line()], all, { sharesStageDates: false, showsWhatWeNeed: true }, dayOf)).toEqual([])
    expect(gcPageStages([line()], all, { sharesStageDates: true, showsWhatWeNeed: false }, dayOf)).toEqual([])
  })

  it('shows the bullets on them with the eye on: still needed, and settled with how we know and no name', () => {
    const [stage] = gcPageStages([line()], all, ON, dayOf)
    expect(stage?.need).toEqual([
      { id: id(1), words: 'The framing inspection has passed.', wantsPhoto: false, waitsOnPhoto: false },
      { id: id(2), words: 'Framing is done.', wantsPhoto: true, waitsOnPhoto: true },
    ])
    expect(stage?.settled).toEqual([{ id: id(3), words: 'Power is on.', how: 'we saw it on site' }])
    // The bar is for what we need from them only: one of three, never a bullet of ours or a hidden one.
    expect(stage?.marks).toEqual([true, false, false])
    expect(stage?.pct).toBe(33)
    expect(JSON.stringify(stage)).not.toMatch(/Luis|Ray|Our material|Hidden/)
  })

  it('leaves out a finished stage and one with nothing to show, in the job’s order', () => {
    const other = '33333333-3333-4333-8333-333333333333'
    const stages = gcPageStages([line({ fixtureId: other, name: 'Trim Set', order: 2 }), line({ finished: true })], rows({ bullets: [bullet(id(1)), bullet(id(6), { fixture_id: other, shown_to_gc: false })] }), ON, dayOf)
    expect(stages).toEqual([])
  })

  it('reads crew confirmed for our first day only after our Go with nothing at all open', () => {
    const go: StartDecisionRow = { id: 'd1', job_id: JOB, fixture_id: FX, kind: 'go', decided_on: '2026-11-20', open_then: [], start_then: '2026-12-01', hold_until: null, by_name: 'Dana', taken_back_at: null, created_at: '2026-11-20T15:00:00Z' } as StartDecisionRow
    const settled = rows({ bullets: [bullet(id(1)), bullet(id(5), { waits_on: 'us', reads: 'hand', hand_ok: true, hand_ok_by_name: 'Dana' })], marks: [mark(id(1))], decisions: [go] })
    expect(gcPageStages([line()], settled, ON, dayOf)[0]).toMatchObject({ crewConfirmedFor: '2026-12-01', need: [], pct: 100 })
    expect(W.confirmed('2026-12-01')).toBe('Crew confirmed for Tue Dec 1.')
    // Something of ours still open: no firm date yet, and the page does not say why.
    const ours = rows({ ...settled, bullets: [bullet(id(1)), bullet(id(5), { waits_on: 'us', reads: 'hand' })] })
    expect(gcPageStages([line()], ours, ON, dayOf)[0]?.crewConfirmedFor).toBeNull()
    expect(gcPageStages([line()], rows({ ...settled, decisions: [] }), ON, dayOf)[0]?.crewConfirmedFor).toBeNull()
  })
})

describe('what the page may send', () => {
  const stage = gcPageStages([line()], rows({ bullets: [bullet(id(1)), bullet(id(2), { wants_photo: true }), bullet(id(3))], marks: [mark(id(3))] }), ON, dayOf)[0]

  it('reads a body and refuses what it cannot read', () => {
    expect(parseGcPageAnswer({ fixtureId: FX, ready: [id(1), id(1)], readyDay: '' })).toEqual({ ok: true, answer: { fixtureId: FX, ready: [id(1)], photos: [], readyDay: null } })
    expect(parseGcPageAnswer({ fixtureId: 'x', ready: [id(1)] }).ok).toBe(false)
    expect(parseGcPageAnswer({ fixtureId: FX, ready: ['nope'] }).ok).toBe(false)
    expect(parseGcPageAnswer({ fixtureId: FX, ready: Array.from({ length: GC_PAGE_MAX_BULLETS + 1 }, (_, i) => id(100 + i)) }).ok).toBe(false)
    expect(parseGcPageAnswer({ fixtureId: FX, readyDay: 'Dec 1' }).ok).toBe(false)
    expect(parseGcPageAnswer({ fixtureId: FX })).toEqual({ ok: false, why: 'Tick what is ready, or give a day.' })
    expect(parseGcPageAnswer({ fixtureId: FX, photos: [{ bulletId: id(2), path: 'p', fileName: '', bytes: 9 * 1024 * 1024 }] }).ok).toBe(false)
  })

  it('holds an answer to what the page shows right now', () => {
    const answer = (over: Partial<{ ready: string[]; readyDay: string | null }>) => ({ fixtureId: FX, ready: [], photos: [], readyDay: null, ...over })
    expect(gcPageAnswerProblem(answer({ ready: [id(1), id(2)] }), stage, '2026-11-20')).toBeNull()
    // Already settled, hidden, of ours or unknown: a stale page cannot tick it.
    expect(gcPageAnswerProblem(answer({ ready: [id(3)] }), stage, '2026-11-20')).toBe('Your page has changed. Please open it again.')
    expect(gcPageAnswerProblem(answer({ ready: [id(9)] }), stage, '2026-11-20')).toBe('Your page has changed. Please open it again.')
    expect(gcPageAnswerProblem(answer({ ready: [id(1)] }), undefined, '2026-11-20')).toMatch(/not on your page any more/)
    expect(gcPageAnswerProblem(answer({ readyDay: '2026-11-19' }), stage, '2026-11-20')).toBe('Please pick today or a day after it.')
    expect(gcPageAnswerProblem(answer({ readyDay: '2026-11-20' }), stage, '2026-11-20')).toBeNull()
    expect(gcPageAnswerProblem(answer({ readyDay: '2029-01-01' }), stage, '2026-11-20')).toBe('Please pick a day within two years.')
  })

  it('keeps a photo under the job’s folder, and takes back only a path it gave for that bullet', () => {
    const path = gcPagePhotoPath(JOB, id(2), 1795000000000)
    expect(path).toBe(`${JOB}/page-${id(2)}-1795000000000.jpg`)
    expect(gcPagePhotoPathOk(path, JOB, id(2))).toBe(true)
    expect(gcPagePhotoPathOk(path, JOB, id(1))).toBe(false)
    expect(gcPagePhotoPathOk(path.replace(JOB, FX), JOB, id(2))).toBe(false)
    expect(gcPagePhotoPathOk(`${JOB}/../x/page-${id(2)}-1795000000000.jpg`, JOB, id(2))).toBe(false)
  })

  it('names the send by its count', () => {
    expect(W.send(1)).toBe('Yes, 1 is ready')
    expect(W.send(3)).toBe('Yes, 3 are ready')
    expect(W.need(2)).toBe('Still needed from you · 2')
  })
})
