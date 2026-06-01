/** Row shapes shared between Settings.tsx (state/loaders) and the extracted Settings tab
 * components (People, etc.). Kept here so tab components don't import from the page module. */
import type { UserRole } from '../hooks/useAuth'

export type UserRow = {
  id: string
  email: string
  name: string
  role: UserRole
  last_sign_in_at: string | null
  estimator_prospects_access?: boolean
  estimator_service_type_ids?: string[] | null
  primary_service_type_ids?: string[] | null
  superintendent_service_type_ids?: string[] | null
  subcontractor_service_type_ids?: string[] | null
  helpers_service_type_ids?: string[] | null
  archived_at?: string | null
}

export type PersonRow = {
  id: string
  master_user_id: string
  kind: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  creator_name: string | null
  creator_email: string | null
  is_user: boolean
}

export interface ServiceType {
  id: string
  name: string
  description: string | null
  color: string | null
  sequence_order: number
  created_at: string
  updated_at: string
  ledger_job_prefix?: string | null
  ledger_bid_prefix?: string | null
}

export interface FixtureType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

export interface PartType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

export interface AssemblyType {
  id: string
  service_type_id: string
  name: string
  category: string | null
  sequence_order: number
  created_at: string
  updated_at: string
}

export type CountsFixtureGroup = { id: string; service_type_id: string; label: string; sequence_order: number }
export type CountsFixtureGroupItem = { id: string; group_id: string; name: string; sequence_order: number }
