'use server';
// import { pool } from 'pg-pool';
import { Pool } from 'pg';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return new NextResponse(JSON.stringify({ wtf: 'wtf' }), {
      status: 200,
      statusText: 'Good to go',
    });
  } catch (error) {
    console.error(error);
    return new NextResponse(JSON.stringify({ error: `${error}` }), {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
