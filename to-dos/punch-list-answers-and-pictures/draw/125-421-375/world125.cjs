// Invented rows for card #125: the customer's conversation on the Pipeline row.
const NOW = '2026-11-24T10:40:00-06:00'
const id = (g, n) => `00000000-0000-4194-${g}-${String(n).padStart(12, '0')}`
const U = (n) => `00000000-0000-4194-8000-0000000000${n}`
const ROSA = U('03'), PACO = U('06'), SID = U('07')
const JOB = (n) => id('8002', n)
const CONTACT = (n) => id('8009', n)
const d = (offset, hhmm) => { const x = new Date('2026-11-24T12:00:00Z'); x.setUTCDate(x.getUTCDate() + offset); return `${x.toISOString().slice(0, 10)}T${hhmm}:00-06:00` }
const m = (n, contact, channel, direction, when, body, who, job, extra = {}) => ({ id: id('800a', n), contact_id: CONTACT(contact), channel_id: null, bid_id: null, project_id: null, channel, direction, at: when, subject: null, body, who_text: who, who_user_id: null, office_only: direction === 'team', quo_rev: 0, jobs_ledger_id: job ? JOB(job) : null, created_at: when, duration_seconds: null, summary: null, transcript: null, delivery: null, auto: false, optout_line: null, back_on: null, back_by: null, ...extra })
const messages = [
  // Sam Sample on the leak job (#1327)
  m(1, 1, 'email', 'in', d(-2, '07:50'), 'Two photos from this morning.', 'Sam Sample', null, { subject: 'Photos of the wet floor' }),
  m(2, 1, 'text', 'out', d(-1, '15:10'), 'Hi Sam, the line is rerouted and the pressure test held. The patch crew comes Friday morning.', 'Rosa Sample', 5, { who_user_id: ROSA }),
  m(3, 1, 'text', 'in', d(0, '08:12'), 'Thank you. The floor by the back door is still damp. Can someone look at it Thursday?', 'Sam Sample', 5),
  // Pat Sample on Cedar Bend, building C (#1321)
  m(4, 2, 'email', 'in', d(-1, '16:40'), 'Can your crew start building C Monday? The slab is poured.', 'Pat Sample', 3, { subject: 'Building C start' }),
  m(5, 2, 'note', 'team', d(0, '09:05'), 'Called Pat back, waiting on the revised set before we commit.', 'Rosa Sample', 3, { who_user_id: ROSA }),
  // Elena on the retail shell (#1318)
  m(6, 3, 'call', 'in', d(-2, '11:30'), 'Asked whether the inspection is still on for 9.', 'Elena', 2, { duration_seconds: 192, summary: 'Asked whether the inspection is still on for 9.' }),
  m(7, 3, 'text', 'out', d(-2, '11:42'), 'Still on for 9, we will be there at 8:30.', 'Sid Sample', 2, { who_user_id: SID }),
  m(8, 4, 'text', 'in', d(-1, '15:02'), 'Paperwork for building C is signed and sent back.', 'Sam Plumber', 3),
]
const contactOf = { 1: ['customer', 'Sam Sample'], 2: ['customer', 'Pat Sample'], 3: ['customer', 'Elena'], 4: ['trade', 'Sam Plumber'] }
const names = { [ROSA]: 'Rosa Sample', [SID]: 'Sid Sample' }
const line = (job, x) => { const n = Number(x.contact_id.slice(-1)); return { job_id: JOB(job), id: x.id, contact_id: x.contact_id, contact_kind: contactOf[n][0], contact_name: contactOf[n][1], contact_goes_by: null, channel: x.channel, direction: x.direction, at: x.at, who_user_id: x.who_user_id, who_text: x.who_text, who_name: x.who_user_id ? names[x.who_user_id] : null, subject: x.subject, body: x.body, duration_seconds: x.duration_seconds, summary: x.summary, transcript: null, delivery: null, auto: false, tied: !!x.jobs_ledger_id } }
const pipeline_customer_lines = [line(5, messages[0]), line(5, messages[1]), line(5, messages[2]), line(3, messages[3]), line(3, messages[7]), line(2, messages[5]), line(2, messages[6])]
const note = (n, job, who, name, when, body) => ({ id: id('800c', n), job_id: JOB(job), author_user_id: who, body, created_at: when, updated_at: when, _name: name })
const notes = [
  note(1, 5, PACO, 'Paco Sample', d(-2, '14:10'), 'Found the leak under the hall bath. Cut the slab and capped the line for the night.'),
  note(2, 5, SID, 'Sid Sample', d(-1, '09:30'), 'Reroute through the attic is done. Pressure test held at 80 for 30 minutes.'),
  note(3, 5, ROSA, 'Rosa Sample', d(-1, '15:05'), 'Patch crew is booked for Friday morning.'),
  note(4, 3, SID, 'Sid Sample', d(-1, '10:15'), 'Walked building C with Pat. Ground rough passed.'),
  note(5, 2, PACO, 'Paco Sample', d(0, '07:20'), 'Second floor rough-in is about half done.'),
]
const stat = (job) => { const mine = notes.filter((x) => x.job_id === JOB(job)); const last = mine[mine.length - 1]; return { job_id: JOB(job), note_count: mine.length, last_note_at: last.created_at, last_note_body: last.body, last_note_author_name: last._name, report_count: 0, last_report_at: null, last_report_author_name: null, last_report_template_name: null, last_report_preview: null } }
const events = [
  { id: id('800d', 1), event_type: 'contract_sent', occurred_at: d(-3, '09:02'), actor_user_id: ROSA, actor_name: 'Rosa Sample', summary: 'Contract sent to the customer', detail: null, financial: false },
  { id: id('800d', 2), event_type: 'contract_viewed', occurred_at: d(-3, '09:40'), actor_user_id: null, actor_name: null, summary: 'Contract opened by the customer', detail: null, financial: false },
]
const extra = () => ({
  tables: { messages, jobs_ledger_thread_notes: notes.map(({ _name, ...r }) => r), contact_channels: [
    { id: id('800e', 1), contact_id: CONTACT(1), kind: 'phone', value: '(512) 555-0100', opted_out_at: null, usual_at: null, created_at: d(-80, '09:00') },
    { id: id('800e', 2), contact_id: CONTACT(1), kind: 'email', value: 'sam.sample@example.com', opted_out_at: null, usual_at: null, created_at: d(-80, '09:00') },
  ] },
  add: { app_settings: [{ key: 'messages_texts_on_v1', value_text: 'true', value_num: null }] },
  rpc: { pipeline_customer_lines, jobs_ledger_thread_note_stats: [stat(5), stat(3), stat(2)], list_job_activity_events: events, contact_for_customer: CONTACT(1), list_job_payment_promises_for: [] },
})
module.exports = { NOW, extra, JOB }
