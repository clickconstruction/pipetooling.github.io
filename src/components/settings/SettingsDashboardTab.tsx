/** Settings → Dashboard & alerts tab: quick buttons, daily goals, team-hours sharing,
 * financial pins, report notifications, my reports, notification history, muted/ignored tasks.
 * Presentational; all state/handlers live in the parent (Settings.tsx) and arrive as props.
 * Inner role gates are preserved verbatim (myRole etc. arrive as props). */
import React, { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { Link } from 'react-router-dom'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Database } from '../../types/database'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { formatNotificationDatetime } from '../../utils/formatNotificationDatetime'
import { displayReportTemplateName } from '../../lib/reportTemplateDisplayName'
import {
  addPinForUser,
  clearPinned,
  clearPinnedInSupabase,
  deletePinForPathAndTab,
  removePin,
  reorderPins,
  type PinnedItem,
} from '../../lib/pinnedTabs'
import { displayLabelForGoalPickerUser, type GoalPickerUserRow } from '../../lib/goalPickerUserLabel'
import type { UserRole } from '../../hooks/useAuth'
import type { UserRow } from '../../types/settingsRows'
import type { ReportForEdit } from '../ReportEditModal'
import type { ReportForMyReports } from '../MyReportsModal'
import JobBookSettingsSection from './JobBookSettingsSection'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

type NotificationHistoryRow = Database['public']['Tables']['notification_history']['Row']
type TeamLeaderAssignment = {
  id: string
  leader_user_id: string
  member_user_id: string
  dashboard_hours_visibility: 'full' | 'strip_only'
}

type SettingsDashboardTabProps = {
  apTotal: number | null
  authUser: { id: string } | null
  billedCount: number | null
  billedTotal: number | null
  costMatrixTotal: number | null
  dailyGoalsLoading: boolean
  dailyGoalsRows: Array<{ id: string; body: string; sort_order: number }>
  dailyGoalsSectionOpen: boolean
  dailyGoalsTargetUserId: string
  dashboardButtons: Record<string, boolean>
  dashboardButtonsSaving: boolean
  dashboardButtonsSectionOpen: boolean
  dashboardQuickButtonsPlacement: 'top' | 'with_pins'
  dashboardQuickButtonsPlacementSaving: boolean
  externalTeamTotal: number | null
  filteredTeamLeaderAssignments: TeamLeaderAssignment[]
  financialPinsSectionOpen: boolean
  goalPickerUsers: Array<{ id: string; name: string | null; email: string | null }>
  hasNotificationHistory: boolean | null
  ignoredTaskTypes: Array<{ checklist_item_id: string; task_title: string; ignored_at: string }>
  ignoredTaskTypesLoading: boolean
  ignoredTaskTypesOpen: boolean
  ignoredTaskTypesUnignoringId: string | null
  loadBilledTotalAndPinnedUsers: () => void
  loadCostMatrixPinnedUsers: () => void
  loadExternalTeamTotalAndPinnedUsers: () => void
  loadIgnoredTaskTypes: () => void
  loadMutedTasks: () => void
  loadSupplyHousesAPTotalAndPinnedUsers: () => void
  mutedTasks: Array<{ checklist_item_id: string; task_title: string; muted_until: string }>
  mutedTasksLoading: boolean
  mutedTasksOpen: boolean
  myPins: PinnedItem[]
  myReports: ReportForMyReports[]
  myReportsExpanded: boolean
  myReportsLoading: boolean
  myReportsReportEditWindowDays: number
  myRole: UserRole | null
  notificationHistory: NotificationHistoryRow[]
  notificationHistoryError: string | null
  notificationHistoryLoading: boolean
  notificationHistoryOpen: boolean
  pinAPMasterIds: Set<string>
  pinAPMessage: { type: 'success' | 'error'; text: string } | null
  pinAPSaving: boolean
  pinAPUnpinSaving: boolean
  pinBilledMasterIds: Set<string>
  pinBilledMessage: { type: 'success' | 'error'; text: string } | null
  pinBilledSaving: boolean
  pinBilledUnpinSaving: boolean
  pinCostMatrixMasterIds: Set<string>
  pinCostMatrixMessage: { type: 'success' | 'error'; text: string } | null
  pinCostMatrixSaving: boolean
  pinCostMatrixUnpinSaving: boolean
  pinExternalTeamMasterIds: Set<string>
  pinExternalTeamMessage: { type: 'success' | 'error'; text: string } | null
  pinExternalTeamSaving: boolean
  pinExternalTeamUnpinSaving: boolean
  pinRemovingId: string | null
  pinsClearSuccess: boolean
  pinsLoading: boolean
  reportNotificationSaving: boolean
  reportNotificationTemplateIds: Set<string>
  reportNotificationsSectionOpen: boolean
  reportTemplates: Array<{ id: string; name: string }>
  saveReportNotificationPreferences: (e: FormEvent) => void
  setDailyGoalsRows: Dispatch<SetStateAction<Array<{ id: string; body: string; sort_order: number }>>>
  setDailyGoalsSectionOpen: Dispatch<SetStateAction<boolean>>
  setDailyGoalsTargetUserId: Dispatch<SetStateAction<string>>
  setDashboardButtons: Dispatch<SetStateAction<Record<string, boolean>>>
  setDashboardButtonsSaving: Dispatch<SetStateAction<boolean>>
  setDashboardButtonsSectionOpen: Dispatch<SetStateAction<boolean>>
  setDashboardQuickButtonsPlacement: Dispatch<SetStateAction<'top' | 'with_pins'>>
  setDashboardQuickButtonsPlacementSaving: Dispatch<SetStateAction<boolean>>
  setEditReportModalOpen: Dispatch<SetStateAction<boolean>>
  setError: Dispatch<SetStateAction<string | null>>
  setFinancialPinsSectionOpen: Dispatch<SetStateAction<boolean>>
  setIgnoredTaskTypesOpen: Dispatch<SetStateAction<boolean>>
  setIgnoredTaskTypesUnignoringId: Dispatch<SetStateAction<string | null>>
  setMuteModalItemId: Dispatch<SetStateAction<string | null>>
  setMuteModalTitle: Dispatch<SetStateAction<string>>
  setMutedTasksOpen: Dispatch<SetStateAction<boolean>>
  setMyReportsExpanded: Dispatch<SetStateAction<boolean>>
  setMyReportsModalOpen: Dispatch<SetStateAction<boolean>>
  setNotificationHistoryOpen: Dispatch<SetStateAction<boolean>>
  setPinAPMasterIds: Dispatch<SetStateAction<Set<string>>>
  setPinAPMessage: Dispatch<SetStateAction<{ type: 'success' | 'error'; text: string } | null>>
  setPinAPSaving: Dispatch<SetStateAction<boolean>>
  setPinAPUnpinSaving: Dispatch<SetStateAction<boolean>>
  setPinBilledMasterIds: Dispatch<SetStateAction<Set<string>>>
  setPinBilledMessage: Dispatch<SetStateAction<{ type: 'success' | 'error'; text: string } | null>>
  setPinBilledSaving: Dispatch<SetStateAction<boolean>>
  setPinBilledUnpinSaving: Dispatch<SetStateAction<boolean>>
  setPinCostMatrixMasterIds: Dispatch<SetStateAction<Set<string>>>
  setPinCostMatrixMessage: Dispatch<SetStateAction<{ type: 'success' | 'error'; text: string } | null>>
  setPinCostMatrixSaving: Dispatch<SetStateAction<boolean>>
  setPinCostMatrixUnpinSaving: Dispatch<SetStateAction<boolean>>
  setPinExternalTeamMasterIds: Dispatch<SetStateAction<Set<string>>>
  setPinExternalTeamMessage: Dispatch<SetStateAction<{ type: 'success' | 'error'; text: string } | null>>
  setPinExternalTeamSaving: Dispatch<SetStateAction<boolean>>
  setPinExternalTeamUnpinSaving: Dispatch<SetStateAction<boolean>>
  setPinRemovingId: Dispatch<SetStateAction<string | null>>
  setPinsClearSuccess: Dispatch<SetStateAction<boolean>>
  setReportForEdit: Dispatch<SetStateAction<ReportForEdit | null>>
  setReportNotificationsSectionOpen: Dispatch<SetStateAction<boolean>>
  setSelectedReport: Dispatch<SetStateAction<{ id: string; template_name: string; job_display_name: string; created_at: string; created_by_name: string; field_values?: Record<string, string>; reported_at_lat?: number | null; reported_at_lng?: number | null } | null>>
  setTeamAssignLeaderId: Dispatch<SetStateAction<string>>
  setTeamAssignMemberId: Dispatch<SetStateAction<string>>
  setTeamAssignSaving: Dispatch<SetStateAction<boolean>>
  setTeamLeadAssignmentsSectionOpen: Dispatch<SetStateAction<boolean>>
  setTeamLeaderAssignments: Dispatch<SetStateAction<TeamLeaderAssignment[]>>
  setTeamLeaderAssignmentsSearchQuery: Dispatch<SetStateAction<string>>
  setTeamLeaderSortColumn: Dispatch<SetStateAction<'leader' | 'member'>>
  setTeamLeaderSortDir: Dispatch<SetStateAction<'asc' | 'desc'>>
  setTeamLeaderVisibilitySavingId: Dispatch<SetStateAction<string | null>>
  setViewReportModalOpen: Dispatch<SetStateAction<boolean>>
  showMyReports: boolean
  teamAssignLeaderId: string
  teamAssignMemberId: string
  teamAssignSaving: boolean
  teamHoursMemberPickerDisabled: boolean
  teamHoursMemberPickerUsers: GoalPickerUserRow[]
  teamHoursMemberPlaceholder: string
  teamLeadAssignmentsSectionOpen: boolean
  teamLeaderAssignments: TeamLeaderAssignment[]
  teamLeaderAssignmentsSearchQuery: string
  teamLeaderSortColumn: 'leader' | 'member'
  teamLeaderSortDir: 'asc' | 'desc'
  teamLeaderVisibilitySavingId: string | null
  toggleReportNotificationTemplate: (templateId: string) => void
  users: UserRow[]
}

function pinKeyOf(item: PinnedItem): string {
  return `${item.path}:${item.tab ?? ''}`
}
function pinLabel(item: PinnedItem): string {
  return item.tab ? `${item.label} · ${item.tab.replace(/-/g, ' ').replace(/_/g, ' ')}` : item.label
}

/** A draggable, removable pin row (drag handle activates only past an 8px threshold). */
function SortablePinRow({ item, removing, onRemove }: { item: PinnedItem; removing: boolean; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: pinKeyOf(item) })
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        background: 'var(--bg-subtle)',
        borderRadius: 6,
        border: '1px solid var(--border)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          title="Drag to reorder"
          aria-label="Drag to reorder"
          style={{ cursor: 'grab', background: 'none', border: 'none', color: 'var(--text-faint)', padding: 0, fontSize: '1rem', touchAction: 'none' }}
        >
          ⠿
        </button>
        <span style={{ fontSize: '0.875rem' }}>{pinLabel(item)}</span>
      </span>
      <button
        type="button"
        disabled={removing}
        onClick={onRemove}
        style={{
          padding: '0.25rem 0.5rem',
          fontSize: '0.75rem',
          background: removing ? 'var(--bg-200)' : 'var(--bg-red-tint)',
          color: removing ? 'var(--text-faint)' : 'var(--text-red-700)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          cursor: removing ? 'not-allowed' : 'pointer',
        }}
      >
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </li>
  )
}

export default function SettingsDashboardTab({
  apTotal,
  authUser,
  billedCount,
  billedTotal,
  costMatrixTotal,
  dailyGoalsLoading,
  dailyGoalsRows,
  dailyGoalsSectionOpen,
  dailyGoalsTargetUserId,
  dashboardButtons,
  dashboardButtonsSaving,
  dashboardButtonsSectionOpen,
  dashboardQuickButtonsPlacement,
  dashboardQuickButtonsPlacementSaving,
  externalTeamTotal,
  filteredTeamLeaderAssignments,
  financialPinsSectionOpen,
  goalPickerUsers,
  hasNotificationHistory,
  ignoredTaskTypes,
  ignoredTaskTypesLoading,
  ignoredTaskTypesOpen,
  ignoredTaskTypesUnignoringId,
  loadBilledTotalAndPinnedUsers,
  loadCostMatrixPinnedUsers,
  loadExternalTeamTotalAndPinnedUsers,
  loadIgnoredTaskTypes,
  loadMutedTasks,
  loadSupplyHousesAPTotalAndPinnedUsers,
  mutedTasks,
  mutedTasksLoading,
  mutedTasksOpen,
  myPins,
  myReports,
  myReportsExpanded,
  myReportsLoading,
  myReportsReportEditWindowDays,
  myRole,
  notificationHistory,
  notificationHistoryError,
  notificationHistoryLoading,
  notificationHistoryOpen,
  pinAPMasterIds,
  pinAPMessage,
  pinAPSaving,
  pinAPUnpinSaving,
  pinBilledMasterIds,
  pinBilledMessage,
  pinBilledSaving,
  pinBilledUnpinSaving,
  pinCostMatrixMasterIds,
  pinCostMatrixMessage,
  pinCostMatrixSaving,
  pinCostMatrixUnpinSaving,
  pinExternalTeamMasterIds,
  pinExternalTeamMessage,
  pinExternalTeamSaving,
  pinExternalTeamUnpinSaving,
  pinRemovingId,
  pinsClearSuccess,
  pinsLoading,
  reportNotificationSaving,
  reportNotificationTemplateIds,
  reportNotificationsSectionOpen,
  reportTemplates,
  saveReportNotificationPreferences,
  setDailyGoalsRows,
  setDailyGoalsSectionOpen,
  setDailyGoalsTargetUserId,
  setDashboardButtons,
  setDashboardButtonsSaving,
  setDashboardButtonsSectionOpen,
  setDashboardQuickButtonsPlacement,
  setDashboardQuickButtonsPlacementSaving,
  setEditReportModalOpen,
  setError,
  setFinancialPinsSectionOpen,
  setIgnoredTaskTypesOpen,
  setIgnoredTaskTypesUnignoringId,
  setMuteModalItemId,
  setMuteModalTitle,
  setMutedTasksOpen,
  setMyReportsExpanded,
  setMyReportsModalOpen,
  setNotificationHistoryOpen,
  setPinAPMasterIds,
  setPinAPMessage,
  setPinAPSaving,
  setPinAPUnpinSaving,
  setPinBilledMasterIds,
  setPinBilledMessage,
  setPinBilledSaving,
  setPinBilledUnpinSaving,
  setPinCostMatrixMasterIds,
  setPinCostMatrixMessage,
  setPinCostMatrixSaving,
  setPinCostMatrixUnpinSaving,
  setPinExternalTeamMasterIds,
  setPinExternalTeamMessage,
  setPinExternalTeamSaving,
  setPinExternalTeamUnpinSaving,
  setPinRemovingId,
  setPinsClearSuccess,
  setReportForEdit,
  setReportNotificationsSectionOpen,
  setSelectedReport,
  setTeamAssignLeaderId,
  setTeamAssignMemberId,
  setTeamAssignSaving,
  setTeamLeadAssignmentsSectionOpen,
  setTeamLeaderAssignments,
  setTeamLeaderAssignmentsSearchQuery,
  setTeamLeaderSortColumn,
  setTeamLeaderSortDir,
  setTeamLeaderVisibilitySavingId,
  setViewReportModalOpen,
  showMyReports,
  teamAssignLeaderId,
  teamAssignMemberId,
  teamAssignSaving,
  teamHoursMemberPickerDisabled,
  teamHoursMemberPickerUsers,
  teamHoursMemberPlaceholder,
  teamLeadAssignmentsSectionOpen,
  teamLeaderAssignments,
  teamLeaderAssignmentsSearchQuery,
  teamLeaderSortColumn,
  teamLeaderSortDir,
  teamLeaderVisibilitySavingId,
  toggleReportNotificationTemplate,
  users,
}: SettingsDashboardTabProps) {
  const { showToast } = useToastContext()
  // Local copy of the pin order for instant drag feedback; reconciled from `myPins` (which the
  // parent reloads on the pins-changed event after reorderPins persists).
  const [orderedPins, setOrderedPins] = useState<PinnedItem[]>(myPins)
  useEffect(() => {
    setOrderedPins(myPins)
  }, [myPins])
  const pinDragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  async function handlePinDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = orderedPins.findIndex((p) => pinKeyOf(p) === active.id)
    const newIndex = orderedPins.findIndex((p) => pinKeyOf(p) === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(orderedPins, oldIndex, newIndex)
    setOrderedPins(reordered)
    await reorderPins(authUser?.id, reordered)
  }
  return (
    <>

      {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
          <button
            type="button"
            aria-expanded={dashboardButtonsSectionOpen}
            onClick={() => setDashboardButtonsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{dashboardButtonsSectionOpen ? '▼' : '▶'}</span>
            Dashboard buttons
          </button>
          {dashboardButtonsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
                Choose which quick-action buttons appear on your Dashboard.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
                {(['job', 'job_labor', 'bid', 'project', 'part', 'assembly', 'prospect', 'inspections', 'builder_review'] as const)
                  .filter((key) => key !== 'builder_review' || myRole === 'master_technician')
                  .map((key) => {
                  const label = key === 'job_labor' ? 'Job Labor' : key === 'prospect' ? 'Prospect' : key === 'inspections' ? 'Inspections' : key === 'builder_review' ? 'Builder Review' : key.charAt(0).toUpperCase() + key.slice(1)
                  return (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={dashboardButtons[key] !== false}
                        onChange={async (e) => {
                          const visible = e.target.checked
                          setDashboardButtons((prev) => ({ ...prev, [key]: visible }))
                          setDashboardButtonsSaving(true)
                          await supabase.from('user_dashboard_buttons').upsert(
                            { user_id: authUser!.id, button_key: key, visible },
                            { onConflict: 'user_id,button_key' }
                          )
                          setDashboardButtonsSaving(false)
                        }}
                        disabled={dashboardButtonsSaving}
                      />
                      {label}
                    </label>
                  )
                })}
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-700)' }}>Placement</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem', marginTop: 0 }}>
                  Show quick-action buttons at the top of the Dashboard (above Clock In/Out), or in the same row as your pinned page tabs.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dashboard-quick-buttons-placement"
                      checked={dashboardQuickButtonsPlacement === 'top'}
                      onChange={async () => {
                        if (!authUser?.id) return
                        setDashboardQuickButtonsPlacement('top')
                        setDashboardQuickButtonsPlacementSaving(true)
                        const { error } = await supabase.from('user_dashboard_preferences').upsert(
                          { user_id: authUser.id, quick_buttons_placement: 'top' },
                          { onConflict: 'user_id' },
                        )
                        setDashboardQuickButtonsPlacementSaving(false)
                        if (error) setError(error.message)
                      }}
                      disabled={dashboardQuickButtonsPlacementSaving}
                    />
                    At the top (above Clock In/Out)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="dashboard-quick-buttons-placement"
                      checked={dashboardQuickButtonsPlacement === 'with_pins'}
                      onChange={async () => {
                        if (!authUser?.id) return
                        setDashboardQuickButtonsPlacement('with_pins')
                        setDashboardQuickButtonsPlacementSaving(true)
                        const { error } = await supabase.from('user_dashboard_preferences').upsert(
                          { user_id: authUser.id, quick_buttons_placement: 'with_pins' },
                          { onConflict: 'user_id' },
                        )
                        setDashboardQuickButtonsPlacementSaving(false)
                        if (error) setError(error.message)
                      }}
                      disabled={dashboardQuickButtonsPlacementSaving}
                    />
                    With pinned tabs (default)
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {myRole != null && (
        <div style={{ marginBottom: '2rem' }}>
          <button
            type="button"
            onClick={() => setFinancialPinsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{financialPinsSectionOpen ? '▼' : '▶'}</span>
            Dashboard Page Pins
          </button>
          {financialPinsSectionOpen && (
            <div style={{ padding: '1rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
                <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Page pins</h2>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  Pinned pages appear as shortcut links at the top of your Dashboard.
                </p>
                {pinsClearSuccess && (
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-green-600)', fontWeight: 500 }}>
                    Page pins cleared.
                  </p>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    clearPinned(authUser?.id)
                    if (authUser?.id) await clearPinnedInSupabase(authUser.id)
                    setPinsClearSuccess(true)
                    setTimeout(() => setPinsClearSuccess(false), 3000)
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    background: 'var(--bg-muted)',
                    color: 'var(--text-700)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Clear all page pins
                </button>
                {!pinsLoading && orderedPins.length > 0 && (
                  <>
                    <p style={{ margin: '0.75rem 0 0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drag ⠿ to reorder how they appear on the dashboard.</p>
                    <DndContext sensors={pinDragSensors} collisionDetection={closestCenter} onDragEnd={handlePinDragEnd}>
                      <SortableContext items={orderedPins.map(pinKeyOf)} strategy={verticalListSortingStrategy}>
                        <ul style={{ margin: '0.25rem 0 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {orderedPins.map((item) => {
                            const pinKey = pinKeyOf(item)
                            return (
                              <SortablePinRow
                                key={pinKey}
                                item={item}
                                removing={pinRemovingId === pinKey}
                                onRemove={async () => {
                                  setPinRemovingId(pinKey)
                                  await removePin(authUser?.id, item)
                                  setPinRemovingId(null)
                                }}
                              />
                            )
                          })}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  </>
                )}
              </div>

              {myRole === 'dev' && (
              <>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
                <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Billed to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pin Billed count and total to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinBilledMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinBilledMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinBilledMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinBilledMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinBilledSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinBilledSaving || pinBilledMasterIds.size === 0}
              onClick={async () => {
                setPinBilledSaving(true)
                setPinBilledMessage(null)
                const count = billedCount ?? 0
                const total = billedTotal ?? 0
                const label = `Billed Awaiting Payment (${count}) - $${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                const item = { path: '/jobs', label, tab: 'billed' as const }
                const ids = Array.from(pinBilledMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinBilledSaving(false)
                if (errMsg) setPinBilledMessage({ type: 'error', text: errMsg })
                else {
                  loadBilledTotalAndPinnedUsers()
                  setPinBilledMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinBilledMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinBilledSaving || pinBilledMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinBilledSaving || pinBilledUnpinSaving}
              onClick={async () => {
                setPinBilledUnpinSaving(true)
                setPinBilledMessage(null)
                const { count, error } = await deletePinForPathAndTab('/jobs', 'billed')
                setPinBilledUnpinSaving(false)
                if (error) setPinBilledMessage({ type: 'error', text: error.message })
                else {
                  loadBilledTotalAndPinnedUsers()
                  setPinBilledMessage({ type: 'success', text: `Unpinned Billed for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinBilledMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                color: 'var(--text-700)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: pinBilledSaving || pinBilledUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinBilledMessage && (
            <p style={{ color: pinBilledMessage.type === 'success' ? 'var(--text-green-600)' : 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinBilledMessage.text}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Cost matrix to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pin Cost matrix to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinCostMatrixMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinCostMatrixMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinCostMatrixMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinCostMatrixMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinCostMatrixSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinCostMatrixSaving || pinCostMatrixMasterIds.size === 0}
              onClick={async () => {
                setPinCostMatrixSaving(true)
                setPinCostMatrixMessage(null)
                const total = costMatrixTotal ?? 0
                const item = { path: '/people', label: `Internal Team: $${Math.round(total).toLocaleString('en-US')}`, tab: 'hours' as const }
                const ids = Array.from(pinCostMatrixMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinCostMatrixSaving(false)
                if (errMsg) setPinCostMatrixMessage({ type: 'error', text: errMsg })
                else {
                  loadCostMatrixPinnedUsers()
                  setPinCostMatrixMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinCostMatrixMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinCostMatrixSaving || pinCostMatrixMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinCostMatrixSaving || pinCostMatrixUnpinSaving}
              onClick={async () => {
                setPinCostMatrixUnpinSaving(true)
                setPinCostMatrixMessage(null)
                const { count, error } = await deletePinForPathAndTab('/people', 'hours')
                setPinCostMatrixUnpinSaving(false)
                if (error) setPinCostMatrixMessage({ type: 'error', text: error.message })
                else {
                  loadCostMatrixPinnedUsers()
                  setPinCostMatrixMessage({ type: 'success', text: `Unpinned Cost matrix for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinCostMatrixMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                color: 'var(--text-700)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: pinCostMatrixSaving || pinCostMatrixUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinCostMatrixMessage && (
            <p style={{ color: pinCostMatrixMessage.type === 'success' ? 'var(--text-green-600)' : 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinCostMatrixMessage.text}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Supply Houses AP to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pin Supply Houses AP total to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinAPMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinAPMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinAPMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinAPMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinAPSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinAPSaving || pinAPMasterIds.size === 0}
              onClick={async () => {
                setPinAPSaving(true)
                setPinAPMessage(null)
                const total = apTotal ?? 0
                const item = { path: '/materials', label: `Supply Houses AP | $${Math.round(total).toLocaleString('en-US')}`, tab: 'supply-houses' as const }
                const ids = Array.from(pinAPMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinAPSaving(false)
                if (errMsg) setPinAPMessage({ type: 'error', text: errMsg })
                else {
                  loadSupplyHousesAPTotalAndPinnedUsers()
                  setPinAPMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinAPMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinAPSaving || pinAPMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinAPSaving || pinAPUnpinSaving}
              onClick={async () => {
                setPinAPUnpinSaving(true)
                setPinAPMessage(null)
                const { count, error } = await deletePinForPathAndTab('/materials', 'supply-houses')
                setPinAPUnpinSaving(false)
                if (error) setPinAPMessage({ type: 'error', text: error.message })
                else {
                  loadSupplyHousesAPTotalAndPinnedUsers()
                  setPinAPMessage({ type: 'success', text: `Unpinned Supply Houses AP for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinAPMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                color: 'var(--text-700)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: pinAPSaving || pinAPUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinAPMessage && (
            <p style={{ color: pinAPMessage.type === 'success' ? 'var(--text-green-600)' : 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinAPMessage.text}
            </p>
          )}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Pin Sub Labor Due to Dashboard</h2>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Pin Sub Labor Due (unpaid sub labor balances) to a master or dev&apos;s dashboard so it appears on their Dashboard.
          </p>
          {pinExternalTeamMasterIds.size > 0 && (
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>
              Pinned for:{' '}
              {users
                .filter((u) => u.role === 'master_technician' || u.role === 'dev')
                .filter((u) => pinExternalTeamMasterIds.has(u.id))
                .map((u) => u.name || u.email || 'Unknown')
                .join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
            {users.filter((u) => u.role === 'master_technician' || u.role === 'dev').map((u) => (
              <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={pinExternalTeamMasterIds.has(u.id)}
                  onChange={(e) => {
                    setPinExternalTeamMasterIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(u.id)
                      else next.delete(u.id)
                      return next
                    })
                  }}
                  disabled={pinExternalTeamSaving}
                />
                {u.name || u.email || 'Unknown'} ({u.role === 'dev' ? 'Dev' : 'Master'})
              </label>
            ))}
            <button
              type="button"
              disabled={pinExternalTeamSaving || pinExternalTeamMasterIds.size === 0}
              onClick={async () => {
                setPinExternalTeamSaving(true)
                setPinExternalTeamMessage(null)
                const total = externalTeamTotal ?? 0
                const formatTotal = total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                const item = { path: '/jobs', label: `Sub Labor Due: $${formatTotal}`, tab: 'sub_sheet_ledger' as const }
                const ids = Array.from(pinExternalTeamMasterIds)
                let ok = 0
                let errMsg: string | null = null
                for (const userId of ids) {
                  const { error } = await addPinForUser(userId, item)
                  if (error) errMsg = error.message
                  else ok++
                }
                setPinExternalTeamSaving(false)
                if (errMsg) setPinExternalTeamMessage({ type: 'error', text: errMsg })
                else {
                  loadExternalTeamTotalAndPinnedUsers()
                  setPinExternalTeamMessage({ type: 'success', text: `Pinned for ${ok} user${ok !== 1 ? 's' : ''}. Users may need to refresh their Dashboard to see it.` })
                  setTimeout(() => setPinExternalTeamMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: pinExternalTeamSaving || pinExternalTeamMasterIds.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Pin To Dashboard
            </button>
            <button
              type="button"
              disabled={pinExternalTeamSaving || pinExternalTeamUnpinSaving}
              onClick={async () => {
                setPinExternalTeamUnpinSaving(true)
                setPinExternalTeamMessage(null)
                const [subRes, extRes] = await Promise.all([
                  deletePinForPathAndTab('/jobs', 'sub_sheet_ledger'),
                  deletePinForPathAndTab('/materials', 'external-team'),
                ])
                const count = (subRes.count ?? 0) + (extRes.count ?? 0)
                const error = subRes.error ?? extRes.error
                setPinExternalTeamUnpinSaving(false)
                if (error) setPinExternalTeamMessage({ type: 'error', text: error.message })
                else {
                  loadExternalTeamTotalAndPinnedUsers()
                  setPinExternalTeamMessage({ type: 'success', text: `Unpinned Sub Labor Due for ${count} user${count !== 1 ? 's' : ''}.` })
                  setTimeout(() => setPinExternalTeamMessage(null), 5000)
                }
              }}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: 'var(--bg-muted)',
                color: 'var(--text-700)',
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                cursor: pinExternalTeamSaving || pinExternalTeamUnpinSaving ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              Unpin All
            </button>
          </div>
          {pinExternalTeamMessage && (
            <p style={{ color: pinExternalTeamMessage.type === 'success' ? 'var(--text-green-600)' : 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {pinExternalTeamMessage.text}
            </p>
          )}
        </div>
              </>
              )}

            </div>
          )}
        </div>
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
          <button
            type="button"
            aria-expanded={dailyGoalsSectionOpen}
            onClick={() => setDailyGoalsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{dailyGoalsSectionOpen ? '▼' : '▶'}</span>
            Daily goals (clock-in gate)
          </button>
          {dailyGoalsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
                After a user&apos;s first clock-in each calendar day, they must check off these goals before using the app. Leave empty to disable the gate for that user.
              </p>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>User</label>
              <select
                value={dailyGoalsTargetUserId}
                onChange={(e) => setDailyGoalsTargetUserId(e.target.value)}
                style={{ padding: '0.35rem 0.5rem', marginBottom: '1rem', maxWidth: 420, width: '100%' }}
              >
                <option value="">Select user…</option>
                {goalPickerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                  </option>
                ))}
              </select>
              {dailyGoalsTargetUserId &&
                (dailyGoalsLoading ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
                ) : (
                  <>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {dailyGoalsRows.map((row) => (
                        <li key={row.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                          <textarea
                            value={row.body}
                            onChange={(e) => {
                              const v = e.target.value
                              setDailyGoalsRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, body: v } : r)))
                            }}
                            onBlur={async (e) => {
                              const body = e.currentTarget.value.trim()
                              if (!body) return
                              const { error: err } = await supabase.from('user_dashboard_goals').update({ body }).eq('id', row.id)
                              if (err) setError(err.message)
                            }}
                            rows={2}
                            style={{ flex: 1, padding: '0.5rem', fontSize: '0.875rem' }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Delete this goal?')) return
                              const { error: err } = await supabase.from('user_dashboard_goals').delete().eq('id', row.id)
                              if (err) setError(err.message)
                              else setDailyGoalsRows((prev) => prev.filter((r) => r.id !== row.id))
                            }}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}
                          >
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!dailyGoalsTargetUserId) return
                        const nextOrder =
                          dailyGoalsRows.length === 0 ? 0 : Math.max(...dailyGoalsRows.map((r) => r.sort_order), 0) + 1
                        const { data, error: err } = await supabase
                          .from('user_dashboard_goals')
                          .insert({ user_id: dailyGoalsTargetUserId, body: 'New goal', sort_order: nextOrder })
                          .select('id, body, sort_order')
                          .single()
                        if (err) setError(err.message)
                        else if (data)
                          setDailyGoalsRows((prev) => [...prev, data as { id: string; body: string; sort_order: number }])
                      }}
                      style={{ marginTop: '0.5rem', padding: '0.35rem 0.75rem', fontSize: '0.875rem' }}
                    >
                      Add goal
                    </button>
                  </>
                ))}
            </div>
          )}
        </div>
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <JobBookSettingsSection onDbError={(msg) => setError(msg)} />
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
          <button
            type="button"
            aria-expanded={teamLeadAssignmentsSectionOpen}
            onClick={() => setTeamLeadAssignmentsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{teamLeadAssignmentsSectionOpen ? '▼' : '▶'}</span>
            Team Hours Sharing
          </button>
          {teamLeadAssignmentsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>
            Link a leader to a member for team hours sharing—the leader can approve that member&apos;s hours from Dashboard → My Team. Any account role can be leader or member. A member can have more than one leader (with a different leader each time). The member list skips people already linked to the leader you pick.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Leader</label>
              <select
                value={teamAssignLeaderId}
                onChange={(e) => {
                  setTeamAssignLeaderId(e.target.value)
                  setTeamAssignMemberId('')
                }}
                style={{ padding: '0.35rem 0.5rem', maxWidth: 320, width: '100%', minWidth: 200, border: '1px solid var(--border-strong)' }}
              >
                <option value="">Select user…</option>
                {goalPickerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.875rem', fontWeight: 500 }}>Member</label>
              <select
                value={teamAssignMemberId}
                disabled={teamHoursMemberPickerDisabled}
                onChange={(e) => setTeamAssignMemberId(e.target.value)}
                style={{
                  padding: '0.35rem 0.5rem',
                  maxWidth: 320,
                  width: '100%',
                  minWidth: 200,
                  ...(teamHoursMemberPickerDisabled
                    ? {
                        background: 'var(--bg-muted)',
                        color: 'var(--text-faint)',
                        cursor: 'not-allowed',
                        border: '1px solid var(--border)',
                      }
                    : {
                        background: 'var(--surface)',
                        color: 'inherit',
                        cursor: 'pointer',
                        border: '1px solid var(--border-strong)',
                      }),
                }}
              >
                <option value="">{teamHoursMemberPlaceholder}</option>
                {teamHoursMemberPickerUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(u.name?.trim() || u.email || u.id).slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={teamAssignSaving || !teamAssignLeaderId || !teamAssignMemberId || teamAssignLeaderId === teamAssignMemberId}
              onClick={async () => {
                if (!authUser?.id || !teamAssignLeaderId || !teamAssignMemberId) return
                if (teamAssignLeaderId === teamAssignMemberId) {
                  setError('Leader and member must be different users.')
                  return
                }
                setTeamAssignSaving(true)
                try {
                  const inserted = await withSupabaseRetry(
                    async () =>
                      supabase
                        .from('team_leader_assignments')
                        .insert({
                          leader_user_id: teamAssignLeaderId,
                          member_user_id: teamAssignMemberId,
                          created_by_user_id: authUser.id,
                        })
                        .select('id, leader_user_id, member_user_id, dashboard_hours_visibility')
                        .single(),
                    'add team lead assignment',
                  )
                  if (!inserted) {
                    setError('Could not add assignment.')
                    return
                  }
                  const row = inserted as {
                    id: string
                    leader_user_id: string
                    member_user_id: string
                    dashboard_hours_visibility: string | null
                  }
                  setTeamLeaderAssignments((prev) => [
                    {
                      id: row.id,
                      leader_user_id: row.leader_user_id,
                      member_user_id: row.member_user_id,
                      dashboard_hours_visibility:
                        row.dashboard_hours_visibility === 'strip_only' ? 'strip_only' : 'full',
                    },
                    ...prev,
                  ])
                  setTeamAssignLeaderId('')
                  setTeamAssignMemberId('')
                } catch (e) {
                  setError(formatErrorMessage(e))
                } finally {
                  setTeamAssignSaving(false)
                }
              }}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.875rem',
                borderRadius: 4,
                border: '1px solid #2563eb',
                background: '#2563eb',
                color: 'white',
                cursor: teamAssignSaving ? 'wait' : 'pointer',
                opacity: teamAssignSaving ? 0.7 : 1,
              }}
            >
              Add
            </button>
          </div>
          {teamLeaderAssignments.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No assignments yet.</p>
          ) : (
            <React.Fragment>
              <div style={{ marginBottom: '0.75rem' }}>
                <input
                  type="search"
                  value={teamLeaderAssignmentsSearchQuery}
                  onChange={(e) => setTeamLeaderAssignmentsSearchQuery(e.target.value)}
                  placeholder="Search by leader or member…"
                  aria-label="Search team hours assignments by leader or member"
                  style={{
                    width: '100%',
                    maxWidth: 420,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {filteredTeamLeaderAssignments.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>No assignments match your search.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted)', textAlign: 'left' }}>
                    <th
                      scope="col"
                      aria-sort={
                        teamLeaderSortColumn === 'leader'
                          ? teamLeaderSortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (teamLeaderSortColumn === 'leader') {
                            setTeamLeaderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                          } else {
                            setTeamLeaderSortColumn('leader')
                            setTeamLeaderSortDir('asc')
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontStyle: 'inherit',
                          lineHeight: 'inherit',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        Leader
                        {teamLeaderSortColumn === 'leader' && (
                          <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {teamLeaderSortDir === 'asc' ? '\u25B2' : '\u25BC'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th
                      scope="col"
                      aria-sort={
                        teamLeaderSortColumn === 'member'
                          ? teamLeaderSortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                      style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (teamLeaderSortColumn === 'member') {
                            setTeamLeaderSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                          } else {
                            setTeamLeaderSortColumn('member')
                            setTeamLeaderSortDir('asc')
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          width: '100%',
                          padding: 0,
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontStyle: 'inherit',
                          lineHeight: 'inherit',
                          fontWeight: 600,
                          textAlign: 'left',
                        }}
                      >
                        Member
                        {teamLeaderSortColumn === 'member' && (
                          <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {teamLeaderSortDir === 'asc' ? '\u25B2' : '\u25BC'}
                          </span>
                        )}
                      </button>
                    </th>
                    <th scope="col" style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                      Leader dashboard
                    </th>
                    <th scope="col" style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', width: 100 }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredTeamLeaderAssignments.map((row) => {
                    const leaderLabel = displayLabelForGoalPickerUser(row.leader_user_id, goalPickerUsers)
                    const memberLabel = displayLabelForGoalPickerUser(row.member_user_id, goalPickerUsers)
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{leaderLabel}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{memberLabel}</td>
                        <td style={{ padding: '0.5rem 0.75rem', maxWidth: 220 }}>
                          <select
                            value={row.dashboard_hours_visibility}
                            disabled={myRole !== 'dev' || teamLeaderVisibilitySavingId === row.id}
                            title={
                              myRole !== 'dev'
                                ? 'Only a developer can change this setting.'
                                : 'What this leader sees on their Dashboard for this member'
                            }
                            onChange={(e) => {
                              const next = e.target.value === 'strip_only' ? 'strip_only' : 'full'
                              if (next === row.dashboard_hours_visibility) return
                              setTeamLeaderVisibilitySavingId(row.id)
                              void (async () => {
                                try {
                                  await withSupabaseRetry(
                                    async () =>
                                      supabase
                                        .from('team_leader_assignments')
                                        .update({ dashboard_hours_visibility: next })
                                        .eq('id', row.id),
                                    'update team leader dashboard visibility',
                                  )
                                  setTeamLeaderAssignments((prev) =>
                                    prev.map((r) => (r.id === row.id ? { ...r, dashboard_hours_visibility: next } : r)),
                                  )
                                } catch (err) {
                                  setError(formatErrorMessage(err))
                                } finally {
                                  setTeamLeaderVisibilitySavingId(null)
                                }
                              })()
                            }}
                            style={{
                              width: '100%',
                              maxWidth: 200,
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.8125rem',
                              border: '1px solid var(--border-strong)',
                              borderRadius: 4,
                              background: myRole !== 'dev' ? 'var(--bg-muted)' : 'var(--surface)',
                              cursor: myRole !== 'dev' ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <option value="full">Full My Team</option>
                            <option value="strip_only">Clock strip only</option>
                          </select>
                          {myRole !== 'dev' ? (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: 4 }}>Dev only</div>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <button
                            type="button"
                            disabled={teamAssignSaving}
                            onClick={async () => {
                              if (!confirm('Remove this team lead assignment?')) return
                              setTeamAssignSaving(true)
                              try {
                                await withSupabaseRetry(
                                  async () => supabase.from('team_leader_assignments').delete().eq('id', row.id),
                                  'remove team lead assignment',
                                )
                                setTeamLeaderAssignments((prev) => prev.filter((r) => r.id !== row.id))
                              } catch (e) {
                                setError(formatErrorMessage(e))
                              } finally {
                                setTeamAssignSaving(false)
                              }
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.8125rem',
                              color: 'var(--text-red-700)',
                              border: '1px solid #fecaca',
                              borderRadius: 4,
                              background: 'var(--bg-red-tint)',
                              cursor: teamAssignSaving ? 'wait' : 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
            </React.Fragment>
          )}
        </div>
      )}
        </div>
      )}

      {(myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)) && (
        <div style={{ marginBottom: '2rem', border: '1px solid var(--border)', borderRadius: 8 }}>
          <button
            type="button"
            aria-expanded={reportNotificationsSectionOpen}
            onClick={() => setReportNotificationsSectionOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>{reportNotificationsSectionOpen ? '▼' : '▶'}</span>
            Report notifications
          </button>
          {reportNotificationsSectionOpen && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Get a push notification when someone submits these report types. Enable push notifications above first.
              </p>
              <form onSubmit={saveReportNotificationPreferences}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  {reportTemplates.map((t) => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={reportNotificationTemplateIds.has(t.id)}
                        onChange={() => toggleReportNotificationTemplate(t.id)}
                      />
                      Notify me when someone submits: {t.name}
                    </label>
                  ))}
                  {reportTemplates.length === 0 && (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>No report templates.</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={reportNotificationSaving}
                  style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: reportNotificationSaving ? 'not-allowed' : 'pointer' }}
                >
                  {reportNotificationSaving ? 'Saving…' : 'Save report notification preferences'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}


      {showMyReports && (
        <div
          style={{
            marginBottom: '2rem',
            marginTop: 0,
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
          }}
        >
            <button
              type="button"
            onClick={() => setMyReportsExpanded((prev) => !prev)}
            aria-expanded={myReportsExpanded}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap',
              margin: 0,
              padding: '1rem',
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              textAlign: 'left',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem' }} aria-hidden>{myReportsExpanded ? '▼' : '▶'}</span>
              My Reports
            </span>
            {myReportsExpanded && !myReportsLoading && myReports.length > 1 && (
            <button
              type="button"
                onClick={(e) => { e.stopPropagation(); setMyReportsModalOpen(true) }}
                style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.875rem', color: 'var(--text-link)', cursor: 'pointer' }}
            >
                Show more →
            </button>
            )}
            </button>
          {myReportsExpanded && (
            <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              {myReportsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading reports…</p>
              ) : myReports.length > 0 ? (
                (() => {
                  const r = myReports[0]!
                  const editWindowMs = myReportsReportEditWindowDays * 24 * 60 * 60 * 1000
                  const isWithinEditWindow = new Date(r.created_at).getTime() >= Date.now() - editWindowMs
                  return (
                    <div
                      style={{
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{ flex: 1, minWidth: 0 }}
                        onClick={() => {
                          setSelectedReport({ id: r.id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, created_by_name: r.created_by_name, field_values: r.field_values, reported_at_lat: r.reported_at_lat ?? null, reported_at_lng: r.reported_at_lng ?? null })
                          setViewReportModalOpen(true)
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{r.job_display_name || 'Unknown job'}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginLeft: '0.5rem' }}>· {displayReportTemplateName(r.template_name, myRole)}</span>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                      {isWithinEditWindow && (
            <button
              type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setReportForEdit({ id: r.id, template_id: r.template_id, template_name: r.template_name, job_display_name: r.job_display_name, created_at: r.created_at, field_values: r.field_values })
                            setEditReportModalOpen(true)
                          }}
                          style={{ flexShrink: 0, padding: '0.35rem 0.75rem', fontSize: '0.875rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Edit
            </button>
                      )}
          </div>
                  )
                })()
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No reports yet. Create one from a job.</p>
              )}
            </div>
          )}
        </div>
      )}

      {hasNotificationHistory === true && (
      <div
        style={{
          marginBottom: '2rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg-subtle)',
        }}
      >
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
          onClick={() => setNotificationHistoryOpen((o) => !o)}
          aria-expanded={notificationHistoryOpen}
          aria-controls="notification-history-content"
            >
          <span style={{ fontSize: '0.75rem' }} aria-hidden>{notificationHistoryOpen ? '▼' : '▶'}</span>
          My Notification History
            </button>
        {notificationHistoryOpen && (
          <div id="notification-history-content" style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
            {notificationHistoryLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
            ) : notificationHistoryError ? (
              <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', margin: 0 }}>{notificationHistoryError}</p>
            ) : notificationHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>No notifications yet.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {notificationHistory.map((row) => {
                  const channelLabel = row.channel === 'both' ? 'Email + Push' : row.channel === 'email' ? 'Email' : 'Push'
                  const link =
                    row.project_id && row.step_id
                      ? `/workflows/${row.project_id}#step-${row.step_id}`
                      : row.checklist_instance_id
                        ? '/checklist'
                        : null
                  return (
                    <li
                      key={row.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        marginBottom: '0.5rem',
                        background: 'var(--surface)',
                      }}
                    >
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', minWidth: 140 }}>
                        {formatNotificationDatetime(row.sent_at)}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{row.title}</span>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--bg-muted)',
                          color: 'var(--text-700)',
                        }}
                      >
                        {channelLabel}
                      </span>
                      {link && (
                        <Link to={link} style={{ fontSize: '0.875rem', color: 'var(--text-link)' }}>
                          View →
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
              </div>
            )}
          </div>
      )}

      {authUser?.id && (
        <div
          style={{
            marginBottom: '2rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
          }}
        >
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            onClick={() => setMutedTasksOpen((o) => !o)}
            aria-expanded={mutedTasksOpen}
            aria-controls="muted-tasks-content"
            >
            <span style={{ fontSize: '0.75rem' }} aria-hidden>{mutedTasksOpen ? '▼' : '▶'}</span>
            Muted Tasks
            </button>
          {mutedTasksOpen && (
            <div id="muted-tasks-content" style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              {mutedTasksLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : mutedTasks.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                  You are not muting any task notifications. Use the mute icon on a task (Checklist or Dashboard) to mute it.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {mutedTasks.map((m) => {
                    const until = new Date(m.muted_until)
                    const isForever = until > new Date('9999-01-01')
                    const expiryText = isForever ? 'Forever' : until.toLocaleDateString(undefined, { dateStyle: 'medium' })
                    return (
                      <li
                        key={m.checklist_item_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: 'var(--bg-subtle)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{m.task_title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Muted until: {expiryText}</div>
                  </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                            type="button"
                            onClick={() => { setMuteModalItemId(m.checklist_item_id); setMuteModalTitle(m.task_title) }}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Change
                  </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!authUser?.id) return
                              await supabase
                                .from('user_checklist_item_mute_preferences')
                                .delete()
                                .eq('user_id', authUser.id)
                                .eq('checklist_item_id', m.checklist_item_id)
                              loadMutedTasks()
                            }}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Unmute
                          </button>
              </div>
                      </li>
                    )
                  })}
                </ul>
            )}
          </div>
          )}
        </div>
      )}

      {myRole === 'dev' && authUser?.id && (
        <div
          style={{
            marginBottom: '2rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-subtle)',
          }}
        >
            <button
              type="button"
            aria-expanded={ignoredTaskTypesOpen}
            onClick={() => setIgnoredTaskTypesOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                margin: 0,
                padding: '1rem',
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
            <span style={{ fontSize: '0.75rem' }} aria-hidden>{ignoredTaskTypesOpen ? '▼' : '▶'}</span>
            Ignored task types (Dashboard)
            </button>
          {ignoredTaskTypesOpen && (
              <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                These affect which task types appear in Recently Completed Tasks on the Dashboard. They are not the same as
                Muted Tasks (notifications).
              </p>
              {ignoredTaskTypesLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Loading…</p>
              ) : ignoredTaskTypes.length === 0 ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
                  No ignored task types. On the Dashboard, use Ignore in Recently Completed Tasks to move a type here.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {ignoredTaskTypes.map((row) => (
                    <li
                      key={row.checklist_item_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.5rem 0.75rem',
                            border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{row.task_title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Ignored {new Date(row.ignored_at).toLocaleString()}
                  </div>
              </div>
                      <button
                        type="button"
                        disabled={ignoredTaskTypesUnignoringId != null}
                        onClick={async () => {
                          if (!authUser?.id) return
                          setIgnoredTaskTypesUnignoringId(row.checklist_item_id)
                          try {
                            await withSupabaseRetry(
                              async () =>
                                supabase
                                  .from('dev_ignored_checklist_items')
                                  .delete()
                                  .eq('dev_user_id', authUser.id)
                                  .eq('checklist_item_id', row.checklist_item_id),
                              'unignore checklist item type',
                            )
                            showToast('Task type removed from ignored list.', 'success')
                            await loadIgnoredTaskTypes()
                          } catch (e) {
                            setError(formatErrorMessage(e))
                          } finally {
                            setIgnoredTaskTypesUnignoringId(null)
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.8125rem',
                          background: 'var(--surface)',
                          color: 'var(--text-700)',
                          border: '1px solid var(--border-strong)',
                          borderRadius: 4,
                          cursor: ignoredTaskTypesUnignoringId != null ? 'wait' : 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        {ignoredTaskTypesUnignoringId === row.checklist_item_id ? 'Removing…' : 'Un-ignore'}
              </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        )}

    </>
  )
}
