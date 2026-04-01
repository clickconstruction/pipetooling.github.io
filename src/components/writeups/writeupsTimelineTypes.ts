import type { WriteupListRow } from './WriteupEditorModal'

export type NcnsListRow = {
  id: string
  subject_user_id: string
  subject_name: string
  created_by_user_id: string
  author_name: string
  work_date: string
  created_at: string
  had_approved_sessions: boolean
  source: string | null
  details: string | null
}

export type WriteupsTimelineRow =
  | { kind: 'writeup'; sortMs: number; writeup: WriteupListRow }
  | { kind: 'ncns'; sortMs: number; ncns: NcnsListRow }

export const NCNS_TEMPLATE_SORT_KEY = 'No-call, no-show'
