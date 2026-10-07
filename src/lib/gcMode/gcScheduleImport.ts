/**
 * GC mode design spike: bring in a schedule a customer or the architect hands us, the Gantt's G-137
 * (mock-up and plan `to-dos/gc-mode/mockups/G-137.md`). A customer who keeps a master schedule hands
 * it to us at award: "this is the schedule you build to". The file already holds their dates and
 * their waits, so the office should not have to move bar after bar to them.
 *
 * Three steps, each pure. `readScheduleFile` reads the two files G-136 writes, from our export or
 * from the customer's own programs: Microsoft Project's XML (MSPDI), which Primavera P6 also writes,
 * and our three spreadsheets. It says what it could not read. `guessPlaces` guesses where each of
 * their activities lands on this job, with the reason, for the office to tick. `importedSchedule`
 * makes the schedule, through the first draft's own kernel: their dates and waits on the lines the
 * file names, the first draft's way everywhere else. The result is a schedule like any other.
 *
 * The reader takes the MSPDI namespace and the spreadsheet's headers from `gcScheduleExport.ts`, so
 * what we write and what we read cannot drift apart. Its own file, out of the barrel.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export type { ImportChoice, ImportFileRow, ImportGuess, ImportLine, ImportedSchedule, ScheduleFileReading, ScheduleFileResult } from '../gc/schedule/import'
export { IMPORT_INTRO, IMPORT_REPLACES, guessPlaces, importHoldsWords, importLines, importRefusal, importedSchedule, notInWords, notPlacedWords, readScheduleFile, sameName, togetherWords } from '../gc/schedule/import'

