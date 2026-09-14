import { describe, expect, it } from 'vitest'
import { contractFileStrength, folderMatchesJob, matchDriveContracts, partyNamesAgree, signedOnFromModified, streetKey, summarizeDriveMatches, type DriveMatchJob, type DriveScanFile } from './driveContractMatch'

function file(p: Partial<DriveScanFile> & { name: string; folderName: string }): DriveScanFile {
  return { id: `f-${p.name}`, mimeType: 'application/pdf', modifiedTime: '2026-06-14T15:00:00.000Z', webViewLink: 'https://drive.google.com/file/d/x/view', size: 1, folderId: 'fo', ...p }
}
const JOBS: DriveMatchJob[] = [
  { id: 'j523', jobNumber: '523', jobName: 'Mission Hills', jobAddress: '2100 Independence Dr, New Braunfels, TX 78130', customerName: 'TF Harper', gcName: 'TF Harper' },
  { id: 'j804', jobNumber: '804', jobName: 'Summit GC- Auto Zone', jobAddress: '3915 N Loop 1604 E, San Antonio, TX 78247', customerName: 'Summit General Contractors', gcName: 'Summit GC' },
  { id: 'j651', jobNumber: '651', jobName: 'Dudley Mason', jobAddress: '233 Palomino Trail, Natalia, TX 78059', customerName: 'RMC- Dudley Mason', gcName: null },
  { id: 'j683', jobNumber: '683', jobName: 'Job', jobAddress: '15054 State Hwy 71, Bee Cave, TX 78738', customerName: 'The Learning Experience', gcName: null },
]

describe('the Drive pass matcher', () => {
  it('reads file names: contract words are strong, proposal is weak, invoices and plans are not contracts', () => {
    expect(contractFileStrength('TF Harper – Mission Hills – Subcontract (signed).pdf')).toBe('strong')
    expect(contractFileStrength('Palomino Trail service agreement')).toBe('strong')
    expect(contractFileStrength('Proposal v2.pdf')).toBe('weak')
    expect(contractFileStrength('Invoice 4421.pdf')).toBe('no')
    expect(contractFileStrength('A-1.2 plans.pdf')).toBe('no')
    expect(contractFileStrength('signed change order 3.pdf')).toBe('no')
    expect(contractFileStrength('Lien waiver signed.pdf')).toBe('no')
    expect(contractFileStrength('Signed Inspection Report (Mon Jun 29, 2026).pdf')).toBe('no')
    expect(contractFileStrength('Kerrville TX (GEO Report) - signed.pdf')).toBe('no')
    expect(contractFileStrength('Loberg Insurance Rider for Subcontractors.pdf')).toBe('no')
    expect(contractFileStrength('Joeris Subcontract SAMPLE Template 2024.pdf')).toBe('no')
    expect(contractFileStrength('CLICK PLUMBING - EST. #123 - 105 DOVER RD. - SIGNED (3.27.2026).pdf')).toBe('strong')
  })

  it('party names agree by their identifying words, in any order, ignoring RMC / LLC / Contracting', () => {
    expect(partyNamesAgree('_Mason Dudley', 'RMC- Dudley Mason')).toBe(true)
    expect(partyNamesAgree('_Knight Contracting', 'Knight Contracting')).toBe(true)
    expect(partyNamesAgree('_Heron Construction', 'Heron Construction Group')).toBe(true)
    expect(partyNamesAgree('Michael Hageman', 'Michael Palmer')).toBe(false)
    expect(partyNamesAgree('Ryan Wilson', 'Suzy Wilson')).toBe(false)
    const job: DriveMatchJob = { id: 'j651', jobNumber: '651', jobName: 'Dudley Mason', jobAddress: '233 Palomino Trail, Natalia, TX 78059', customerName: 'RMC- Dudley Mason', gcName: 'RMC- Dudley Mason' }
    expect(folderMatchesJob('_Mason Dudley', job).strength).toBe('customer')
    expect(folderMatchesJob('_Mason Dudley / 233 Palomino Trail / Contracts', job).strength).toBe('street')
  })

  it('keys an address by number + street and matches folders by street, number, job name or customer', () => {
    expect(streetKey('2100 Independence Dr, New Braunfels, TX 78130')).toBe('2100 independence')
    expect(streetKey('13616 1/2 N Hwy 183, Austin, TX')).toBe('13616 n')
    expect(streetKey('Bee Cave')).toBeNull()
    expect(folderMatchesJob('2100 Independence Dr', JOBS[0]!).strength).toBe('street')
    expect(folderMatchesJob('J523 Mission Hills', JOBS[0]!).strength).toBe('number')
    expect(folderMatchesJob('Job 804 - Auto Zone', JOBS[1]!).strength).toBe('number')
    expect(folderMatchesJob('Auto Zone – 3915 N Loop 1604', JOBS[1]!).strength).toBe('street')
    expect(folderMatchesJob('Dudley Mason misc', JOBS[2]!).strength).toBe('name')
    expect(folderMatchesJob('TLE Bee Cave', JOBS[3]!).strength).toBeNull()
    expect(folderMatchesJob('15230 Independence', JOBS[0]!).strength).toBeNull()
    // A bare number in a street is not a job number ("105 Dover" is not J105).
    const j105: DriveMatchJob = { id: 'j105', jobNumber: '105', jobName: 'Jennifer Loehr', jobAddress: '9 Elm St, Austin, TX', customerName: 'Jennifer Loehr', gcName: null }
    expect(folderMatchesJob('_Heron Construction / 105 Dover', j105).strength).toBeNull()
    expect(folderMatchesJob('Job 105 - Loehr', j105).strength).toBe('number')
  })

  it('a strong file in a folder that names the street or number is confident; name-only folders and weak words are "check"; the rest none', () => {
    const matches = matchDriveContracts(
      [
        file({ name: 'TF Harper – Mission Hills – Subcontract (signed).pdf', folderName: '2100 Independence Dr' }),
        file({ name: 'Auto Zone 1604 – Summit Subcontract Agreement.pdf', folderName: 'Auto Zone – 3915 N Loop 1604' }),
        file({ name: 'Palomino Trail service agreement', folderName: 'Dudley Mason – Palomino', mimeType: 'application/vnd.google-apps.document' }),
        file({ name: 'Proposal v2.pdf', folderName: '2100 Independence Dr' }),
        file({ name: 'Plans A-1.pdf', folderName: 'TLE Bee Cave' }),
      ],
      JOBS,
    )
    expect(matches.map((m) => [m.jobId, m.confidence, m.kind])).toEqual([
      ['j523', 'confident', 'subcontract'],
      ['j804', 'confident', 'subcontract'],
      ['j651', 'check', 'agreement'],
      ['j523', 'check', 'other'],
      [null, 'none', 'other'],
    ])
    expect(matches[0]!.reason).toBe('folder names 2100 Independence Dr · signed subcontract')
    expect(matches[2]!.reason).toBe('folder names the job "Dudley Mason" · contract')
    expect(summarizeDriveMatches(matches)).toEqual({ confident: 2, check: 2, none: 1, jobsCovered: 2 })
  })

  it('two jobs at one address make the file a "check", unless the folder names the job number', () => {
    const twin: DriveMatchJob = { ...JOBS[0]!, id: 'j999', jobNumber: '999', jobName: 'Mission Hills phase 2' }
    const byStreet = matchDriveContracts([file({ name: 'Subcontract signed.pdf', folderName: '2100 Independence Dr' })], [...JOBS, twin])
    expect(byStreet[0]!.confidence).toBe('check')
    expect(byStreet[0]!.reason).toContain('2 jobs match this folder')
    const byNumber = matchDriveContracts([file({ name: 'Subcontract signed.pdf', folderName: 'J999 – 2100 Independence Dr' })], [...JOBS, twin])
    expect(byNumber[0]).toMatchObject({ jobId: 'j999', confidence: 'confident' })
  })

  it('Signed on comes from the file date', () => {
    expect(signedOnFromModified('2026-06-14T15:00:00.000Z')).toBe('2026-06-14')
    expect(signedOnFromModified(null)).toBe('')
    expect(signedOnFromModified('nope')).toBe('')
  })
})
