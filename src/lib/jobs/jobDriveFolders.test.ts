import { describe, expect, it } from 'vitest'
import {
  driveFolderBackfillOutcome,
  driveFolderIdFromUrl,
  driveFoldersMadeWords,
  foldersMadeLater,
  jobDriveFoldersFromAnswer,
  jobDriveLinkState,
  jobDriveLinksPatch,
  NOT_A_FOLDER_WHY,
  planDriveFolderBackfill,
  type JobDriveFolders,
} from './jobDriveFolders'
import { plainWordsFailures } from '../plainWords'

const answer = {
  app_email: 'drive-intake@pipetooling-drive.iam.gserviceaccount.com',
  folder: { url: 'https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA', source: 'made' },
  pictures: { url: 'https://drive.google.com/drive/folders/1BBBBBBBBBBBBBBBBBBBBBBBBBBB', source: 'made', writable: true },
  plans: { url: 'https://drive.google.com/drive/folders/1CCCCCCCCCCCCCCCCCCCCCCCCCCC', source: 'made', writable: true },
  team_url: 'https://drive.google.com/drive/folders/1DDDDDDDDDDDDDDDDDDDDDDDDDDD',
  photos_url: 'https://drive.google.com/drive/folders/1EEEEEEEEEEEEEEEEEEEEEEEEEEE',
  sent_url: 'https://drive.google.com/drive/folders/1FFFFFFFFFFFFFFFFFFFFFFFFFFF',
  stamped: ['google_drive_link', 'job_pictures_link', 'job_plans_link'],
}

describe('driveFolderIdFromUrl / jobDriveLinkState', () => {
  it('reads a folder link, with or without the /u/0/ part, and refuses a file or another site', () => {
    expect(driveFolderIdFromUrl('https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA?usp=sharing')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromUrl('https://drive.google.com/drive/u/0/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromUrl('https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAA/view')).toBeNull()
    expect(driveFolderIdFromUrl('https://www.dropbox.com/sh/abc')).toBeNull()
    expect(driveFolderIdFromUrl(null)).toBeNull()
  })

  it('names the state: none, a folder, or a link that is not one', () => {
    expect(jobDriveLinkState(null)).toBe('none')
    expect(jobDriveLinkState('   ')).toBe('none')
    expect(jobDriveLinkState('https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe('folder')
    expect(jobDriveLinkState('https://photos.app.goo.gl/abc')).toBe('not_a_folder')
  })
})

describe('jobDriveFoldersFromAnswer / jobDriveLinksPatch', () => {
  it('reads the function’s answer and the patch for the job row', () => {
    const r = jobDriveFoldersFromAnswer(answer)
    expect(r.appEmail).toBe(answer.app_email)
    expect(r.folder).toEqual({ url: answer.folder.url, source: 'made', writable: true })
    expect(r.pictures.writable).toBe(true)
    expect(r.stamped).toEqual(['google_drive_link', 'job_pictures_link', 'job_plans_link'])
    expect(jobDriveLinksPatch(r)).toEqual({ google_drive_link: answer.folder.url, job_pictures_link: answer.pictures.url, job_plans_link: answer.plans.url })
  })

  it('patches only what the press wrote: a kept pictures link stays the job’s', () => {
    const r = jobDriveFoldersFromAnswer({ ...answer, pictures: { url: 'https://drive.google.com/drive/folders/1KKKKKKKKKKKKKKKKKKKKKKKKKKK', source: 'kept', writable: false }, stamped: ['google_drive_link', 'job_plans_link'] })
    expect(r.pictures).toEqual({ url: 'https://drive.google.com/drive/folders/1KKKKKKKKKKKKKKKKKKKKKKKKKKK', source: 'kept', writable: false })
    expect(jobDriveLinksPatch(r)).toEqual({ google_drive_link: answer.folder.url, job_plans_link: answer.plans.url })
  })

  it('never throws on a thin answer', () => {
    const r = jobDriveFoldersFromAnswer(null)
    expect(r.folder.url).toBe('')
    expect(r.stamped).toEqual([])
    expect(jobDriveLinksPatch(r)).toEqual({})
  })
})

describe('driveFoldersMadeWords', () => {
  const made = jobDriveFoldersFromAnswer(answer)
  const withSource = (source: JobDriveFolders['folder']['source']): JobDriveFolders => ({ ...made, folder: { ...made.folder, source } })

  it('says where the folder came from, with no hold when every folder takes a file', () => {
    expect(driveFoldersMadeWords(withSource('made'))).toEqual({ line: 'The job’s folders are ready under Jobs.', hold: null })
    expect(driveFoldersMadeWords(withSource('found')).line).toBe('The job’s folder was already under Jobs. The folders missing inside it are made.')
    expect(driveFoldersMadeWords(withSource('bid')).line).toBe('The job uses its bid’s folder. The folders missing inside it are made.')
    expect(driveFoldersMadeWords(withSource('kept')).line).toBe('The job keeps its folder. The folders missing inside it are made.')
  })

  it('holds a kept pictures folder the app cannot write in, naming the account to share it with', () => {
    const r: JobDriveFolders = { ...withSource('made'), pictures: { url: 'https://drive.google.com/drive/folders/1KKKKKKKKKKKKKKKKKKKKKKKKKKK', source: 'kept', writable: false } }
    const w = driveFoldersMadeWords(r)
    expect(w.hold).toBe(`The app cannot write in the job’s pictures folder, so photos cannot file there. Share it with ${answer.app_email} as an editor, or clear the link on the Edit tab and press again.`)
    const plansOnly: JobDriveFolders = { ...withSource('kept'), plans: { url: 'https://x', source: 'kept', writable: false } }
    expect(driveFoldersMadeWords(plansOnly).hold).toContain('plans folder')
    // A kept link that is not a Drive folder is nobody's hold: photos go to Team only › Photos instead.
    const other: JobDriveFolders = { ...withSource('kept'), pictures: { url: 'https://photos.app.goo.gl/abc', source: 'kept', writable: null } }
    expect(driveFoldersMadeWords(other).hold).toBeNull()
  })

  it('says the folders inside come later when the office’s choice is as-needed (punch list #211, PR 3)', () => {
    const later = { url: '', source: 'later' as const, writable: null }
    const asNeeded = jobDriveFoldersFromAnswer({ ...answer, folders_made: 'as-needed', pictures: later, plans: later, team_url: '', photos_url: '', sent_url: '', stamped: ['google_drive_link'] })
    expect(asNeeded.foldersMade).toBe('as-needed')
    expect(asNeeded.pictures).toEqual(later)
    expect(foldersMadeLater(asNeeded)).toBe(true)
    expect(foldersMadeLater(made)).toBe(false)
    expect(jobDriveLinksPatch(asNeeded)).toEqual({ google_drive_link: answer.folder.url })
    expect(driveFoldersMadeWords(asNeeded)).toEqual({ line: 'The job’s folder is ready under Jobs. The folders inside are made as something first lands in them.', hold: null })
    expect(driveFoldersMadeWords({ ...asNeeded, folder: { ...asNeeded.folder, source: 'found' } }).line).toBe('The job’s folder was already under Jobs. The folders inside are made as something first lands in them.')
    expect(driveFoldersMadeWords({ ...asNeeded, folder: { ...asNeeded.folder, source: 'bid' } }).line).toBe('The job uses its bid’s folder. The folders inside are made as something first lands in them.')
    // A kept pictures folder the app cannot write in is still the hold, whatever the choice.
    expect(driveFoldersMadeWords({ ...asNeeded, pictures: { url: 'https://x', source: 'kept', writable: false } }).hold).toContain('pictures folder')
    expect(made.foldersMade).toBe('upfront')
  })

  it('says where in the tree the folder sits and what the press did with it (v2.6284)', () => {
    const under = { ...withSource('found'), placed: { act: 'move_rename' as const, path: 'Jobs › Oak Hollow HOA › 972 · Oak Hollow Bldg C', customerFolder: { name: 'Oak Hollow HOA', url: 'https://drive.google.com/drive/folders/1GGGGGGGGGGGGGGGGGGGGGGGGGGG' } } }
    expect(driveFoldersMadeWords(under).line).toBe('The job’s folder was already under Oak Hollow HOA. It was moved under Oak Hollow HOA and renamed to the office’s pattern. The folders missing inside it are made.')
    expect(driveFoldersMadeWords({ ...under, placed: { ...under.placed, act: 'moved' } }).line).toContain('It was moved under Oak Hollow HOA.')
    expect(driveFoldersMadeWords({ ...under, placed: { ...under.placed, act: 'renamed' } }).line).toContain('It was renamed to the office’s pattern.')
    expect(driveFoldersMadeWords({ ...withSource('made'), placed: { ...under.placed, act: 'made' } }).line).toBe('The job’s folders are ready under Oak Hollow HOA.')
    expect(jobDriveFoldersFromAnswer({ ...answer, placed: { act: 'moved', path: 'Jobs › A › B', customer_folder: { name: 'A', url: 'https://x' } } }).placed).toEqual({ act: 'moved', path: 'Jobs › A › B', customerFolder: { name: 'A', url: 'https://x' } })
    expect(jobDriveFoldersFromAnswer({ ...answer, placed: { act: 'odd' } }).placed).toEqual({ act: 'in_place', path: '', customerFolder: null })
    expect(jobDriveFoldersFromAnswer(answer).placed).toBeNull()
    for (const act of ['moved', 'renamed', 'move_rename'] as const) expect(plainWordsFailures(driveFoldersMadeWords({ ...under, placed: { ...under.placed, act } }).line)).toEqual([])
  })

  it('keeps to plain words', () => {
    const later = { url: '', source: 'later' as const, writable: null }
    for (const source of ['made', 'found', 'bid', 'kept'] as const) {
      const w = driveFoldersMadeWords({ ...withSource(source), pictures: { url: 'https://x', source: 'kept', writable: false } })
      expect(plainWordsFailures(w.line)).toEqual([])
      expect(plainWordsFailures(w.hold ?? '')).toEqual([])
      const l = driveFoldersMadeWords({ ...withSource(source), foldersMade: 'as-needed', pictures: later, plans: later })
      expect(plainWordsFailures(l.line)).toEqual([])
    }
  })
})

describe('planDriveFolderBackfill / driveFolderBackfillOutcome', () => {
  const jobs = [
    { id: 'a', google_drive_link: null },
    { id: 'b', google_drive_link: '' },
    { id: 'c', google_drive_link: 'https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    { id: 'd', google_drive_link: 'https://www.dropbox.com/sh/abc' },
  ]

  it('makes folders for the jobs with no link, holds a link that is not a folder, leaves a folder alone', () => {
    const plan = planDriveFolderBackfill(jobs)
    expect(plan.ready.map((j) => j.id)).toEqual(['a', 'b'])
    expect(plan.held).toEqual([{ job: jobs[3], why: NOT_A_FOLDER_WHY }])
    expect(plan.words.button).toBe('Make folders for 2 jobs · 1 has a link that is not a folder ▸')
    expect(plan.words.dead).toBe(false)
    expect(plainWordsFailures(plan.words.foot ?? '')).toEqual([])
  })

  it('is dead with nothing ready, and says so when only holds are left', () => {
    expect(planDriveFolderBackfill([jobs[2]!]).words).toEqual({ button: 'Make folders for', foot: null, dead: true })
    const onlyHeld = planDriveFolderBackfill([jobs[3]!, { id: 'e', google_drive_link: 'https://photos.app.goo.gl/x' }])
    expect(onlyHeld.words.dead).toBe(true)
    expect(onlyHeld.words.button).toBe('Make folders for ▸')
  })

  it('counts one ready job as one', () => {
    expect(planDriveFolderBackfill([jobs[0]!]).words.button).toBe('Make folders for 1 job')
  })

  it('reads the outcome past the failures', () => {
    expect(driveFolderBackfillOutcome(5, 0)).toEqual({ line: 'Got folders for 5 jobs.', head: null, tone: 'success' })
    const some = driveFolderBackfillOutcome(4, 1)
    expect(some.line).toBe('Got folders for 4 jobs. 1 did not get folders.')
    expect(some.head).toBe('1 job did not get folders. It stays here with the reason.')
    expect(some.tone).toBe('warning')
    expect(driveFolderBackfillOutcome(0, 2).tone).toBe('error')
  })
})
