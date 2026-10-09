/**
 * GC mode's doors (door 2, v2.4937): every GC table, the lane that owns it, and who its policy lets
 * in. `doors.test.ts` reads the migrations and fails when a GC table is missing here, when its
 * policy says another door, or when a dev-only table does not say what opens it. A new table in any
 * lane joins this list in the PR that creates it, so nothing ships dev only into a page the office
 * already uses and quietly reads empty there.
 *
 * - `office`: `gc_office_team()`, the GC office: dev, the leaders, the assistants, the controller and
 *   estimators (doors 1 and 2).
 * - `money`: `gc_money_team()`, our number (B5-a) and Owner Billing (its door): dev, the leaders and the controller.
 * - `schedule`: `gc_on_schedule_team(project)`, the schedule's team door (its PR 10, v2.5114): the GC office and the
 *   job's project manager. Building's door adds the job's superintendent in that one helper.
 * - `dev`: `is_dev()` while its lane builds it. `opens` names the door that will open it.
 */
export type GcDoor = 'office' | 'money' | 'schedule' | 'dev'

export interface GcTableDoor {
  lane: 'New project' | 'Board' | 'Portal' | 'Schedule' | 'Building' | 'Owner Billing'
  door: GcDoor
  /** For a dev-only table: what opens it, and whose call that is. */
  opens?: string
}

const BUILDING_OPENS = 'Building’s door, when a job is being built (BUILDING_REAL_BUILD.md)'
const BUILDING_MONEY_OPENS = 'Building’s door, to the money roles: dev, the leaders and the controller (BUILDING_REAL_BUILD.md decision 4)'
const PORTAL_OPENS = 'the trade wave, when the Portal lane says the portal is ready (PORTAL_REAL_BUILD.md)'
const AWARD_OPENS = 'award’s door: estimators, the leaders and dev, the owner’s call W (mockups/board-b6.md)'

const office = (lane: GcTableDoor['lane']): GcTableDoor => ({ lane, door: 'office' })
const schedule = (): GcTableDoor => ({ lane: 'Schedule', door: 'schedule' })
const dev = (lane: GcTableDoor['lane'], opens: string): GcTableDoor => ({ lane, door: 'dev', opens })

export const GC_TABLE_DOORS: Record<string, GcTableDoor> = {
  // New project (door 1).
  gc_projects: office('New project'),
  gc_trade_packages: office('New project'),
  gc_scope_items: office('New project'),
  gc_scope_exclusions: office('New project'),
  gc_scope_book_saved: office('New project'),
  gc_scope_book_edits: office('New project'),
  gc_scope_book_merges: office('New project'),
  gc_scope_sets: office('New project'),
  gc_plan_sets: office('New project'),
  gc_plan_set_items: office('New project'),
  gc_plan_questions: office('New project'),
  gc_plan_set_sends: office('New project'),

  // The Board (door 2), and our number behind the money team.
  gc_companies: office('Board'),
  gc_company_people: office('Board'),
  gc_company_vetting_forms: office('Board'),
  gc_invites: office('Board'),
  gc_quotes: office('Board'),
  gc_company_contacts: office('Board'),
  gc_trade_promises: office('Board'),
  gc_trade_promise_moves: office('Board'),
  gc_bid_tabs: office('Board'),
  gc_bid_tab_views: office('Board'),
  gc_project_money: { lane: 'Board', door: 'money' },
  // Award and the statement of work (B6-a): a contract with the trade, dev only until call W.
  gc_sows: dev('Board', AWARD_OPENS),
  gc_sow_lines: dev('Board', AWARD_OPENS),

  // The trade's portal, and its two records on a trade's signed work (P4a).
  gc_trade_portal_links: dev('Portal', PORTAL_OPENS),
  gc_trade_messages: dev('Portal', PORTAL_OPENS),
  gc_back_charges: dev('Portal', PORTAL_OPENS),
  gc_trade_change_requests: dev('Portal', PORTAL_OPENS),

  // The schedule, behind its team door (the schedule's PR 10).
  gc_schedules: schedule(),
  gc_schedule_activities: schedule(),
  gc_schedule_activity_parts: schedule(),
  gc_schedule_baselines: schedule(),
  gc_schedule_baseline_dates: schedule(),
  gc_schedule_changes: schedule(),
  gc_schedule_crew_counts: schedule(),
  gc_schedule_inspection_failures: schedule(),
  gc_schedule_late_notices: schedule(),
  gc_schedule_links: schedule(),
  gc_schedule_lookahead_marks: schedule(),
  gc_schedule_milestones: schedule(),
  gc_schedule_move_answers: schedule(),
  gc_schedule_move_pushes: schedule(),
  gc_schedule_move_tells: schedule(),
  gc_schedule_moves: schedule(),
  gc_schedule_sends: schedule(),
  gc_schedule_templates: schedule(),
  gc_schedule_wait_holds: schedule(),
  gc_schedule_waits: schedule(),
  gc_schedule_walks: schedule(),
  gc_schedule_what_ifs: schedule(),
  gc_rough_schedules: schedule(),

  // Building.
  gc_daily_logs: dev('Building', BUILDING_OPENS),
  gc_daily_log_crews: dev('Building', BUILDING_OPENS),
  gc_daily_log_delays: dev('Building', BUILDING_OPENS),
  gc_punch_items: dev('Building', BUILDING_OPENS),
  gc_submittals: dev('Building', BUILDING_OPENS),
  gc_submittal_holds: dev('Building', BUILDING_OPENS),
  gc_submittal_rounds: dev('Building', BUILDING_OPENS),
  gc_rfis: dev('Building', BUILDING_OPENS),
  gc_rfi_holds: dev('Building', BUILDING_OPENS),
  gc_weekly_reports: dev('Building', BUILDING_OPENS),
  gc_draws: dev('Building', BUILDING_MONEY_OPENS),
  gc_draw_lines: dev('Building', BUILDING_MONEY_OPENS),
  gc_sow_line_reports: dev('Building', BUILDING_MONEY_OPENS),
  gc_change_order_trade_sends: dev('Building', BUILDING_MONEY_OPENS),

  // Owner Billing.
  gc_owner_contract_lines: { lane: 'Owner Billing', door: 'money' },
  gc_change_orders: { lane: 'Owner Billing', door: 'money' },
  gc_owner_pay_apps: { lane: 'Owner Billing', door: 'money' },
  gc_owner_pay_app_lines: { lane: 'Owner Billing', door: 'money' },
  gc_owner_pay_reminders: { lane: 'Owner Billing', door: 'money' },
  gc_owner_interest_bills: { lane: 'Owner Billing', door: 'money' },
  gc_owner_acceptances: { lane: 'Owner Billing', door: 'money' },
  gc_money_monday_email_requests: { lane: 'Owner Billing', door: 'money' },
  gc_owner_card_bills: { lane: 'Owner Billing', door: 'money' },
}

/**
 * The schedule's append-only tables (the schedule's PR 10, v2.5114), and the only columns a person may change on each.
 * Privileges hold them, not a policy: `authenticated` has no table-wide UPDATE, DELETE or TRUNCATE on any of them, so
 * no door can open them by changing a policy. `doors.test.ts` reads every GRANT and REVOKE in the migrations and fails
 * when one of these gains a table-wide write, or a column grant this list does not name.
 */
export const GC_SCHEDULE_APPEND_ONLY: Readonly<Record<string, readonly string[]>> = {
  gc_schedule_changes: [],
  gc_schedule_moves: ['undone_on', 'undone_by'],
  gc_schedule_move_pushes: [],
  gc_schedule_move_tells: [],
  gc_schedule_move_answers: [],
  gc_schedule_late_notices: ['pushed_back_on', 'pushed_back_by', 'pushed_back_note'],
  gc_schedule_walks: [],
  gc_schedule_crew_counts: [],
  gc_schedule_sends: [],
  gc_schedule_templates: ['name', 'aside_on'],
}

/**
 * Tables named `gc_` that are not GC mode's: Trades mode's GC Review (the statement emails, a GC's
 * word by link), older than GC mode and gated their own way. The test leaves them alone.
 */
export const NOT_GC_MODE_TABLES = ['gc_statement_email_requests', 'gc_word_asks', 'gc_word_ask_answers'] as const
