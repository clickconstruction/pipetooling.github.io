import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ClockSessionRow } from '../../types/clockSessions'
import { CollapsibleSection } from '../CollapsibleSection'
import { ClockSessionsTable } from './ClockSessionsTable'

type ClockSessionsSectionProps = {
  title: string
  sessions: ClockSessionRow[]
  /** Shown in header instead of session count, e.g. "3 of 12 matching". */
  headerCountLabel?: string
  /** Header count when headerCountLabel is unset; defaults to sessions.length. */
  headerCount?: number
  collapsedByDefault?: boolean
  showActionsColumn?: boolean
  renderActions?: (session: ClockSessionRow) => ReactNode
  renderDuration?: (session: ClockSessionRow) => ReactNode
  open?: boolean
  onToggle?: () => void
  emptyMessage?: string
  enableDurationColumnSort?: boolean
  onDurationClick?: (session: ClockSessionRow) => void
}

export function ClockSessionsSection({
  title,
  sessions,
  headerCountLabel,
  headerCount,
  collapsedByDefault = true,
  showActionsColumn = false,
  renderActions,
  renderDuration,
  open: controlledOpen,
  onToggle: controlledOnToggle,
  emptyMessage = 'No sessions',
  enableDurationColumnSort = false,
  onDurationClick,
}: ClockSessionsSectionProps) {
  const [internalOpen, setInternalOpen] = useState(!collapsedByDefault)
  const isControlled = controlledOpen !== undefined && controlledOnToggle !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const onToggle = isControlled ? controlledOnToggle : () => setInternalOpen((p) => !p)

  const countForHeader =
    headerCountLabel !== undefined ? undefined : (headerCount ?? sessions.length)

  return (
    <CollapsibleSection
      title={title}
      count={countForHeader}
      headerCountLabel={headerCountLabel}
      open={open}
      onToggle={onToggle}
    >
      <ClockSessionsTable
        sessions={sessions}
        showActionsColumn={showActionsColumn}
        renderActions={renderActions}
        renderDuration={renderDuration}
        emptyMessage={emptyMessage}
        enableDurationColumnSort={enableDurationColumnSort}
        onDurationClick={onDurationClick}
      />
    </CollapsibleSection>
  )
}
