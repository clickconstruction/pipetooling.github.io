/**
 * The row style the Pipeline's ⋯ menus share: the board-level tools menu
 * (`JobsStagesToolsMenu`) and the per-section ⋯ menus still rendered by `JobsStagesTab`.
 * Its own module so the component file exports only components (Fast Refresh).
 */
import type { CSSProperties } from 'react'

export const stagesToolsMenuItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: '0.875rem',
  color: 'var(--text-gray-800)',
  textAlign: 'left',
  borderRadius: 4,
  whiteSpace: 'nowrap',
}

