import { mkdir, writeFile } from 'node:fs/promises';
import { longNote } from '../tests/long-note';
await mkdir('.qa', { recursive: true });
await writeFile('.qa/long-note.md', longNote());
console.log('Manual test note: .qa/long-note.md');
