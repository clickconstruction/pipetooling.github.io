import { useCallback, useRef, useState } from 'react'

/** `html: null` while the email is still being built. */
export type EmailPreview = { title: string; html: string | null }

/**
 * The preview's state for a window that offers one (v2.4250). `show` takes the
 * finished HTML, or a promise of it — the overlay (`EmailPreviewOverlay`) is up at once and says it is
 * building. A build that lands after Back is dropped; one that fails closes the
 * overlay and rejects, so the caller says why where the button is.
 */
export function useEmailPreview() {
  const [preview, setPreview] = useState<EmailPreview | null>(null)
  const seq = useRef(0)
  const close = useCallback(() => {
    seq.current += 1
    setPreview(null)
  }, [])
  const show = useCallback(async (title: string, html: string | Promise<string>) => {
    const mine = (seq.current += 1)
    if (typeof html === 'string') {
      setPreview({ title, html })
      return
    }
    setPreview({ title, html: null })
    try {
      const built = await html
      if (seq.current === mine) setPreview({ title, html: built })
    } catch (e) {
      if (seq.current === mine) setPreview(null)
      throw e
    }
  }, [])
  return { preview, show, close }
}
