import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2250',
  date: '2026-08-24',
  title: 'Stage review on the Review tab + task cost estimates',
  kind: 'feature',
  highlights: [
    'The Goals section on Checklist → Review now narrates stage unlocks: a green banner shows recently finished stages and exactly which stages they opened.',
    'Opening a stage shows what finishing it would unlock next, and a Remind button nudges everyone with open tasks in that stage.',
    'Devs can put a dollar estimate on any task — pick who does it, their hourly rate fills in from pay config, set hours — and gold cost chips roll up per task, per person, per stage, and per roadmap.',
  ],
}

export default note
