import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6872',
  date: '2026-11-10',
  title: 'A bid asks once who the city lists on its permit',
  kind: 'feature',
  highlights: [
    'A permit lists one contact, and it is not always the builder. Under the permit that looks like a bid’s job, the window now asks once: do you know who that is? Works for the GC, Someone else, or Not sure.',
    'Works for the GC shows the name’s other permits first. Then you choose Show all under the GC, or This permit only, since one person can file for more than one builder.',
    'Every answer keeps who gave it and when, and Undo takes it back. Not sure leaves the question open for the rest of the team.',
    'Under the GC’s card, Other permits under names tied to them lists the GC’s own name and each name tied to it, with what the city lists that name on.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
