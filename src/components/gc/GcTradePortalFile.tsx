import { useId, useState } from 'react'
import { GC_COMPANY } from '../../lib/gc/company'
import { MUTED } from '../../lib/portal/portalTheme'
import { TRADE_FILE_MAX_BYTES } from '../../../supabase/functions/_shared/gcTradeFile'
import { PORTAL_FILE_ACCEPT, type PickedFile } from '../../lib/gc/tradePortalFile'
import { Btn } from './gcUi'
import { usePortalLang } from './gcTradePortalLang'

/**
 * GC mode, the trade partner portal's P5a-1 (to-dos/gc-mode/mockups/portal-p5a.md): a file the company picks to send
 * with a submittal round, a change it asks for, or its quote. A PDF or a photo, 10 MB at most, said before it sends;
 * the function reads the type again from the file's first bytes. The pick is read as base64 for the kind `file`
 * (`portalFileUpload` in `tradePortalFile.ts`), which `usePress().runWithFile` sends before the kind that stores the link.
 */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result ?? '')
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** The picker: its label, the file picked with Remove, and a file too big said before anything sends. */
export function PortalFilePick({ label, picked, onPick, disabled = false }: { label: string; picked: PickedFile | null; onPick: (f: PickedFile | null) => void; disabled?: boolean }) {
  const { t } = usePortalLang()
  const id = useId()
  const [problem, setProblem] = useState<string | null>(null)
  if (picked) {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span data-portal-file-picked>{picked.name}</span>
        <Btn kind="quiet" disabled={disabled} onClick={() => onPick(null)}>
          {t('remove')}
        </Btn>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
      <label htmlFor={id} style={{ color: MUTED }}>
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept={PORTAL_FILE_ACCEPT}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          setProblem(null)
          if (!file) return
          if (file.size > TRADE_FILE_MAX_BYTES) {
            setProblem(t('errFileTooBig', { gc: GC_COMPANY.name }))
            return
          }
          void readAsBase64(file)
            .then((base64) => onPick({ name: file.name, base64 }))
            .catch(() => setProblem(t('errFailed')))
        }}
      />
      {problem && <span style={{ color: 'var(--text-red-700)', fontSize: '0.8rem' }}>{problem}</span>}
    </div>
  )
}
