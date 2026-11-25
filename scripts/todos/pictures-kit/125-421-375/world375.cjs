// Invented rows for card #375: tag a teammate in a task note. The reader is Paco Sample (primary) on a phone.
const NOW = '2026-11-24T10:40:00-06:00'
const TODAY = '2026-11-24'
const id = (g, n) => `00000000-0000-4194-${g}-${String(n).padStart(12, '0')}`
const U = (n) => `00000000-0000-4194-8000-0000000000${n}`
const DEVON = U('01'), MAX = U('02'), ROSA = U('03'), CORA = U('04'), PACO = U('06'), SID = U('07')
const JOB = (n) => id('8002', n)
const d = (offset, hhmm) => { const x = new Date('2026-11-24T12:00:00Z'); x.setUTCDate(x.getUTCDate() + offset); return `${x.toISOString().slice(0, 10)}T${hhmm}:00-06:00` }
const ITEM = (n) => id('8011', n), INST = (n) => id('8012', n), EV = (n) => id('8013', n), TAG = (n) => id('8014', n)
const item = (n, title, by, when) => ({ id: ITEM(n), title, created_by_user_id: by, created_at: when, updated_at: when, start_date: TODAY, due_date: null, repeat_type: 'once', repeat_days_after: null, repeat_days_of_week: null, repeat_end_date: null, show_until_completed: true, links: null, notify_on_complete_user_id: null, notify_creator_on_complete: false, asks_for_photo: false, roadmap_group_task_id: null, remind_day_before: false, reminder_scope: null, reminder_time: null, escalate_after_days: null, source_tag: null, painted_map_id: null, place_name: null, place_lat: null, place_lng: null, place_accuracy_m: null, place_set_at: null, place_set_by: null, spot_photo_path: null })
const inst = (n, when, done = null) => ({ id: INST(n), checklist_item_id: ITEM(n), scheduled_date: TODAY, completed_at: done, completed_by_user_id: done ? PACO : null, created_at: when, notes: null, percent_complete: done ? 100 : 0, reviewed_at: null, reviewed_by: null })
const ev = (n, i, who, when, body, type = 'comment') => ({ id: EV(n), instance_id: INST(i), event_type: type, actor_user_id: who, body, created_at: when, percent: null })
const items = [
  item(1, 'Pick up the slab leak locator from the shop', ROSA, d(-1, '16:10')),
  item(2, 'Photograph the water heater data plate at 100 Sample St', SID, d(-1, '16:30')),
  item(3, 'Turn in last week’s receipts', CORA, d(-3, '09:00')),
]
const instances = [inst(1, d(-1, '16:10')), inst(2, d(-1, '16:30')), inst(3, d(-3, '09:00'), d(0, '07:15'))]
const events = [
  ev(1, 1, ROSA, d(-1, '16:12'), 'It is on the charger by the back door.'),
  ev(2, 1, ROSA, d(0, '08:05'), '@Paco Sample bring it back to the shop by Friday, Hal needs it Monday.'),
  ev(3, 2, SID, d(0, '08:55'), '@Paco Sample which size relief valve is on it?'),
  ev(4, 3, PACO, d(-1, '15:20'), '@Cora Sample two of them are faded, is a photo of each enough?'),
  ev(5, 3, CORA, d(-1, '16:02'), 'Yes, a clear photo of each is enough.'),
]
const tags = [
  { id: TAG(1), event_id: EV(2), instance_id: INST(1), item_id: ITEM(1), tagged_user_id: PACO, tagged_name: 'Paco Sample', tagger_user_id: ROSA, created_at: d(0, '08:05'), cleared_at: null, cleared_how: null, answer_event_id: null, asker_seen_at: null },
  { id: TAG(2), event_id: EV(3), instance_id: INST(2), item_id: ITEM(2), tagged_user_id: PACO, tagged_name: 'Paco Sample', tagger_user_id: SID, created_at: d(0, '08:55'), cleared_at: null, cleared_how: null, answer_event_id: null, asker_seen_at: null },
  { id: TAG(3), event_id: EV(4), instance_id: INST(3), item_id: ITEM(3), tagged_user_id: CORA, tagged_name: 'Cora Sample', tagger_user_id: PACO, created_at: d(-1, '15:20'), cleared_at: d(-1, '16:02'), cleared_how: 'answered', answer_event_id: EV(5), asker_seen_at: null },
]
const mine = (t, kind, i, title, noteBody, taggerName, taggedName, answer = null) => ({ tag_id: t.id, kind, source: 'task', instance_id: t.instance_id, item_id: t.item_id, task_title: title, task_date: TODAY, tagged_left: false, note_id: t.event_id, job_id: null, job_name: null, job_number: null, job_kind: null, customer_name: null, note_body: noteBody, note_created_at: t.created_at, tagger_user_id: t.tagger_user_id, tagger_name: taggerName, tagged_user_id: t.tagged_user_id, tagged_name: taggedName, created_at: t.created_at, cleared_at: t.cleared_at, cleared_how: t.cleared_how, answer_body: answer, answer_note_id: t.answer_event_id, asker_seen_at: t.asker_seen_at })
const note_tags_mine = [
  mine(tags[0], 'waiting', 1, items[0].title, events[1].body, 'Rosa Sample', 'Paco Sample'),
  mine(tags[1], 'waiting', 2, items[1].title, events[2].body, 'Sid Sample', 'Paco Sample'),
  mine(tags[2], 'asked', 3, items[2].title, events[3].body, 'Paco Sample', 'Cora Sample', events[4].body),
  { tag_id: TAG(9), kind: 'waiting', source: 'job', instance_id: null, item_id: null, task_title: null, task_date: null, tagged_left: false, note_id: id('8015', 1), job_id: JOB(2), job_name: 'Sample Retail Shell rough-in', job_number: '1318', job_kind: 'job', customer_name: 'Sample Owner LLC', note_body: '@Paco Sample is the second floor ready for the inspector Thursday?', note_created_at: d(-1, '14:40'), tagger_user_id: MAX, tagger_name: 'Max Sample', tagged_user_id: PACO, tagged_name: 'Paco Sample', created_at: d(-1, '14:40'), cleared_at: null, cleared_how: null, answer_body: null, answer_note_id: null, asker_seen_at: null },
]
const taggable = [
  { user_id: ROSA, name: 'Rosa Sample', role: 'assistant', on_task: true, gave: true },
  { user_id: DEVON, name: 'Devon Sample', role: 'dev', on_task: false, gave: false },
  { user_id: MAX, name: 'Max Sample', role: 'master_technician', on_task: false, gave: false },
  { user_id: CORA, name: 'Cora Sample', role: 'controller', on_task: false, gave: false },
]
const extra = (more = {}) => ({
  tables: {
    checklist_items: items, checklist_instances: instances,
    checklist_instance_assignees: instances.map((x) => ({ checklist_instance_id: x.id, user_id: PACO })),
    checklist_item_assignees: items.map((x, i) => ({ checklist_item_id: x.id, user_id: PACO, display_order: i + 1 })),
    checklist_instance_events: events, task_note_tags: tags,
  },
  rpc: { note_tags_mine, task_note_taggable: taggable, job_note_tags_count: 4, note_tags_count: 4, task_note_tags_count: 3, task_note_tags_seen: 0, job_note_tags_seen: 0, ...(more.rpc || {}) },
})
module.exports = { NOW, extra }
