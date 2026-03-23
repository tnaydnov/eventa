/**
 * DEPRECATED — WhatsApp integration removed.
 * This file can be safely deleted.
 */
import { NextResponse } from 'next/server';

export function GET() {
  return new NextResponse('Gone', { status: 410 });
}

export function POST() {
  return new NextResponse('Gone', { status: 410 });
}
