import { describe, expect, it, vi } from 'vitest'
import { HOURS_STATEMENT_DRIVE_WORDS, hoursStatementDriveFileName, hoursStatementDriveProblem, hoursStatementDriveUrl, hoursStatementInDriveWords, putHoursStatementInSentByUs, type HoursStatementDriveIo } from './hoursStatementDrive'

/** Put in Sent by us (punch list #212, residual C, v2.6634): the gate, the words, and the copy then the tie. Every name and number is made up. */
describe('a signed statement into Sent by us', () => {
  it('only a signed statement with a copy goes, once', () => {
    expect(hoursStatementDriveProblem({ state: 'sent', contract_document_id: 'doc-1' })).toBe('Only a signed statement goes in Sent by us.')
    expect(hoursStatementDriveProblem({ state: 'signed', contract_document_id: null })).toBe('This statement has no signed copy to put there.')
    expect(hoursStatementDriveProblem({ state: 'signed', contract_document_id: 'doc-1', drive_file_id: 'f1' })).toBe('Already in Team only → Sent by us.')
    expect(hoursStatementDriveProblem({ state: 'signed', contract_document_id: 'doc-1', drive_file_id: null })).toBeNull()
    expect(hoursStatementDriveProblem({ state: 'signed', contract_document_id: 'doc-1' })).toBeNull()
  })

  it('names the file as the Legal desk does, the copy by Drive’s viewer, and the toast by the folder', () => {
    expect(hoursStatementDriveFileName('HS-1042-0007')).toBe('HS-1042-0007 signed.pdf')
    expect(hoursStatementDriveUrl('abc 1')).toBe('https://drive.google.com/file/d/abc%201/view')
    expect(hoursStatementInDriveWords('HS-1042-0007')).toBe('HS-1042-0007 is in Team only → Sent by us.')
    expect(HOURS_STATEMENT_DRIVE_WORDS.put).toBe('Put in Sent by us')
  })

  it('reads the PDF through the gate, puts it in the folder under its name, then keeps the id on the row', async () => {
    const calls: string[] = []
    const io: HoursStatementDriveIo = {
      signedPdfUrl: vi.fn(async (id: string) => {
        calls.push(`url:${id}`)
        return 'https://files.example.com/signed'
      }),
      fetchBytes: vi.fn(async (url: string) => {
        calls.push(`fetch:${url}`)
        return new Blob(['%PDF-'], { type: 'application/pdf' })
      }),
      putInSentByUs: vi.fn(async (jobId: string, file: File) => {
        calls.push(`put:${jobId}:${file.name}:${file.type}`)
        return { driveFileId: 'drive-9' }
      }),
      markFiled: vi.fn(async (statementId: string, driveFileId: string) => {
        calls.push(`mark:${statementId}:${driveFileId}`)
      }),
    }
    const out = await putHoursStatementInSentByUs(io, { statementId: 'hs-1', recordId: 'HS-1042-0007', jobId: 'job-1', contractDocumentId: 'doc-1' })
    expect(out).toEqual({ driveFileId: 'drive-9', url: 'https://drive.google.com/file/d/drive-9/view' })
    expect(calls).toEqual(['url:doc-1', 'fetch:https://files.example.com/signed', 'put:job-1:HS-1042-0007 signed.pdf:application/pdf', 'mark:hs-1:drive-9'])
  })

  it('a tie that fails names its reason and leaves the copy where the office can see it', async () => {
    const io: HoursStatementDriveIo = {
      signedPdfUrl: async () => 'u',
      fetchBytes: async () => new Blob(['x']),
      putInSentByUs: async () => ({ driveFileId: 'drive-9' }),
      markFiled: async () => {
        throw new Error('column "drive_file_id" does not exist')
      },
    }
    await expect(putHoursStatementInSentByUs(io, { statementId: 'hs-1', recordId: 'HS-1', jobId: 'job-1', contractDocumentId: 'doc-1' })).rejects.toThrow('column "drive_file_id" does not exist')
  })
})
