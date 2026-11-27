import { describe, expect, it } from 'vitest'
import {
  JOB_FOLDER_TRASH_CONFIRM_LINE,
  JOB_FOLDER_TRASH_NOT_KNOWN,
  jobFolderTrashAnswer,
  jobFolderTrashOffered,
  jobFolderTrashProblem,
  jobFolderTrashToast,
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
