/** The giver's photo of the spot from the dev seat (v2.7592): the call's shape, the staged copy's checks, and the app's own writes it mirrors. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TASK_PHOTO_MIME,
  TASK_PHOTO_STAGING_BUCKET,
  TASK_PHOTO_VERBS,
  TASK_SPOT_PHOTO_MAX_BYTES,
  isTaskPhotoVerb,
  stagedPhotoProblem,
  taskPhotoDryRun,
  taskPhotoInput,
  taskPhotoStagePath,
  type TaskPhotoWorld,
} from '../../../supabase/functions/_shared/devMcpTaskPhoto'
import { WRITE_VERBS, isWriteVerb, planVerbFor, stateGuarded, writeRpcBody } from '../../../supabase/functions/_shared/devMcpWrites'
import { TASK_SPOT_PHOTOS_BUCKET, isTaskSpotPhotoPath, taskSpotPhotoPath } from '../tasks/taskSpotPhoto'

const SERVER = readFileSync('supabase/functions/dev-mcp/index.ts', 'utf8')
const README = readFileSync('docs/dev-mcp/README.md', 'utf8')
const PHOTO_IO = readFileSync('src/lib/tasks/taskSpotPhotoIo.ts', 'utf8')
const BUCKET_MIGRATION = readFileSync('supabase/migrations/20261113000000_task_spot_photos.sql', 'utf8')
const STAGING_MIGRATION = readFileSync('supabase/migrations/20261117100000_dev_seat_staging_bucket.sql', 'utf8')

const TASK = '99999999-1111-4111-8111-111111111111'
const DEV = 'ffffffff-1111-4111-8111-111111111111'
const HASH = 'a'.repeat(64)
const SHA = 'b'.repeat(64)
const file = { name: 'spot.jpg', size_bytes: 1200, sha256: SHA }
const worldOf = (over: Partial<TaskPhotoWorld> = {}): TaskPhotoWorld => ({ task: { id: TASK, words: 'ZZ walk the yard' }, owner: { kind: 'item', id: TASK }, table: 'checklist_items', on: 'task', before: null, ...over })
const refusal = (photo: Record<string, unknown>): string => {
  const built = taskPhotoInput('plan_task_photo', { photo })
  if (built.ok) throw new Error('expected a refusal')
  return built.error
}

describe('the photo verbs are on the allowlist with no wrapper RPC', () => {
  it('are two write verbs, plan before apply, named by the server and the README', () => {
    expect(TASK_PHOTO_VERBS).toEqual(['plan_task_photo', 'apply_task_photo'])
    for (const v of TASK_PHOTO_VERBS) {
      expect(isTaskPhotoVerb(v)).toBe(true)
      expect(isWriteVerb(v)).toBe(true)
      expect(WRITE_VERBS[v].rpc).toBeNull()
      expect(SERVER).toContain(`name: '${v}'`)
      expect(SERVER).toContain(`case '${v}':`)
    }
    expect(planVerbFor('apply_task_photo')).toBe('plan_task_photo')
    expect(SERVER).toContain("const SERVER_VERSION = '0.124.0'")
    expect(SERVER).toContain('plan_task_photo → apply_task_photo')
    expect(README).toContain('`plan_task_photo(photo)`')
    // A photo put on, taken off and put on again is a second act: the task's own state refuses a replay, not the call log.
    expect(stateGuarded('apply_task_photo')).toBe(true)
    expect(SERVER.slice(SERVER.indexOf("    case 'plan_task_photo':"), SERVER.indexOf("    case 'plan_activity_note':"))).not.toContain('hooks.priorApply')
  })

  it('writes what the giver\'s press writes: the picture as a JPEG that is never written over, then the path', () => {
    expect(PHOTO_IO).toContain("upload(path, blob, { contentType: 'image/jpeg', upsert: false })")
    expect(PHOTO_IO).toContain('.update({ spot_photo_path: path } as never)')
    expect(TASK_PHOTO_MIME).toBe('image/jpeg')
    expect(SERVER).toContain('const path = taskSpotPhotoPath(world.owner, crypto.randomUUID())')
    expect(SERVER).toContain('const put = await storagePut(session, TASK_SPOT_PHOTOS_BUCKET, path, staged.bytes, TASK_PHOTO_MIME)')
    // The storage helper never writes over a file: x-upsert false, as the window's upsert: false.
    expect(SERVER).toContain("'Content-Type': mime, 'x-upsert': 'false' }")
    // A path that does not save takes the new picture back out, as putTaskSpotPhoto does.
    expect(PHOTO_IO).toContain('void removeTaskSpotPhotoFile(up.path)')
    expect(SERVER).toContain('const back = await stagedRemove(session, path, TASK_SPOT_PHOTOS_BUCKET)')
    // Every removal in the branch is one whose answer is read: the reply never says a file is gone unasked.
    expect(SERVER.slice(SERVER.indexOf("    case 'plan_task_photo':"), SERVER.indexOf("    case 'plan_activity_note':"))).not.toContain('storageRemove(')
    // No verb writes a photo on a day's card: that is the doer's proof of work.
    expect(SERVER).not.toMatch(/restRows\(session, 'POST', 'task_photos'/)
  })

  it('the caps are the buckets\' own', () => {
    expect(BUCKET_MIGRATION).toContain(`'${TASK_SPOT_PHOTOS_BUCKET}', '${TASK_SPOT_PHOTOS_BUCKET}', false, ${TASK_SPOT_PHOTO_MAX_BYTES}`)
    expect(STAGING_MIGRATION).toContain(`'${TASK_PHOTO_STAGING_BUCKET}'`)
    expect(STAGING_MIGRATION).toContain("'image/jpeg'")
    // The staged copy waits in the dev's own folder, where the staging policies hold them.
    expect(taskPhotoStagePath(DEV, file)).toBe(`${DEV}/task-spot-photos/${SHA.slice(0, 32)}.jpg`)
    expect(STAGING_MIGRATION).toContain('(storage.foldername(name))[1] = auth.uid()::text')
  })

  it('the name the picture takes is the app\'s one shape, which the bucket\'s gate reads the task from', () => {
    const path = taskSpotPhotoPath({ kind: 'item', id: TASK }, '0b0b0b0b-1111-4111-8111-111111111111')
    expect(isTaskSpotPhotoPath(path)).toBe(true)
    expect(path).toBe(`item/${TASK}/0b0b0b0b-1111-4111-8111-111111111111.jpg`)
  })
})

describe('taskPhotoInput — the call, shaped', () => {
  it('takes a task and a file, or a task and remove', () => {
    expect(taskPhotoInput('plan_task_photo', { photo: { task: TASK, file: { ...file, sha256: SHA.toUpperCase() } } })).toMatchObject({ ok: true, p: { action: 'put', task: TASK, file } })
    expect(taskPhotoInput('plan_task_photo', { photo: { task: TASK, file, replace: true } })).toMatchObject({ ok: true, p: { replace: true } })
    expect(taskPhotoInput('plan_task_photo', { photo: { task: 'walk the yard', remove: true } })).toMatchObject({ ok: true, p: { action: 'remove', task: 'walk the yard' } })
    expect(refusal({ file })).toContain('task names the task')
    expect(refusal({ task: TASK })).toContain('file is { name, size_bytes, sha256 }')
    expect(refusal({ task: TASK, remove: true, file })).toContain('goes with no file')
    expect(refusal({ task: TASK, file, replace: 'yes' })).toContain('replace is true')
  })

  it('takes a JPEG of 2 MB at most, and says how to make one', () => {
    expect(refusal({ task: TASK, file: { ...file, name: 'spot.png' } })).toContain('sips -Z 1600 -s format jpeg')
    expect(refusal({ task: TASK, file: { ...file, name: 'spot.heic' } })).toContain('must end .jpg')
    expect(refusal({ task: TASK, file: { ...file, size_bytes: TASK_SPOT_PHOTO_MAX_BYTES + 1 } })).toContain('2 MB at most')
    expect(taskPhotoInput('plan_task_photo', { photo: { task: TASK, file: { ...file, name: 'IMG_2291.JPEG', size_bytes: TASK_SPOT_PHOTO_MAX_BYTES } } }).ok).toBe(true)
    expect(refusal({ task: TASK, file: { ...file, size_bytes: 0 } })).toContain('size in bytes')
    expect(refusal({ task: TASK, file: { ...file, sha256: 'abc' } })).toContain('64 hex')
    expect(refusal({ task: TASK, file: { ...file, name: 'photos/spot.jpg' } })).toContain('with no folder')
  })

  it('apply needs the plan\'s hash', () => {
    expect(writeRpcBody('apply_task_photo', { photo: { task: TASK, file } })).toMatchObject({ ok: false })
    expect(writeRpcBody('apply_task_photo', { photo: { task: TASK, file }, plan_hash: HASH })).toMatchObject({ ok: true, rpc: null, step: 'apply', planHash: HASH })
  })
})

describe('the staged copy and the dry run', () => {
  it('a staged file is the planned one by its size and a JPEG by its header', () => {
    const jpg = new Uint8Array(1200)
    jpg.set([0xff, 0xd8, 0xff, 0xe0])
    expect(stagedPhotoProblem(jpg, file)).toBeNull()
    expect(stagedPhotoProblem(jpg.slice(0, 900), file)).toContain('900 bytes; the plan says 1200')
    const png = new Uint8Array(1200)
    png.set([0x89, 0x50, 0x4e, 0x47])
    expect(stagedPhotoProblem(png, file)).toContain('is not a JPEG')
  })

  it('a task carries one photo: a second is refused unless it replaces, and a remove needs one to take off', () => {
    const has = worldOf({ before: `item/${TASK}/p1.jpg` })
    expect(taskPhotoDryRun({ action: 'put', task: TASK, file }, has)).toMatchObject({ ok: false, refused: expect.stringContaining('A task carries one') })
    const over = taskPhotoDryRun({ action: 'put', task: TASK, file, replace: true }, has)
    expect(over.ok && over.reply).toMatchObject({ has_a_photo_now: true, replaces: `item/${TASK}/p1.jpg` })
    expect(taskPhotoDryRun({ action: 'remove', task: TASK }, worldOf())).toMatchObject({ ok: false, refused: expect.stringContaining('no photo of the spot to take off') })
    expect(taskPhotoDryRun({ action: 'remove', task: TASK }, has).ok).toBe(true)
  })

  it('the plan names where the picture lands without the id the write makes, so the hash holds', () => {
    const a = taskPhotoDryRun({ action: 'put', task: TASK, file }, worldOf())
    const b = taskPhotoDryRun({ action: 'put', task: TASK, file }, worldOf())
    expect(a).toEqual(b)
    expect(a.ok && String(a.reply.lands)).toContain(`item/${TASK}/<a new id>.jpg`)
    const roadmap = taskPhotoDryRun({ action: 'put', task: TASK, file }, worldOf({ owner: { kind: 'roadmap', id: 'r-1' }, table: 'checklist_tech_tree_group_tasks', on: 'roadmap task' }))
    expect(roadmap.ok && String(roadmap.reply.lands)).toContain("roadmap/r-1/<a new id>.jpg, and the roadmap task's spot_photo_path")
  })
})
