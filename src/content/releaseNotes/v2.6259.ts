import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6259',
  date: '2026-11-02',
  title: 'The courtesy notice before a lien: the rules and the words',
  kind: 'feature',
  highlights: [
    'Supply houses send a plain reminder before they lien: we already sent you the notice, here is the day the lien goes on unless it is paid, here is where to pay, here is who to call. The Lien desk is getting that step.',
    'This first part settles the rules. The reminder is offered from day 7 after a sent notice, waits a week between presses, closes once the claim is paid, the owner calls, the GC gives written okay, the affidavit is filed or they answer, and is held when the lien cannot go on.',
    'The words are set here too: the notice stands, this is a reminder and not a new notice, the lien’s day, the pay link, the master plumber’s number. The owner’s copy keeps the rule to pay only with the GC’s written okay.',
    'Nothing changes on a screen yet. The press on the desk comes next.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
