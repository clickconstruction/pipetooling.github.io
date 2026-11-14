import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7247',
  date: '2026-11-14',
  title: 'The dev seat drafts a lien affidavit on the Lien desk',
  kind: 'feature',
  highlights: [
    'A lien affidavit can now be drafted from the dev seat, the same draft the Lien desk saves before a paper is sent for approval.',
    'Before anything is saved, the seat reads back what the paper would say today: the months it names, the notice to the owner and the claim.',
    'It drafts only a job the desk is ready to draft. A job still missing a property fact is refused, with what is missing.',
    'It is a draft alone. Sending it for approval, approving it and printing it stay on the Lien desk.',
  ],
}

export default note
