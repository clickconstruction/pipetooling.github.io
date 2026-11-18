import { COPY_TEMPLATE_KEYS, COPY_TEMPLATE_LABELS } from '../../lib/prospects/prospectCopyTemplates'
import type { ProspectCopyTemplates } from './useProspectCopyTemplates'

const EnvelopeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1rem" height="1rem" fill="currentColor" style={{ display: 'block' }}>
    <path d="M112 128C85.5 128 64 149.5 64 176C64 191.1 71.1 205.3 83.2 214.4L291.2 370.4C308.3 383.2 331.7 383.2 348.8 370.4L556.8 214.4C568.9 205.3 576 191.1 576 176C576 149.5 554.5 128 528 128L112 128zM64 260L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 260L377.6 408.8C343.5 434.4 296.5 434.4 262.4 408.8L64 260z" />
  </svg>
)

const EnvelopeCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1rem" height="1rem" fill="currentColor" style={{ display: 'block' }}>
    <path d="M64 176C64 149.5 85.5 128 112 128L528 128C554.5 128 576 149.5 576 176L576 257.4C551.6 246.2 524.6 240 496 240C408.3 240 334.3 298.8 311.3 379.2C304.2 377.9 297.2 375 291.2 370.4L83.2 214.4C71.1 205.3 64 191.1 64 176zM304 432C304 460.6 310.2 487.6 321.4 512L128 512C92.7 512 64 483.3 64 448L64 260L262.4 408.8C275 418.2 289.3 424.2 304.1 426.7C304.1 428.5 304 430.2 304 432zM352 432C352 352.5 416.5 288 496 288C575.5 288 640 352.5 640 432C640 511.5 575.5 576 496 576C416.5 576 352 511.5 352 432zM553.4 371.1C546.3 365.9 536.2 367.5 531 374.6L478 447.5L451.2 420.7C445 414.5 434.8 414.5 428.6 420.7C422.4 426.9 422.4 437.1 428.6 443.3L468.6 483.3C471.9 486.6 476.5 488.3 481.2 487.9C485.9 487.5 490.1 485.1 492.9 481.4L556.9 393.4C562.1 386.3 560.5 376.2 553.4 371.1z" />
  </svg>
)

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1rem" height="1rem" fill="currentColor" style={{ display: 'block' }}>
    <path d="M535.6 85.7C513.7 63.8 478.3 63.8 456.4 85.7L432 110.1L529.9 208L554.3 183.6C576.2 161.7 576.2 126.3 554.3 104.4L535.6 85.7zM236.4 305.7C230.3 311.8 225.6 319.3 222.9 327.6L193.3 416.4C190.4 425 192.7 434.5 199.1 441C205.5 447.5 215 449.7 223.7 446.8L312.5 417.2C320.7 414.5 328.2 409.8 334.4 403.7L496 241.9L398.1 144L236.4 305.7zM160 128C107 128 64 171 64 224L64 480C64 533 107 576 160 576L416 576C469 576 512 533 512 480L512 384C512 366.3 497.7 352 480 352C462.3 352 448 366.3 448 384L448 480C448 497.7 433.7 512 416 512L160 512C142.3 512 128 497.7 128 480L128 224C128 206.3 142.3 192 160 192L256 192C273.7 192 288 177.7 288 160C288 142.3 273.7 128 256 128L160 128z" />
  </svg>
)

/**
 * The Copy row under a Follow Up card's notes: each template's Copy press, its envelope (Open in email, checked
 * once mailed) and its Edit press. Moved out of `src/pages/Prospects.tsx` unchanged, with the three icons only it
 * draws. The page shows it on the Customers lane.
 */
export function ProspectCopyTemplateRow({ copy }: { copy: ProspectCopyTemplates }) {
  const { handleCopyTemplate, handleOpenMail, emailSentTemplateKeys, openEditCopyModal } = copy
  return (
    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>Copy:</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {COPY_TEMPLATE_KEYS.map((key) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={() => handleCopyTemplate(key)}
              style={{
                padding: '0.35rem 0.6rem',
                fontSize: '0.8125rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {COPY_TEMPLATE_LABELS[key]}
            </button>
            <button
              type="button"
              onClick={() => handleOpenMail(key)}
              title={emailSentTemplateKeys.has(key) ? 'Email sent' : 'Open in email'}
              style={{
                padding: '0.35rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: emailSentTemplateKeys.has(key) ? 'var(--text-green-600)' : 'var(--text-muted)',
                fontSize: '0.875rem',
              }}
            >
              {emailSentTemplateKeys.has(key) ? <EnvelopeCheckIcon /> : <EnvelopeIcon />}
            </button>
            <button
              type="button"
              onClick={() => openEditCopyModal(key)}
              title="Edit template"
              style={{
                padding: '0.35rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}
            >
              <EditIcon />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
