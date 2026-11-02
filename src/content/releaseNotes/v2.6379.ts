import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6379',
  date: '2026-11-02',
  title: 'The Development page’s fifth tile says what is not yet billed, and the GC contact is set on the page',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'With no bill open on the site, the fifth count reads Not yet billed: what is left to bill, how much of it is done, and how many jobs have money left. Its card lists the waiting jobs with money left, biggest first. With a bill open the tile reads Open on bills as before.',
    'The GC contact line at the top opens a sheet: none yet · add one, or Change › when a contact is on record. The name, phone and email go onto every bid of the site that has none, or onto the ones that carry the contact being changed, in one press that names the count.',
    'The message after it offers Put it back, which restores each bid’s contact as it was.',
  ],
}

export default note
