import { describe, expect, it } from 'vitest'
import { jobDocumentFolderLinks } from './jobDocumentsTab'

describe('jobDocumentFolderLinks', () => {
  it('lists the folder links that are set, as web addresses only', () => {
    expect(
      jobDocumentFolderLinks({
        google_drive_link: ' https://drive.google.com/drive/folders/abc ',
        job_plans_link: '',
        job_pictures_link: 'https://photos.app.goo.gl/xyz',
      }),
    ).toEqual([
      { label: 'Job folder', url: 'https://drive.google.com/drive/folders/abc' },
      { label: 'Pictures', url: 'https://photos.app.goo.gl/xyz' },
    ])
  })

  it('leaves out anything that is not a web address', () => {
    expect(jobDocumentFolderLinks({ google_drive_link: 'javascript:alert(1)', job_plans_link: 'in the truck', job_pictures_link: null })).toEqual([])
    expect(jobDocumentFolderLinks({})).toEqual([])
  })
})
