// The Node half of the boot hook, in its own file so the edge copy of instrumentation.js
// never pulls node built-ins into its bundle. One fresh session-signing nonce per server
// start: cookies are signed with the nonce of the boot that issued them, so killing the
// server signs every device out on the next start. The nonce lives on disk rather than in
// module scope because the proxy and the route handlers are separate bundles in dev, and a
// file they all read is the only way they agree on the value. Written aside and renamed so
// a request never reads half a nonce.
import { randomBytes } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Kept in step with SESSION_BOOT_FILE in lib/auth.js by hand.
const file = path.join('data', '.session-boot');

mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(`${file}.tmp`, randomBytes(18).toString('base64url'));
renameSync(`${file}.tmp`, file);
