/**
 * The reads behind one person's day of tasks (punch list #381): today's tasks, the older ones still open, and what is
 * dated ahead. Each takes the person as a value, so Today reads the signed-in person and a look at someone else's day
 * reads that person, through the same three calls. What the caller may read is the database's rule on each table: a
 * person reads their own tasks, and the office reads everyone's.
 */
import { supabase } from '../supabase'
import type { ChecklistCardEvent } from '../checklistCardEvents'
import { NO_ORDER, olderOpenParts, olderRowsToRead, orderTodayRows, type PersonDayRow } from './personDay'

/** What a card's read asks of the roadmap task it was made from. */
const ROADMAP_EMBED = 'checklist_tech_tree_group_tasks(group_id, asks_for_photo, checklist_tech_tree_groups(title, roadmap_id, checklist_tech_tree_roadmaps(title)))'
const ROW_COLUMNS = 'id, checklist_item_id, scheduled_date, completed_at, percent_complete, notes, completed_by_user_id, created_at, reviewed_at, reviewed_by'

const TODAY_SELECT = `${ROW_COLUMNS}, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_at, created_by_user_id, asks_for_photo, due_date, repeat_type, roadmap_group_task_id, ${ROADMAP_EMBED}), checklist_instance_assignees!inner(user_id)`
const OLDER_SELECT = `${ROW_COLUMNS}, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_at, created_by_user_id, asks_for_photo, show_until_completed, due_date, repeat_type, roadmap_group_task_id, ${ROADMAP_EMBED}), checklist_instance_assignees!inner(user_id)`
const AHEAD_SELECT = `${ROW_COLUMNS}, checklist_items(title, links, notify_on_complete_user_id, notify_creator_on_complete, created_by_user_id, roadmap_group_task_id, checklist_tech_tree_group_tasks(group_id, checklist_tech_tree_groups(title, roadmap_id, checklist_tech_tree_roadmaps(title)))), checklist_instance_assignees!inner(user_id)`

/** How many older open tasks one read brings. A person past this has the newest ones listed. */
export const OLDER_OPEN_LIMIT = 300
/** How many tasks dated ahead one read brings. */
export const AHEAD_LIMIT = 30

export type PersonDay = {
  /** The tasks dated today, done or not, in the person's own order. */
  today: PersonDayRow[]
  /** Older tasks still wanted: one-offs, show-until-done tasks and anything sent back. */
  stillOpen: PersonDayRow[]
  /** Repeating days that went unticked. */
  missed: PersonDayRow[]
  /** The missed days already answered as skipped. */
  skippedIds: Set<string>
}

/**
 * One person's day. A failed read of today's tasks comes back as `failure`, for the caller to draw with its reason.
 * The reads after it are quieter: a miss there leaves that part empty, as the page always did.
 */
export async function readPersonDay(personId: string, todayYmd: string): Promise<{ day: PersonDay } | { failure: unknown }> {
  const { data: todayData, error: e1 } = await supabase
    .from('checklist_instances')
    .select(TODAY_SELECT)
    .eq('checklist_instance_assignees.user_id', personId)
    .eq('scheduled_date', todayYmd)
    .order('created_at', { ascending: true })
  if (e1) return { failure: e1 }

  // Older open tasks, newest first under the cap, sorted into their parts once the threads that decide them are read.
  const { data: pastData } = await supabase
    .from('checklist_instances')
    .select(OLDER_SELECT)
    .eq('checklist_instance_assignees.user_id', personId)
    .is('completed_at', null)
    .lt('scheduled_date', todayYmd)
    .order('scheduled_date', { ascending: false })
    .limit(OLDER_OPEN_LIMIT)
  // The percent column is younger than the generated types (#273), so the rows pass through unknown.
  const olderOpen = (pastData ?? []) as unknown as PersonDayRow[]
  const toRead = olderRowsToRead(olderOpen)
  let transitions: ChecklistCardEvent[] = []
  if (toRead.length > 0) {
    const { data: transData } = await supabase
      .from('checklist_instance_events')
      .select('id, instance_id, event_type, actor_user_id, body, created_at, percent')
      .in('instance_id', toRead)
      .in('event_type', ['completed', 'reopened', 'skipped'])
      .order('created_at', { ascending: true })
    transitions = (transData ?? []) as unknown as ChecklistCardEvent[]
  }
  const parts = olderOpenParts(olderOpen, transitions, todayYmd)

  // The order the office set for this person, one row per task.
  const today = (todayData ?? []) as unknown as PersonDayRow[]
  const itemIds = [...new Set(today.map((r) => r.checklist_item_id))]
  const orderByItem = new Map<string, number>()
  if (itemIds.length > 0) {
    const { data: orderData } = await supabase.from('checklist_item_assignees').select('checklist_item_id, display_order').eq('user_id', personId).in('checklist_item_id', itemIds)
    for (const row of (orderData ?? []) as Array<{ checklist_item_id: string; display_order: number | null }>) orderByItem.set(row.checklist_item_id, row.display_order ?? NO_ORDER)
  }
  return { day: { today: orderTodayRows(today, orderByItem), ...parts } }
}

/** The person's tasks dated after today, soonest first. Null when the read failed, and the caller keeps what it had. */
export async function readPersonAhead(personId: string, todayYmd: string): Promise<PersonDayRow[] | null> {
  const { data, error } = await supabase
    .from('checklist_instances')
    .select(AHEAD_SELECT)
    .eq('checklist_instance_assignees.user_id', personId)
    .gt('scheduled_date', todayYmd)
    .order('scheduled_date', { ascending: true })
    .limit(AHEAD_LIMIT)
  if (error) return null
  return (data ?? []) as unknown as PersonDayRow[]
}

/** How many coming tasks one read brings: a week of a long daily round fits. */
export const COMING_UP_LIMIT = 300

/**
 * The person's open tasks dated after today and no later than `lastYmd`, soonest first, with what Coming up needs of
 * each. Null when the read failed.
 */
export async function readPersonComingUp(personId: string, todayYmd: string, lastYmd: string): Promise<Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string | null; repeat_type: string | null } | null }> | null> {
  const { data, error } = await supabase
    .from('checklist_instances')
    .select('id, checklist_item_id, scheduled_date, completed_at, checklist_items(title, repeat_type), checklist_instance_assignees!inner(user_id)')
    .eq('checklist_instance_assignees.user_id', personId)
    .is('completed_at', null)
    .gt('scheduled_date', todayYmd)
    .lte('scheduled_date', lastYmd)
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(COMING_UP_LIMIT)
  if (error) return null
  return (data ?? []) as unknown as Array<{ id: string; checklist_item_id: string; scheduled_date: string; completed_at: string | null; checklist_items: { title: string | null; repeat_type: string | null } | null }>
}
