import { describe, expect, it } from 'vitest'
import {
  CONTRACT_FILE_MAX_BYTES,
  fileContract,
  freeContractName,
  holdContract,
  markVoidedCopy,
  mimeForExt,
  type ContractNameFacts,
  type FilerDrive,
  type FilerStore,
} from '../../../supabase/functions/_shared/jobContractDriveFiler'
import { CONTRACT_HOLD_WORDS, type ContractDriveRow, type LinkedFileFacts } from './jobContractDrive'

const FILE_A = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345'
const NOW = new Date('2026-11-17T18:00:00Z')

function row(over: Partial<ContractDriveRow> = {}): ContractDriveRow {
  return { id: 'c1', job_id: 'j1', kind: 'contract', status: 'signed', voided_at: null, signed_at: '2026-11-14T18:00:00Z', signed_pdf_path: 'c1/signed.pdf', ...over }
}

/** A Drive that remembers what it was asked, with one job folder and no files. */
function fakeDrive(over: Partial<FilerDrive> = {}) {
  const calls: string[] = []
  const uploads: { folderId: string; name: string; mime: string; mark: Record<string, string>; bytes: number }[] = []
  const renames: { id: string; name: string }[] = []
  const indexed: string[] = []
  const drive: FilerDrive = {
    jobFolder: async (jobId) => (calls.push(`jobFolder:${jobId}`), { folderId: 'job-folder' }),
    folder: async (parentId, name) => (calls.push(`folder:${parentId}/${name}`), `${parentId}/${name}`),
    openToAnyone: async () => false,
    marked: async () => null,
    nameTaken: async () => false,
    upload: async (folderId, bytes, name, mime, mark) => {
      uploads.push({ folderId, name, mime, mark, bytes: bytes.length })
      return 'new-file'
    },
    linked: async (): Promise<LinkedFileFacts> => ({ seen: true, isFolder: false, trashed: false, inCompanyDrive: true }),
    fileName: async () => '2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf',
    rename: async (id, name) => void renames.push({ id, name }),
    index: async (id) => void indexed.push(id),
    ...over,
  }
  return { drive, calls, uploads, renames, indexed }
}

function fakeStore(over: Partial<FilerStore> = {}, facts: Partial<ContractNameFacts> = {}) {
  const saved: { id: string; patch: Record<string, string | null> }[] = []
  const store: FilerStore = {
    bytes: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: 'application/pdf' }),
    nameFacts: async () => ({ jobNumber: '1042', signer: 'Dana Whitfield', coversJobNumbers: [], customerName: 'Ridgeway Builders', ...facts }),
    save: async (id, patch) => void saved.push({ id, patch }),
    ...over,
  }
  return { store, saved }
}

describe('filing one signed paper', () => {
  it('uploads the stored file under Team only › Contracts in its job’s folder, named and marked, and hands it to the index', async () => {
    const d = fakeDrive()
    const s = fakeStore()
    const out = await fileContract(row(), d.drive, s.store, NOW)
    expect(out).toEqual({ id: 'c1', did: 'filed', driveFileId: 'new-file', name: '2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf' })
    expect(d.calls).toEqual(['jobFolder:j1', 'folder:job-folder/Team only', 'folder:job-folder/Team only/Contracts'])
    expect(d.uploads).toEqual([{ folderId: 'job-folder/Team only/Contracts', name: '2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf', mime: 'application/pdf', mark: { pt_job_contract: 'c1' }, bytes: 3 }])
    expect(s.saved).toEqual([{ id: 'c1', patch: { drive_file_id: 'new-file', drive_filed_at: NOW.toISOString(), drive_file_origin: 'filed', drive_file_hold: null, drive_file_hold_words: null, drive_file_tried_at: NOW.toISOString() } }])
    expect(d.indexed).toEqual(['new-file'])
  })

  it('adopts a paper the office already keeps in the jobs drive, with no upload and no rename', async () => {
    const d = fakeDrive()
    const s = fakeStore()
    const out = await fileContract(row({ signed_pdf_path: null, signed_document_url: `https://drive.google.com/file/d/${FILE_A}/view` }), d.drive, s.store, NOW)
    expect(out).toMatchObject({ did: 'adopted', driveFileId: FILE_A })
    expect(d.uploads).toEqual([])
    expect(d.renames).toEqual([])
    expect(d.calls).toEqual([])
    expect(s.saved[0]!.patch).toMatchObject({ drive_file_id: FILE_A, drive_file_origin: 'adopted', drive_file_hold: null })
    expect(d.indexed).toEqual([FILE_A])
  })

  it('holds a linked file outside the jobs drive, and a link that is not a Drive file', async () => {
    const outside = fakeDrive({ linked: async () => ({ seen: true, isFolder: false, trashed: false, inCompanyDrive: false }) })
    const s = fakeStore()
    const linked = row({ signed_pdf_path: null, signed_document_url: `https://drive.google.com/file/d/${FILE_A}/view` })
    expect(await fileContract(linked, outside.drive, s.store, NOW)).toMatchObject({ did: 'held', hold: { kind: 'link_outside', words: CONTRACT_HOLD_WORDS.link_outside } })
    expect(await fileContract(row({ signed_pdf_path: null, signed_document_url: 'https://example.com/c.pdf' }), fakeDrive().drive, s.store, NOW)).toMatchObject({ did: 'held', hold: { kind: 'link_outside' } })
    expect(s.saved.every((w) => w.patch.drive_file_hold === 'link_outside' && !('drive_file_id' in w.patch))).toBe(true)
  })

  it('holds a record with no file and no link, without asking Drive anything', async () => {
    const d = fakeDrive()
    const s = fakeStore()
    expect(await fileContract(row({ signed_pdf_path: null }), d.drive, s.store, NOW)).toMatchObject({ did: 'held', hold: { kind: 'no_file' } })
    expect(d.calls).toEqual([])
    expect(s.saved).toEqual([{ id: 'c1', patch: { drive_file_hold: 'no_file', drive_file_hold_words: CONTRACT_HOLD_WORDS.no_file, drive_file_tried_at: NOW.toISOString() } }])
  })

  it('holds with the job’s own reason when its folder cannot be placed', async () => {
    const d = fakeDrive({ jobFolder: async () => ({ why: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.' }) })
    const s = fakeStore()
    const out = await fileContract(row(), d.drive, s.store, NOW)
    expect(out).toMatchObject({ did: 'held', hold: { kind: 'job_folder', words: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.' } })
    expect(d.uploads).toEqual([])
  })

  it('never files into a folder anyone with its link can open', async () => {
    const d = fakeDrive({ openToAnyone: async () => true })
    const s = fakeStore()
    expect(await fileContract(row(), d.drive, s.store, NOW)).toMatchObject({ did: 'held', hold: { kind: 'open_link' } })
    expect(d.uploads).toEqual([])
  })

  it('finds the file a run already made by its mark, and does not file it twice', async () => {
    const d = fakeDrive({ marked: async () => ({ id: 'made-before', name: '2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf' }) })
    const s = fakeStore()
    expect(await fileContract(row(), d.drive, s.store, NOW)).toMatchObject({ did: 'found', driveFileId: 'made-before' })
    expect(d.uploads).toEqual([])
    expect(s.saved[0]!.patch).toMatchObject({ drive_file_id: 'made-before', drive_file_origin: 'filed' })
  })

  it('holds a scan too big to send, and a stored file the bucket no longer has', async () => {
    const s1 = fakeStore({ bytes: async (_p, max) => (expect(max).toBe(CONTRACT_FILE_MAX_BYTES), 'tooBig' as const) })
    expect(await fileContract(row(), fakeDrive().drive, s1.store, NOW)).toMatchObject({ did: 'held', hold: { kind: 'too_big' } })
    const s2 = fakeStore({ bytes: async () => null })
    expect(await fileContract(row(), fakeDrive().drive, s2.store, NOW)).toMatchObject({ did: 'held', hold: { kind: 'no_file' } })
  })

  it('turns Drive’s refusal into a hold with Drive’s words, and throws nothing', async () => {
    const d = fakeDrive({ upload: async () => { throw new Error('Upload failed (403): The user does not have sufficient permissions for this file.') } })
    const s = fakeStore()
    const out = await fileContract(row(), d.drive, s.store, NOW)
    expect(out).toMatchObject({ did: 'held', hold: { kind: 'drive_refused', words: 'Upload failed (403): The user does not have sufficient permissions for this file.' } })
    expect(s.saved[0]!.patch.drive_file_hold).toBe('drive_refused')
  })

  it('files the scan over the signed PDF, under the name a scan takes, keeping its extension', async () => {
    const d = fakeDrive()
    const s = fakeStore({ bytes: async () => ({ bytes: new Uint8Array([9]), mime: null }) }, { signer: 'Priya Raman', jobNumber: '1017' })
    await fileContract(row({ paper_upload_path: 'c1/paper.jpg', paper_signed_on: '2026-10-30' }), d.drive, s.store, NOW)
    expect(d.uploads[0]).toMatchObject({ name: '2026-10-30 Signed contract scan · 1017 · Priya Raman.jpg', mime: 'image/jpeg' })
  })

  it('names a paper over several jobs for the jobs it covers', async () => {
    const d = fakeDrive()
    const s = fakeStore({}, { coversJobNumbers: ['825', '251', '843'], customerName: 'Harlan Custom Homes', jobNumber: '825' })
    await fileContract(row({ paper_upload_path: 'c1/paper.pdf', paper_signed_on: '2026-09-18', covers_group_id: 'g1' }), d.drive, s.store, NOW)
    expect(d.uploads[0]!.name).toBe('2026-09-18 Signed contract scan · covers 251, 825 and 843 · Harlan Custom Homes.pdf')
  })

  it('takes the next free name when the folder already holds one of that name', async () => {
    const d = fakeDrive({ nameTaken: async (_f, name) => !name.includes('(2)') })
    const s = fakeStore()
    const out = await fileContract(row(), d.drive, s.store, NOW)
    expect(out).toMatchObject({ did: 'filed', name: '2026-11-14 Signed contract · 1042 · Dana Whitfield (2).pdf' })
  })

  it('leaves alone a paper already in Drive, a draft, a paper out for signature and a voided one', async () => {
    const d = fakeDrive()
    const s = fakeStore()
    for (const r of [row({ drive_file_id: FILE_A }), row({ status: 'draft' }), row({ status: 'sent' }), row({ status: 'voided', voided_at: '2026-11-16T00:00:00Z' })]) {
      expect(await fileContract(r, d.drive, s.store, NOW)).toEqual({ id: 'c1', did: 'nothing' })
    }
    expect(s.saved).toEqual([])
    expect(d.calls).toEqual([])
  })

  it('still files when the index hand-off fails: the index sweep is the net', async () => {
    const d = fakeDrive({ index: async () => { throw new Error('index down') } })
    const s = fakeStore()
    expect(await fileContract(row(), d.drive, s.store, NOW)).toMatchObject({ did: 'filed' })
    expect(s.saved[0]!.patch.drive_file_id).toBe('new-file')
  })
})

describe('a hold the whole run shares', () => {
  it('writes Drive not connected on the row with its words', async () => {
    const s = fakeStore()
    expect(await holdContract(row(), 'no_drive', s.store, NOW.toISOString())).toMatchObject({ did: 'held', hold: { kind: 'no_drive', words: CONTRACT_HOLD_WORDS.no_drive } })
    expect(s.saved[0]!.patch).toEqual({ drive_file_hold: 'no_drive', drive_file_hold_words: CONTRACT_HOLD_WORDS.no_drive, drive_file_tried_at: NOW.toISOString() })
  })
})

describe('a voided paper’s copy', () => {
  const voided = { status: 'voided', voided_at: '2026-11-16T12:00:00Z', drive_file_id: FILE_A }
  it('is renamed VOIDED once and kept, when the app made it', async () => {
    const d = fakeDrive()
    const s = fakeStore()
    expect(await markVoidedCopy(row({ ...voided, drive_file_origin: 'filed' }), d.drive, s.store, NOW)).toEqual({ id: 'c1', did: 'marked' })
    expect(d.renames).toEqual([{ id: FILE_A, name: 'VOIDED · 2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf' }])
    expect(s.saved).toEqual([{ id: 'c1', patch: { drive_void_marked_at: NOW.toISOString() } }])
    // The index is told at once, so Find a file reads the VOIDED name the same minute.
    expect(d.indexed).toEqual([FILE_A])
  })
  it('is still marked when the index hand-off fails after the rename: the index sweep is the net', async () => {
    const d = fakeDrive({ index: async () => { throw new Error('index down') } })
    const s = fakeStore()
    expect(await markVoidedCopy(row({ ...voided, drive_file_origin: 'filed' }), d.drive, s.store, NOW)).toEqual({ id: 'c1', did: 'marked' })
    expect(d.renames).toHaveLength(1)
    expect(s.saved).toEqual([{ id: 'c1', patch: { drive_void_marked_at: NOW.toISOString() } }])
  })
  it('is not renamed again when it already carries the mark, and is marked done when Drive no longer holds it', async () => {
    const already = fakeDrive({ fileName: async () => 'VOIDED · 2026-11-14 Signed contract · 1042 · Dana Whitfield.pdf' })
    expect(await markVoidedCopy(row({ ...voided, drive_file_origin: 'filed' }), already.drive, fakeStore().store, NOW)).toMatchObject({ did: 'marked' })
    expect(already.renames).toEqual([])
    expect(already.indexed).toEqual([])
    const gone = fakeDrive({ fileName: async () => null })
    expect(await markVoidedCopy(row({ ...voided, drive_file_origin: 'filed' }), gone.drive, fakeStore().store, NOW)).toMatchObject({ did: 'marked' })
    expect(gone.renames).toEqual([])
  })
  it('never touches a file the office placed, and is left for the next run when Drive refuses', async () => {
    const d = fakeDrive()
    const s = fakeStore()
    expect(await markVoidedCopy(row({ ...voided, drive_file_origin: 'adopted' }), d.drive, s.store, NOW)).toEqual({ id: 'c1', did: 'nothing' })
    const refuses = fakeDrive({ rename: async () => { throw new Error('Drive answered 500') } })
    expect(await markVoidedCopy(row({ ...voided, drive_file_origin: 'filed' }), refuses.drive, s.store, NOW)).toEqual({ id: 'c1', did: 'nothing' })
    expect(s.saved).toEqual([])
  })
})

describe('small helpers', () => {
  it('knows a scan’s type by its extension', () => {
    expect(mimeForExt('PDF')).toBe('application/pdf')
    expect(mimeForExt('jpeg')).toBe('image/jpeg')
    expect(mimeForExt('xyz')).toBe('application/octet-stream')
  })
  it('counts up to a free name and gives up past its tries', async () => {
    expect(await freeContractName('a.pdf', async (n) => n === 'a.pdf' || n === 'a (2).pdf')).toBe('a (3).pdf')
    await expect(freeContractName('a.pdf', async () => true, 3)).rejects.toThrow('Too many files')
  })
})
