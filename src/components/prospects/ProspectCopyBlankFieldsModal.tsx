import type { ProspectCopyTemplates } from './useProspectCopyTemplates'

/**
 * Missing information: the details a template names that this prospect or this sender still lacks. Moved out of
 * `src/pages/Prospects.tsx` unchanged. The page mounts it while the list is up.
 */
export function ProspectCopyBlankFieldsModal({ copy }: { copy: ProspectCopyTemplates }) {
  const { copyBlankFieldsList, setCopyBlankFieldsModalOpen } = copy
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 750,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
      onClick={() => setCopyBlankFieldsModalOpen(false)}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>Missing information</h3>
        <p style={{ margin: '0 0 1rem 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          The following fields are blank but used in your template. Please fill them in before copying:
        </p>
        <ul style={{ margin: '0 0 1rem 0', paddingLeft: '1.25rem' }}>
          {copyBlankFieldsList.map((field) => (
            <li key={field} style={{ marginBottom: '0.25rem' }}>{field}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setCopyBlankFieldsModalOpen(false)}
          style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }}
        >
          OK
        </button>
      </div>
    </div>
  )
}
