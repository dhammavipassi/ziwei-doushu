/**
 * /api/interpret — 命盘 AI 解读（流式 SSE）
 *
 * 请求体: { chart: ZiweiChart, messages: { role, content }[] }
 * 返回: SSE 流，格式 data: {"delta":{"text":"..."}}\n\n
 */

import { NextRequest } from 'next/server';
import { streamDeepSeek, type ChatMessage } from '@/lib/ai/deepseek';
import { buildChartSystemPrompt } from '@/lib/ai/chart-serializer';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const chart = body.chart as ZiweiChart;
    const userMessages = body.messages as { role: 'user' | 'assistant'; content: string }[];

    if (!chart || !userMessages || userMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing chart or messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildChartSystemPrompt(chart);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const stream = await streamDeepSeek(messages, { temperature: 0.7, maxTokens: 4096 });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
