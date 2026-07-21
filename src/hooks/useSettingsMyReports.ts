import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ReportForMyReports } from '../components/MyReportsModal'

/**
 * Settings → Dashboard & alerts → My Reports engine: `list_my_reports` RPC
 * loader (+ the report edit-window app setting) and the realtime channel
 * (`settings-my-reports-changes` on `reports`). Extracted verbatim from
 * Settings.tsx (v2.858). The view/edit/MyReports modals and their selection
 * state stay in the parent (they're page-level, shared surfaces); the parent
 * reaches the reload through the returned `loadMyReportsRef` exactly as before.
 * `enabled` = the parent's `showMyReports` role gate.
 */
export function useSettingsMyReports(enabled: boolean, authUserId: string | null) {
  const [myReports, setMyReports] = useState<ReportForMyReports[]>([])
  const [myReportsLoading, setMyReportsLoading] = useState(false)
  const [myReportsExpanded, setMyReportsExpanded] = useState(false)
  const [myReportsReportEditWindowDays, setMyReportsReportEditWindowDays] = useState<number>(2)
  const loadMyReportsRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!authUserId || !enabled) return
    setMyReportsLoading(true)
    const load = async () => {
      try {
        const [{ data: reportSettings }, { data }] = await Promise.all([
          supabase.from('app_settings').select('key, value_num').eq('key', 'report_edit_window_days').maybeSingle(),
          supabase.rpc('list_my_reports'),
        ])
        const editDays = (reportSettings as { value_num?: number } | null)?.value_num ?? 2
        setMyReportsReportEditWindowDays(typeof editDays === 'number' ? editDays : 2)
        const arr = Array.isArray(data) ? data : []
        const list = arr.map(
          (r: {
            id: string
            template_id: string
            template_name: string
            job_display_name: string
            job_ledger_id?: string | null
            project_id?: string | null
            bid_id?: string | null
            created_at: string
            created_by_name: string
            field_values?: unknown
            reported_at_lat?: number | null
            reported_at_lng?: number | null
          }) => ({
            id: r.id,
            template_id: r.template_id,
            template_name: r.template_name,
            job_display_name: r.job_display_name,
            job_ledger_id: r.job_ledger_id ?? null,
            project_id: r.project_id ?? null,
            bid_id: r.bid_id ?? null,
            created_at: r.created_at,
            created_by_name: r.created_by_name,
            field_values: r.field_values as Record<string, string> | undefined,
            reported_at_lat: r.reported_at_lat ?? null,
            reported_at_lng: r.reported_at_lng ?? null,
          }),
        )
        setMyReports(list)
      } finally {
        setMyReportsLoading(false)
      }
    }
    loadMyReportsRef.current = load
    load()
  }, [authUserId, enabled])

  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('settings-my-reports-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        loadMyReportsRef.current?.()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [enabled])

  return {
    myReports,
    myReportsLoading,
    myReportsExpanded,
    setMyReportsExpanded,
    myReportsReportEditWindowDays,
    loadMyReportsRef,
  }
}
