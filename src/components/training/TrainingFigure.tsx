import { useId } from 'react'
import type { FigureName } from '../../lib/training/figures'
import { FIGURES } from './figures'

/**
 * A figure in a lesson (punch list #116, v2.5598): the named drawing at the width of the column, its caption
 * under it in the same plain words as every sentence. The caption is the drawing's name for a screen reader.
 */
export function TrainingFigure({ name, caption }: { name: FigureName; caption: string }) {
  const id = useId()
  const captionId = `${id}-caption`
  const Drawing = FIGURES[name]
  return (
    <figure data-training-figure={name} style={{ margin: '0.5rem 0 0.75rem' }}>
      <Drawing titleId={captionId} />
      <figcaption id={captionId} style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {caption}
      </figcaption>
    </figure>
  )
}
