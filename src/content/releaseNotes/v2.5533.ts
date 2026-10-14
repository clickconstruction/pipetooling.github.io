import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5533',
  date: '2026-10-14',
  title: 'Lien desk: the run records what is ready, and a printed notice is not held for its signature',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Recording a run is no longer all or nothing. An envelope marked in red, such as one with no mailing address, stays in the pile with its reason and its doors, and every ready envelope records now. The foot says exactly what will happen, such as 9 notices are held and the 13 ready ones record now, and the button reads Record 13 · 9 held stay in the pile. It waits only when nothing at all is ready.',
    'A notice that already printed and went in the mail is no longer held for the leader’s signature. Its card says it records as it went, in amber, and keeps Leader here, sign and He signed the paper right there, so a pen signature on the paper can be recorded first.',
    'After the record, the held notices keep their rows in the run, so their doors are right there for the next move. Nothing changes before printing: an unsigned notice still cannot reach the stack.',
  ],
}

export default note
