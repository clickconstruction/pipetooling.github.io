import type { UserRole } from '../../types/userRole'

/**
 * Who opens the Document builder tab on Documents (punch list #404). A dev only for now, which is the owner's call of
 * 2026-11-19: "at the moment it's going to be dev only". Every screen of the tab takes this one gate, and the tab's
 * tables open to `is_dev()` alone, so opening the tab to the office changes this list and those policies together.
 *
 * Pure: no React, no supabase.
 */
export const DOCUMENT_BUILDER_TEAM: readonly UserRole[] = ['dev']

export function canUseDocumentBuilder(role: UserRole | string | null | undefined): boolean {
  return role != null && (DOCUMENT_BUILDER_TEAM as readonly string[]).includes(role)
}
