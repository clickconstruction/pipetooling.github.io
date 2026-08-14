/** DB-backup export logic for Settings → Data tab (dev-only JSON backups) + the account
 * 'time since manual DB backup' header. Owns all export loading/error state, the last-backup
 * timestamp (persisted to localStorage), and the 10 export handlers. Extracted verbatim from
 * Settings.tsx. */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/supabasePaging'
import type { SupabaseClientResult } from '../utils/errorHandling'

const LAST_FULL_BACKUP_AT_KEY_PREFIX = 'pipetooling_last_full_backup_at'

/**
 * Pages one table's export past PostgREST's silent 1000-row cap (un-ranged
 * selects truncate with NO error — the worst failure mode for a backup) and
 * returns the `{ data, error }` shape the export handlers already collect.
 * `buildPage` must apply a stable `.order()` on the table's primary key so
 * pages don't shuffle between requests.
 */
async function fetchBackupRows<T>(
  buildPage: (from: number, to: number) => PromiseLike<SupabaseClientResult<T[]>>,
  table: string,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  try {
    return { data: await fetchAllRows(buildPage, `export ${table}`), error: null }
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : `Failed to export ${table}` } }
  }
}

function getLastFullBackupStorageKey(userId: string | undefined): string {
  return userId ? `${LAST_FULL_BACKUP_AT_KEY_PREFIX}_${userId}` : LAST_FULL_BACKUP_AT_KEY_PREFIX
}

export function useSettingsBackupExports(userId: string | undefined) {
  const [exportProjectsLoading, setExportProjectsLoading] = useState(false)
  const [exportMaterialsLoading, setExportMaterialsLoading] = useState(false)
  const [exportBidsLoading, setExportBidsLoading] = useState(false)
  const [exportPeopleLoading, setExportPeopleLoading] = useState(false)
  const [exportJobsLoading, setExportJobsLoading] = useState(false)
  const [exportChecklistLoading, setExportChecklistLoading] = useState(false)
  const [exportReportsLoading, setExportReportsLoading] = useState(false)
  const [exportProspectsLoading, setExportProspectsLoading] = useState(false)
  const [exportSettingsLoading, setExportSettingsLoading] = useState(false)
  const [exportAllLoading, setExportAllLoading] = useState(false)
  const [lastFullBackupAtIso, setLastFullBackupAtIso] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const k = getLastFullBackupStorageKey(userId)
    setLastFullBackupAtIso(localStorage.getItem(k))
  }, [userId])

  async function exportProjectsBackup() {
    setExportError(null)
    setExportProjectsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8,
      ] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('customers').select('*').order('id').range(from, to), 'customers'),
        fetchBackupRows((from, to) => supabase.from('projects').select('*').order('id').range(from, to), 'projects'),
        fetchBackupRows((from, to) => supabase.from('project_workflows').select('*').order('id').range(from, to), 'project_workflows'),
        fetchBackupRows((from, to) => supabase.from('project_workflow_steps').select('*').order('id').range(from, to), 'project_workflow_steps'),
        fetchBackupRows((from, to) => supabase.from('project_workflow_step_actions').select('*').order('id').range(from, to), 'project_workflow_step_actions'),
        fetchBackupRows((from, to) => supabase.from('step_subscriptions').select('*').order('id').range(from, to), 'step_subscriptions'),
        fetchBackupRows((from, to) => supabase.from('workflow_step_line_items').select('*').order('id').range(from, to), 'workflow_step_line_items'),
        fetchBackupRows((from, to) => supabase.from('workflow_projections').select('*').order('id').range(from, to), 'workflow_projections'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          customers: r1.data ?? [],
          projects: r2.data ?? [],
          project_workflows: r3.data ?? [],
          project_workflow_steps: r4.data ?? [],
          project_workflow_step_actions: r5.data ?? [],
          step_subscriptions: r6.data ?? [],
          workflow_step_line_items: r7.data ?? [],
          workflow_projections: r8.data ?? [],
        },
      }
      downloadJson(`projects-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportProjectsLoading(false)
    }
  }

  async function exportMaterialsBackup() {
    setExportError(null)
    setExportMaterialsLoading(true)
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('supply_houses').select('*').order('id').range(from, to), 'supply_houses'),
        fetchBackupRows((from, to) => supabase.from('material_parts').select('*').order('id').range(from, to), 'material_parts'),
        fetchBackupRows((from, to) => supabase.from('material_part_prices').select('*').order('id').range(from, to), 'material_part_prices'),
        fetchBackupRows((from, to) => supabase.from('material_templates').select('*').order('id').range(from, to), 'material_templates'),
        fetchBackupRows((from, to) => supabase.from('material_template_items').select('*').order('id').range(from, to), 'material_template_items'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          supply_houses: r1.data ?? [],
          material_parts: r2.data ?? [],
          material_part_prices: r3.data ?? [],
          material_templates: r4.data ?? [],
          material_template_items: r5.data ?? [],
        },
      }
      downloadJson(`materials-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportMaterialsLoading(false)
    }
  }

  async function exportBidsBackup() {
    setExportError(null)
    setExportBidsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17,
      ] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('bids').select('*').order('id').range(from, to), 'bids'),
        fetchBackupRows((from, to) => supabase.from('bids_gc_builders').select('*').order('id').range(from, to), 'bids_gc_builders'),
        fetchBackupRows((from, to) => supabase.from('bids_count_rows').select('*').order('id').range(from, to), 'bids_count_rows'),
        fetchBackupRows((from, to) => supabase.from('bids_submission_entries').select('*').order('id').range(from, to), 'bids_submission_entries'),
        fetchBackupRows((from, to) => supabase.from('cost_estimates').select('*').order('id').range(from, to), 'cost_estimates'),
        fetchBackupRows((from, to) => supabase.from('cost_estimate_labor_rows').select('*').order('id').range(from, to), 'cost_estimate_labor_rows'),
        fetchBackupRows((from, to) => supabase.from('fixture_labor_defaults').select('*').order('fixture').range(from, to), 'fixture_labor_defaults'),
        fetchBackupRows((from, to) => supabase.from('bid_pricing_assignments').select('*').order('id').range(from, to), 'bid_pricing_assignments'),
        fetchBackupRows((from, to) => supabase.from('price_book_versions').select('*').order('id').range(from, to), 'price_book_versions'),
        fetchBackupRows((from, to) => supabase.from('price_book_entries').select('*').order('id').range(from, to), 'price_book_entries'),
        fetchBackupRows((from, to) => supabase.from('labor_book_versions').select('*').order('id').range(from, to), 'labor_book_versions'),
        fetchBackupRows((from, to) => supabase.from('labor_book_entries').select('*').order('id').range(from, to), 'labor_book_entries'),
        fetchBackupRows((from, to) => supabase.from('takeoff_book_versions').select('*').order('id').range(from, to), 'takeoff_book_versions'),
        fetchBackupRows((from, to) => supabase.from('takeoff_book_entries').select('*').order('id').range(from, to), 'takeoff_book_entries'),
        fetchBackupRows((from, to) => supabase.from('purchase_orders').select('*').order('id').range(from, to), 'purchase_orders'),
        fetchBackupRows((from, to) => supabase.from('purchase_order_items').select('*').order('id').range(from, to), 'purchase_order_items'),
        fetchBackupRows((from, to) => supabase.from('bid_versions').select('*').order('id').range(from, to), 'bid_versions'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error || r16.error || r17.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          bids: r1.data ?? [],
          bids_gc_builders: r2.data ?? [],
          bids_count_rows: r3.data ?? [],
          bids_submission_entries: r4.data ?? [],
          cost_estimates: r5.data ?? [],
          cost_estimate_labor_rows: r6.data ?? [],
          fixture_labor_defaults: r7.data ?? [],
          bid_pricing_assignments: r8.data ?? [],
          price_book_versions: r9.data ?? [],
          price_book_entries: r10.data ?? [],
          labor_book_versions: r11.data ?? [],
          labor_book_entries: r12.data ?? [],
          takeoff_book_versions: r13.data ?? [],
          takeoff_book_entries: r14.data ?? [],
          purchase_orders: r15.data ?? [],
          purchase_order_items: r16.data ?? [],
          bid_versions: r17.data ?? [],
        },
      }
      downloadJson(`bids-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportBidsLoading(false)
    }
  }

  async function exportPeopleBackup() {
    setExportError(null)
    setExportPeopleLoading(true)
    try {
      const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('users').select('*').order('id').range(from, to), 'users'),
        fetchBackupRows((from, to) => supabase.from('people').select('*').order('id').range(from, to), 'people'),
        fetchBackupRows((from, to) => supabase.from('master_assistants').select('*').order('master_id').order('assistant_id').range(from, to), 'master_assistants'),
        fetchBackupRows((from, to) => supabase.from('master_shares').select('*').order('sharing_master_id').order('viewing_master_id').range(from, to), 'master_shares'),
        fetchBackupRows((from, to) => supabase.from('master_primaries').select('*').order('master_id').order('primary_id').range(from, to), 'master_primaries'),
        fetchBackupRows((from, to) => supabase.from('master_superintendents').select('*').order('master_id').order('superintendent_id').range(from, to), 'master_superintendents'),
        fetchBackupRows((from, to) => supabase.from('pay_approved_masters').select('*').order('master_id').range(from, to), 'pay_approved_masters'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          users: r1.data ?? [],
          people: r2.data ?? [],
          master_assistants: r3.data ?? [],
          master_shares: r4.data ?? [],
          master_primaries: r5.data ?? [],
          master_superintendents: r6.data ?? [],
          pay_approved_masters: r7.data ?? [],
        },
      }
      downloadJson(`people-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportPeopleLoading(false)
    }
  }

  async function exportJobsBackup() {
    setExportError(null)
    setExportJobsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15,
      ] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('jobs_ledger').select('*').order('id').range(from, to), 'jobs_ledger'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger_fixtures').select('*').order('id').range(from, to), 'jobs_ledger_fixtures'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger_materials').select('*').order('id').range(from, to), 'jobs_ledger_materials'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger_team_members').select('*').order('id').range(from, to), 'jobs_ledger_team_members'),
        fetchBackupRows((from, to) => supabase.from('people_labor_jobs').select('*').order('id').range(from, to), 'people_labor_jobs'),
        fetchBackupRows((from, to) => supabase.from('people_labor_job_items').select('*').order('id').range(from, to), 'people_labor_job_items'),
        fetchBackupRows((from, to) => supabase.from('people_crew_jobs').select('*').order('work_date').order('person_name').range(from, to), 'people_crew_jobs'),
        fetchBackupRows((from, to) => supabase.from('people_teams').select('*').order('id').range(from, to), 'people_teams'),
        fetchBackupRows((from, to) => supabase.from('people_team_members').select('*').order('team_id').order('person_name').range(from, to), 'people_team_members'),
        fetchBackupRows((from, to) => supabase.from('people_hours').select('*').order('id').range(from, to), 'people_hours'),
        fetchBackupRows((from, to) => supabase.from('people_hours_display_order').select('*').order('person_name').range(from, to), 'people_hours_display_order'),
        fetchBackupRows((from, to) => supabase.from('people_pay_config').select('*').order('person_name').range(from, to), 'people_pay_config'),
        fetchBackupRows((from, to) => supabase.from('jobs_receivables').select('*').order('id').range(from, to), 'jobs_receivables'),
        fetchBackupRows((from, to) => supabase.from('jobs_tally_parts').select('*').order('id').range(from, to), 'jobs_tally_parts'),
        fetchBackupRows((from, to) => supabase.from('supply_house_invoices').select('*').order('id').range(from, to), 'supply_house_invoices'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          jobs_ledger: r1.data ?? [],
          jobs_ledger_fixtures: r2.data ?? [],
          jobs_ledger_materials: r3.data ?? [],
          jobs_ledger_team_members: r4.data ?? [],
          people_labor_jobs: r5.data ?? [],
          people_labor_job_items: r6.data ?? [],
          people_crew_jobs: r7.data ?? [],
          people_teams: r8.data ?? [],
          people_team_members: r9.data ?? [],
          people_hours: r10.data ?? [],
          people_hours_display_order: r11.data ?? [],
          people_pay_config: r12.data ?? [],
          jobs_receivables: r13.data ?? [],
          jobs_tally_parts: r14.data ?? [],
          supply_house_invoices: r15.data ?? [],
        },
      }
      downloadJson(`jobs-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportJobsLoading(false)
    }
  }

  async function exportChecklistBackup() {
    setExportError(null)
    setExportChecklistLoading(true)
    try {
      const [r1, r2] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('checklist_items').select('*').order('id').range(from, to), 'checklist_items'),
        fetchBackupRows((from, to) => supabase.from('checklist_instances').select('*').order('id').range(from, to), 'checklist_instances'),
      ])
      const err = r1.error || r2.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          checklist_items: r1.data ?? [],
          checklist_instances: r2.data ?? [],
        },
      }
      downloadJson(`checklist-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportChecklistLoading(false)
    }
  }

  async function exportReportsBackup() {
    setExportError(null)
    setExportReportsLoading(true)
    try {
      const [r1, r2, r3, r4, r5] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('reports').select('*').order('id').range(from, to), 'reports'),
        fetchBackupRows((from, to) => supabase.from('report_templates').select('*').order('id').range(from, to), 'report_templates'),
        fetchBackupRows((from, to) => supabase.from('report_template_fields').select('*').order('id').range(from, to), 'report_template_fields'),
        fetchBackupRows((from, to) => supabase.from('report_enabled_users').select('*').order('user_id').range(from, to), 'report_enabled_users'),
        fetchBackupRows((from, to) => supabase.from('user_report_notification_preferences').select('*').order('user_id').order('template_id').range(from, to), 'user_report_notification_preferences'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          reports: r1.data ?? [],
          report_templates: r2.data ?? [],
          report_template_fields: r3.data ?? [],
          report_enabled_users: r4.data ?? [],
          user_report_notification_preferences: r5.data ?? [],
        },
      }
      downloadJson(`reports-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportReportsLoading(false)
    }
  }

  async function exportProspectsBackup() {
    setExportError(null)
    setExportProspectsLoading(true)
    try {
      const [r1, r2, r3] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('prospects').select('*').order('id').range(from, to), 'prospects'),
        fetchBackupRows((from, to) => supabase.from('prospect_callbacks').select('*').order('id').range(from, to), 'prospect_callbacks'),
        fetchBackupRows((from, to) => supabase.from('prospect_comments').select('*').order('id').range(from, to), 'prospect_comments'),
      ])
      const err = r1.error || r2.error || r3.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          prospects: r1.data ?? [],
          prospect_callbacks: r2.data ?? [],
          prospect_comments: r3.data ?? [],
        },
      }
      downloadJson(`prospects-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportProspectsLoading(false)
    }
  }

  async function exportSettingsBackup() {
    setExportError(null)
    setExportSettingsLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12,
      ] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('app_settings').select('*').order('key').range(from, to), 'app_settings'),
        fetchBackupRows((from, to) => supabase.from('workflow_templates').select('*').order('id').range(from, to), 'workflow_templates'),
        fetchBackupRows((from, to) => supabase.from('workflow_template_steps').select('*').order('id').range(from, to), 'workflow_template_steps'),
        fetchBackupRows((from, to) => supabase.from('workflow_step_dependencies').select('*').order('id').range(from, to), 'workflow_step_dependencies'),
        fetchBackupRows((from, to) => supabase.from('service_types').select('*').order('id').range(from, to), 'service_types'),
        fetchBackupRows((from, to) => supabase.from('fixture_types').select('*').order('id').range(from, to), 'fixture_types'),
        fetchBackupRows((from, to) => supabase.from('part_types').select('*').order('id').range(from, to), 'part_types'),
        fetchBackupRows((from, to) => supabase.from('assembly_types').select('*').order('id').range(from, to), 'assembly_types'),
        fetchBackupRows((from, to) => supabase.from('counts_fixture_groups').select('*').order('id').range(from, to), 'counts_fixture_groups'),
        fetchBackupRows((from, to) => supabase.from('counts_fixture_group_items').select('*').order('id').range(from, to), 'counts_fixture_group_items'),
        fetchBackupRows((from, to) => supabase.from('notification_templates').select('*').order('id').range(from, to), 'notification_templates'),
        fetchBackupRows((from, to) => supabase.from('email_templates').select('*').order('id').range(from, to), 'email_templates'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          app_settings: r1.data ?? [],
          workflow_templates: r2.data ?? [],
          workflow_template_steps: r3.data ?? [],
          workflow_step_dependencies: r4.data ?? [],
          service_types: r5.data ?? [],
          fixture_types: r6.data ?? [],
          part_types: r7.data ?? [],
          assembly_types: r8.data ?? [],
          counts_fixture_groups: r9.data ?? [],
          counts_fixture_group_items: r10.data ?? [],
          notification_templates: r11.data ?? [],
          email_templates: r12.data ?? [],
        },
      }
      downloadJson(`settings-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportSettingsLoading(false)
    }
  }

  async function exportAllBackup() {
    setExportError(null)
    setExportAllLoading(true)
    try {
      const [
        r1, r2, r3, r4, r5, r6, r7, r8,
        r9, r10, r11, r12, r13, r14, r15, r16,
        r17, r18, r19, r20, r21, r22, r23, r24, r25, r26,
        r27, r28, r29, r30, r31, r32, r33, r34,
        r35, r36, r37, r38, r39, r40, r41, r42, r43, r44,
        r45, r46, r47, r48, r49, r50, r51, r52, r53,
        r54, r55, r56, r57, r58, r59, r60, r61, r62, r63,
        r64, r65, r66, r67, r68, r69, r70, r71, r72,
      ] = await Promise.all([
        fetchBackupRows((from, to) => supabase.from('customers').select('*').order('id').range(from, to), 'customers'),
        fetchBackupRows((from, to) => supabase.from('projects').select('*').order('id').range(from, to), 'projects'),
        fetchBackupRows((from, to) => supabase.from('project_workflows').select('*').order('id').range(from, to), 'project_workflows'),
        fetchBackupRows((from, to) => supabase.from('project_workflow_steps').select('*').order('id').range(from, to), 'project_workflow_steps'),
        fetchBackupRows((from, to) => supabase.from('project_workflow_step_actions').select('*').order('id').range(from, to), 'project_workflow_step_actions'),
        fetchBackupRows((from, to) => supabase.from('step_subscriptions').select('*').order('id').range(from, to), 'step_subscriptions'),
        fetchBackupRows((from, to) => supabase.from('workflow_step_line_items').select('*').order('id').range(from, to), 'workflow_step_line_items'),
        fetchBackupRows((from, to) => supabase.from('workflow_projections').select('*').order('id').range(from, to), 'workflow_projections'),
        fetchBackupRows((from, to) => supabase.from('supply_houses').select('*').order('id').range(from, to), 'supply_houses'),
        fetchBackupRows((from, to) => supabase.from('material_parts').select('*').order('id').range(from, to), 'material_parts'),
        fetchBackupRows((from, to) => supabase.from('material_part_prices').select('*').order('id').range(from, to), 'material_part_prices'),
        fetchBackupRows((from, to) => supabase.from('material_templates').select('*').order('id').range(from, to), 'material_templates'),
        fetchBackupRows((from, to) => supabase.from('material_template_items').select('*').order('id').range(from, to), 'material_template_items'),
        fetchBackupRows((from, to) => supabase.from('bids').select('*').order('id').range(from, to), 'bids'),
        fetchBackupRows((from, to) => supabase.from('bids_gc_builders').select('*').order('id').range(from, to), 'bids_gc_builders'),
        fetchBackupRows((from, to) => supabase.from('bids_count_rows').select('*').order('id').range(from, to), 'bids_count_rows'),
        fetchBackupRows((from, to) => supabase.from('bids_submission_entries').select('*').order('id').range(from, to), 'bids_submission_entries'),
        fetchBackupRows((from, to) => supabase.from('cost_estimates').select('*').order('id').range(from, to), 'cost_estimates'),
        fetchBackupRows((from, to) => supabase.from('cost_estimate_labor_rows').select('*').order('id').range(from, to), 'cost_estimate_labor_rows'),
        fetchBackupRows((from, to) => supabase.from('fixture_labor_defaults').select('*').order('fixture').range(from, to), 'fixture_labor_defaults'),
        fetchBackupRows((from, to) => supabase.from('bid_pricing_assignments').select('*').order('id').range(from, to), 'bid_pricing_assignments'),
        fetchBackupRows((from, to) => supabase.from('price_book_versions').select('*').order('id').range(from, to), 'price_book_versions'),
        fetchBackupRows((from, to) => supabase.from('price_book_entries').select('*').order('id').range(from, to), 'price_book_entries'),
        fetchBackupRows((from, to) => supabase.from('labor_book_versions').select('*').order('id').range(from, to), 'labor_book_versions'),
        fetchBackupRows((from, to) => supabase.from('labor_book_entries').select('*').order('id').range(from, to), 'labor_book_entries'),
        fetchBackupRows((from, to) => supabase.from('takeoff_book_versions').select('*').order('id').range(from, to), 'takeoff_book_versions'),
        fetchBackupRows((from, to) => supabase.from('takeoff_book_entries').select('*').order('id').range(from, to), 'takeoff_book_entries'),
        fetchBackupRows((from, to) => supabase.from('purchase_orders').select('*').order('id').range(from, to), 'purchase_orders'),
        fetchBackupRows((from, to) => supabase.from('purchase_order_items').select('*').order('id').range(from, to), 'purchase_order_items'),
        fetchBackupRows((from, to) => supabase.from('users').select('*').order('id').range(from, to), 'users'),
        fetchBackupRows((from, to) => supabase.from('people').select('*').order('id').range(from, to), 'people'),
        fetchBackupRows((from, to) => supabase.from('master_assistants').select('*').order('master_id').order('assistant_id').range(from, to), 'master_assistants'),
        fetchBackupRows((from, to) => supabase.from('master_shares').select('*').order('sharing_master_id').order('viewing_master_id').range(from, to), 'master_shares'),
        fetchBackupRows((from, to) => supabase.from('master_primaries').select('*').order('master_id').order('primary_id').range(from, to), 'master_primaries'),
        fetchBackupRows((from, to) => supabase.from('pay_approved_masters').select('*').order('master_id').range(from, to), 'pay_approved_masters'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger').select('*').order('id').range(from, to), 'jobs_ledger'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger_fixtures').select('*').order('id').range(from, to), 'jobs_ledger_fixtures'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger_materials').select('*').order('id').range(from, to), 'jobs_ledger_materials'),
        fetchBackupRows((from, to) => supabase.from('jobs_ledger_team_members').select('*').order('id').range(from, to), 'jobs_ledger_team_members'),
        fetchBackupRows((from, to) => supabase.from('people_labor_jobs').select('*').order('id').range(from, to), 'people_labor_jobs'),
        fetchBackupRows((from, to) => supabase.from('people_labor_job_items').select('*').order('id').range(from, to), 'people_labor_job_items'),
        fetchBackupRows((from, to) => supabase.from('people_crew_jobs').select('*').order('work_date').order('person_name').range(from, to), 'people_crew_jobs'),
        fetchBackupRows((from, to) => supabase.from('people_teams').select('*').order('id').range(from, to), 'people_teams'),
        fetchBackupRows((from, to) => supabase.from('people_team_members').select('*').order('team_id').order('person_name').range(from, to), 'people_team_members'),
        fetchBackupRows((from, to) => supabase.from('people_hours').select('*').order('id').range(from, to), 'people_hours'),
        fetchBackupRows((from, to) => supabase.from('people_hours_display_order').select('*').order('person_name').range(from, to), 'people_hours_display_order'),
        fetchBackupRows((from, to) => supabase.from('people_pay_config').select('*').order('person_name').range(from, to), 'people_pay_config'),
        fetchBackupRows((from, to) => supabase.from('jobs_receivables').select('*').order('id').range(from, to), 'jobs_receivables'),
        fetchBackupRows((from, to) => supabase.from('jobs_tally_parts').select('*').order('id').range(from, to), 'jobs_tally_parts'),
        fetchBackupRows((from, to) => supabase.from('supply_house_invoices').select('*').order('id').range(from, to), 'supply_house_invoices'),
        fetchBackupRows((from, to) => supabase.from('checklist_items').select('*').order('id').range(from, to), 'checklist_items'),
        fetchBackupRows((from, to) => supabase.from('checklist_instances').select('*').order('id').range(from, to), 'checklist_instances'),
        fetchBackupRows((from, to) => supabase.from('reports').select('*').order('id').range(from, to), 'reports'),
        fetchBackupRows((from, to) => supabase.from('report_templates').select('*').order('id').range(from, to), 'report_templates'),
        fetchBackupRows((from, to) => supabase.from('report_template_fields').select('*').order('id').range(from, to), 'report_template_fields'),
        fetchBackupRows((from, to) => supabase.from('report_enabled_users').select('*').order('user_id').range(from, to), 'report_enabled_users'),
        fetchBackupRows((from, to) => supabase.from('user_report_notification_preferences').select('*').order('user_id').order('template_id').range(from, to), 'user_report_notification_preferences'),
        fetchBackupRows((from, to) => supabase.from('prospects').select('*').order('id').range(from, to), 'prospects'),
        fetchBackupRows((from, to) => supabase.from('prospect_callbacks').select('*').order('id').range(from, to), 'prospect_callbacks'),
        fetchBackupRows((from, to) => supabase.from('prospect_comments').select('*').order('id').range(from, to), 'prospect_comments'),
        fetchBackupRows((from, to) => supabase.from('app_settings').select('*').order('key').range(from, to), 'app_settings'),
        fetchBackupRows((from, to) => supabase.from('workflow_templates').select('*').order('id').range(from, to), 'workflow_templates'),
        fetchBackupRows((from, to) => supabase.from('workflow_template_steps').select('*').order('id').range(from, to), 'workflow_template_steps'),
        fetchBackupRows((from, to) => supabase.from('workflow_step_dependencies').select('*').order('id').range(from, to), 'workflow_step_dependencies'),
        fetchBackupRows((from, to) => supabase.from('service_types').select('*').order('id').range(from, to), 'service_types'),
        fetchBackupRows((from, to) => supabase.from('fixture_types').select('*').order('id').range(from, to), 'fixture_types'),
        fetchBackupRows((from, to) => supabase.from('part_types').select('*').order('id').range(from, to), 'part_types'),
        fetchBackupRows((from, to) => supabase.from('assembly_types').select('*').order('id').range(from, to), 'assembly_types'),
        fetchBackupRows((from, to) => supabase.from('counts_fixture_groups').select('*').order('id').range(from, to), 'counts_fixture_groups'),
        fetchBackupRows((from, to) => supabase.from('counts_fixture_group_items').select('*').order('id').range(from, to), 'counts_fixture_group_items'),
        fetchBackupRows((from, to) => supabase.from('notification_templates').select('*').order('id').range(from, to), 'notification_templates'),
        fetchBackupRows((from, to) => supabase.from('email_templates').select('*').order('id').range(from, to), 'email_templates'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error || r16.error || r17.error || r18.error || r19.error || r20.error || r21.error || r22.error || r23.error || r24.error || r25.error || r26.error || r27.error || r28.error || r29.error || r30.error || r31.error || r32.error || r33.error || r34.error || r35.error || r36.error || r37.error || r38.error || r39.error || r40.error || r41.error || r42.error || r43.error || r44.error || r45.error || r46.error || r47.error || r48.error || r49.error || r50.error || r51.error || r52.error || r53.error || r54.error || r55.error || r56.error || r57.error || r58.error || r59.error || r60.error || r61.error || r62.error || r63.error || r64.error || r65.error || r66.error || r67.error || r68.error || r69.error || r70.error || r71.error || r72.error
      if (err) {
        setExportError(err.message)
        return
      }
      const payload = {
        exportedAt: new Date().toISOString(),
        tables: {
          customers: r1.data ?? [],
          projects: r2.data ?? [],
          project_workflows: r3.data ?? [],
          project_workflow_steps: r4.data ?? [],
          project_workflow_step_actions: r5.data ?? [],
          step_subscriptions: r6.data ?? [],
          workflow_step_line_items: r7.data ?? [],
          workflow_projections: r8.data ?? [],
          supply_houses: r9.data ?? [],
          material_parts: r10.data ?? [],
          material_part_prices: r11.data ?? [],
          material_templates: r12.data ?? [],
          material_template_items: r13.data ?? [],
          bids: r14.data ?? [],
          bids_gc_builders: r15.data ?? [],
          bids_count_rows: r16.data ?? [],
          bids_submission_entries: r17.data ?? [],
          cost_estimates: r18.data ?? [],
          cost_estimate_labor_rows: r19.data ?? [],
          fixture_labor_defaults: r20.data ?? [],
          bid_pricing_assignments: r21.data ?? [],
          price_book_versions: r22.data ?? [],
          price_book_entries: r23.data ?? [],
          labor_book_versions: r24.data ?? [],
          labor_book_entries: r25.data ?? [],
          takeoff_book_versions: r26.data ?? [],
          takeoff_book_entries: r27.data ?? [],
          purchase_orders: r28.data ?? [],
          purchase_order_items: r29.data ?? [],
          users: r30.data ?? [],
          people: r31.data ?? [],
          master_assistants: r32.data ?? [],
          master_shares: r33.data ?? [],
          master_primaries: r34.data ?? [],
          pay_approved_masters: r35.data ?? [],
          jobs_ledger: r36.data ?? [],
          jobs_ledger_fixtures: r37.data ?? [],
          jobs_ledger_materials: r38.data ?? [],
          jobs_ledger_team_members: r39.data ?? [],
          people_labor_jobs: r40.data ?? [],
          people_labor_job_items: r41.data ?? [],
          people_crew_jobs: r42.data ?? [],
          people_teams: r43.data ?? [],
          people_team_members: r44.data ?? [],
          people_hours: r45.data ?? [],
          people_hours_display_order: r46.data ?? [],
          people_pay_config: r47.data ?? [],
          jobs_receivables: r48.data ?? [],
          jobs_tally_parts: r49.data ?? [],
          supply_house_invoices: r50.data ?? [],
          checklist_items: r51.data ?? [],
          checklist_instances: r52.data ?? [],
          reports: r53.data ?? [],
          report_templates: r54.data ?? [],
          report_template_fields: r55.data ?? [],
          report_enabled_users: r56.data ?? [],
          user_report_notification_preferences: r57.data ?? [],
          prospects: r58.data ?? [],
          prospect_callbacks: r59.data ?? [],
          prospect_comments: r60.data ?? [],
          app_settings: r61.data ?? [],
          workflow_templates: r62.data ?? [],
          workflow_template_steps: r63.data ?? [],
          workflow_step_dependencies: r64.data ?? [],
          service_types: r65.data ?? [],
          fixture_types: r66.data ?? [],
          part_types: r67.data ?? [],
          assembly_types: r68.data ?? [],
          counts_fixture_groups: r69.data ?? [],
          counts_fixture_group_items: r70.data ?? [],
          notification_templates: r71.data ?? [],
          email_templates: r72.data ?? [],
        },
      }
      downloadJson(`full-backup-${new Date().toISOString().slice(0, 10)}.json`, payload)
      const backupKey = getLastFullBackupStorageKey(userId)
      const nowIso = new Date().toISOString()
      try {
        localStorage.setItem(backupKey, nowIso)
      } catch {
        /* quota or private mode */
      }
      setLastFullBackupAtIso(nowIso)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportAllLoading(false)
    }
  }

  const exportBackupBusy =
    exportProjectsLoading ||
    exportMaterialsLoading ||
    exportBidsLoading ||
    exportPeopleLoading ||
    exportJobsLoading ||
    exportChecklistLoading ||
    exportReportsLoading ||
    exportProspectsLoading ||
    exportSettingsLoading ||
    exportAllLoading

  return {
    exportProjectsLoading,
    exportMaterialsLoading,
    exportBidsLoading,
    exportPeopleLoading,
    exportJobsLoading,
    exportChecklistLoading,
    exportReportsLoading,
    exportProspectsLoading,
    exportSettingsLoading,
    exportAllLoading,
    exportError,
    lastFullBackupAtIso,
    exportBackupBusy,
    exportProjectsBackup,
    exportMaterialsBackup,
    exportBidsBackup,
    exportPeopleBackup,
    exportJobsBackup,
    exportChecklistBackup,
    exportReportsBackup,
    exportProspectsBackup,
    exportSettingsBackup,
    exportAllBackup,
  }
}
