import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4679',
  date: '2026-10-06',
  title: 'Release of Lien: a waiver waiting for a signature reopens with the leader it asked',
  kind: 'fix',
  highlights: [
    'Reopen a waiver that is waiting for a leader’s signature, and the Signs pick shows that leader, not the default one.',
    'He is here, he signs now and Sign it now no longer move the request to the default leader. The pad stays the asked leader’s to draw on, even after he is archived.',
    'Opening the window on another job before the last one finished loading no longer brings back the last job’s waiver.',
  ],
}

export default note
