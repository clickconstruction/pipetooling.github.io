import { useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { SearchableSelect } from '../SearchableSelect'

const JOB_FIELD_CLIPBOARD_WRAPPER_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  background: 'var(--surface)',
}

const JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '0.5rem',
  paddingRight: '2.5rem',
  border: 'none',
  outline: 'none',
  fontSize: '0.875rem',
  background: 'transparent',
}

function ClipboardPasteGlyph() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" style={{ width: 20, height: 20 }} aria-hidden>
      <path d="M360 160L280 160C266.7 160 256 149.3 256 136C256 122.7 266.7 112 280 112L360 112C373.3 112 384 122.7 384 136C384 149.3 373.3 160 360 160zM360 208C397.1 208 427.6 180 431.6 144L448 144C456.8 144 464 151.2 464 160L464 512C464 520.8 456.8 528 448 528L192 528C183.2 528 176 520.8 176 512L176 160C176 151.2 183.2 144 192 144L208.4 144C212.4 180 242.9 208 280 208L360 208zM419.9 96C407 76.7 385 64 360 64L280 64C255 64 233 76.7 220.1 96L192 96C156.7 96 128 124.7 128 160L128 512C128 547.3 156.7 576 192 576L448 576C483.3 576 512 547.3 512 512L512 160C512 124.7 483.3 96 448 96L419.9 96z" />
    </svg>
  )
}

async function pasteTextToField(ref: RefObject<HTMLInputElement | null>, setValue: (v: string) => void) {
  ref.current?.focus()
  if (!document.execCommand('paste')) {
    try {
      const text = await navigator.clipboard.readText()
      setValue(text)
    } catch {
      /* clipboard not available */
    }
  }
}

type ServiceTypeOption = { id: string; name: string }

type JobFormIdentityFieldsProps = {
  hcpNumber: string
  setHcpNumber: (v: string) => void
  clickNumber: string
  setClickNumber: (v: string) => void
  jobName: string
  setJobName: (v: string) => void
  jobAddress: string
  setJobAddress: (v: string) => void
  lastBillDate: string
  setLastBillDate: (v: string) => void
  formServiceTypeId: string
  setFormServiceTypeId: (v: string) => void
  /** Shell's `jobFormServiceTypeSelectOptions` memo (role-filtered + current type injected in edit mode). */
  serviceTypeOptions: ServiceTypeOption[]
  /** Shell's `headerTradePill` memo — already null when not editing, so it doubles as the edit-mode gate. */
  tradePill: { label: string; style: CSSProperties } | null
  /** Closes the form (autosave flush) then navigates to the job on Jobs → Stages. */
  onTradePillClick: () => void
}

/**
 * The identity rows of the New/Edit Job modal: HCP / C# / Service type (+ the
 * edit-mode trade pill shortcut to Jobs → Stages), Job Name, and Last manual
 * bill date / Job Address. Fully controlled — every field is shell form state
 * the save engine and identity autosave slice read; the only state here is the
 * two input refs backing the clipboard-paste affordances.
 */
export function JobFormIdentityFields({
  hcpNumber,
  setHcpNumber,
  clickNumber,
  setClickNumber,
  jobName,
  setJobName,
  jobAddress,
  setJobAddress,
  lastBillDate,
  setLastBillDate,
  formServiceTypeId,
  setFormServiceTypeId,
  serviceTypeOptions,
  tradePill,
  onTradePillClick,
}: JobFormIdentityFieldsProps) {
  const jobNameInputRef = useRef<HTMLInputElement | null>(null)
  const jobAddressInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '0 0 110px', minWidth: 110 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>HCP</label>
          <input
            type="text"
            value={hcpNumber}
            onChange={(e) => setHcpNumber(e.target.value)}
            placeholder="HCP number"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
        </div>
        <div style={{ flex: '0 0 110px', minWidth: 110 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>C#</label>
          <input
            type="text"
            value={clickNumber}
            onChange={(e) => setClickNumber(e.target.value)}
            placeholder="Click number"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label
            htmlFor="job-form-service-type"
            style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}
          >
            Service type <span style={{ color: 'var(--text-red-700)' }}>*</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ flex: '0 1 240px', minWidth: 170 }}>
              <SearchableSelect
                id="job-form-service-type"
                value={formServiceTypeId}
                onChange={setFormServiceTypeId}
                options={serviceTypeOptions.map((st) => ({ value: st.id, label: st.name }))}
                emptyOption={{ value: '', label: 'Select service type…' }}
                placeholder="Select service type…"
                required
                listAriaLabel="Service type"
                disabled={serviceTypeOptions.length === 0}
              />
            </div>
            {tradePill ? (
              <button
                type="button"
                onClick={onTradePillClick}
                title="Open this job in Jobs → Stages (closes Edit Job — your changes save automatically)"
                aria-label="Open this job in Jobs → Stages. Closes Edit Job; your changes save automatically."
                style={{ ...tradePill.style, marginTop: 0, cursor: 'pointer', flexShrink: 0 }}
              >
                {tradePill.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Name <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
          <div style={{ ...JOB_FIELD_CLIPBOARD_WRAPPER_STYLE, position: 'relative' }}>
            <input
              ref={jobNameInputRef}
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder="Job name"
              style={JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE}
            />
            <button
              type="button"
              onClick={() => void pasteTextToField(jobNameInputRef, setJobName)}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.25rem 0.4rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={jobName.trim() ? 'Replace with clipboard' : 'Paste from clipboard'}
              aria-label={jobName.trim() ? 'Replace job name with clipboard' : 'Paste job name from clipboard'}
            >
              <ClipboardPasteGlyph />
            </button>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '0 0 auto', minWidth: 140 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Last manual bill date</label>
          <input
            type="date"
            value={lastBillDate}
            onChange={(e) => setLastBillDate(e.target.value)}
            style={{ width: '100%', minWidth: 140, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Job Address <span style={{ color: 'var(--text-red-700)' }}>*</span></label>
          <div style={{ ...JOB_FIELD_CLIPBOARD_WRAPPER_STYLE, position: 'relative' }}>
            <input
              ref={jobAddressInputRef}
              type="text"
              value={jobAddress}
              onChange={(e) => setJobAddress(e.target.value)}
              placeholder="Address"
              style={JOB_FIELD_TEXT_INPUT_IN_WRAPPER_STYLE}
            />
            <button
              type="button"
              onClick={() => void pasteTextToField(jobAddressInputRef, setJobAddress)}
              style={{
                position: 'absolute',
                right: 4,
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '0.25rem 0.4rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={jobAddress.trim() ? 'Replace with clipboard' : 'Paste from clipboard'}
              aria-label={jobAddress.trim() ? 'Replace job address with clipboard' : 'Paste job address from clipboard'}
            >
              <ClipboardPasteGlyph />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
