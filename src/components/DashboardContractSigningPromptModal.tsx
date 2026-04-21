export type ContractSigningPromptRow = { id: string; document_name: string; status: string }

type Props = {
  open: boolean
  rows: ContractSigningPromptRow[]
  openingDocId: string | null
  onClose: () => void
  onOpenSigningPage: (personContractDocumentId: string) => void
}

export function DashboardContractSigningPromptModal({
  open,
  rows,
  openingDocId,
  onClose,
  onOpenSigningPage,
}: Props) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '1rem',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-contract-signing-prompt-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 'min(92vw, 480px)',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h2
          id="dashboard-contract-signing-prompt-title"
          style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}
        >
          Required Signatures
        </h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#4b5563', lineHeight: 1.45 }}>
          You have unsigned documents. These must be signed to keep you in compliance with our company and our
          company in compliance with our customers and vendors. App access will be restricted until they are marked
          complete.
        </p>
        <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', fontSize: '0.875rem', lineHeight: 1.5 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>{r.document_name}</div>
              <button
                type="button"
                disabled={openingDocId != null}
                onClick={() => onOpenSigningPage(r.id)}
                style={{
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8125rem',
                  background: openingDocId === r.id ? '#93c5fd' : '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: openingDocId != null && openingDocId !== r.id ? 'not-allowed' : 'pointer',
                }}
              >
                {openingDocId === r.id ? 'Opening…' : 'Open signing page'}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={openingDocId != null}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              cursor: openingDocId != null ? 'not-allowed' : 'pointer',
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
