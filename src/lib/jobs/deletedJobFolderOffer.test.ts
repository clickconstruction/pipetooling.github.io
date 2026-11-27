import { describe, expect, it } from 'vitest'
import {
  DELETED_BUNDLE_FOLDER_LINE,
  DELETED_BUNDLE_FOLDER_OPEN,
  DELETED_BUNDLE_FOLDER_PRESS,
  JOB_FOLDER_TRASH_CONFIRM_LINE,
  JOB_FOLDER_TRASH_NOT_KNOWN,
  jobFolderTrashAnswer,
  jobFolderTrashOffered,
  jobFolderTrashProblem,
  jobFolderTrashToast,
  deletedBundleFolderConfirm,
  deletedBundleFolderOffered,
  deletedBundleFolderOutcome,
  deletedJobFolderFacts,
} from './deletedJobFolderOffer'

const LINK = 'https://drive.google.com/drive/folders/job-folder-id'
const zz = { job_name: 'ZZ Test walk job', customer_name: 'Ridge Builders', google_drive_link: LINK }

describe('jobFolderTrashOffered', () => {
  it('is a dev on a ZZ-named job that keeps a Drive link', () => {
    expect(jobFolderTrashOffered('dev', zz)).toBe(true)
    expect(jobFolderTrashOffered('dev', { job_name: 'Bldg C', customer_name: 'zz test customer', google_drive_link: LINK })).toBe(true)
  })
  it('is nobody else, whatever the job', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', '', null, undefined]) {
      expect(jobFolderTrashOffered(role, zz)).toBe(false)
    }
  })
  it('is never a job that is not named ZZ', () => {
    expect(jobFolderTrashOffered('dev', { job_name: 'Oak Hollow Bldg C', customer_name: 'Ridge Builders', google_drive_link: LINK })).toBe(false)
    expect(jobFolderTrashOffered('dev', { job_name: 'Dizzy’s remodel', customer_name: null, google_drive_link: LINK })).toBe(false)
  })
  it('is never a job with no link, and never no job', () => {
    expect(jobFolderTrashOffered('dev', { ...zz, google_drive_link: null })).toBe(false)
    expect(jobFolderTrashOffered('dev', { ...zz, google_drive_link: '  ' })).toBe(false)
    expect(jobFolderTrashOffered('dev', null)).toBe(false)
  })
})

describe('the words', () => {
  it('says in the Delete window that the folder goes to the trash and can come back', () => {
    expect(JOB_FOLDER_TRASH_CONFIRM_LINE).toBe('This is a ZZ test job, so its Drive folder goes to Drive’s trash with it. The folder can be restored there for 30 days.')
  })
  it('reads the function’s four answers and nothing else', () => {
    for (const act of ['trashed', 'none', 'already', 'gone'] as const) {
      expect(jobFolderTrashAnswer({ success: true, act, words: ' Said. ' })).toEqual({ act, words: 'Said.' })
    }
    expect(jobFolderTrashAnswer({ success: true, act: 'deleted', words: 'Said.' })).toBeNull()
    expect(jobFolderTrashAnswer({ success: true, act: 'trashed', words: '' })).toBeNull()
    expect(jobFolderTrashAnswer({ success: true, folder: { url: LINK } })).toBeNull()
    expect(jobFolderTrashAnswer(null)).toBeNull()
  })
  it('turns the old function’s answer into a sentence, and leaves every other refusal as it came', () => {
    expect(jobFolderTrashProblem('job_id is required')).toBe(JOB_FOLDER_TRASH_NOT_KNOWN)
    expect(jobFolderTrashProblem(' 1 bid still keeps this folder. It stays. ')).toBe('1 bid still keeps this folder. It stays.')
  })
  it('says the job is deleted first, then what became of its folder', () => {
    expect(jobFolderTrashToast({ answer: { act: 'trashed', words: 'Its Drive folder went to Drive’s trash.' } })).toEqual({ words: 'The job is deleted. Its Drive folder went to Drive’s trash.', tone: 'success' })
    expect(jobFolderTrashToast({ problem: '1 bid still keeps this folder. It stays.' })).toEqual({ words: 'The job is deleted. 1 bid still keeps this folder. It stays.', tone: 'warning' })
  })
})

describe('Recently deleted: a job deleted earlier (punch list #443, row 18)', () => {
  it('offers the press to a dev on a deleted job’s bundle whose kept copy is ZZ-named and keeps a link', () => {
    expect(deletedBundleFolderOffered('dev', 'job', zz)).toBe(true)
  })
  it('offers it for no other kind of bundle, no other role, no real job and no job without a link or a copy', () => {
    for (const kind of ['bid', 'partial', 'customers', 'people', '', null, undefined]) expect(deletedBundleFolderOffered('dev', kind, zz)).toBe(false)
    for (const role of ['master_technician', 'assistant', 'controller', 'primary', null]) expect(deletedBundleFolderOffered(role, 'job', zz)).toBe(false)
    expect(deletedBundleFolderOffered('dev', 'job', { ...zz, job_name: 'Cedar Bend' })).toBe(false)
    expect(deletedBundleFolderOffered('dev', 'job', { ...zz, google_drive_link: '' })).toBe(false)
    expect(deletedBundleFolderOffered('dev', 'job', undefined)).toBe(false)
  })
  it('names the act on the confirm’s button and says what goes, what stays and how it comes back', () => {
    expect(deletedBundleFolderConfirm('1142 · ZZ Test Payoff 1')).toEqual({
      title: 'Send this job’s Drive folder to the trash?',
      message:
        '1142 · ZZ Test Payoff 1. Its own Drive folder goes to Drive’s trash, and can be restored there for 30 days. The folder stays if a bid, another job or a customer still keeps it. It also stays if a person added a file to it. The customer’s folder stays. If you put this job back later, restore its folder in Drive as well.',
      confirmLabel: 'Send to Drive’s trash',
    })
    expect(deletedBundleFolderConfirm('  ').message.startsWith('Its own Drive folder goes')).toBe(true)
    expect(deletedBundleFolderConfirm('x').confirmLabel).not.toMatch(/^ok$/i)
  })
  it('keeps every sentence it writes under 20 words, with no dash, semicolon or parenthesis', () => {
    const said = [DELETED_BUNDLE_FOLDER_LINE, ...deletedBundleFolderConfirm('').message.split(/(?<=\.)\s+/)]
    for (const s of said) {
      expect(s.split(/\s+/).length).toBeLessThan(20)
      expect(s).not.toMatch(/[—–;()]/)
    }
  })
  it('says the press and the link by their own names', () => {
    expect(DELETED_BUNDLE_FOLDER_PRESS).toBe('Send its Drive folder to the trash…')
    expect(DELETED_BUNDLE_FOLDER_OPEN).toBe('Open it in Drive ↗')
    expect(DELETED_BUNDLE_FOLDER_LINE).toBe('This test job kept a Drive folder. Deleting the job did not remove it.')
  })
  it('says what the function answered: where the folder went, or why it stays, in the function’s own words', () => {
    expect(deletedBundleFolderOutcome({ answer: { act: 'trashed', words: 'Its Drive folder went to Drive’s trash.' } })).toEqual({ words: 'Its Drive folder went to Drive’s trash.', tone: 'done' })
    expect(deletedBundleFolderOutcome({ answer: { act: 'already', words: 'Its Drive folder is already in Drive’s trash.' } })).toEqual({ words: 'Its Drive folder is already in Drive’s trash.', tone: 'done' })
    expect(deletedBundleFolderOutcome({ problem: '1 bid still keeps this folder. It stays.' })).toEqual({ words: '1 bid still keeps this folder. It stays.', tone: 'stays' })
    expect(deletedBundleFolderOutcome({ problem: 'job_id is required' })).toEqual({ words: JOB_FOLDER_TRASH_NOT_KNOWN, tone: 'stays' })
  })
  it('keys the kept copies by job id, the first read winning, and skips a row with no id', () => {
    const facts = deletedJobFolderFacts([
      { record_id: 'job-a', job_name: 'ZZ newest', customer_name: null, google_drive_link: LINK },
      { record_id: 'job-a', job_name: 'ZZ older', customer_name: null, google_drive_link: null },
      { record_id: null, job_name: 'ZZ nobody', customer_name: null, google_drive_link: LINK },
      { record_id: 'job-b', job_name: 'Cedar Bend', customer_name: 'Ridge Builders', google_drive_link: null },
    ])
    expect([...facts.keys()]).toEqual(['job-a', 'job-b'])
    expect(facts.get('job-a')).toEqual({ job_name: 'ZZ newest', customer_name: null, google_drive_link: LINK })
  })
})
