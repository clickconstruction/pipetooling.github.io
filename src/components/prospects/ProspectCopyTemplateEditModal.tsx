import { COPY_TEMPLATE_LABELS } from '../../lib/prospects/prospectCopyTemplates'
import type { ProspectCopyTemplates } from './useProspectCopyTemplates'

/**
 * Edit a copy template: its subject, its body, and the chips that drop a bracketed name at the cursor. Moved out
 * of `src/pages/Prospects.tsx` unchanged; `useProspectCopyTemplates` holds what it edits and saves. The page
 * mounts it while a template is being edited.
 */
export function ProspectCopyTemplateEditModal({ copy }: { copy: ProspectCopyTemplates }) {
  const { editingCopyTemplateKey, setEditingCopyTemplateKey, editingCopyText, setEditingCopyText, editingCopySubject, setEditingCopySubject, copyTemplateSaving, copyTemplateTextareaRef, saveCopyTemplate } = copy
  if (!editingCopyTemplateKey) return null
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
      onClick={() => !copyTemplateSaving && setEditingCopyTemplateKey(null)}
    >
      <div role="dialog" aria-modal="true"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.5rem',
          maxWidth: 560,
          width: '90%',
          maxHeight: 'min(85vh, 100%)',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 1rem 0' }}>Edit {COPY_TEMPLATE_LABELS[editingCopyTemplateKey]}</h3>
        <form onSubmit={saveCopyTemplate} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500, fontSize: '0.875rem' }}>Subject</label>
            <input
              type="text"
              value={editingCopySubject}
              onChange={(e) => setEditingCopySubject(e.target.value)}
              placeholder="Email subject (supports same placeholders as body)"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                fontSize: '0.9375rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <textarea
            ref={copyTemplateTextareaRef}
            value={editingCopyText}
            onChange={(e) => setEditingCopyText(e.target.value)}
            placeholder="Template text. Use [User name], [user email], [user phone number], [company name], [prospect phone number], [prospect contact name], [prospect last contact], [prospect last successful contact] as placeholders."
            style={{
              width: '100%',
              minHeight: 200,
              padding: '0.75rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              fontSize: '0.9375rem',
              resize: 'vertical',
              fontFamily: 'inherit',
              flex: 1,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>Placeholders:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {[
                { text: '[User name]' },
                { text: '[user email]' },
                { text: '[user phone number]' },
                { text: '[company name]' },
                { text: '[prospect phone number]' },
                { text: '[prospect contact name]' },
                { text: '[prospect last contact]' },
                { text: '[prospect last successful contact]' },
                ...(editingCopyTemplateKey === 'phone_followup_email' || editingCopyTemplateKey === 'just_checking_in_email'
                  ? [{ text: '_______', tooltip: editingCopyTemplateKey === 'phone_followup_email' ? '(contact name)' : '(contact info)' }]
                  : []),
              ].map(({ text, tooltip }) => (
                <button
                  key={text}
                  type="button"
                  title={tooltip}
                  onClick={() => {
                    const ta = copyTemplateTextareaRef.current
                    const start = ta ? ta.selectionStart : editingCopyText.length
                    const end = ta ? ta.selectionEnd : editingCopyText.length
                    const before = editingCopyText.slice(0, start)
                    const after = editingCopyText.slice(end)
                    setEditingCopyText(before + text + after)
                    if (ta) {
                      ta.focus()
                      const newPos = start + text.length
                      setTimeout(() => ta.setSelectionRange(newPos, newPos), 0)
                    }
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: 9999,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={copyTemplateSaving}
              style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: copyTemplateSaving ? 'not-allowed' : 'pointer' }}
            >
              {copyTemplateSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => !copyTemplateSaving && setEditingCopyTemplateKey(null)}
              style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
