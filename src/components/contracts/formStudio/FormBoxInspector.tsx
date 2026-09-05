import { useEffect, useState, type CSSProperties } from 'react'
import type { FormBox, FormBoxType, FormSchema } from '../../../lib/forms/formSchema'
import { DIGIT_MASK_PRESETS } from '../../../lib/forms/formStudioState'

/**
 * The right-hand panel of the Form Studio: every property of the selected
 * box. Controlled by the editor; each change is a `patch` on the box, except
 * the key (renamed through the editor so values re-key) and the set-level
 * flags (group / one-of), which patch the schema.
 */

const label: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.3rem 0.4rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.8125rem', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)' }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }
const check: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', cursor: 'pointer' }

const TYPES: Array<{ v: FormBoxType; l: string }> = [
  { v: 'text', l: 'Text' },
  { v: 'digits', l: 'Digits (masked)' },
  { v: 'checkbox', l: 'Checkbox' },
  { v: 'signature', l: 'Signature' },
  { v: 'date', l: 'Date' },
  { v: 'constant', l: 'Constant (printed every time)' },
]

export function FormBoxInspector({
  schema,
  box,
  onPatch,
  onRename,
  onSchema,
  onDelete,
  onDuplicate,
  onMoveOrder,
}: {
  schema: FormSchema
  box: FormBox
  onPatch: (patch: Partial<FormBox>) => void
  onRename: (to: string) => string | null
  onSchema: (next: FormSchema) => void
  onDelete: () => void
  onDuplicate: () => void
  onMoveOrder: (dir: -1 | 1) => void
}) {
  const [keyDraft, setKeyDraft] = useState(box.key)
  const [keyError, setKeyError] = useState<string | null>(null)
  useEffect(() => {
    setKeyDraft(box.key)
    setKeyError(null)
  }, [box.key])

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v))
  const group = box.group ? schema.groups.find((g) => g.key === box.group) : undefined
  const oneOf = box.oneOf ? schema.oneOfs.find((o) => o.key === box.oneOf) : undefined

  function setGroupKey(key: string) {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    if (!k) {
      onPatch({ group: undefined })
      onSchema({ ...schema, groups: schema.groups.filter((g) => schema.boxes.some((b) => b.key !== box.key && b.group === g.key)) })
      return
    }
    const groups = schema.groups.some((g) => g.key === k) ? schema.groups : [...schema.groups, { key: k, label: k, exactlyOne: true, required: false }]
    onSchema({ ...schema, groups, boxes: schema.boxes.map((b) => (b.key === box.key ? { ...b, group: k } : b)) })
  }
  function setOneOfKey(key: string) {
    const k = key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
    if (!k) {
      onSchema({ ...schema, boxes: schema.boxes.map((b) => (b.key === box.key ? { ...b, oneOf: undefined } : b)), oneOfs: schema.oneOfs.filter((o) => schema.boxes.some((b) => b.key !== box.key && b.oneOf === o.key)) })
      return
    }
    const oneOfs = schema.oneOfs.some((o) => o.key === k) ? schema.oneOfs : [...schema.oneOfs, { key: k, label: k, required: false }]
    onSchema({ ...schema, oneOfs, boxes: schema.boxes.map((b) => (b.key === box.key ? { ...b, oneOf: k } : b)) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8125rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9375rem', color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{box.key}</strong>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>page {box.page} · order {box.order}</span>
      </div>

      <label>
        <span style={label}>Key</span>
        <input
          style={input}
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          onBlur={() => {
            if (keyDraft === box.key) return
            const err = onRename(keyDraft)
            setKeyError(err)
            if (err) setKeyDraft(box.key)
          }}
          aria-label="Box key"
        />
        {keyError ? <span style={{ color: 'var(--text-red-700)', fontSize: '0.75rem' }}>{keyError}</span> : null}
      </label>

      <label>
        <span style={label}>Type</span>
        <select style={input} value={box.type} onChange={(e) => onPatch({ type: e.target.value as FormBoxType, ...(e.target.value === 'digits' && !box.mask ? { mask: '###-##-####' } : {}), ...(e.target.value === 'date' && !box.dateMode ? { dateMode: 'today' } : {}) })}>
          {TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.l}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span style={label}>Filled by</span>
        <select style={input} value={box.party ?? 'signer'} onChange={(e) => onPatch({ party: e.target.value === 'office' ? 'office' : undefined })}>
          <option value="signer">the signer (on the signing page)</option>
          <option value="office">the office (completed from the record afterwards)</option>
        </select>
      </label>

      {box.type !== 'constant' ? (
        <>
          <label>
            <span style={label}>Label (what the signer sees)</span>
            <input style={input} value={box.label} onChange={(e) => onPatch({ label: e.target.value })} />
          </label>
          <label>
            <span style={label}>Label · Español</span>
            <input style={input} value={box.labelEs ?? ''} onChange={(e) => onPatch({ labelEs: e.target.value || undefined })} />
          </label>
          <label>
            <span style={label}>Help line</span>
            <textarea style={{ ...input, minHeight: 44, resize: 'vertical' }} value={box.help ?? ''} onChange={(e) => onPatch({ help: e.target.value || undefined })} />
          </label>
          <label>
            <span style={label}>Help · Español</span>
            <textarea style={{ ...input, minHeight: 36, resize: 'vertical' }} value={box.helpEs ?? ''} onChange={(e) => onPatch({ helpEs: e.target.value || undefined })} />
          </label>
        </>
      ) : (
        <label>
          <span style={label}>Printed text (use line breaks for a second line)</span>
          <textarea style={{ ...input, minHeight: 56, resize: 'vertical' }} value={box.text ?? ''} onChange={(e) => onPatch({ text: e.target.value })} />
        </label>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {box.type !== 'constant' && box.type !== 'signature' ? (
          <label style={check}>
            <input type="checkbox" checked={Boolean(box.required)} onChange={(e) => onPatch({ required: e.target.checked || undefined })} /> required
          </label>
        ) : null}
        <label style={check} title="Masked after entry; kept out of stored values, logs, and mail; lives only in the signed PDF.">
          <input type="checkbox" checked={Boolean(box.sensitive)} onChange={(e) => onPatch({ sensitive: e.target.checked || undefined })} /> sensitive
        </label>
        <label style={check} title="The phone lens skips it unless the signer opens Rarely needed.">
          <input type="checkbox" checked={Boolean(box.advanced)} onChange={(e) => onPatch({ advanced: e.target.checked || undefined })} /> rarely needed
        </label>
      </div>

      {box.type === 'digits' ? (
        <>
          <label>
            <span style={label}>Mask (# = one digit)</span>
            <input style={input} list="form-studio-masks" value={box.mask ?? ''} onChange={(e) => onPatch({ mask: e.target.value })} />
            <datalist id="form-studio-masks">
              {DIGIT_MASK_PRESETS.map((p) => (
                <option key={p.mask} value={p.mask}>
                  {p.label}
                </option>
              ))}
            </datalist>
          </label>
          <label>
            <span style={label}>PDF fields per segment (comma-separated, optional)</span>
            <input
              style={{ ...input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem' }}
              value={(box.bindSegments ?? []).join(', ')}
              onChange={(e) => {
                const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                onPatch({ bindSegments: parts.length > 0 ? parts : undefined })
              }}
            />
          </label>
        </>
      ) : box.type !== 'signature' ? (
        <label>
          <span style={label}>PDF field to fill (blank = draw at the box)</span>
          <input style={{ ...input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.75rem' }} value={box.bind ?? ''} onChange={(e) => onPatch({ bind: e.target.value.trim() || undefined })} />
        </label>
      ) : null}

      {box.type === 'checkbox' ? (
        <>
          <label>
            <span style={label}>Group (pick one of)</span>
            <input style={input} list="form-studio-groups" value={box.group ?? ''} onChange={(e) => setGroupKey(e.target.value)} placeholder="e.g. classification" />
            <datalist id="form-studio-groups">
              {schema.groups.map((g) => (
                <option key={g.key} value={g.key} />
              ))}
            </datalist>
          </label>
          {group ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.4rem 0.5rem', border: '1px dashed var(--border)', borderRadius: 4 }}>
              <label>
                <span style={label}>Group label</span>
                <input style={input} value={group.label} onChange={(e) => onSchema({ ...schema, groups: schema.groups.map((g) => (g.key === group.key ? { ...g, label: e.target.value } : g)) })} />
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <label style={check}>
                  <input type="checkbox" checked={group.exactlyOne} onChange={(e) => onSchema({ ...schema, groups: schema.groups.map((g) => (g.key === group.key ? { ...g, exactlyOne: e.target.checked } : g)) })} /> only one
                </label>
                <label style={check}>
                  <input type="checkbox" checked={group.required} onChange={(e) => onSchema({ ...schema, groups: schema.groups.map((g) => (g.key === group.key ? { ...g, required: e.target.checked } : g)) })} /> one is required
                </label>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {box.type === 'text' || box.type === 'digits' ? (
        <>
          <label>
            <span style={label}>One-of set (fill only one, e.g. ssn | ein)</span>
            <input style={input} list="form-studio-oneofs" value={box.oneOf ?? ''} onChange={(e) => setOneOfKey(e.target.value)} placeholder="e.g. tin" />
            <datalist id="form-studio-oneofs">
              {schema.oneOfs.map((o) => (
                <option key={o.key} value={o.key} />
              ))}
            </datalist>
          </label>
          {oneOf ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end' }}>
              <label style={{ flex: 1 }}>
                <span style={label}>Set label</span>
                <input style={input} value={oneOf.label} onChange={(e) => onSchema({ ...schema, oneOfs: schema.oneOfs.map((o) => (o.key === oneOf.key ? { ...o, label: e.target.value } : o)) })} />
              </label>
              <label style={{ ...check, paddingBottom: '0.35rem' }}>
                <input type="checkbox" checked={oneOf.required} onChange={(e) => onSchema({ ...schema, oneOfs: schema.oneOfs.map((o) => (o.key === oneOf.key ? { ...o, required: e.target.checked } : o)) })} /> one is required
              </label>
            </div>
          ) : null}
        </>
      ) : null}

      {box.type === 'text' ? (
        <div style={row}>
          <label>
            <span style={label}>Prefill from roster</span>
            <select style={input} value={box.prefill ?? ''} onChange={(e) => onPatch({ prefill: (e.target.value || undefined) as FormBox['prefill'] })}>
              <option value="">none</option>
              <option value="person_name">their name</option>
              <option value="person_email">their email</option>
              <option value="person_phone">their phone</option>
            </select>
          </label>
          <label>
            <span style={label}>Max length</span>
            <input style={input} type="number" min={1} value={box.maxLength ?? ''} onChange={(e) => onPatch({ maxLength: num(e.target.value) })} />
          </label>
        </div>
      ) : null}

      {box.type === 'date' ? (
        <label>
          <span style={label}>Date value</span>
          <select style={input} value={box.dateMode ?? 'today'} onChange={(e) => onPatch({ dateMode: e.target.value as FormBox['dateMode'] })}>
            <option value="today">today, filled automatically</option>
            <option value="typed">typed by the signer</option>
          </select>
        </label>
      ) : null}

      <div style={row}>
        <label>
          <span style={label}>Font size (pt)</span>
          <input style={input} type="number" min={4} max={48} step={0.5} value={box.fontSize ?? ''} placeholder="10" onChange={(e) => onPatch({ fontSize: num(e.target.value) })} />
        </label>
        <label>
          <span style={label}>Align</span>
          <select style={input} value={box.align ?? 'left'} onChange={(e) => onPatch({ align: e.target.value as FormBox['align'] })}>
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </label>
      </div>

      <div>
        <span style={label}>Position (PDF points, from bottom-left)</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
          {(['x', 'y', 'w', 'h'] as const).map((k) => (
            <label key={k}>
              <span style={{ ...label, fontSize: '0.625rem' }}>{k}</span>
              <input style={input} type="number" step={0.5} value={box.rect[k]} onChange={(e) => onPatch({ rect: { ...box.rect, [k]: Number(e.target.value) } })} aria-label={`Box ${k}`} />
            </label>
          ))}
        </div>
      </div>

      {box.type !== 'constant' ? (
        <label>
          <span style={label}>Sample value (previews only)</span>
          <input style={input} value={box.sample ?? ''} placeholder={box.type === 'checkbox' ? 'true' : ''} onChange={(e) => onPatch({ sample: e.target.value || undefined })} />
        </label>
      ) : null}

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
        <button type="button" onClick={() => onMoveOrder(-1)} style={btn}>
          ↑ Earlier
        </button>
        <button type="button" onClick={() => onMoveOrder(1)} style={btn}>
          ↓ Later
        </button>
        <button type="button" onClick={onDuplicate} style={btn}>
          Duplicate
        </button>
        <button type="button" onClick={onDelete} style={{ ...btn, color: 'var(--text-red-700)', marginLeft: 'auto' }}>
          Delete
        </button>
      </div>
      <p style={{ margin: 0, fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>Arrow keys nudge the selected box 0.5 pt, Shift for 5. Shift-click selects several. Delete removes.</p>
    </div>
  )
}

const btn: CSSProperties = { padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', fontFamily: 'inherit' }
