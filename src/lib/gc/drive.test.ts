import { describe, expect, it } from 'vitest'
import { driveLink, driveLinkProblem } from './drive'

describe('the plans live in Google Drive', () => {
  it('reads a Drive file or folder link, and nothing else', () => {
    expect(driveLink('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing')).toEqual({ kind: 'file', id: '1AbCdEfGhIjKlMn' })
    expect(driveLink('drive.google.com/drive/u/0/folders/1AbCdEfGhIjKlMn')).toEqual({ kind: 'folder', id: '1AbCdEfGhIjKlMn' })
    expect(driveLink('https://drive.google.com/open?id=1AbCdEfGhIjKlMn')).toEqual({ kind: 'file', id: '1AbCdEfGhIjKlMn' })
    expect(driveLink('https://www.dropbox.com/s/abc/plans.pdf')).toBeNull()
    expect(driveLinkProblem('')).toBe('Add the Google Drive link to the plans.')
    expect(driveLinkProblem('https://example.com/plans.pdf')).toBe('The plans link is not a Google Drive link.')
    expect(driveLinkProblem('https://drive.google.com/drive/folders/1HcBidSetAnyoneWithTheLink')).toBeNull()
  })
})
