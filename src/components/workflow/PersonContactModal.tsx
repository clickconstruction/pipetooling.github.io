/**
 * The person-contact window a stage card's assignee name opens: the name, "Not a user" when the
 * name matches no account, the email and phone as mailto: / tel: links, and a Close button.
 * Verbatim move out of src/pages/Workflow.tsx per docs/WORKFLOW_PAGE_ARCHITECTURE.md
 * ("Contact modal"); the page keeps the open state because the openers live in every card.
 */
import { telHrefFor } from '../../lib/phoneContact'
import type { PersonContactInfo } from './PersonDisplayWithContact'

export function PersonContactModal({
  contact,
  onClose,
}: {
  contact: PersonContactInfo | null
  onClose: () => void
}) {
  if (!contact) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Contact information for ${contact.name}`}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, paddingTop: 'var(--app-top-chrome, 0px)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: '90%' }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.25rem' }}>{contact.name}</h3>
        {!contact.isUser && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Not a user</div>
        )}
        <div style={{ fontSize: '0.9375rem', display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Email:</span>
            {contact.email ? (
              <a href={`mailto:${contact.email}`} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                {contact.email}
              </a>
            ) : (
              <span style={{ color: 'var(--text-faint)' }}>—</span>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Phone:</span>
            {contact.phone ? (
              <a href={telHrefFor(contact.phone)} style={{ color: 'var(--text-link)', textDecoration: 'underline' }}>
                {contact.phone}
              </a>
            ) : (
              <span style={{ color: 'var(--text-faint)' }}>—</span>
            )}
          </div>
          {!contact.email && !contact.phone && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              No contact information on file.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="wf-btn-modal-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
