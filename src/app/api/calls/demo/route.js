import { NextResponse } from 'next/server';
import { DEFAULT_EXT_MAP } from '../../../../constants/defaultData';
import { generateDemoCDRData } from '../../../../services/demoDataGenerator';
import { activeRows } from '../../../../lib/db';
import { ingest } from '../../../../lib/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The extension roster is a localStorage preference, so the browser sends its own keys and
// the sample is built for the team that asked for it. Only the keys are read; the generator
// ignores the names.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const rawExts = Array.isArray(body?.extensions) && body.extensions.length > 0
    ? body.extensions.map(String).filter((e) => !e.startsWith('10404'))
    : [];
  const extensions = rawExts.length > 0 ? rawExts : Object.keys(DEFAULT_EXT_MAP);

  const roster = Object.fromEntries(extensions.map((ext) => [ext, ext]));
  const rows = generateDemoCDRData(roster);
  const info = ingest(rows, { filename: 'sample.cdr.csv', source: 'demo' });

  return NextResponse.json({ ...info, ...activeRows() });
}
