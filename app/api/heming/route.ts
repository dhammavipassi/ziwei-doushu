/**
 * /api/heming — 合盘 AI 分析（流式 SSE）
 *
 * 请求体: { chartA: ZiweiChart, chartB: ZiweiChart, question?: string }
 * 返回: SSE 流
 */

import { NextRequest } from 'next/server';
import { streamDeepSeek, type ChatMessage } from '@/lib/ai/deepseek';
import { buildHemingSystemPrompt } from '@/lib/ai/chart-serializer';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const chartA = body.chartA as ZiweiChart;
    const chartB = body.chartB as ZiweiChart;
    const question = body.question as string | undefined;

    if (!chartA || !chartB) {
      return new Response(JSON.stringify({ error: 'Missing chartA or chartB' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = buildHemingSystemPrompt(chartA, chartB);

    const userContent = question?.trim()
      ? question
      : '请全面分析两人的合盘关系，包括：缘分深浅、性格匹配度、感情走势、相处建议。';

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
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
