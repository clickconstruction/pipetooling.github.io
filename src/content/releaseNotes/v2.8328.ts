import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8328',
  date: '2026-11-23',
  title: 'Permits: San Antonio’s nightly read no longer skips a permit dated just before its start',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The nightly read looks at San Antonio’s applications twice: once for the newly filed, once for the ones whose permit was just issued.',
    'The second look took its starting day from what the first look had just written. On a night that day jumped forward, permits the city had dated before it were never read, and those applications kept reading as still waiting.',
    'Both looks now take their starting day from what was held before the night’s read began, and the second goes back thirty days where it went back ten.',
    'The first nightly read after this is switched on picks up the missed applications by itself.',
  ],
}

export default note
