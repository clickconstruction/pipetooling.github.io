import type { WriteupAnswers, WriteupTemplateBlock } from '../../lib/writeupTemplateSchema'

export type WriteupFormFieldsProps = {
  schema: WriteupTemplateBlock[]
  answers: WriteupAnswers
  onChange: (answers: WriteupAnswers) => void
  readOnly?: boolean
  disabled?: boolean
}

export function WriteupFormFields({ schema, answers, onChange, readOnly = false, disabled = false }: WriteupFormFieldsProps) {
  const ro = readOnly || disabled

  function setField(id: string, value: unknown) {
    onChange({ ...answers, [id]: value })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {schema.map((b) => {
        if (b.type === 'prompt') {
          return (
            <div
              key={b.id}
              style={{
                padding: '0.75rem',
                background: '#f3f4f6',
                borderRadius: 6,
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {b.content}
            </div>
          )
        }
        if (b.type === 'text') {
          const v = typeof answers[b.id] === 'string' ? (answers[b.id] as string) : ''
          return (
            <div key={b.id}>
              <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                {b.label}
                {b.required ? <span style={{ color: '#b91c1c' }}> *</span> : null}
              </label>
              <input
                type="text"
                value={v}
                onChange={(e) => setField(b.id, e.target.value)}
                readOnly={ro}
                disabled={disabled}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem' }}
              />
            </div>
          )
        }
        if (b.type === 'textarea') {
          const v = typeof answers[b.id] === 'string' ? (answers[b.id] as string) : ''
          return (
            <div key={b.id}>
              <label style={{ display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', fontWeight: 500 }}>
                {b.label}
                {b.required ? <span style={{ color: '#b91c1c' }}> *</span> : null}
              </label>
              <textarea
                value={v}
                onChange={(e) => setField(b.id, e.target.value)}
                readOnly={ro}
                disabled={disabled}
                rows={4}
                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.875rem', resize: 'vertical' }}
              />
            </div>
          )
        }
        if (b.type === 'checklist') {
          const raw = answers[b.id]
          const checked = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
          return (
            <div key={b.id}>
              {b.label ? (
                <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', fontWeight: 500 }}>
                  {b.label}
                  {b.required ? <span style={{ color: '#b91c1c' }}> *</span> : null}
                </div>
              ) : b.required ? (
                <div style={{ fontSize: '0.8125rem', marginBottom: '0.35rem', color: '#374151' }}>
                  Select at least one <span style={{ color: '#b91c1c' }}>*</span>
                </div>
              ) : null}
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {b.options.map((opt) => {
                  const isOn = checked.includes(opt)
                  return (
                    <li key={opt} style={{ marginBottom: '0.35rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: ro ? 'default' : 'pointer', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={isOn}
                          disabled={ro}
                          onChange={() => {
                            if (ro) return
                            if (isOn) setField(b.id, checked.filter((x) => x !== opt))
                            else setField(b.id, [...checked, opt])
                          }}
                        />
                        {opt}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}
