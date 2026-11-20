import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8069',
  date: '2026-11-20',
  title: 'Permits, Market: the call list says when it could not be read',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When the year of permits did not load, Call this week said every builder was answered, showed zero builders to call, and said the city shows only issued permits. None of that was true. The list now shows the reason and a Retry, and no name or count.',
    'When the permits behind the open jobs did not load, the list drew with no job open on anyone and said nothing. It now waits and says why.',
    'When only the answers do not load, the list still shows. A line under the reason says a name already answered may be on it, and Retry reads the answers again.',
    'The chips show no counts while the list is still reading, so a zero no longer reads as a fact.',
  ],
}

export default note
