import { describe, expect, it } from 'vitest'
import {
  APP_SETTINGS_KEY_DRIVE_BID_FOLDER_PATTERN,
  APP_SETTINGS_KEY_DRIVE_FOLDERS_MADE,
  APP_SETTINGS_KEY_DRIVE_JOB_FOLDER_PATTERN,
  APP_SETTINGS_KEY_DRIVE_JOBS_ROOT_FOLDER_ID,
} from '../appSettingsKeys'
import { plainWordsFailures } from '../plainWords'
import {
  bidFolderName,
  DEFAULT_BID_FOLDER_PATTERN,
  DEFAULT_JOB_FOLDER_PATTERN,
  DRIVE_BID_FOLDER_PATTERN_KEY,
  DRIVE_FOLDERS_MADE_KEY,
  DRIVE_JOB_FOLDER_PATTERN_KEY,
  DRIVE_JOBS_ROOT_FOLDER_ID_KEY,
  driveFolderIdFromLinkOrId,
  driveSafeName,
  driveSettingsFromRows,
  FOLDER_NAME_MAX,
  folderName,
  folderPatternJson,
  JOB_FOLDER_PIECE_LABELS,
  JOB_FOLDER_PIECES,
  parseBidFolderPattern,
  parseFoldersMade,
  parseJobFolderPattern,
  writeCheckWords,
} from './folderName'

const job = { id: '7d759246-8476-4a37-884f-ed1562d5663f', number: '972', name: 'Oak Hollow Bldg C', customer: 'Oak Hollow HOA', address: '14 Oak Hollow Dr', year: 2026 }

describe('folderName', () => {
  it('names a job by the pieces in the pattern’s order, joined by the dot', () => {
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, job)).toBe('972 · Oak Hollow Bldg C')
    expect(folderName(['name', 'number'], job)).toBe('Oak Hollow Bldg C · 972')
    expect(folderName(['year', 'number', 'customer', 'address'], job)).toBe('2026 · 972 · Oak Hollow HOA · 14 Oak Hollow Dr')
  })

  it('skips a piece the job has no value for, and names a job with none of them by its id', () => {
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, name: null })).toBe('972')
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, number: '  ' })).toBe('Oak Hollow Bldg C')
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { id: job.id })).toBe('Job 7d759246')
  })

  it('keeps the name Drive-safe as v2.6054’s press did: no backslashes, one space between words, capped', () => {
    expect(folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, name: ' Oak\\Hollow   Bldg\tC ' })).toBe('972 · Oak Hollow Bldg C')
    expect(driveSafeName('a\u0000b\u001fc')).toBe('a b c')
    const long = folderName(DEFAULT_JOB_FOLDER_PATTERN, { ...job, name: 'x'.repeat(200) })
    expect(long.length).toBeLessThanOrEqual(FOLDER_NAME_MAX)
    expect(long.startsWith('972 · xxx')).toBe(true)
  })

  it('names a bid by the project name as drive-intake did, or by its number when the pieces are empty', () => {
    const bid = { id: 'b1f3a0d2-0000-4000-8000-000000000000', project: 'Oak Hollow Bldg C', number: 482, customer: 'Oak Hollow HOA', address: null, year: 2026 }
    expect(bidFolderName(DEFAULT_BID_FOLDER_PATTERN, bid)).toBe('Oak Hollow Bldg C')
    expect(bidFolderName(['number', 'project'], bid)).toBe('482 · Oak Hollow Bldg C')
    expect(bidFolderName(DEFAULT_BID_FOLDER_PATTERN, { ...bid, project: '' })).toBe('Bid 482')
    expect(bidFolderName(DEFAULT_BID_FOLDER_PATTERN, { id: bid.id })).toBe('Bid b1f3a0d2')
  })

  it('labels every piece in the tray, in plain words', () => {
    for (const p of JOB_FOLDER_PIECES) expect(JOB_FOLDER_PIECE_LABELS[p].length).toBeGreaterThan(2)
  })
})

describe('the stored pattern', () => {
  it('reads a JSON list, drops a piece it does not know and a repeat, and falls back when nothing is left', () => {
    expect(parseJobFolderPattern('["name","number"]')).toEqual(['name', 'number'])
    expect(parseJobFolderPattern('["number","name","number","color"]')).toEqual(['number', 'name'])
    expect(parseJobFolderPattern('["color"]')).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseJobFolderPattern('not json')).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseJobFolderPattern('{"a":1}')).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseJobFolderPattern(null)).toEqual([...DEFAULT_JOB_FOLDER_PATTERN])
    expect(parseBidFolderPattern('["number","project"]')).toEqual(['number', 'project'])
    expect(parseBidFolderPattern('["name"]')).toEqual([...DEFAULT_BID_FOLDER_PATTERN])
  })

  it('round-trips through its stored form', () => {
    expect(parseJobFolderPattern(folderPatternJson(['year', 'number']))).toEqual(['year', 'number'])
  })

  it('reads the folders-made choice, upfront unless as-needed is stored', () => {
    expect(parseFoldersMade('as-needed')).toBe('as-needed')
    expect(parseFoldersMade('upfront')).toBe('upfront')
    expect(parseFoldersMade('later')).toBe('upfront')
    expect(parseFoldersMade(null)).toBe('upfront')
  })
})

describe('driveSettingsFromRows', () => {
  it('takes the setting’s root, else the env’s, and says which', () => {
    const rows = [
      { key: DRIVE_JOBS_ROOT_FOLDER_ID_KEY, value_text: '1AAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      { key: DRIVE_JOB_FOLDER_PATTERN_KEY, value_text: '["year","number"]' },
      { key: DRIVE_FOLDERS_MADE_KEY, value_text: 'as-needed' },
    ]
    expect(driveSettingsFromRows(rows, '1EEEEEEEEEEEEEEEEEEEEEEEEEEE')).toEqual({
      rootFolderId: '1AAAAAAAAAAAAAAAAAAAAAAAAAAA',
      rootFrom: 'setting',
      jobPattern: ['year', 'number'],
      bidPattern: [...DEFAULT_BID_FOLDER_PATTERN],
      foldersMade: 'as-needed',
    })
    expect(driveSettingsFromRows([], '1EEEEEEEEEEEEEEEEEEEEEEEEEEE')).toMatchObject({ rootFolderId: '1EEEEEEEEEEEEEEEEEEEEEEEEEEE', rootFrom: 'env', jobPattern: ['number', 'name'], foldersMade: 'upfront' })
    expect(driveSettingsFromRows([{ key: DRIVE_JOBS_ROOT_FOLDER_ID_KEY, value_text: '  ' }], undefined)).toMatchObject({ rootFolderId: null, rootFrom: null })
  })

  it('uses the keys the app’s settings file names, so the page and the functions read one row', () => {
    expect(DRIVE_JOBS_ROOT_FOLDER_ID_KEY).toBe(APP_SETTINGS_KEY_DRIVE_JOBS_ROOT_FOLDER_ID)
    expect(DRIVE_JOB_FOLDER_PATTERN_KEY).toBe(APP_SETTINGS_KEY_DRIVE_JOB_FOLDER_PATTERN)
    expect(DRIVE_BID_FOLDER_PATTERN_KEY).toBe(APP_SETTINGS_KEY_DRIVE_BID_FOLDER_PATTERN)
    expect(DRIVE_FOLDERS_MADE_KEY).toBe(APP_SETTINGS_KEY_DRIVE_FOLDERS_MADE)
  })
})

describe('the write check', () => {
  const email = 'drive-intake@example.iam.gserviceaccount.com'

  it('reads a folder link or a bare id, and nothing else', () => {
    expect(driveFolderIdFromLinkOrId('https://drive.google.com/drive/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA?usp=sharing')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromLinkOrId('https://drive.google.com/drive/u/1/folders/1AAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromLinkOrId(' 1AAAAAAAAAAAAAAAAAAAAAAAAAAA ')).toBe('1AAAAAAAAAAAAAAAAAAAAAAAAAAA')
    expect(driveFolderIdFromLinkOrId('https://drive.google.com/file/d/1AAAAAAAAAAAAAAAAAAAAAAAAAAA/view')).toBeNull()
    expect(driveFolderIdFromLinkOrId('short')).toBeNull()
    expect(driveFolderIdFromLinkOrId('')).toBeNull()
  })

  it('answers in the same words everywhere: the app can write here, or Drive’s refusal with the account to share with', () => {
    expect(writeCheckWords({ kind: 'ok' }, email)).toEqual({ ok: true, words: 'The app can write here.' })
    expect(writeCheckWords({ kind: 'cannot_write' }, email)).toEqual({ ok: false, words: `The app can open this folder but cannot add a file to it. Share it with ${email} as an editor.` })
    expect(writeCheckWords({ kind: 'cannot_open', status: 404, reason: null }, email).words).toBe(`The app cannot open this folder. Drive answered 404. Share it with ${email} as an editor.`)
    expect(writeCheckWords({ kind: 'cannot_open', status: 403, reason: 'The caller does not have permission' }, email).words).toContain('Drive answered 403: The caller does not have permission.')
    // Drive's own reason ends in a period (v2.6073): the sentence keeps one.
    expect(writeCheckWords({ kind: 'cannot_open', status: 404, reason: 'File not found: 1AAAAAAAAAAAAAAAAAAAAAAAAAAA.' }, email).words).toBe(`The app cannot open this folder. Drive answered 404: File not found: 1AAAAAAAAAAAAAAAAAAAAAAAAAAA. Share it with ${email} as an editor.`)
    expect(writeCheckWords({ kind: 'cannot_open', status: 404, reason: ' . ' }, email).words).toBe(`The app cannot open this folder. Drive answered 404. Share it with ${email} as an editor.`)
    expect(writeCheckWords({ kind: 'not_a_folder' }, email).ok).toBe(false)
    expect(writeCheckWords({ kind: 'no_link' }, email).words).toBe('Paste a Drive folder link first.')
  })

  it('keeps every answer in plain words', () => {
    const seen = [{ kind: 'ok' }, { kind: 'no_link' }, { kind: 'not_a_folder' }, { kind: 'cannot_write' }, { kind: 'cannot_open', status: 403, reason: null }] as const
    for (const s of seen) expect(plainWordsFailures(writeCheckWords(s, 'robot@example.com').words)).toEqual([])
  })
})
