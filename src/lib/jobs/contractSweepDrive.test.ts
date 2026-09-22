import { describe, expect, it } from 'vitest'
import { bestDriveFindByJob, defaultSweepDoor, driveFindChip, driveFindPrefills } from './contractSweepDrive'
import type { DriveContractMatch } from './driveContractMatch'

const match = (over: { jobId: string | null; confidence: DriveContractMatch['confidence']; name?: string; modified?: string | null; link?: string | null }): DriveContractMatch => ({
  file: { id: over.name ?? 'f', name: over.name ?? 'Contract.pdf', mimeType: 'application/pdf', modifiedTime: over.modified === undefined ? '2026-08-14T15:00:00Z' : over.modified, webViewLink: over.link === undefined ? `https://drive.google.com/file/d/${over.name ?? 'f'}/view` : over.link, size: 1, folderId: 'fo', folderName: 'J523 Mission Hills' },
  jobId: over.jobId,
  confidence: over.confidence,
  reason: 'folder names the street · signed subcontract',
  kind: 'subcontract',
})

describe('contractSweepDrive — one best find per job', () => {
  it('prefers a confident match over a check, whatever the dates', () => {
    const finds = bestDriveFindByJob([match({ jobId: 'j1', confidence: 'check', name: 'newer', modified: '2026-09-01T00:00:00Z' }), match({ jobId: 'j1', confidence: 'confident', name: 'older', modified: '2026-01-01T00:00:00Z' })])
    expect(finds.get('j1')?.fileName).toBe('older')
    expect(finds.get('j1')?.confidence).toBe('confident')
  })

  it('between equals takes the newest, and dates the find from the file', () => {
    const finds = bestDriveFindByJob([match({ jobId: 'j1', confidence: 'confident', name: 'a', modified: '2026-03-01T00:00:00Z' }), match({ jobId: 'j1', confidence: 'confident', name: 'b', modified: '2026-08-14T15:00:00Z' })])
    expect(finds.get('j1')).toMatchObject({ fileName: 'b', signedOn: '2026-08-14', folderName: 'J523 Mission Hills', link: 'https://drive.google.com/file/d/b/view' })
  })

  it('is nobody’s find without a job, a link, or a real match', () => {
    const finds = bestDriveFindByJob([match({ jobId: null, confidence: 'confident' }), match({ jobId: 'j2', confidence: 'none' }), match({ jobId: 'j3', confidence: 'confident', link: null })])
    expect(finds.size).toBe(0)
  })

  it('a file with no date still counts, with no signed-on', () => {
    expect(bestDriveFindByJob([match({ jobId: 'j1', confidence: 'check', modified: null })]).get('j1')?.signedOn).toBe('')
  })
})

describe('contractSweepDrive — the words', () => {
  const finds = bestDriveFindByJob([match({ jobId: 'j1', confidence: 'confident' }), match({ jobId: 'j2', confidence: 'check' }), match({ jobId: 'gone', confidence: 'confident' })])

  it('chips green when sure, amber when a person should look', () => {
    expect(driveFindChip(finds.get('j1')!)).toMatchObject({ text: '📄 in Drive', tone: 'green' })
    expect(driveFindChip(finds.get('j2')!)).toMatchObject({ text: '📄 in Drive? check', tone: 'amber' })
  })

  it('fills the link in only for a confident find — a "check" find waits for the person to say so', () => {
    expect(driveFindPrefills(finds.get('j1'), false)).toBe(true)
    expect(driveFindPrefills(finds.get('j2'), false)).toBe(false)
    expect(driveFindPrefills(finds.get('j2'), true)).toBe(true)
    expect(driveFindPrefills(undefined, true)).toBe(false)
  })

  it('opens on "we already have one" for a find or a builder’s row, else on send', () => {
    expect(defaultSweepDoor({ find: finds.get('j1'), isGcRow: false })).toBe('have')
    expect(defaultSweepDoor({ find: undefined, isGcRow: true })).toBe('have')
    expect(defaultSweepDoor({ find: undefined, isGcRow: false })).toBe('send')
  })
})
