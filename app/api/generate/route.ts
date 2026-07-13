/**
 * /api/generate — 服务端起盘
 *
 * 请求体: BirthInfo (year, month, day, hour, gender, ...)
 * 返回: ZiweiChart JSON
 */

import { NextRequest } from 'next/server';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const birthInfo = await req.json() as BirthInfo;

    if (!birthInfo.year || !birthInfo.month || !birthInfo.day || birthInfo.hour === undefined || !birthInfo.gender) {
      return new Response(JSON.stringify({ error: 'Missing required birth info' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const chart = generateChart(birthInfo);

    return new Response(JSON.stringify(chart), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
