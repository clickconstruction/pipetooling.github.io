import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { planDriveFolderBackfill } from '../jobs/jobDriveFolders'
import { bidFolderName, folderName } from './folderName'
import {
  addPiece,
  APPLIES_FROM_NOW_WORDS,
  bidFolderFacts,
  canSetWhereFilesGo,
  checkPastedWords,
  EVERY_PASTED_OK_WORDS,
  exampleJob,
  FIXED_NAMES_WORDS,
  folderCheckFromAnswer,
  FOLDERS_MADE_WORDS,
  heldLineWords,
  JOB_HAS_NO_FOLDER_WORDS,
  jobFolderFacts,
  LOOKING_UP_WORDS,
  jobLabel,
  makeFoldersWords,
  NO_ROOT_YET_WORDS,
  pastedFolderJobs,
  pickerQuery,
  removePiece,
  ROOT_FROM_ENV_WORDS,
  rootCardWords,
  samePattern,
  trayPieces,
  whereFilesGoFromAnswer,
  type WhereFilesGoJob,
} from './whereFilesGoTab'

const folder = { id: '1AAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Jobs', path: ['PipeTooling Jobs'], owner: null, drive: 'PipeTooling Jobs', folders: 118 }
const answer = {
  success: true,
  app_email: 'drive-intake@example.iam.gserviceaccount.com',
  root: { id: folder.id, url: `https://drive.google.com/drive/folders/${folder.id}`, from: 'env', ok: true, words: 'The app can write here.', folder },
  job_pattern: ['number', 'name'],
  bid_pattern: ['project'],
  folders_made: 'upfront',
  pieces: { job: ['number', 'name', 'customer', 'address', 'year'], bid: ['project', 'number', 'customer', 'address', 'year'] },
}

const job = (over: Partial<WhereFilesGoJob>): WhereFilesGoJob => ({
  id: '7d759246-8476-4a37-884f-ed1562d5663f',
  hcp_number: '972',
  job_name: 'Oak Hollow Bldg C',
  customer_name: 'Oak Hollow HOA',
  job_address: '14 Oak Hollow Dr',
  created_at: '2026-03-04T15:00:00Z',
  google_drive_link: null,
  job_pictures_link: null,
  job_plans_link: null,
  ...over,
})

describe('the settings answer', () => {
  it('reads the root, the patterns and the choice, and falls back on what is missing', () => {
    const s = whereFilesGoFromAnswer(answer)
    expect(s.appEmail).toBe('drive-intake@example.iam.gserviceaccount.com')
    expect(s.root).toMatchObject({ id: folder.id, from: 'env', ok: true, words: 'The app can write here.' })
    expect(s.root?.folder).toEqual(folder)
    expect(s.jobPattern).toEqual(['number', 'name'])
    expect(s.bidPattern).toEqual(['project'])
    expect(s.foldersMade).toBe('upfront')
    expect(whereFilesGoFromAnswer({ ...answer, root: null, job_pattern: ['year', 'name'], folders_made: 'as-needed' })).toMatchObject({ root: null, jobPattern: ['year', 'name'], foldersMade: 'as-needed' })
    expect(whereFilesGoFromAnswer(null)).toMatchObject({ appEmail: '', root: null, jobPattern: ['number', 'name'], bidPattern: ['project'], foldersMade: 'upfront' })
    expect(whereFilesGoFromAnswer({ job_pattern: ['color'] }).jobPattern).toEqual(['number', 'name'])
  })

  it('reads a check’s answer', () => {
    expect(folderCheckFromAnswer({ success: true, ok: false, words: 'The app cannot open this folder. Drive answered 404. Share it with robot@example.com as an editor.', app_email: 'robot@example.com', url: null, folder: null })).toEqual({
      ok: false,
      words: 'The app cannot open this folder. Drive answered 404. Share it with robot@example.com as an editor.',
      appEmail: 'robot@example.com',
      url: null,
      folder: null,
    })
    expect(folderCheckFromAnswer(undefined)).toMatchObject({ ok: false, words: '' })
  })
})

describe('the root card', () => {
  it('names the folder, its path from the top, its Shared Drive and the folders inside, and says when the functions set it', () => {
    const w = rootCardWords(whereFilesGoFromAnswer(answer).root)
    expect(w).toEqual({ name: 'Jobs', path: 'PipeTooling Jobs › Jobs', owner: 'In the Shared Drive PipeTooling Jobs.', count: '118 job folders inside.', from: ROOT_FROM_ENV_WORDS })
  })

  it('names an owner in a My Drive, one folder, a root with no facts and no root at all', () => {
    const mine = { ...folder, path: [], owner: 'Dana Office', drive: null, folders: 1 }
    expect(rootCardWords({ id: folder.id, url: '', from: 'setting', ok: true, words: '', folder: mine })).toEqual({ name: 'Jobs', path: null, owner: 'Owned by Dana Office.', count: '1 job folder inside.', from: null })
    expect(rootCardWords({ id: folder.id, url: '', from: 'setting', ok: false, words: 'x', folder: null })).toEqual({ name: 'The jobs root', path: null, owner: null, count: null, from: null })
    expect(rootCardWords(null)).toEqual({ name: 'The jobs root', path: null, owner: null, count: null, from: NO_ROOT_YET_WORDS })
  })
})

describe('the live example', () => {
  it('reads the job as the function does, the year in the app’s calendar', () => {
    const facts = jobFolderFacts(job({}))
    expect(facts).toEqual({ id: '7d759246-8476-4a37-884f-ed1562d5663f', number: '972', name: 'Oak Hollow Bldg C', customer: 'Oak Hollow HOA', address: '14 Oak Hollow Dr', year: '2026' })
    expect(folderName(['number', 'name'], facts)).toBe('972 · Oak Hollow Bldg C')
    expect(folderName(['year', 'customer'], facts)).toBe('2026 · Oak Hollow HOA')
    // New Year's Eve in Chicago is still the old year, though UTC has turned.
    expect(jobFolderFacts(job({ created_at: '2027-01-01T03:00:00Z' })).year).toBe('2026')
  })

  it('reads a bid the same way', () => {
    const facts = bidFolderFacts({ id: 'b1', project_name: 'Oak Hollow Bldg C', bid_number: '482', customer_name: 'Oak Hollow HOA', address: null, created_at: '2026-02-01T12:00:00Z' })
    expect(bidFolderName(['project'], facts)).toBe('Oak Hollow Bldg C')
    expect(bidFolderName(['number', 'project', 'address', 'year'], facts)).toBe('482 · Oak Hollow Bldg C · 2026')
  })

  it('picks the first job with a number and a name, then one with either, then none', () => {
    const noName = job({ id: 'a', job_name: null })
    const whole = job({ id: 'b' })
    expect(exampleJob([noName, whole])?.id).toBe('b')
    expect(exampleJob([noName])?.id).toBe('a')
    expect(exampleJob([job({ id: 'c', hcp_number: '', job_name: ' ' })])).toBeNull()
    expect(exampleJob([])).toBeNull()
  })

  it('labels a job for the lists under the cards', () => {
    expect(jobLabel(job({}))).toBe('972 · Oak Hollow Bldg C')
    expect(jobLabel(job({ job_name: null }))).toBe('972 · Oak Hollow HOA')
    expect(jobLabel(job({ hcp_number: null, job_name: null, customer_name: null }))).toBe('job 7d759246')
  })
})

describe('editing a pattern', () => {
  it('adds a piece at the end once, removes a piece but never the last, and offers the rest in the tray', () => {
    expect(addPiece(['number', 'name'], 'customer')).toEqual(['number', 'name', 'customer'])
    expect(addPiece(['number', 'name'], 'name')).toEqual(['number', 'name'])
    expect(removePiece(['number', 'name'], 'number')).toEqual(['name'])
    expect(removePiece(['name'], 'name')).toEqual(['name'])
    expect(trayPieces(['number', 'name'], ['number', 'name', 'customer', 'address', 'year'])).toEqual(['customer', 'address', 'year'])
    expect(samePattern(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(samePattern(['a', 'b'], ['b', 'a'])).toBe(false)
  })
})

describe('the presses under the cards', () => {
  it('counts the jobs without a folder in the mock-up’s words, holding a link that is not a folder', () => {
    const jobs = [job({ id: 'a' }), job({ id: 'b' }), job({ id: 'c', google_drive_link: 'https://example.com/not-drive' }), job({ id: 'd', google_drive_link: 'https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA' })]
    const plan = planDriveFolderBackfill(jobs, makeFoldersWords)
    expect(plan.ready.map((j) => j.id)).toEqual(['a', 'b'])
    expect(plan.held.map((h) => h.job.id)).toEqual(['c'])
    expect(plan.words.button).toBe('Make the folders for 2 jobs without one · 1 has a link that is not a folder ▸')
    expect(makeFoldersWords(14, 0).button).toBe('Make the folders for 14 jobs without one')
    expect(makeFoldersWords(1, 0).button).toBe('Make the folders for 1 job without one')
    expect(makeFoldersWords(0, 0)).toMatchObject({ button: 'Make the folders for', dead: true })
    expect(pastedFolderJobs(jobs).map((j) => j.id)).toEqual(['d'])
  })

  it('counts the pasted folders to look at and the jobs held after the look', () => {
    expect(checkPastedWords(41)).toEqual({ button: 'Check 41 pasted folders', dead: false })
    expect(checkPastedWords(1)).toEqual({ button: 'Check 1 pasted folder', dead: false })
    expect(checkPastedWords(0)).toEqual({ button: 'Check pasted folders', dead: true })
    expect(heldLineWords(0)).toBeNull()
    expect(heldLineWords(1)).toBe('Held: 1 job whose pasted folder the app cannot write to')
    expect(heldLineWords(3)).toBe('Held: 3 jobs whose pasted folder the app cannot write to')
  })

  it('sends the picker’s look-up the typed words alone (v2.6073)', () => {
    expect(pickerQuery('  972 ')).toBe('972')
    expect(pickerQuery('Oak  Hollow,(Bldg) C*')).toBe('Oak Hollow Bldg C')
    expect(pickerQuery(' , ')).toBe('')
  })

  it('keeps the office roles and leaves the estimator out', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(canSetWhereFilesGo(r)).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', null]) expect(canSetWhereFilesGo(r)).toBe(false)
  })

  it('keeps every sentence in plain words', () => {
    const sentences = [
      NO_ROOT_YET_WORDS,
      ROOT_FROM_ENV_WORDS,
      APPLIES_FROM_NOW_WORDS,
      FIXED_NAMES_WORDS,
      EVERY_PASTED_OK_WORDS,
      JOB_HAS_NO_FOLDER_WORDS,
      LOOKING_UP_WORDS,
      ...Object.values(FOLDERS_MADE_WORDS),
      rootCardWords(whereFilesGoFromAnswer(answer).root).owner ?? '',
      rootCardWords(whereFilesGoFromAnswer(answer).root).count ?? '',
      makeFoldersWords(3, 1).foot ?? '',
    ]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
  })
})
