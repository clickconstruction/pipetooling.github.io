/**
 * The layers of the windows that open over a conversation (v2.7069, punch list #319).
 *
 * A thread's window sits at 1200. Add a task used to sit at 1012, above Job Detail (1004) and Edit Job (1010), which
 * put it under the thread's window: **Ask a tech…** and **Send as a task** opened it where nobody could see it. It
 * sits above the thread's window now, and the picker it drops down sits above it.
 */

/** The thread's window (`ThreadWindow`). */
export const THREAD_WINDOW_Z = 1200

/** Add a task (`ChecklistAddModal`): over the thread's window, Job Detail and Edit Job. */
export const ADD_TASK_WINDOW_Z = 1210

/** A list Add a task drops down through a portal: over Add a task itself. */
export const ADD_TASK_PICKER_Z = 1220
