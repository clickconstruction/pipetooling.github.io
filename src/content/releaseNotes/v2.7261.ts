import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7261',
  date: '2026-11-14',
  title: 'Lien desk: a started paper stays on the desk, whatever its day',
  kind: 'fix',
  highlights: [
    'A lien notice, affidavit or retainage notice someone has drafted, sent for approval, approved or held now stays on the Lien desk even when its day is more than 30 days out. Before, it showed only in the job’s Lien window until the day came within 30 days.',
    'On To do it sits under Coming up by its day, or under the leader’s group while it waits for approval. On By paper it is in its pile as any other.',
    'Nothing else past 30 days shows: a job with no started paper reads as before, and a drafted notice brings only the months it names.',
    'The Dashboard’s lien counts include the started papers too.',
  ],
}

export default note
