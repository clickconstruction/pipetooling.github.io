import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ClockSessionRow } from '../../types/clockSessions'
import { CollapsibleSection } from '../CollapsibleSection'
import { ClockSessionsTable } from './ClockSessionsTable'

type ClockSessionsSectionProps = {
  title: string
  sessions: ClockSessionRow[]
  collapsedByDefault?: boolean
  showActionsColumn?: boolean
  renderActions?: (session: ClockSessionRow) => ReactNode
  renderDuration?: (session: ClockSessionRow) => ReactNode
  open?: boolean
  onToggle?: () => void
}

export function ClockSessionsSection({
  title,
  sessions,
  collapsedByDefault = true,
  showActionsColumn = false,
  renderActions,
  renderDuration,
  open: controlledOpen,
  onToggle: controlledOnToggle,
}: ClockSessionsSectionProps) {
  const [internalOpen, setInternalOpen] = useState(!collapsedByDefault)
  const isControlled = controlledOpen !== undefined && controlledOnToggle !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const onToggle = isControlled ? controlledOnToggle : () => setInternalOpen((p) => !p)

  return (
    <CollapsibleSection title={title} count={sessions.length} open={open} onToggle={onToggle}>
      <ClockSessionsTable
        sessions={sessions}
        showActionsColumn={showActionsColumn}
        renderActions={renderActions}
        renderDuration={renderDuration}
        emptyMessage="No sessions"
      />
    </CollapsibleSection>
  )
}
