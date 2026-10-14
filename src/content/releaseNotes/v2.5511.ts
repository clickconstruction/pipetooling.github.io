import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5511',
  date: '2026-10-13',
  title: 'Follow-ups: an Idle lens, a Next line and a door on every card',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Follow-ups deck on Jobs → Pipeline gains an Idle 21+ chip beside the stage chips. Press it and the deck deals only the jobs with no crew on site in 21 or more days, whatever their notes say. An idle card’s chip reads “idle 46 days” in red instead of “quiet 3 days”.',
    'Every card now carries a Next line under Why it’s here: Bill it, Schedule the next visit or close it, Put the next visit on the schedule, Nudge the customer for payment, or Work the account. A bill opens the job’s Bill tab from the card; a visit opens the week grid on the job.',
    'A link ending in ?followups=idle opens the deck on the Idle lens, the door the Dashboard’s idle card takes next. The List view marks idle rows.',
  ],
}

export default note
