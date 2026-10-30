import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6103',
  date: '2026-10-29',
  title: 'Legal desk: How much? adds only the retainage no bill already asks for',
  kind: 'fix',
  highlights: [
    'When a bill went out for the whole amount and the GC paid it short by the retainage, the open bill already held the retainage and How much? added it again. The claim now adds only the retainage no sent bill carries, so that account reads the open bills alone.',
    'The line under How much? says what was added and why: the retainage no bill asks for yet, another part already on a bill, or that the whole retainage held is already inside the open bills. What’s left for us? works from the same claim.',
    'A bill sent net of retainage, the way the AIA window bills, still adds the retainage held. On a job with no pay application, a bill the GC paid short by exactly the figure typed in the lien details is read as carrying it; otherwise the typed figure is still added.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
