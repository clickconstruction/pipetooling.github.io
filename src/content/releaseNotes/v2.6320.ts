import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6320',
  date: '2026-11-02',
  title: 'The superintendent’s line and the pace strip: the ground under the Projects board (punch list #242, PR 1)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'One reading per project says whether the job is ahead or behind at this pace: the work done against the hours used, in the job’s own crew days. Money leading the work by ten points or more outranks the hours.',
    'The pace strip draws it as one picture: the labor budget as the track, the real days as amber pieces, the days left as ticks, the work done as a blue mark, the money as a thin line, the stages as pieces with a bar where each ends.',
    'Hover a stage’s end bar for its card: what the stage is, the budget to reach it, and the day the crew passed it. Hover or tap a day for who clocked, the subs, what was bought and the report.',
    'Nothing on a screen yet. The Projects board beside Forecast and the superintendent’s phone card follow and draw this same strip.',
  ],
}

export default note
