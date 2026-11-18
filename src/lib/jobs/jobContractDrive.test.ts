import { describe, expect, it } from 'vitest'
import {
  CONTRACT_DRIVE_HOLD_KINDS,
  CONTRACT_DRIVE_WORDS,
  CONTRACT_HOLD_WORDS,
  JOB_FOLDER_GONE_WORDS,
  JOB_FOLDER_TRASHED_WORDS,
  keptJobFolderWhy,
  canAdoptLinkedFile,
  contractDriveCounts,
  contractDriveDue,
  contractDriveLine,
  contractDriveName,
  contractDriveUrl,
  contractFileSource,
  contractHold,
  contractHoldDoor,
  contractHoldRetries,
  contractLinkFileId,
  contractPaperChipWords,
  contractPapersOnFile,
  contractSignedDay,
  contractsHeldLine,
  fileContractsOutcome,
  fileContractsWords,
  holdRetryMinutes,
  joinJobNumbers,
  knownContractFileIds,
  unvoidedDriveName,
  voidedDriveName,
  withoutKnownContracts,
  type ContractDriveRow,
} from './jobContractDrive'
import { plainWordsFailures } from '../plainWords'

const FILE_A = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const FILE_B = '1ZyXwVuTsRqPoNmLkJiHgFeDcBa543210'

function row(over: Partial<ContractDriveRow> = {}): ContractDriveRow {
  return { id: 'c1', job_id: 'j1', kind: 'contract', status: 'signed', voided_at: null, signed_at: '2026-11-14T18:00:00Z', ...over }
}

describe('where a signed paper’s file is', () => {
  it('files the scan when the record has one, over the signed PDF and over the link', () => {
    expect(contractFileSource({ paper_upload_path: 'c1/paper.JPG', signed_pdf_path: 'c1/signed.pdf', signed_document_url: `https://drive.google.com/file/d/${FILE_A}/view` })).toEqual({ from: 'bucket', path: 'c1/paper.JPG', ext: 'jpg', scan: true })
  })
  it('files the signed PDF when there is no scan', () => {
    expect(contractFileSource({ paper_upload_path: null, signed_pdf_path: 'c1/signed.pdf', signed_document_url: null })).toEqual({ from: 'bucket', path: 'c1/signed.pdf', ext: 'pdf', scan: false })
  })
  it('reads a typed Drive link as a Drive file, a Google Doc too', () => {
    expect(contractFileSource({ signed_document_url: `https://drive.google.com/file/d/${FILE_A}/view?usp=sharing` })).toEqual({ from: 'drive_link', driveFileId: FILE_A })
    expect(contractFileSource({ signed_document_url: `https://docs.google.com/document/d/${FILE_B}/edit` })).toEqual({ from: 'drive_link', driveFileId: FILE_B })
    expect(contractLinkFileId(`https://drive.google.com/open?id=${FILE_A}`)).toBe(FILE_A)
  })
  it('keeps a link that is not a Drive file as a link, and a record with nothing as nothing', () => {
    expect(contractFileSource({ signed_document_url: 'https://example.com/contract.pdf' })).toEqual({ from: 'other_link', url: 'https://example.com/contract.pdf' })
    expect(contractFileSource({ signed_document_url: `https://drive.google.com/drive/folders/${FILE_A}` })).toEqual({ from: 'other_link', url: `https://drive.google.com/drive/folders/${FILE_A}` })
    expect(contractFileSource({})).toEqual({ from: 'none' })
  })
  it('reads an extension it cannot trust as pdf', () => {
    expect(contractFileSource({ paper_upload_path: 'c1/paper' })).toMatchObject({ ext: 'pdf' })
  })
})

describe('what the sweep owes a row', () => {
  const now = new Date('2026-11-17T12:00:00Z').getTime()
  it('files a signed paper that has never been tried', () => {
    expect(contractDriveDue(row(), now)).toBe('file')
  })
  it('owes nothing to a draft, a paper out for signature or a paper already in Drive', () => {
    expect(contractDriveDue(row({ status: 'draft' }), now)).toBeNull()
    expect(contractDriveDue(row({ status: 'sent' }), now)).toBeNull()
    expect(contractDriveDue(row({ drive_file_id: FILE_A, drive_file_origin: 'filed' }), now)).toBeNull()
  })
  it('takes a held paper again an hour on, and a paper left with no reason on the next run', () => {
    const tenAgo = new Date(now - 10 * 60_000).toISOString()
    expect(contractDriveDue(row({ drive_file_hold: 'job_folder', drive_file_tried_at: tenAgo }), now)).toBeNull()
    expect(contractDriveDue(row({ drive_file_hold: 'job_folder', drive_file_tried_at: new Date(now - 61 * 60_000).toISOString() }), now)).toBe('file')
    expect(contractDriveDue(row({ drive_file_hold: 'no_file', drive_file_tried_at: new Date(now - 61 * 60_000).toISOString() }), now)).toBe('file')
    expect(contractDriveDue(row({ drive_file_tried_at: tenAgo }), now)).toBe('file')
    expect(holdRetryMinutes('drive_refused')).toBe(60)
    expect(holdRetryMinutes(null)).toBe(0)
  })
  it('marks the app’s own copy of a voided paper once, and never a file the office placed', () => {
    const voided = { status: 'voided', voided_at: '2026-11-16T12:00:00Z', drive_file_id: FILE_A }
    expect(contractDriveDue(row({ ...voided, drive_file_origin: 'filed' }), now)).toBe('mark_void')
    expect(contractDriveDue(row({ ...voided, drive_file_origin: 'filed', drive_void_marked_at: '2026-11-16T12:10:00Z' }), now)).toBeNull()
    expect(contractDriveDue(row({ ...voided, drive_file_origin: 'adopted' }), now)).toBeNull()
    expect(contractDriveDue(row({ status: 'voided', voided_at: '2026-11-16T12:00:00Z' }), now)).toBeNull()
  })
})

describe('the file’s name in Drive', () => {
  const pdf = { from: 'bucket', path: 'c1/signed.pdf', ext: 'pdf', scan: false } as const
  const scan = { from: 'bucket', path: 'c1/paper.pdf', ext: 'pdf', scan: true } as const
  it('names a contract by its signed day, what it is, the job’s number and who signed', () => {
    expect(contractDriveName({ row: row(), source: pdf, jobNumber: '1042', signer: 'Dana Whitfield' })).toBe('2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf')
  })
  it('names a warranty, a scan and a GC’s own paper for what they are', () => {
    expect(contractDriveName({ row: row({ kind: 'warranty', signed_at: '2026-11-12T20:00:00Z' }), source: pdf, jobNumber: '1039', signer: 'Luis Ortega' })).toBe('2026-11-12 Signed warranty · 1039 · Luis Ortega.pdf')
    expect(contractDriveName({ row: row({ paper_signed_on: '2026-10-30' }), source: scan, jobNumber: '1017', signer: 'Priya Raman' })).toBe('2026-10-30 Signed contract scan · 1017 · Priya Raman.pdf')
    expect(contractDriveName({ row: row({ kind: 'their_paper', our_signed_on: '2026-10-21', paper_title: 'Master Subcontract Agreement' }), source: scan, jobNumber: '1003', signer: 'Ray Harlan' })).toBe(
      '2026-10-21 Their paper signed by us · 1003 · Master Subcontract Agreement.pdf',
    )
  })
  it('names a paper over several jobs by the jobs it covers and its customer', () => {
    expect(contractDriveName({ row: row({ paper_signed_on: '2026-09-18' }), source: scan, jobNumber: '825', signer: 'Ray Harlan', coversJobNumbers: ['843', '251', '825'], customerName: 'Harlan Custom Homes' })).toBe(
      '2026-09-18 Signed contract scan · covers 251, 825 and 843 · Harlan Custom Homes.pdf',
    )
    expect(joinJobNumbers(['825', '251'])).toBe('251 and 825')
  })
  it('takes the signed day in the company’s zone, not the UTC day', () => {
    // 02:30 UTC on the 15th is the evening of the 14th in Chicago.
    expect(contractSignedDay(row({ signed_at: '2026-11-15T02:30:00Z' }))).toBe('2026-11-14')
  })
  it('keeps a scan’s own extension, leaves out a piece the record lacks and takes a slash out', () => {
    expect(contractDriveName({ row: row(), source: { from: 'bucket', path: 'c1/paper.jpg', ext: 'jpg', scan: true }, jobNumber: '', signer: 'A/B Homes' })).toBe('2026-11-14 Signed contract scan · A-B Homes.jpg')
  })
  it('renames a voided copy once, and takes the mark off again', () => {
    const name = '2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf'
    expect(voidedDriveName(name)).toBe(`VOIDED · ${name}`)
    expect(voidedDriveName(voidedDriveName(name))).toBe(`VOIDED · ${name}`)
    expect(unvoidedDriveName(voidedDriveName(name))).toBe(name)
  })
})

describe('a paper the office already keeps in Drive', () => {
  it('is adopted only when the app sees a live file inside the jobs drive', () => {
    expect(canAdoptLinkedFile({ seen: true, isFolder: false, trashed: false, inCompanyDrive: true })).toBe(true)
    expect(canAdoptLinkedFile({ seen: true, isFolder: false, trashed: false, inCompanyDrive: false })).toBe(false)
    expect(canAdoptLinkedFile({ seen: false, isFolder: false, trashed: false, inCompanyDrive: false })).toBe(false)
    expect(canAdoptLinkedFile({ seen: true, isFolder: true, trashed: false, inCompanyDrive: true })).toBe(false)
    expect(canAdoptLinkedFile({ seen: true, isFolder: false, trashed: true, inCompanyDrive: true })).toBe(false)
  })
})

describe('the holds', () => {
  it('has words for every kind, each in plain words', () => {
    for (const kind of CONTRACT_DRIVE_HOLD_KINDS) {
      expect(CONTRACT_HOLD_WORDS[kind].length).toBeGreaterThan(10)
      expect(plainWordsFailures(CONTRACT_HOLD_WORDS[kind])).toEqual([])
    }
  })
  it('carries the job’s own reason, or Drive’s, when one is given', () => {
    expect(contractHold('job_folder', 'This job’s Drive link is not a folder.')).toEqual({ kind: 'job_folder', words: 'This job’s Drive link is not a folder.' })
    expect(contractHold('no_file').words).toBe(CONTRACT_HOLD_WORDS.no_file)
  })
  it('holds a job whose Drive folder is gone or in the trash, in plain words, and lets a live one through', () => {
    expect(keptJobFolderWhy(null)).toBe(JOB_FOLDER_GONE_WORDS)
    expect(keptJobFolderWhy({ trashed: true })).toBe(JOB_FOLDER_TRASHED_WORDS)
    expect(keptJobFolderWhy({ trashed: false })).toBeNull()
    for (const words of [JOB_FOLDER_GONE_WORDS, JOB_FOLDER_TRASHED_WORDS]) expect(plainWordsFailures(words)).toEqual([])
    // The hold carries the reason and the job's own door.
    expect(contractHold('job_folder', keptJobFolderWhy(null))).toEqual({ kind: 'job_folder', words: JOB_FOLDER_GONE_WORDS })
    expect(contractHoldDoor('job_folder')?.to).toBe('job_edit')
  })
  it('gives each hold its door, and offers Try again only where trying can help', () => {
    expect(contractHoldDoor('no_drive')).toEqual({ label: 'Open Where files go', to: 'where_files_go' })
    expect(contractHoldDoor('job_folder')?.to).toBe('job_edit')
    expect(contractHoldDoor('open_link')?.to).toBe('drive_folder')
    expect(contractHoldDoor('no_file')).toEqual({ label: 'Add the scan', to: 'add_scan' })
    expect(contractHoldDoor('drive_refused')).toBeNull()
    expect(contractHoldRetries('job_folder')).toBe(true)
    expect(contractHoldRetries('no_file')).toBe(false)
  })
})

describe('the Contract window’s Drive block', () => {
  it('has no block for a paper that is not signed', () => {
    expect(contractDriveLine(row({ status: 'sent' })).state).toBe('none')
  })
  it('says a filed paper is in the job’s folder, with its day', () => {
    const line = contractDriveLine(row({ drive_file_id: FILE_A, drive_file_origin: 'filed' }), { filedDay: 'Nov 14' })
    expect(line).toMatchObject({ state: 'filed', title: 'In the job’s Drive folder', sub: 'Team only › Contracts · filed Nov 14', driveFileId: FILE_A })
    expect(contractDriveUrl(FILE_A)).toBe(`https://drive.google.com/file/d/${FILE_A}/view`)
  })
  it('says an adopted paper is where the office put it', () => {
    expect(contractDriveLine(row({ drive_file_id: FILE_A, drive_file_origin: 'adopted' }), { path: 'Jobs › Harlan Custom Homes › 988 · Harlan Duplex' })).toMatchObject({
      state: 'adopted',
      title: CONTRACT_DRIVE_WORDS.adopted,
      sub: 'Jobs › Harlan Custom Homes › 988 · Harlan Duplex',
    })
  })
  it('offers File it in Drive now on a paper the sweep has not reached', () => {
    expect(contractDriveLine(row())).toMatchObject({ state: 'waiting', title: 'Not in Drive yet', fileNow: true, retry: false })
  })
  it('shows a hold with its reason, its door and Try again', () => {
    const line = contractDriveLine(row({ drive_file_hold: 'job_folder', drive_file_hold_words: 'This job’s Drive link is not a folder.' }))
    expect(line).toMatchObject({ state: 'held', sub: 'This job’s Drive link is not a folder.', retry: true, fileNow: false })
    expect(line.door?.to).toBe('job_edit')
    expect(contractDriveLine(row({ drive_file_hold: 'no_file' }))).toMatchObject({ state: 'held', sub: CONTRACT_HOLD_WORDS.no_file, retry: false })
  })
  it('says what became of a voided paper’s copy', () => {
    const voided = { status: 'voided', voided_at: '2026-11-16T12:00:00Z', drive_file_id: FILE_A }
    expect(contractDriveLine(row({ ...voided, drive_file_origin: 'filed', drive_void_marked_at: '2026-11-16T12:10:00Z' })).sub).toBe(CONTRACT_DRIVE_WORDS.voidedMarked)
    expect(contractDriveLine(row({ ...voided, drive_file_origin: 'filed' })).sub).toBe(CONTRACT_DRIVE_WORDS.voidedSoon)
    expect(contractDriveLine(row({ ...voided, drive_file_origin: 'adopted' })).sub).toBe(CONTRACT_DRIVE_WORDS.voidedAdopted)
    expect(contractDriveLine(row({ status: 'voided', voided_at: '2026-11-16T12:00:00Z' })).state).toBe('none')
  })
  it('keeps the block’s own words plain', () => {
    for (const words of [CONTRACT_DRIVE_WORDS.waitingSub, CONTRACT_DRIVE_WORDS.voidedMarked, CONTRACT_DRIVE_WORDS.voidedSoon, CONTRACT_DRIVE_WORDS.voidedAdopted]) expect(plainWordsFailures(words)).toEqual([])
  })
})

describe('Documents → Where files go', () => {
  const rows = [
    row({ id: 'a', drive_file_id: FILE_A, drive_file_origin: 'filed' }),
    row({ id: 'b', drive_file_id: FILE_B, drive_file_origin: 'adopted' }),
    row({ id: 'c' }),
    row({ id: 'd', drive_file_hold: 'no_file' }),
    row({ id: 'e', status: 'voided', voided_at: '2026-11-16T12:00:00Z', drive_file_id: FILE_A, drive_file_origin: 'filed' }),
    row({ id: 'f', status: 'draft' }),
  ]
  it('counts the signed papers in Drive, waiting and held, and leaves voided and unsigned ones out', () => {
    const counts = contractDriveCounts(rows)
    expect(counts).toMatchObject({ signed: 4, inDrive: 2, waiting: 1 })
    expect(counts.held.map((r) => r.id)).toEqual(['d'])
  })
  it('says its count on the press, and is dead when nothing waits', () => {
    expect(fileContractsWords(2, 0)).toMatchObject({ button: 'File 2 signed contracts', dead: false })
    expect(fileContractsWords(1, 0).button).toBe('File 1 signed contract')
    expect(fileContractsWords(0, 0).dead).toBe(true)
    expect(fileContractsWords(0, 2).dead).toBe(true)
  })
  it('names what took and what did not after the press', () => {
    expect(fileContractsOutcome(2, 0).line).toBe('Filed 2 signed contracts.')
    expect(fileContractsOutcome(1, 1)).toMatchObject({ line: 'Filed 1 signed contract. 1 did not file.', tone: 'warning' })
  })
  it('says how many are held, or nothing', () => {
    expect(contractsHeldLine(0)).toBeNull()
    expect(contractsHeldLine(1)).toBe('1 signed contract is held. It says why.')
    expect(contractsHeldLine(2)).toBe('2 signed contracts are held. Each says why.')
  })
})

describe('the Contract sweep’s Drive pass', () => {
  it('knows a paper on file by its Drive id: filed, adopted or linked by hand', () => {
    const known = knownContractFileIds([
      { status: 'signed', voided_at: null, drive_file_id: FILE_A, drive_file_origin: 'filed', signed_document_url: null },
      { status: 'signed', voided_at: null, drive_file_id: null, drive_file_origin: null, signed_document_url: `https://drive.google.com/file/d/${FILE_B}/view` },
    ])
    expect([...known].sort()).toEqual([FILE_A, FILE_B].sort())
  })
  it('keeps the app’s own copy of a voided paper out, and lets a hand-linked file of a voided record be offered again', () => {
    const voided = { status: 'voided', voided_at: '2026-11-16T12:00:00Z' }
    expect(knownContractFileIds([{ ...voided, drive_file_id: FILE_A, drive_file_origin: 'filed', signed_document_url: null }]).has(FILE_A)).toBe(true)
    expect(knownContractFileIds([{ ...voided, drive_file_id: FILE_A, drive_file_origin: 'adopted', signed_document_url: `https://drive.google.com/file/d/${FILE_A}/view` }]).size).toBe(0)
  })
  it('drops the papers on file from the scan, whatever they are named', () => {
    const files = [{ id: FILE_A, name: '2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf' }, { id: FILE_B, name: 'Harlan signed contract.pdf' }]
    expect(withoutKnownContracts(files, new Set([FILE_A]))).toEqual([files[1]])
    expect(withoutKnownContracts(files, new Set())).toEqual(files)
  })
})

describe('Find a file: a hit that is a paper on file', () => {
  const base = { job_id: 'j1', status: 'signed', voided_at: null }
  it('marks a signed paper’s Drive copy signed, filed or adopted, with its record', () => {
    const marks = contractPapersOnFile([
      { ...base, id: 'c1', drive_file_id: FILE_A, drive_file_origin: 'filed' },
      { ...base, id: 'c2', job_id: 'j2', drive_file_id: FILE_B, drive_file_origin: 'adopted' },
      { ...base, id: 'c3', drive_file_id: null, drive_file_origin: null },
    ])
    expect(marks.get(FILE_A)).toEqual({ paper: 'signed', contractId: 'c1', jobId: 'j1' })
    expect(marks.get(FILE_B)).toEqual({ paper: 'signed', contractId: 'c2', jobId: 'j2' })
    expect(marks.size).toBe(2)
  })
  it('marks the app’s own copy of a voided paper voided, and leaves a hand-linked file of a voided record unmarked', () => {
    const voided = { job_id: 'j1', status: 'voided', voided_at: '2026-11-16T12:00:00Z' }
    expect(contractPapersOnFile([{ ...voided, id: 'c1', drive_file_id: FILE_A, drive_file_origin: 'filed' }]).get(FILE_A)?.paper).toBe('voided')
    expect(contractPapersOnFile([{ ...voided, id: 'c1', drive_file_id: FILE_A, drive_file_origin: 'adopted' }]).size).toBe(0)
  })
  it('lets a signed record win when one file stands for a voided record too', () => {
    const marks = contractPapersOnFile([
      { job_id: 'j1', status: 'voided', voided_at: '2026-11-16T12:00:00Z', id: 'old', drive_file_id: FILE_A, drive_file_origin: 'filed' },
      { ...base, id: 'new', job_id: 'j9', drive_file_id: FILE_A, drive_file_origin: 'adopted' },
    ])
    expect(marks.get(FILE_A)).toEqual({ paper: 'signed', contractId: 'new', jobId: 'j9' })
  })
  it('words the chip', () => {
    expect(contractPaperChipWords('signed')).toBe('Signed contract')
    expect(contractPaperChipWords('voided')).toBe('Voided contract')
  })
})

