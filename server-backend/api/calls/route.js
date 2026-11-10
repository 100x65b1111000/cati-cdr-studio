import { NextResponse } from 'next/server';
import Papa from 'papaparse';
import { activeRows, clearDataset } from '../../../lib/db';
import { ingest } from '../../../lib/ingest';

export const runtime = 'nodejs';
// Without this a GET that ignores its request can be resolved at build time, which would
// open the database during `next build` and freeze whatever rows it found there.
export const dynamic = 'force-dynamic';

const MAX_BYTES = 50 * 1024 * 1024;

// The three messages the browser used to raise itself when it parsed the file locally.
// Kept verbatim so ErrorBanner and the preview modal still describe failures the way
// they did before the parse moved server-side.
const NOT_CSV = 'That file is not a CSV. Export the CDR report as .csv and try again.';

const fail = (message, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET() {
  return NextResponse.json(activeRows());
}

export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');

  if (!file || typeof file.name !== 'string') return fail(NOT_CSV);
  if (!file.name.toLowerCase().endsWith('.csv')) return fail(NOT_CSV);
  if (file.size > MAX_BYTES) {
    return fail(`${file.name} is ${Math.round(file.size / 1048576)}MB, over the 50MB limit. Split the export and try again.`);
  }

  const text = await file.text();
  // Same header/skip options the browser uses for its preview, so the row count the
  // user confirmed is the row count that gets stored.
  const results = Papa.parse(text, { header: true, skipEmptyLines: true });

  if (!Array.isArray(results.data) || results.data.length === 0) {
    return fail(`${file.name} parsed but contained no rows.`);
  }
  if (results.errors?.some((e) => e.type === 'FieldMismatch') && results.data.length === 0) {
    return fail(`CSV parse failed: ${results.errors[0].message}`);
  }

  const info = ingest(results.data, { filename: file.name, source: 'csv' });
  return NextResponse.json({ ...info, ...activeRows() });
}

export async function DELETE() {
  clearDataset();
  return NextResponse.json(activeRows());
}
