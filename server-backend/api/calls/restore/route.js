import { NextResponse } from 'next/server';
import { activateUpload, activeRows } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Undo after a bad replace: point the dataset back at one of the retained uploads.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Pick an upload to restore.' }, { status: 400 });
  }

  const restored = activateUpload(id);
  if (!restored) {
    return NextResponse.json({ error: `Upload ${id} is no longer retained.` }, { status: 404 });
  }
  return NextResponse.json(restored);
}
