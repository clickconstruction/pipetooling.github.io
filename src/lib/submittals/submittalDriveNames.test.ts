import { describe, expect, it } from 'vitest'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { driveFileLink, isFileable, jobFolderName, packageFileName, SUBMITTALS_FOLDER } from '../../../supabase/functions/_shared/submittalDriveNames'
import { driveFolderIdFromUrl } from '../../../supabase/functions/_shared/driveUpload'

describe('submittalDriveNames', () => {
  it('names the job folder as drive-intake does, and the file by revision and shared date', () => {
    expect(jobFolderName({ project_name: '  SpaceX BA-02N ', bid_number: '375', id: 'x' })).toBe('SpaceX BA-02N')
    expect(jobFolderName({ project_name: null, bid_number: '375', id: 'x' })).toBe('Bid 375')
    expect(packageFileName(3, '2026-09-17T15:00:00Z', APP_CALENDAR_TZ)).toBe('Rev 3 · 2026-09-17.pdf')
    expect(packageFileName(2, '2026-09-17T04:30:00Z', APP_CALENDAR_TZ)).toBe('Rev 2 · 2026-09-16.pdf')
    expect(SUBMITTALS_FOLDER).toBe('Submittals')
    expect(driveFileLink('abc')).toBe('https://drive.google.com/file/d/abc/view')
  })
  it('files shared, superseded and reviewed revisions with a package; never a draft or an unbuilt one', () => {
    expect(isFileable('shared', 'p.pdf')).toBe(true)
    expect(isFileable('superseded', 'p.pdf')).toBe(true)
    expect(isFileable('draft', 'p.pdf')).toBe(false)
    expect(isFileable('shared', null)).toBe(false)
  })
  it('reads a folder id out of a Drive folder link', () => {
    expect(driveFolderIdFromUrl('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345')
    expect(driveFolderIdFromUrl('https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345?usp=x')).toBe('1AbCdEfGhIjKlMnOpQrStUvWxYz012345')
    expect(driveFolderIdFromUrl('https://example.com')).toBeNull()
    expect(driveFolderIdFromUrl(null)).toBeNull()
  })
})
