import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2828',
  date: '2026-09-05',
  title: 'Job Summary — a Capacity view: were we full?',
  kind: 'feature',
  highlights: [
    'A seventh view on Jobs → Job Summary. One bar per week: the field roster’s available hours as an outline, approved field hours filled, utilization on top — amber under 60%, red over 100%.',
    'Tiles for utilization over the window, the peak week, weeks under 60% (room to sell), weeks over 100% (more hours than the roster’s day), and the crew today.',
    'Available hours count every master technician and helper active on the roster that weekday. If the roster can’t be read, the view estimates from who clocked in and says so.',
  ],
}

export default note
