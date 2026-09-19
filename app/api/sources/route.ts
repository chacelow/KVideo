import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'sources.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    return NextResponse.json({ error: 'sources.json not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
