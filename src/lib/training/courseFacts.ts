/**
 * The size of each course, for the Dashboard card before the first press (punch list #111, v2.5575): how many
 * lessons and about how long, read from `course.md` alone and from the lesson files' NAMES, never their words.
 * `import.meta.glob` without `eager` returns loaders and loads nothing, so the Dashboard chunk carries no lesson
 * text (the 6 MiB lesson, v2.4695); `course.md` is a few hundred bytes. The content test holds `minutes` in
 * `course.md` equal to the lessons' minutes plus the final check's.
 */
import { parseHelpGuideFrontmatter } from '../helpGuides'
import { courseFileFromGlobPath } from './courseContent'

export type CourseFacts = { slug: string; title: string; lessons: number; minutes: number }

const courseMeta = import.meta.glob('../../content/training/*/course.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const lessonPaths = Object.keys(import.meta.glob('../../content/training/*/[0-9][0-9]-*.md'))

function build(): Record<string, CourseFacts> {
  const out: Record<string, CourseFacts> = {}
  for (const [path, source] of Object.entries(courseMeta)) {
    const at = courseFileFromGlobPath(path)
    if (!at) continue
    const { fields } = parseHelpGuideFrontmatter(source)
    const minutes = Number.parseInt((fields.minutes ?? '').trim(), 10)
    out[at.slug] = {
      slug: at.slug,
      title: (fields.title ?? at.slug).trim(),
      lessons: lessonPaths.filter((p) => courseFileFromGlobPath(p)?.slug === at.slug).length,
      minutes: Number.isFinite(minutes) ? minutes : 0,
    }
  }
  return out
}

export const TRAINING_COURSE_FACTS: Record<string, CourseFacts> = build()

/** "30 lessons of about five minutes · about 3 hours in all" */
export function courseSizeWords(f: CourseFacts | undefined): string | null {
  if (!f || f.lessons === 0) return null
  const hours = Math.max(1, Math.round(f.minutes / 60))
  const each = f.lessons > 0 && f.minutes > 0 ? Math.round((f.minutes - 15) / f.lessons) : 0
  const eachWords = each >= 4 && each <= 6 ? 'about five minutes' : each > 0 ? `about ${each} minutes` : ''
  return `${f.lessons} lessons${eachWords ? ` of ${eachWords}` : ''} · about ${hours} hour${hours === 1 ? '' : 's'} in all`
}
