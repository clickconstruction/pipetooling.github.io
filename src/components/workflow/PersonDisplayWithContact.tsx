/**
 * Assignee name rendered as a contact-info button (with the "(not a user)"
 * suffix when the name is not a registered user). Verbatim move out of
 * src/pages/Workflow.tsx per docs/WORKFLOW_PAGE_ARCHITECTURE.md; used in
 * every stage card row. The contact modal itself stays page-level.
 */
export type PersonContactInfo = {
  name: string
  email: string | null
  phone: string | null
  isUser: boolean
}

export function PersonDisplayWithContact({
  name,
  contacts,
  userNames,
  onOpenContact,
}: {
  name: string | null
  contacts: Record<string, { email: string | null; phone: string | null }>
  userNames: Set<string>
  onOpenContact: (info: PersonContactInfo) => void
}) {
  if (!name || !name.trim()) {
    return <span>Assigned to: unknown</span>
  }
  const trimmedName = name.trim()
  const contact = contacts[trimmedName]
  const isUser = userNames.has(trimmedName.toLowerCase())

  return (
    <span>
      <button
        type="button"
        data-stop
        onClick={(e) => {
          e.stopPropagation()
          onOpenContact({
            name: trimmedName,
            email: contact?.email ?? null,
            phone: contact?.phone ?? null,
            isUser,
          })
        }}
        title="View contact information"
        aria-label={`View contact information for ${trimmedName}`}
        style={{
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-link)',
          textDecoration: 'underline',
          cursor: 'pointer',
          font: 'inherit',
          textAlign: 'left',
        }}
      >
        {trimmedName}
      </button>
      {!isUser && <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>(not a user)</span>}
    </span>
  )
}
