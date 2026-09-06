/**
 * Roles that can OPEN the Schedule board (Schedule Dispatch hub, Quickfill Schedule parity).
 * Reads are still scoped per role by RLS (`job_schedule_blocks_select`) — a superintendent
 * sees only blocks on assigned projects; the rest render as anonymous "busy" placeholders
 * via `schedule_hidden_block_counts`.
 */
export const CAN_VIEW_SCHEDULE_DISPATCH_ROLES: ReadonlySet<string> = new Set([
  'dev',
  'master_technician',
  'assistant',
  'superintendent',
  'controller',
])

/**
 * Roles that can EDIT schedule blocks (add / move / delete / note). Today this equals the
 * view set — `job_schedule_blocks` INSERT/UPDATE/DELETE policies admit every viewer on the
 * blocks they can see — but it is a separate constant so the two never drift silently.
 */
export const CAN_USE_SCHEDULE_DISPATCH_EDIT_ROLES: ReadonlySet<string> = new Set([
  'dev',
  'master_technician',
  'assistant',
  'superintendent',
  'controller',
])

/**
 * Roles the time-off RPC accepts. Mirrors the gate inside
 * `pay_staff_bulk_insert_user_time_off` (and its undo twin
 * `pay_staff_remove_not_coming_in_for_user_day`):
 *   is_dev() OR is_pay_approved_master() OR is_assistant_of_pay_approved_master() OR is_assistant()
 * → dev, master_technician (pay-approved), assistant, controller (assistant-LIKE since v2.662).
 * Superintendent is refused with `not authorized` — so the board must not arm the "off"
 * button for that role (journey map J18-N2: 63 dead buttons).
 */
export const CAN_WRITE_SCHEDULE_TIME_OFF_ROLES: ReadonlySet<string> = new Set([
  'dev',
  'master_technician',
  'assistant',
  'controller',
])

/** True when `pay_staff_bulk_insert_user_time_off` would accept this role at all. */
export function canWriteTimeOff(role: string | null | undefined): boolean {
  return role != null && CAN_WRITE_SCHEDULE_TIME_OFF_ROLES.has(role)
}
