/**
 * Box photos: the Drive files follow a job that moved (punch list #297, v2.6885). A box photo's row moves with its box
 * when a job's Materials on site move to another job, but the file the sweep already filed stayed in the first job's
 * photo folder. `photo-save` takes one ask from a dev, `{ refile_box_photos: <job> }`, and the dev seat makes it after
 * `apply_materials_move`. The kernel holds the ask, what one file needs, the reply's words and the seat's half; the
 * function and the server are read as text for the wiring. Made-up jobs and names only.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  NO_REFILE_NEEDED,
  REFILE_HELD_RETRY_WORDS,
  REFILE_RETRY_MS,
  REFILE_SWEEP_BATCH,
  REFILE_SWEEP_FINISHES_WORDS,
  REFILE_ASK_ROLES,
  REFILE_GONE_WORDS,
  REFILE_TRASHED_WORDS,
  dueRowsByJob,
  mayAskRefile,
  movePhotoWordsWithRefile,
  moveReplyWithRefileWords,
  movedPhotosInDrive,
  nextFreeName,
  refileAskOf,
  refileResult,
  refileRowNeedsClearing,
  refileRowPatch,
  refileStep,
  refiledForSeat,
  type RefileHeld,
  type RefileMoved,
} from '../../../supabase/functions/_shared/boxPhotoRefile'

const FUNCTION = readFileSync('supabase/functions/photo-save/index.ts', 'utf8')
const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const MOVE_SQL = readFileSync('supabase/migrations/20261109160000_on_site_move_job.sql', 'utf8')
const MIGRATION = readFileSync('supabase/migrations/20261111024500_box_photo_refile_due.sql', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const EDGE = readFileSync('docs/EDGE_FUNCTIONS.md', 'utf8')
const MAP = readFileSync('docs/MATERIALS_ON_SITE_ARCHITECTURE.md', 'utf8')

const JOB = '00000000-0000-4000-8000-0000000509a2'
const FOLDER = 'folderB'
const moved = (n: number, over: Partial<RefileMoved> = {}): RefileMoved => ({ id: `p${n}`, file_name: `2026-11-0${n} Jordan · A${n} after Count.jpg`, drive_file_id: `d${n}`, ...over })

describe('the ask', () => {
  it('is null for the sweep’s call, the job for a re-file, and a refusal for anything that is not a job id', () => {
    expect(refileAskOf(null)).toBeNull()
    expect(refileAskOf({})).toBeNull()
    expect(refileAskOf('refile_box_photos')).toBeNull()
    expect(refileAskOf([{ refile_box_photos: JOB }])).toBeNull()
    expect(refileAskOf({ refile_box_photos: ` ${JOB.toUpperCase()} ` })).toEqual({ ok: true, jobId: JOB })
    for (const bad of ['', 'JQ902', 42, null, true]) expect(refileAskOf({ refile_box_photos: bad })).toEqual({ ok: false, error: 'refile_box_photos is the job whose box photos to move into its photo folder: a jobs_ledger id.' })
  })
})

describe('what one file needs', () => {
  const names = new Set(['2026-11-01 Jordan · A1 after Count.jpg'])

  it('nothing when it is already in the job’s photo folder', () => {
    expect(refileStep({ name: 'a.jpg', parents: ['other', FOLDER], trashed: false }, FOLDER, names)).toEqual({ kind: 'already' })
  })

  it('a move out of every folder it sits in, under its own name when the folder does not hold it', () => {
    expect(refileStep({ name: 'B2 after Count.jpg', parents: ['folderA'], trashed: false }, FOLDER, names)).toEqual({ kind: 'move', removeParents: ['folderA'], name: 'B2 after Count.jpg', renamed: false })
  })

  it('the next free name when the folder holds its own, any case', () => {
    expect(refileStep({ name: '2026-11-01 JORDAN · A1 after Count.jpg', parents: ['folderA'], trashed: false }, FOLDER, names)).toEqual({
      kind: 'move',
      removeParents: ['folderA'],
      name: '2026-11-01 JORDAN · A1 after Count (2).jpg',
      renamed: true,
    })
    expect(nextFreeName('a.jpg', new Set(['a.jpg', 'A (2).jpg']))).toBe('a (3).jpg')
    expect(nextFreeName('no extension', new Set(['no extension']))).toBe('no extension (2)')
  })

  it('a hold, with its reason, for a file Drive no longer holds or one in its trash', () => {
    expect(refileStep(null, FOLDER, names)).toEqual({ kind: 'held', why: REFILE_GONE_WORDS })
    expect(refileStep({ name: 'a.jpg', parents: ['folderA'], trashed: true }, FOLDER, names)).toEqual({ kind: 'held', why: REFILE_TRASHED_WORDS })
    // The trash wins over the folder: a trashed file in the right folder is still not where the office can see it.
    expect(refileStep({ name: 'a.jpg', parents: [FOLDER], trashed: true }, FOLDER, names)).toEqual({ kind: 'held', why: REFILE_TRASHED_WORDS })
  })
})

describe('the reply', () => {
  const result = (over: { moved?: RefileMoved[]; already?: number; held?: RefileHeld[]; left?: number; inDrive?: number; folderId?: string | null }) =>
    refileResult({ jobId: JOB, folderId: FOLDER, inDrive: 0, moved: [], already: 0, held: [], left: 0, ...over })

  it('carries the job, the folder and the counts', () => {
    expect(result({ inDrive: 3, moved: [moved(1), moved(2)], already: 1 })).toEqual({
      job_id: JOB,
      folder_id: FOLDER,
      folder_url: 'https://drive.google.com/drive/folders/folderB',
      in_drive: 3,
      moved: [moved(1), moved(2)],
      already: 1,
      held: [],
      left: 0,
      words: 'Moved 2 box photos into this job’s photo folder. 1 was already there.',
    })
  })

  it('says there was nothing to move when no photo is filed', () => {
    expect(result({ folderId: null }).words).toBe('This job has no box photo filed in Drive, so there is nothing to move. A photo still waiting is filed for this job by the sweep.')
    expect(result({ folderId: null }).folder_url).toBeNull()
  })

  it('a second ask moves nothing and says every file is already there', () => {
    expect(result({ inDrive: 3, already: 3 }).words).toBe('All 3 box photos in Drive are already in this job’s photo folder. Nothing moved.')
    expect(result({ inDrive: 1, already: 1 }).words).toBe('The 1 box photo in Drive is already in this job’s photo folder. Nothing moved.')
  })

  it('does what is ready: the held ones are named with their reasons and the rest move', () => {
    const held: RefileHeld[] = [{ id: 'p3', file_name: 'A3 after Count.jpg', why: REFILE_TRASHED_WORDS }]
    expect(result({ inDrive: 3, moved: [moved(1), moved(2, { renamed_to: 'A2 after Count (2).jpg' })], held }).words).toBe(
      'Moved 2 box photos into this job’s photo folder. 1 takes a numbered name, since the folder holds its own. 1 was held: A3 after Count.jpg (That file is in Drive’s trash. Restore it there, then ask again.).',
    )
    expect(result({ inDrive: 2, held: [held[0]!, { id: 'p4', file_name: 'B1.jpg', why: REFILE_GONE_WORDS }] }).words).toBe(
      'Nothing moved. 2 were held: A3 after Count.jpg (That file is in Drive’s trash. Restore it there, then ask again.); B1.jpg (Drive no longer holds that file.).',
    )
  })

  it('says how many were not reached when the ask’s time ran out', () => {
    expect(result({ inDrive: 300, moved: [moved(1)], already: 249, left: 50 }).words).toBe(
      'Moved 1 box photo into this job’s photo folder. 249 were already there. 50 were not reached in this ask’s time. The photo sweep moves the rest by itself within a few minutes, or ask again.',
    )
  })
})

describe('the dev seat’s half', () => {
  // The sentence the database writes, built as the migration builds it, so a change there fails here.
  const sql = (inDrive: number, waiting: number) =>
    'Every photo\'s row moves with its box.' +
    (inDrive > 0
      ? ` ${inDrive}${inDrive === 1 ? ' file is' : ' files are'} already in Drive and ${inDrive === 1 ? 'stays' : 'stay'} in JQ901's photo folder: each row keeps its own Drive id, so a photo that showed on its box still does, but JQ902's Drive folder will not list ${inDrive === 1 ? 'it' : 'them'}.`
      : '') +
    (waiting > 0 ? ` ${waiting}${waiting === 1 ? ' is' : ' are'} still waiting for the photo sweep, which files by the row's job: into JQ902's photo folder.` : '')

  it('the migration still writes the sentence the seat rewrites', () => {
    for (const piece of [
      "' already in Drive and '",
      "'''s photo folder: each row keeps its own Drive id, so a photo that showed on its box still does, but '",
      "'''s Drive folder will not list '",
      "'Every photo''s row moves with its box.'",
    ])
      expect(MOVE_SQL).toContain(piece)
  })

  it('the photo words say the apply moves a file already in Drive', () => {
    expect(movePhotoWordsWithRefile(sql(2, 1), 2)).toBe(
      "Every photo's row moves with its box. 2 files are already in Drive in JQ901's photo folder: the apply then moves them into JQ902's photo folder, and each keeps its own Drive id, so a photo that showed on its box still does. 1 is still waiting for the photo sweep, which files by the row's job: into JQ902's photo folder.",
    )
    expect(movePhotoWordsWithRefile(sql(1, 0), 1)).toBe(
      "Every photo's row moves with its box. 1 file is already in Drive in JQ901's photo folder: the apply then moves it into JQ902's photo folder, and each keeps its own Drive id, so a photo that showed on its box still does.",
    )
  })

  it('words with no file in Drive are left as they are, and a sentence it does not know keeps its words with the step named after', () => {
    expect(movePhotoWordsWithRefile(sql(0, 2), 0)).toBe(sql(0, 2))
    expect(movePhotoWordsWithRefile('No photos to move.', 0)).toBe('No photos to move.')
    expect(movePhotoWordsWithRefile('Three files sit in Drive.', 3)).toBe('Three files sit in Drive. The apply then asks the photo sweep to move the files already in Drive into the new job’s photo folder.')
  })

  it('rewrites the words inside the move’s reply and leaves any other reply alone', () => {
    const reply = { moved: { photos: 3 }, photos: { rows: 3, in_drive: 2, waiting: 1, words: sql(2, 1) } }
    const out = moveReplyWithRefileWords(reply) as typeof reply
    expect(out.photos.words).toContain('the apply then moves them into JQ902\'s photo folder')
    expect(out.photos.in_drive).toBe(2)
    expect(out.moved).toEqual({ photos: 3 })
    expect(moveReplyWithRefileWords({ refused: 'the source holds nothing' })).toEqual({ refused: 'the source holds nothing' })
    expect(moveReplyWithRefileWords(null)).toBeNull()
    expect(movedPhotosInDrive(reply)).toBe(2)
    expect(movedPhotosInDrive({ photos: { in_drive: 0 } })).toBe(0)
    expect(movedPhotosInDrive({})).toBe(0)
  })

  it('photo-save’s answer rides in the reply as photos.refiled', () => {
    const body = refileResult({ jobId: JOB, folderId: FOLDER, inDrive: 2, moved: [moved(1), moved(2)], already: 0, held: [], left: 0 })
    expect(refiledForSeat(JOB, { ok: true, status: 200, body })).toEqual({
      asked: true,
      ok: true,
      moved: 2,
      already: 0,
      held: [],
      left: 0,
      folder_url: 'https://drive.google.com/drive/folders/folderB',
      words: 'Moved 2 box photos into this job’s photo folder.',
    })
    expect(NO_REFILE_NEEDED).toMatchObject({ asked: false, ok: true })
  })

  it('a held photo or one not reached says what follows by itself', () => {
    const held: RefileHeld[] = [{ id: 'p2', file_name: 'A2.jpg', why: REFILE_TRASHED_WORDS }]
    const out = refiledForSeat(JOB, { ok: true, status: 200, body: refileResult({ jobId: JOB, folderId: FOLDER, inDrive: 2, moved: [moved(1)], already: 0, held, left: 0 }) })
    expect(out).toMatchObject({ asked: true, ok: false, moved: 1, held })
    expect(out.next).toBe(`The move stands and every photo still opens from its box. ${REFILE_HELD_RETRY_WORDS}`)
    const left = refiledForSeat(JOB, { ok: true, status: 200, body: refileResult({ jobId: JOB, folderId: FOLDER, inDrive: 90, moved: [moved(1)], already: 0, held: [], left: 89 }) })
    expect(left.next).toBe(`The move stands and every photo still opens from its box. ${REFILE_SWEEP_FINISHES_WORDS}`)
    const both = refiledForSeat(JOB, { ok: true, status: 200, body: refileResult({ jobId: JOB, folderId: FOLDER, inDrive: 90, moved: [], already: 0, held, left: 89 }) })
    expect(both.next).toBe(`The move stands and every photo still opens from its box. ${REFILE_SWEEP_FINISHES_WORDS} ${REFILE_HELD_RETRY_WORDS}`)
  })

  it('a failed ask never undoes the move, and the sweep finishes it: nobody has to ask again', () => {
    expect(refiledForSeat(JOB, { ok: false, status: 403, body: { error: 'Only a dev moves a job’s box photos to its folder.' } })).toEqual({
      asked: true,
      ok: false,
      why: 'Only a dev moves a job’s box photos to its folder.',
      next: 'The move stands and every photo still opens from its box. The ask to move the photos’ files did not finish: Only a dev moves a job’s box photos to its folder. Each photo that did not move is marked due, and the photo sweep moves what is due by itself within a few minutes.',
    })
    expect(refiledForSeat(JOB, { ok: false, status: 0, body: { error: 'photo-save could not be reached: timed out' } }).why).toBe('photo-save could not be reached: timed out')
    // An older photo-save answers the sweep's reply to a body it does not know: no words, so it reads as a failed ask.
    expect(refiledForSeat(JOB, { ok: true, status: 200, body: { ticks: 0, saved: 0 } })).toMatchObject({ asked: true, ok: false, why: 'photo-save answered 200' })
  })
})

describe('the engine: marked by the database, moved by the sweep (v2.6915)', () => {
  const now = new Date('2026-11-11T15:00:00.000Z')

  it('a file that is where it belongs carries no mark and no reason', () => {
    expect(refileRowPatch({ settled: true }, now)).toEqual({ refile_due_at: null, fail_why: null })
  })

  it('a held file keeps its reason and is due again a day on', () => {
    expect(REFILE_RETRY_MS).toBe(24 * 60 * 60 * 1000)
    expect(refileRowPatch({ held: REFILE_TRASHED_WORDS }, now)).toEqual({ refile_due_at: '2026-11-12T15:00:00.000Z', fail_why: REFILE_TRASHED_WORDS })
    expect(refileRowPatch({ held: 'x'.repeat(400) }, now).fail_why).toHaveLength(300)
  })

  it('a settled row is written only when it has something to clear', () => {
    expect(refileRowNeedsClearing({ refile_due_at: null, fail_why: null })).toBe(false)
    expect(refileRowNeedsClearing({})).toBe(false)
    expect(refileRowNeedsClearing({ refile_due_at: '2026-11-11T15:00:00.000Z', fail_why: null })).toBe(true)
    expect(refileRowNeedsClearing({ refile_due_at: null, fail_why: REFILE_TRASHED_WORDS })).toBe(true)
  })

  it('the sweep’s due rows are grouped by job in the order they came, so each folder is read once', () => {
    const rows = [
      { id: 'p1', job_id: 'B' },
      { id: 'p2', job_id: 'A' },
      { id: 'p3', job_id: 'B' },
    ]
    expect([...dueRowsByJob(rows)].map(([job, list]) => [job, list.map((r) => r.id)])).toEqual([
      ['B', ['p1', 'p3']],
      ['A', ['p2']],
    ])
    expect(REFILE_SWEEP_BATCH).toBe(20)
  })

  it('the migration marks a filed photo whose job changes, and the cron wakes for a photo that is due', () => {
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(MIGRATION).toContain('ALTER TABLE public.job_box_photos ADD COLUMN IF NOT EXISTS refile_due_at timestamptz;')
    expect(MIGRATION).toContain('IF NEW.job_id IS DISTINCT FROM OLD.job_id AND NEW.drive_file_id IS NOT NULL THEN')
    expect(MIGRATION).toContain('CREATE OR REPLACE TRIGGER job_box_photos_job_changed BEFORE UPDATE OF job_id ON public.job_box_photos')
    expect(MIGRATION).toContain('REVOKE ALL ON FUNCTION public.job_box_photo_job_changed() FROM PUBLIC, anon, authenticated;')
    expect(MIGRATION).toContain('OR EXISTS (SELECT 1 FROM public.job_box_photos WHERE refile_due_at IS NOT NULL AND refile_due_at <= now());')
    // Every earlier clause is written again: a re-schedule that dropped one would stop that source.
    for (const table of ['photo_saves', 'report_photos', 'stage_checklist_answers', 'job_photo_notes', 'machine_check_photos', 'stage_checklist_records', 'task_photos', 'counter_ticket_pages', 'bid_photos']) expect(MIGRATION).toContain(`public.${table}`)
  })

  it('the sweep takes the due rows after its other sources, and the ask and the sweep share one mover', () => {
    expect(FUNCTION).toContain('const boxRefiles = await sweepRefileDue(admin)')
    expect(FUNCTION).toContain(".lte('refile_due_at', new Date().toISOString())")
    expect(FUNCTION).toContain('.limit(REFILE_SWEEP_BATCH)')
    expect(FUNCTION).toContain('const t = await refileJobRows(admin, google, jobId, rows, Date.now() + REFILE_BUDGET_MS)')
    expect(FUNCTION).toContain('const t = await refileJobRows(admin, google, jobId, jobRows, null)')
    expect(FUNCTION).toContain("await admin.from('job_box_photos').update(refileRowPatch({ held: why }, new Date())).eq('id', r.id)")
    expect(FUNCTION).toContain("if (refileRowNeedsClearing(r)) await admin.from('job_box_photos').update(refileRowPatch({ settled: true }, new Date())).eq('id', r.id)")
  })
})

describe('the function, the server and the docs', () => {
  it('photo-save takes the ask from the cron or a dev, and the sweep stays the cron’s alone', () => {
    expect(FUNCTION).toContain('const ask = refileAskOf(await req.json().catch(() => null))')
    // v2.6927: the roles that may combine may ask, read from the caller's own users row.
    expect(FUNCTION).toContain("const { data: asker } = await admin.from('users').select('role').eq('id', me.user.id).maybeSingle()")
    expect(FUNCTION).toContain('if (!mayAskRefile((asker as { role: string | null } | null)?.role)) return json({ error: REFILE_ASK_REFUSAL }, 403)')
    expect(REFILE_ASK_ROLES).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    for (const role of REFILE_ASK_ROLES) expect(mayAskRefile(role)).toBe(true)
    for (const role of ['estimator', 'helpers', 'subcontractor', 'primary', '', null, undefined]) expect(mayAskRefile(role)).toBe(false)
    // The combine's own gate names the same four roles: the ask is for whoever may combine.
    expect(MOVE_SQL).toContain("role IN ('dev', 'master_technician', 'assistant', 'controller')")
    expect(FUNCTION).toContain('const archivedRefusal = await refuseArchivedCaller(admin, me?.user?.id, corsHeaders)')
    expect(FUNCTION).toContain("if (!isCron) return json({ error: 'Unauthorized' }, 401)")
    // The ask's branch returns before the sweep: a dev's session never runs it.
    expect(FUNCTION.indexOf('if (ask) {')).toBeLessThan(FUNCTION.indexOf("if (!isCron) return json({ error: 'Unauthorized' }, 401)"))
    expect(FUNCTION.indexOf("if (!isCron) return json({ error: 'Unauthorized' }, 401)")).toBeLessThan(FUNCTION.indexOf('const messages = await sweep(admin)'))
  })

  it('moves by the job’s own photo folder, lists it once, and keeps going past a file that fails', () => {
    expect(FUNCTION).toContain('landing = await photoFolderOrWhy(admin, google, { jobs_ledger_id: jobId })')
    expect(FUNCTION).toContain('inFolder = await folderFiles(google, landing.id)')
    expect(FUNCTION).toContain('const step = refileStep(await driveFileState(google, r.drive_file_id), landing.id, names)')
    expect(FUNCTION).toContain('await moveFile(google, r.drive_file_id, step.removeParents, landing.id, step.renamed ? step.name : undefined)')
    expect(FUNCTION).toContain("await hold(r, driveFailWords(e instanceof Error ? e.message : String(e)))")
    // The sweep names its files by the kernel's rule too.
    expect(FUNCTION).not.toContain('function nextFreeName(')
  })

  it('the seat asks after the move’s rows land, as the dev, and never before', () => {
    expect(SERVER).toMatch(/const SERVER_VERSION = '0\.78\.0'/)
    expect(SERVER).toContain("refiledForSeat(toJob, await invokeAsDev(session, 'photo-save', { refile_box_photos: toJob }))")
    expect(SERVER.indexOf('const res = await restPost(session, rpcPath, writeBody)')).toBeLessThan(SERVER.indexOf("refiledForSeat(toJob, await invokeAsDev(session, 'photo-save'"))
    expect(SERVER).toContain("name === 'plan_materials_move' ? moveReplyWithRefileWords(redactSecrets(res.body)) : redactSecrets(res.body), await planHash(name, built.body.p, res.body)")
  })

  it('the docs carry it', () => {
    expect(README).toContain('`photos.refiled`')
    expect(EDGE).toContain('refile_box_photos')
    expect(MAP).toContain('refile_box_photos')
  })
})
