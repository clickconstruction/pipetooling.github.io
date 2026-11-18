import { describe, expect, it } from 'vitest'
import { contractDrivePressFromAnswer, contractDrivePressWords } from './jobContractDriveIo'
import { CONTRACT_HOLD_WORDS } from './jobContractDrive'
import { plainWordsFailures } from '../plainWords'

describe('the press’s answer', () => {
  it('reads a filing with the row’s Drive columns', () => {
    const press = contractDrivePressFromAnswer({ ok: true, outcome: { id: 'c1', did: 'filed', driveFileId: 'f1' }, drive: { drive_file_id: 'f1', drive_file_origin: 'filed' } })
    expect(press).toEqual({ did: 'filed', heldWords: null, drive: { drive_file_id: 'f1', drive_file_origin: 'filed' } })
  })
  it('reads a hold’s own words, or the kind’s when it sends none', () => {
    expect(contractDrivePressFromAnswer({ outcome: { did: 'held', hold: { kind: 'job_folder', words: 'This job’s Drive link is not a folder.' } } }).heldWords).toBe('This job’s Drive link is not a folder.')
    expect(contractDrivePressFromAnswer({ outcome: { did: 'held', hold: { kind: 'no_file' } } }).heldWords).toBe(CONTRACT_HOLD_WORDS.no_file)
  })
  it('reads an answer it does not know as nothing done, and never throws', () => {
    expect(contractDrivePressFromAnswer(null)).toEqual({ did: 'nothing', heldWords: null, drive: null })
    expect(contractDrivePressFromAnswer({ outcome: { did: 'exploded' } }).did).toBe('nothing')
  })
})

describe('what the toast says', () => {
  it('says where the paper is, in plain words', () => {
    for (const did of ['filed', 'found', 'adopted', 'marked', 'nothing'] as const) {
      const said = contractDrivePressWords({ did, heldWords: null, drive: null })
      expect(plainWordsFailures(said.words)).toEqual([])
    }
    expect(contractDrivePressWords({ did: 'filed', heldWords: null, drive: null })).toEqual({ words: 'The signed contract is in the job’s Drive folder.', tone: 'success' })
    expect(contractDrivePressWords({ did: 'adopted', heldWords: null, drive: null }).tone).toBe('success')
  })
  it('says a hold in the hold’s own words, as a warning', () => {
    expect(contractDrivePressWords({ did: 'held', heldWords: 'Drive is not connected.', drive: null })).toEqual({ words: 'Drive is not connected.', tone: 'warning' })
  })
})
