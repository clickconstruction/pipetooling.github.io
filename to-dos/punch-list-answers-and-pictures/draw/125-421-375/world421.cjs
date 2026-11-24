// Invented rows for card #421: a day was heard, say what it is.
const NOW = '2026-11-24T10:40:00-06:00'
const id = (g, n) => `00000000-0000-4194-${g}-${String(n).padStart(12, '0')}`
const U = (n) => `00000000-0000-4194-8000-0000000000${n}`
const ROSA = U('03'), SID = U('07')
const JOB = (n) => id('8002', n)
const CONTACT = (n) => id('8009', n)
const d = (offset, hhmm) => { const x = new Date('2026-11-24T12:00:00Z'); x.setUTCDate(x.getUTCDate() + offset); return `${x.toISOString().slice(0, 10)}T${hhmm}:00-06:00` }
const m = (n, contact, channel, direction, when, body, who, job, extra = {}) => ({ id: id('800a', n), contact_id: CONTACT(contact), channel_id: null, bid_id: null, project_id: null, channel, direction, at: when, subject: null, body, who_text: who, who_user_id: null, office_only: direction === 'team', quo_rev: 0, jobs_ledger_id: job ? JOB(job) : null, created_at: when, duration_seconds: null, summary: null, transcript: null, delivery: null, auto: false, optout_line: null, back_on: null, back_by: null, back_words: null, back_done_at: null, mailbox: null, tied_by: null, invitation: null, history: false, step_key: null, ...extra })
const messages = [
  // Sam Plumber, a trade partner, on Cedar Bend building C (#1321)
  m(11, 4, 'text', 'out', d(-4, '09:15'), 'Sam, when can your crew start the building C top-out?', 'Rosa Sample', 3, { who_user_id: ROSA }),
  m(12, 4, 'text', 'in', d(-4, '09:48'), 'We can start building C on Wednesday.', 'Sam Plumber', 3),
  m(13, 4, 'text', 'out', d(-1, '14:05'), 'Thanks. Can you also send your number for the building D fixtures, and your new insurance certificate?', 'Rosa Sample', 3, { who_user_id: ROSA }),
  m(14, 4, 'text', 'in', d(-1, '15:02'), 'I will have the quote to you by Friday.', 'Sam Plumber', 3),
  m(15, 4, 'voicemail', 'in', d(0, '08:40'), '"Hey Rosa, it is Sam. The insurance renews on Monday. I will send the certificate over then."', 'Sam Plumber', 3, { duration_seconds: 21, transcript: 'Hey Rosa, it is Sam. The insurance renews on Monday. I will send the certificate over then.' }),
  // Sam Sample, a customer, on the leak job (#1327)
  m(1, 1, 'text', 'out', d(-1, '15:10'), 'Hi Sam, the line is rerouted and the pressure test held. Your bill comes by email today.', 'Rosa Sample', 5, { who_user_id: ROSA }),
  m(2, 1, 'text', 'in', d(0, '08:12'), 'Thank you. I get paid this week, so I can pay it on Friday.', 'Sam Sample', 5),
  // Pat Sample and Elena, as the lens world has them
  m(4, 2, 'email', 'in', d(-1, '16:40'), 'Can your crew start building C Monday? The slab is poured.', 'Pat Sample', 3, { subject: 'Building C start' }),
  m(6, 3, 'call', 'in', d(-2, '11:30'), 'Asked whether the inspection is still on for 9.', 'Elena', 2, { duration_seconds: 192, summary: 'Asked whether the inspection is still on for 9.' }),
  m(7, 3, 'text', 'out', d(-2, '11:42'), 'Still on for 9, we will be there at 8:30.', 'Sid Sample', 2, { who_user_id: SID }),
]
const promises = [
  { id: id('800f', 1), message_id: id('800a', 12), kind: 'start', state: 'written', day: '2026-11-25', day_words: 'Wednesday', writes: 'start', job_id: null, decided_by: ROSA, decided_at: d(-4, '10:02'), created_at: d(-4, '10:02') },
]
const extra = (more = {}) => ({
  tables: { messages, message_promises: promises, contact_channels: [
    { id: id('800e', 1), contact_id: CONTACT(1), kind: 'phone', value: '(512) 555-0100', opted_out_at: null, usual_at: null, created_at: d(-80, '09:00') },
    { id: id('800e', 3), contact_id: CONTACT(4), kind: 'phone', value: '(512) 555-0108', opted_out_at: null, usual_at: null, created_at: d(-80, '09:00') },
  ] },
  add: { app_settings: [{ key: 'messages_texts_on_v1', value_text: 'true', value_num: null }] },
  rpc: { contact_for_customer: CONTACT(1), list_job_payment_promises_for: [] },
  ...more,
})
module.exports = { NOW, extra, CONTACT, JOB, id }
