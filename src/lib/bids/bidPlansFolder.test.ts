import { describe, expect, it } from 'vitest'
import { bidPlansFolderName, DIVISION_BID_FOLDERS, divisionBidFolderFor, driveFolderUrl, findFolderWords } from './bidPlansFolder'

describe('bidPlansFolder (v2.4162)', () => {
  it('three division folders, each a Drive folder link', () => {
    expect(DIVISION_BID_FOLDERS.map((d) => d.key)).toEqual(['plumbing', 'electrical', 'hvac'])
    for (const d of DIVISION_BID_FOLDERS) expect(d.url).toBe(driveFolderUrl(d.folderId))
  })

  it('a service type names its division folder; none until one is picked', () => {
    expect(divisionBidFolderFor('Plumbing')?.key).toBe('plumbing')
    expect(divisionBidFolderFor('Electrical')?.key).toBe('electrical')
    expect(divisionBidFolderFor('HVAC')?.key).toBe('hvac')
    expect(divisionBidFolderFor('')).toBeNull()
    expect(divisionBidFolderFor('Roofing')).toBeNull()
  })

  it('the folder is named the way the job folder is: the project name', () => {
    expect(bidPlansFolderName({ project_name: '  Knight Contracting- Marcos Pizza Boerne ', bid_number: '367', id: 'x' })).toBe('Knight Contracting- Marcos Pizza Boerne')
    expect(bidPlansFolderName({ project_name: null, bid_number: '367', id: 'x' })).toBe('Bid 367')
  })

  it('says what Find found, in plain words', () => {
    expect(findFolderWords({ found: false }, 'Marcos')).toMatch(/^Not there yet\. Is the folder named exactly “Marcos”/)
    expect(findFolderWords({ found: true, id: 'a', link: 'l', pdfs: 0 }, 'Marcos')).toMatch(/no PDF in it yet/)
    expect(findFolderWords({ found: true, id: 'a', link: 'l', pdfs: 3 }, 'Marcos')).toBe('Found the folder · 3 PDFs. The link is filled in.')
    expect(findFolderWords({ error: 'timeout' }, 'Marcos')).toMatch(/^Could not look just now: timeout/)
  })
})
