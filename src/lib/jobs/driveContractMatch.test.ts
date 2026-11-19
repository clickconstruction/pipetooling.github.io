import { describe, expect, it } from 'vitest'
import { contractFileStrength, folderMatchesJob, matchDriveContracts, namesAnotherStreet, partyNamesAgree, signedOnFromModified, streetKey, streetsNamed, summarizeDriveMatches, type DriveMatchJob, type DriveScanFile } from './driveContractMatch'

function file(p: Partial<DriveScanFile> & { name: string; folderName: string }): DriveScanFile {
  return { id: `f-${p.name}`, mimeType: 'application/pdf', modifiedTime: '2026-06-14T15:00:00.000Z', webViewLink: 'https://drive.google.com/file/d/x/view', size: 1, folderId: 'fo', ...p }
}
const JOBS: DriveMatchJob[] = [
  { id: 'j523', jobNumber: '523', jobName: 'Mission Flats', jobAddress: '9345 Iverson Dr, New Braunfels, TX 78130', customerName: 'TF Halden', gcName: 'TF Halden' },
  { id: 'j804', jobNumber: '804', jobName: 'Selwick GC- Tire Barn', jobAddress: '6873 N Loop 1604 E, San Antonio, TX 78247', customerName: 'Selwick General Contractors', gcName: 'Selwick GC' },
  { id: 'j651', jobNumber: '651', jobName: 'Dunmere Mallin', jobAddress: '524 Pickford Trail, Natalia, TX 78059', customerName: 'RLC- Dunmere Mallin', gcName: null },
  { id: 'j683', jobNumber: '683', jobName: 'Job', jobAddress: '71490 State Hwy 71, Bee Cave, TX 78738', customerName: 'The Reading Corner', gcName: null },
]

describe('the Drive pass matcher', () => {
  it('reads file names: contract words are strong, proposal is weak, invoices and plans are not contracts', () => {
    expect(contractFileStrength('TF Halden – Mission Flats – Subcontract (signed).pdf')).toBe('strong')
    expect(contractFileStrength('Pickford Trail service agreement')).toBe('strong')
    expect(contractFileStrength('Proposal v2.pdf')).toBe('weak')
    expect(contractFileStrength('Invoice 4421.pdf')).toBe('no')
    expect(contractFileStrength('A-1.2 plans.pdf')).toBe('no')
    expect(contractFileStrength('signed change order 3.pdf')).toBe('no')
    expect(contractFileStrength('Lien waiver signed.pdf')).toBe('no')
    expect(contractFileStrength('Signed Inspection Report (Mon Jun 29, 2026).pdf')).toBe('no')
    expect(contractFileStrength('Kerrville TX (GEO Report) - signed.pdf')).toBe('no')
    expect(contractFileStrength('Lowbeck Insurance Rider for Subcontractors.pdf')).toBe('no')
    expect(contractFileStrength('Jessup Subcontract SAMPLE Template 2024.pdf')).toBe('no')
    expect(contractFileStrength('CLICK PLUMBING - EST. #123 - 105 DORROW RD. - SIGNED (3.27.2026).pdf')).toBe('strong')
  })

  it('party names agree by their identifying words, in any order, ignoring RLC / LLC / Contracting', () => {
    expect(partyNamesAgree('_Mallin Dunmere', 'RLC- Dunmere Mallin')).toBe(true)
    expect(partyNamesAgree('_Kestrin Contracting', 'Kestrin Contracting')).toBe(true)
    expect(partyNamesAgree('_Hadlow Construction', 'Hadlow Construction Group')).toBe(true)
    expect(partyNamesAgree('Michael Hadwin', 'Michael Palvern')).toBe(false)
    expect(partyNamesAgree('Ruth Winslow', 'Stan Winslow')).toBe(false)
    const job: DriveMatchJob = { id: 'j651', jobNumber: '651', jobName: 'Dunmere Mallin', jobAddress: '524 Pickford Trail, Natalia, TX 78059', customerName: 'RLC- Dunmere Mallin', gcName: 'RLC- Dunmere Mallin' }
    expect(folderMatchesJob('_Mallin Dunmere', job).strength).toBe('customer')
    expect(folderMatchesJob('_Mallin Dunmere / 524 Pickford Trail / Contracts', job).strength).toBe('street')
  })

  it('keys an address by number + street and matches folders by street, number, job name or customer', () => {
    expect(streetKey('9345 Iverson Dr, New Braunfels, TX 78130')).toBe('9345 iverson')
    expect(streetKey('40937 1/2 N Hwy 183, Austin, TX')).toBe('40937 n')
    expect(streetKey('Bee Cave')).toBeNull()
    expect(folderMatchesJob('9345 Iverson Dr', JOBS[0]!).strength).toBe('street')
    expect(folderMatchesJob('J523 Mission Flats', JOBS[0]!).strength).toBe('number')
    expect(folderMatchesJob('Job 804 - Tire Barn', JOBS[1]!).strength).toBe('number')
    expect(folderMatchesJob('Tire Barn – 6873 N Loop 1604', JOBS[1]!).strength).toBe('street')
    expect(folderMatchesJob('Dunmere Mallin misc', JOBS[2]!).strength).toBe('name')
    expect(folderMatchesJob('TLE Bee Cave', JOBS[3]!).strength).toBeNull()
    expect(folderMatchesJob('15230 Iverson', JOBS[0]!).strength).toBeNull()
    // A bare number in a street is not a job number ("105 Dorrow" is not J105).
    const j105: DriveMatchJob = { id: 'j105', jobNumber: '105', jobName: 'Jennifer Lorne', jobAddress: '9 Elm St, Austin, TX', customerName: 'Jennifer Lorne', gcName: null }
    expect(folderMatchesJob('_Hadlow Construction / 105 Dorrow', j105).strength).toBeNull()
    expect(folderMatchesJob('Job 105 - Lorne', j105).strength).toBe('number')
  })

  it('a strong file in a folder that names the street or number is confident; name-only folders and weak words are "check"; the rest none', () => {
    const matches = matchDriveContracts(
      [
        file({ name: 'TF Halden – Mission Flats – Subcontract (signed).pdf', folderName: '9345 Iverson Dr' }),
        file({ name: 'Tire Barn 1604 – Selwick Subcontract Agreement.pdf', folderName: 'Tire Barn – 6873 N Loop 1604' }),
        file({ name: 'Pickford Trail service agreement', folderName: 'Dunmere Mallin – Pickford', mimeType: 'application/vnd.google-apps.document' }),
        file({ name: 'Proposal v2.pdf', folderName: '9345 Iverson Dr' }),
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
    expect(matches[0]!.reason).toBe('folder names 9345 Iverson Dr · signed subcontract')
    expect(matches[2]!.reason).toBe('folder names the job "Dunmere Mallin" · contract')
    expect(summarizeDriveMatches(matches)).toEqual({ confident: 2, check: 2, none: 1, jobsCovered: 2 })
  })

  it('two jobs at one address make the file a "check", unless the folder names the job number', () => {
    const twin: DriveMatchJob = { ...JOBS[0]!, id: 'j999', jobNumber: '999', jobName: 'Mission Flats phase 2' }
    const byStreet = matchDriveContracts([file({ name: 'Subcontract signed.pdf', folderName: '9345 Iverson Dr' })], [...JOBS, twin])
    expect(byStreet[0]!.confidence).toBe('check')
    expect(byStreet[0]!.reason).toContain('2 jobs match this folder')
    const byNumber = matchDriveContracts([file({ name: 'Subcontract signed.pdf', folderName: 'J999 – 9345 Iverson Dr' })], [...JOBS, twin])
    expect(byNumber[0]).toMatchObject({ jobId: 'j999', confidence: 'confident' })
  })

  it('reads the streets a file names from its own name and its folders, never a year or a count', () => {
    expect(streetsNamed({ name: 'CLICK PLUMBING - EST. #123 - 105 DORROW RD. - SIGNED (3.27.2026).pdf', folderName: '_Hadlow Construction / 105 Dorrow' })).toEqual([{ key: '105 dorrow', text: '105 Dorrow' }])
    expect(streetsNamed({ name: '4969 Alcott Ridge signed contract (dragged).pdf', folderName: 'Randy Field Rafferty' })).toEqual([{ key: '4969 alcott', text: '4969 Alcott Ridge' }])
    expect(streetsNamed({ name: 'Subcontract signed.pdf', folderName: '2025 Contracts / Mission Flats' })).toEqual([])
    expect(streetsNamed({ name: '2 story addition contract.pdf', folderName: '_Mallin Dunmere' })).toEqual([])
    expect(streetsNamed({ name: 'TF Halden – Mission Flats – Subcontract (signed).pdf', folderName: '9345 Iverson Dr' })).toEqual([{ key: '9345 iverson', text: '9345 Iverson Dr' }])
  })

  it('a file that names another street is nobody\'s find for the job, whichever folder it sits in (live 2026-09-24)', () => {
    const elwood: DriveMatchJob = { id: 'j950', jobNumber: '950', jobName: 'New- Walkthrough', jobAddress: '184 Elwood Ave, Alamo Heights, TX 78209', customerName: 'Hadlow Construction Group', gcName: 'Hadlow Construction Group' }
    const dorrow: DriveMatchJob = { id: 'j951', jobNumber: '951', jobName: 'Dorrow', jobAddress: '105 Dorrow Rd, San Antonio, TX', customerName: 'Hadlow Construction Group', gcName: 'Hadlow Construction Group' }
    const dorrowFile = file({ name: 'CLICK PLUMBING - EST. #123 - 105 DORROW RD. - SIGNED (3.27.2026).pdf', folderName: '_Hadlow Construction / 105 Dorrow' })
    expect(namesAnotherStreet(dorrowFile, elwood)).toBe('105 Dorrow')
    expect(namesAnotherStreet(dorrowFile, dorrow)).toBeNull()
    // Only the Elwood job in the sweep: the paper is not offered to it, and says why.
    expect(matchDriveContracts([dorrowFile], [elwood])[0]).toMatchObject({ jobId: null, confidence: 'none', reason: "names 105 Dorrow, not the job's address" })
    // Both jobs: it goes to the Dorrow job, confident, with no "2 jobs match" tie.
    expect(matchDriveContracts([dorrowFile], [elwood, dorrow])[0]).toMatchObject({ jobId: 'j951', confidence: 'confident', reason: 'folder names 105 Dorrow Rd · contract' })
    // The file's own name names the street, not the folder.
    const bancroft: DriveMatchJob = { id: 'j1046', jobNumber: '1046', jobName: 'Pretest', jobAddress: '494 Bancroft Avenue, Universal City, TX', customerName: 'Randy Field Rafferty', gcName: null }
    const alcott = file({ name: '4969 Alcott Ridge signed contract (dragged).pdf', folderName: 'Randy Field Rafferty' })
    expect(matchDriveContracts([alcott], [bancroft])[0]).toMatchObject({ jobId: null, confidence: 'none', reason: "names 4969 Alcott Ridge, not the job's address" })
    // A job with no house number cannot be contradicted: the find stays a check.
    const grayFox: DriveMatchJob = { id: 'j583', jobNumber: '583', jobName: 'Davenport', jobAddress: 'Gray Fox Trail, Neeses, SC', customerName: 'DWT (Davenport)', gcName: null }
    expect(matchDriveContracts([file({ name: '4969 Alcott Ridge signed contract.pdf', folderName: 'Davenport' })], [grayFox])[0]).toMatchObject({ jobId: 'j583', confidence: 'check' })
    // The old fixtures still match as before.
    expect(summarizeDriveMatches(matchDriveContracts([file({ name: 'TF Halden – Mission Flats – Subcontract (signed).pdf', folderName: '9345 Iverson Dr' })], JOBS))).toMatchObject({ confident: 1 })
  })

  it('Signed on comes from the file date', () => {
    expect(signedOnFromModified('2026-06-14T15:00:00.000Z')).toBe('2026-06-14')
    expect(signedOnFromModified(null)).toBe('')
    expect(signedOnFromModified('nope')).toBe('')
  })
})
