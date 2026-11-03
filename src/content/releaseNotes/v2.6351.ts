import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6351',
  date: '2026-11-02',
  title: 'The Development page’s Plans look counts only the jobs that build from plans',
  kind: 'fix',
  highlights: [
    'The chip under the Plans table now reads “N jobs follow no plans yet” and counts only the jobs that build from plans. A job that only carries bills, and a service call priced by the work, are left out: neither ever follows a set.',
    'A quiet line under the chips says how many jobs were left out and why, such as “22 jobs need no plans: 20 bill only, 2 are service calls”, so the count is never a mystery.',
    'The ask to the estimators carries the smaller count, and the strip at the top of the look reads the same words.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'superintendent', 'primary'],
}

export default note
