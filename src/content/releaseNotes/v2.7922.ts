import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7922',
  date: '2026-11-19',
  title: 'Permits: another tenant’s plumbing permit no longer closes a job',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Prospects → Permits, a San Antonio job no longer reads as taken because someone else pulled a plumbing permit at the same street address. In a shopping centre that was often another tenant.',
    'About 68 San Antonio permits since August come back to the skim. The other four cities read exactly as before.',
    'San Antonio lists a job’s plumbing permit under the applicant’s own name, so the app no longer shows another applicant as a builder’s plumber. Builders reads not named on the permits there.',
    'A builder’s count of permits with no plumber yet now ignores a plumbing permit filed long before the job.',
  ],
}

export default note
