/** DB-backup export logic for Settings → Data tab (dev-only JSON backups) + the account
 * 'time since manual DB backup' header. Owns all export loading/error state, the last-backup
 * timestamp (persisted to localStorage), and the 10 export handlers. Extracted verbatim from
 * Settings.tsx. */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LAST_FULL_BACKUP_AT_KEY_PREFIX = 'pipetooling_last_full_backup_at'

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
        supabase.from('customers').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('project_workflows').select('*'),
        supabase.from('project_workflow_steps').select('*'),
        supabase.from('project_workflow_step_actions').select('*'),
        supabase.from('step_subscriptions').select('*'),
        supabase.from('workflow_step_line_items').select('*'),
        supabase.from('workflow_projections').select('*'),
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
        supabase.from('supply_houses').select('*'),
        supabase.from('material_parts').select('*'),
        supabase.from('material_part_prices').select('*'),
        supabase.from('material_templates').select('*'),
        supabase.from('material_template_items').select('*'),
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
        r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16,
      ] = await Promise.all([
        supabase.from('bids').select('*'),
        supabase.from('bids_gc_builders').select('*'),
        supabase.from('bids_count_rows').select('*'),
        supabase.from('bids_submission_entries').select('*'),
        supabase.from('cost_estimates').select('*'),
        supabase.from('cost_estimate_labor_rows').select('*'),
        supabase.from('fixture_labor_defaults').select('*'),
        supabase.from('bid_pricing_assignments').select('*'),
        supabase.from('price_book_versions').select('*'),
        supabase.from('price_book_entries').select('*'),
        supabase.from('labor_book_versions').select('*'),
        supabase.from('labor_book_entries').select('*'),
        supabase.from('takeoff_book_versions').select('*'),
        supabase.from('takeoff_book_entries').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('purchase_order_items').select('*'),
      ])
      const err = r1.error || r2.error || r3.error || r4.error || r5.error || r6.error || r7.error || r8.error || r9.error || r10.error || r11.error || r12.error || r13.error || r14.error || r15.error || r16.error
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
        supabase.from('users').select('*'),
        supabase.from('people').select('*'),
        supabase.from('master_assistants').select('*'),
        supabase.from('master_shares').select('*'),
        supabase.from('master_primaries').select('*'),
        supabase.from('master_superintendents').select('*'),
        supabase.from('pay_approved_masters').select('*'),
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
        supabase.from('jobs_ledger').select('*'),
        supabase.from('jobs_ledger_fixtures').select('*'),
        supabase.from('jobs_ledger_materials').select('*'),
        supabase.from('jobs_ledger_team_members').select('*'),
        supabase.from('people_labor_jobs').select('*'),
        supabase.from('people_labor_job_items').select('*'),
        supabase.from('people_crew_jobs').select('*'),
        supabase.from('people_teams').select('*'),
        supabase.from('people_team_members').select('*'),
        supabase.from('people_hours').select('*'),
        supabase.from('people_hours_display_order').select('*'),
        supabase.from('people_pay_config').select('*'),
        supabase.from('jobs_receivables').select('*'),
        supabase.from('jobs_tally_parts').select('*'),
        supabase.from('supply_house_invoices').select('*'),
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
        supabase.from('checklist_items').select('*'),
        supabase.from('checklist_instances').select('*'),
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
        supabase.from('reports').select('*'),
        supabase.from('report_templates').select('*'),
        supabase.from('report_template_fields').select('*'),
        supabase.from('report_enabled_users').select('*'),
        supabase.from('user_report_notification_preferences').select('*'),
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
        supabase.from('prospects').select('*'),
        supabase.from('prospect_callbacks').select('*'),
        supabase.from('prospect_comments').select('*'),
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
        supabase.from('app_settings').select('*'),
        supabase.from('workflow_templates').select('*'),
        supabase.from('workflow_template_steps').select('*'),
        supabase.from('workflow_step_dependencies').select('*'),
        supabase.from('service_types').select('*'),
        supabase.from('fixture_types').select('*'),
        supabase.from('part_types').select('*'),
        supabase.from('assembly_types').select('*'),
        supabase.from('counts_fixture_groups').select('*'),
        supabase.from('counts_fixture_group_items').select('*'),
        supabase.from('notification_templates').select('*'),
        supabase.from('email_templates').select('*'),
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
        supabase.from('customers').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('project_workflows').select('*'),
        supabase.from('project_workflow_steps').select('*'),
        supabase.from('project_workflow_step_actions').select('*'),
        supabase.from('step_subscriptions').select('*'),
        supabase.from('workflow_step_line_items').select('*'),
        supabase.from('workflow_projections').select('*'),
        supabase.from('supply_houses').select('*'),
        supabase.from('material_parts').select('*'),
        supabase.from('material_part_prices').select('*'),
        supabase.from('material_templates').select('*'),
        supabase.from('material_template_items').select('*'),
        supabase.from('bids').select('*'),
        supabase.from('bids_gc_builders').select('*'),
        supabase.from('bids_count_rows').select('*'),
        supabase.from('bids_submission_entries').select('*'),
        supabase.from('cost_estimates').select('*'),
        supabase.from('cost_estimate_labor_rows').select('*'),
        supabase.from('fixture_labor_defaults').select('*'),
        supabase.from('bid_pricing_assignments').select('*'),
        supabase.from('price_book_versions').select('*'),
        supabase.from('price_book_entries').select('*'),
        supabase.from('labor_book_versions').select('*'),
        supabase.from('labor_book_entries').select('*'),
        supabase.from('takeoff_book_versions').select('*'),
        supabase.from('takeoff_book_entries').select('*'),
        supabase.from('purchase_orders').select('*'),
        supabase.from('purchase_order_items').select('*'),
        supabase.from('users').select('*'),
        supabase.from('people').select('*'),
        supabase.from('master_assistants').select('*'),
        supabase.from('master_shares').select('*'),
        supabase.from('master_primaries').select('*'),
        supabase.from('pay_approved_masters').select('*'),
        supabase.from('jobs_ledger').select('*'),
        supabase.from('jobs_ledger_fixtures').select('*'),
        supabase.from('jobs_ledger_materials').select('*'),
        supabase.from('jobs_ledger_team_members').select('*'),
        supabase.from('people_labor_jobs').select('*'),
        supabase.from('people_labor_job_items').select('*'),
        supabase.from('people_crew_jobs').select('*'),
        supabase.from('people_teams').select('*'),
        supabase.from('people_team_members').select('*'),
        supabase.from('people_hours').select('*'),
        supabase.from('people_hours_display_order').select('*'),
        supabase.from('people_pay_config').select('*'),
        supabase.from('jobs_receivables').select('*'),
        supabase.from('jobs_tally_parts').select('*'),
        supabase.from('supply_house_invoices').select('*'),
        supabase.from('checklist_items').select('*'),
        supabase.from('checklist_instances').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('report_templates').select('*'),
        supabase.from('report_template_fields').select('*'),
        supabase.from('report_enabled_users').select('*'),
        supabase.from('user_report_notification_preferences').select('*'),
        supabase.from('prospects').select('*'),
        supabase.from('prospect_callbacks').select('*'),
        supabase.from('prospect_comments').select('*'),
        supabase.from('app_settings').select('*'),
        supabase.from('workflow_templates').select('*'),
        supabase.from('workflow_template_steps').select('*'),
        supabase.from('workflow_step_dependencies').select('*'),
        supabase.from('service_types').select('*'),
        supabase.from('fixture_types').select('*'),
        supabase.from('part_types').select('*'),
        supabase.from('assembly_types').select('*'),
        supabase.from('counts_fixture_groups').select('*'),
        supabase.from('counts_fixture_group_items').select('*'),
        supabase.from('notification_templates').select('*'),
        supabase.from('email_templates').select('*'),
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
