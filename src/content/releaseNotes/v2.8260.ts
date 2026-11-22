import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8260',
  date: '2026-11-21',
  title: 'Permits, Market: San Antonio’s clock says how many applications still wait',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A line under the clock from an application to its permit now says how many of the year’s applications still wait for a permit.',
    'It also says how many of those were filed over six months ago.',
    'The clock’s own words now say it counts only applications that have their permit, which is why it reads short.',
  ],
}

export default note
