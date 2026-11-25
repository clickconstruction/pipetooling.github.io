import { fireEvent, screen } from '@testing-library/react'

/**
 * Accounts Receivable opens with nothing picked (punch list #437), so a test that reads the pane presses its
 * deposit first, as a person does. `name` matches the row's own label, *$250.00 from DLF*. The wait is long
 * because the list is read after the window draws, and a loaded full-suite run is slow.
 */
export async function pickArDeposit(name: RegExp): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name }, { timeout: 5000 }))
}
