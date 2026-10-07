import { useState } from 'react'

type EvaluateChecklistItem = {
  id: string
  title: string
  body: string[]
}

const evaluateChecklist: EvaluateChecklistItem[] = [
  {
    id: 'location',
    title: 'LOCATION',
    body: [
      'Is the bid date feasible to produce a thorough and complete proposal?',
      'If not, is the potential reward for taking on the risk objectively worth it when our project expects or start? Will present signed from providing our best work on projects we associate with?',
      '(costs associated with traveling and supervision)',
    ],
  },
  {
    id: 'payment_terms',
    title: 'PAYMENT TERMS',
    body: [
      "Are we comfortable with the payment terms? Is this a client we've worked with before?",
      'If not, are the payment terms outlined clearly in the front end docs?',
      "Do we know we're getting paid?",
    ],
  },
  {
    id: 'bid_documents',
    title: 'BID DOCUMENTS',
    body: [
      'Are the available bid documents adequate to have a clear understanding of scope?',
      'Is there a clear procedure for submitting and answering questions?',
      'Is there a substantial amount of information missing where we would be forced to assume / qualify the bid?',
    ],
  },
  {
    id: 'competition',
    title: 'COMPETITION',
    body: [
      'Do we know the other bidders on this project?',
      'Are they familiar competitors? Are any bidders we know from previous projects where bidding against them could be difficult?',
      'Are they likely to self-perform some or all of the labor that we may be sub-contracting?',
    ],
  },
  {
    id: 'strengths',
    title: 'STRENGTHS',
    body: [
      'Does this project play to our strengths?',
      'Are we able to self-perform the work to give ourselves an advantage?',
      'Do we have specific subcontractors that we know will bid to us, with better pricing on significant scope items?',
    ],
  },
]

/**
 * The Bid window's Go/no-go checklist — five questions to ask before pursuing a bid (punch list
 * #51, PR 5 — moved out of `src/pages/Bids.tsx` verbatim). The ticks are the window's own and
 * are not saved: it mounts only while open, so every opening starts empty (the page used to reset
 * them on open and on close). The page keeps whether it is open — the Bid window's Esc guard reads it.
 */
export function BidEvaluateChecklistModal({ onClose }: { onClose: () => void }) {
  const [checked, setChecked] = useState<{ [key: string]: boolean }>({})
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        paddingTop: 'var(--app-top-chrome, 0px)',
      }}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          padding: '1.5rem',
          borderRadius: 8,
          maxWidth: 700,
          width: '90%',
          maxHeight: 'min(80vh, 100%)',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Go/no-go checklist</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {evaluateChecklist.map((item) => (
            <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.75rem 1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={!!checked[item.id]}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                  }
                />
                <span>{item.title}</span>
              </label>
              {item.body.map((line, idx) => (
                <p key={idx} style={{ margin: '0.125rem 0', fontSize: '0.9rem' }}>{line}</p>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
