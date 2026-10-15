/**
 * The only module that touches import.meta.glob for the training courses (Vite-only API), so the
 * courseContent kernels stay node-testable. Eager inside this module, but the module itself is
 * imported only by the lazy /training page chunk: the lesson text (over 100 KB for the OSHA 30
 * refresher) must never ride in the main chunk (the 6 MiB PWA cap, v2.4695). The Dashboard card
 * and the People rail read the catalog from `training_courses`, never this module.
 */
import { buildCourseRegistry, type Course } from './courseContent'

const raw = import.meta.glob('../../content/training/*/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const TRAINING_COURSES: Course[] = buildCourseRegistry(raw)

export function findCourse(slug: string): Course | null {
  return TRAINING_COURSES.find((c) => c.slug === slug) ?? null
}
