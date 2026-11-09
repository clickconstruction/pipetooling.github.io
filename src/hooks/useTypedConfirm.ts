import { useCallback } from 'react'
import { usePromptDialog } from '../contexts/ConfirmDialogContext'
import { useToastContext } from '../contexts/ToastContext'
import { typedConfirmMessage, typedConfirmMissWords, typedWordMatches } from '../lib/typedConfirm'

/**
 * The typed confirm (punch list #188, the confirm rows): asks for a word in the shared prompt window and answers true
 * only when it matches. A wrong word toasts that nothing changed; Cancel answers false quietly.
 */
export function useTypedConfirm() {
  const prompt = usePromptDialog()
  const { showToast } = useToastContext()
  return useCallback(
    async (opts: { title: string; act: string; word: string; confirmLabel: string }): Promise<boolean> => {
      const typed = await prompt({ title: opts.title, message: typedConfirmMessage(opts.act, opts.word), confirmLabel: opts.confirmLabel, placeholder: opts.word })
      if (typed == null) return false
      if (!typedWordMatches(opts.word, typed)) {
        showToast(typedConfirmMissWords(opts.word), 'warning')
        return false
      }
      return true
    },
    [prompt, showToast],
  )
}
