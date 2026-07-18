import type { Database } from '../types/database'

/**
 * Shared types for the Dashboard phase-1 boot seam (`useDashboardBoot`).
 * Moved verbatim from Dashboard.tsx so the hook and the page (and later the
 * My Inbox / Projects card extractions) share one definition.
 */

export type SubscribedStep = {
  step_id: string
  step_name: string
  project_id: string
  project_name: string
  project_number: string | null
  notify_when_started: boolean
  notify_when_complete: boolean
  notify_when_reopened: boolean
}

export type Step = Database['public']['Tables']['project_workflow_steps']['Row']
export type AssignedStep = Step & {
  project_id: string
  project_name: string
  project_address: string | null
  project_plans_link: string | null
  project_superintendent_names: string | null
  workflow_id: string
}

export type ChecklistInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  notes: string | null
  completed_by_user_id: string | null
  created_at: string | null
  checklist_items?: {
    title: string
    links?: string[] | null
    notify_on_complete_user_id?: string | null
    notify_creator_on_complete?: boolean
    created_by_user_id?: string | null
  } | null
  checklist_instance_assignees?: Array<{ user_id: string }>
}
