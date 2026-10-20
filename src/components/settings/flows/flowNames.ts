/** A library paper's name, from its `doc:<uuid>` id, as Settings → Flows read it from the library. */
export const docName = (paperId: string, names: Readonly<Record<string, string>>): string => names[paperId.slice(4)] ?? 'a library paper'
