/**
 * What Checklist → Manage says after its Delete (punch list #369, the walk of 2026-11-25: a task was deleted and
 * nothing was said, and a failure drew the database's own words in a red line at the page's foot, off screen on a
 * long list). Three ends, each said in a toast over the list:
 *   - `done`: the row came back from the delete, so it is gone.
 *   - `failed`: the fallback under `formatErrorMessage`, which puts the reason first when it knows one.
 *   - `refused`: no error and no row. The row rules let a person delete a task they made and let the office delete
 *     any, so no row back means the task is someone else's or was already deleted. The list is read again either way.
 */
export const MANAGE_DELETE_WORDS = {
  done: 'Task deleted.',
  failed: 'The task was not deleted.',
  refused: 'The task was not deleted. It is someone else\u2019s task, or it is already gone.',
} as const
