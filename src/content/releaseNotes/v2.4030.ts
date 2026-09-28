import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4030',
  date: '2026-09-28',
  title: 'Bid Board: a Reply book for the wording the team reuses',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'A new Reply book button on the Bid Board opens the replies the team shares: a decline for a project too far from the office, a follow-up a week after a bid went out. Search it, or tap a kind.',
    'Copy puts a reply on your clipboard signed with your own name, whoever wrote it. Paste it where you are writing and change what the bid needs.',
    'Anyone with the Bid Board can add a reply. Only the person who posted it, or a dev, can change or delete it.',
    'On a phone, Reply book and Customer review are icons, so the search box keeps its room.',
  ],
}

export default note
