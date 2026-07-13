/**
 * Cloudflare Pages _worker.js
 * 处理 /api/* 路由，其余走静态文件
 * 
 * Advanced Mode: _worker.js 放在输出目录根目录，
 * 拦截所有请求，API 路由走 Worker 逻辑，其余走静态资源。
 */

// ─── 常量 ──────────────────────────────────────────────
const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const BRIGHTNESS_MAP = { bright: '庙旺', normal: '平', dim: '陷' };
const SIHUA_MAP = { '禄': '化禄', '权': '化权', '科': '化科', '忌': '化忌' };

// ─── 命盘序列化 ────────────────────────────────────────
function formatStar(star) {
  let s = star.name;
  if (star.brightness) s += `(${BRIGHTNESS_MAP[star.brightness] || star.brightness})`;
  if (star.siHua) s += SIHUA_MAP[star.siHua] || star.siHua;
  return s;
}

function formatPalace(palace, isMingGong, isShenGong) {
  const branchName = BRANCHES[palace.branch] || '?';
  const stemName = STEMS[palace.stem] || '?';
  const majorStars = (palace.stars || []).filter(s => s.type === 'major').map(formatStar);
  const minorStars = (palace.stars || []).filter(s => s.type !== 'major').map(formatStar);

  let label = palace.name;
  if (isMingGong) label += '【命宫】';
  if (isShenGong) label += '【身宫】';

  let line = `${label}(${stemName}${branchName}): `;
  if (majorStars.length > 0) {
    line += `主星[${majorStars.join(', ')}]`;
  } else {
    line += `空宫`;
    if (palace.borrowedStars && palace.borrowedStars.length > 0) {
      line += `(借${palace.borrowedFromName}: ${palace.borrowedStars.join(', ')})`;
    }
  }
  if (minorStars.length > 0) line += ` 辅星[${minorStars.join(', ')}]`;
  if (palace.daXianAge) line += ` 大限${palace.daXianAge[0]}-${palace.daXianAge[1]}岁`;
  if (palace.isCurrentDaXian) line += ` ←当前大限`;
  return line;
}

function serializeChart(chart) {
  const lines = [];
  const { birthInfo, lunarInfo } = chart;

  lines.push(`=== 命盘基本信息 ===`);
  lines.push(`公历: ${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日 ${BRANCHES[birthInfo.hour] || '?'}时 ${birthInfo.gender === 'male' ? '男' : '女'}`);
  if (lunarInfo) {
    lines.push(`农历: ${lunarInfo.lunarYear}年${lunarInfo.isLeapMonth ? '闰' : ''}${lunarInfo.lunarMonth}月${lunarInfo.lunarDay}日`);
    lines.push(`年柱: ${STEMS[lunarInfo.yearStem] || '?'}${BRANCHES[lunarInfo.yearBranch] || '?'}`);
  }
  lines.push(`五行局: ${chart.wuxingJuName || '?'}`);
  lines.push(`当前年龄: ${chart.currentAge || '?'}岁`);
  lines.push('');

  lines.push(`=== 十二宫星曜 ===`);
  for (const p of (chart.palaces || [])) {
    lines.push(formatPalace(p, p.branch === chart.mingGongBranch, p.branch === chart.shenGongBranch));
  }
  lines.push('');

  if (chart.daXians && chart.daXians.length > 0) {
    lines.push(`=== 大限排列 ===`);
    for (const dx of chart.daXians) {
      const marker = chart.currentDaXianIndex >= 0 && dx === chart.daXians[chart.currentDaXianIndex] ? ' ← 当前' : '';
      lines.push(`${dx.startAge}-${dx.endAge}岁: ${dx.palaceName}(${BRANCHES[dx.palaceBranch] || '?'})${marker}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildChartPrompt(chart) {
  const chartText = serializeChart(chart);
  return `你是一位精通紫微斗数的命理师，特别擅长倪海厦《天纪》体系的命盘解读。

以下是一个完整的紫微斗数命盘数据，请基于此数据进行解读：

${chartText}

解读原则：
1. 严格遵循倪海厦《天纪》体系：命宫为本，三方四正为用，四化永远固定
2. 庙旺利陷影响星曜力量强弱，需结合判断
3. 解读要具体、有深度，引用倪海厦的原话或观点
4. 语言风格：专业但不晦涩，有温度但不玄乎
5. 用中文回答，使用 markdown 格式

请根据用户的提问，给出有针对性的命盘解读。`;
}

function buildHemingPrompt(chartA, chartB) {
  const textA = serializeChart(chartA);
  const textB = serializeChart(chartB);
  return `你是一位精通紫微斗数的命理师，特别擅长倪海厦《天纪》体系的合盘分析。

以下是两个人的命盘数据：

【A盘】
${textA}

【B盘】
${textB}

合盘分析原则：
1. 严格遵循倪海厦《天纪》体系
2. 重点看双方夫妻宫的星曜配置和四化
3. 分析双方命宫主星的互动关系
4. 比较双方大限走势是否同步
5. 关注化忌的冲射关系
6. 给出具体的相处建议
7. 用中文回答，使用 markdown 格式

请根据用户的提问，给出合盘分析。`;
}

// ─── DeepSeek 流式调用 ────────────────────────────────
async function streamDeepSeek(messages, env) {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not configured');
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`DeepSeek API error ${response.status}: ${errText}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = response.body.getReader();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              // V4 thinking 模式：只取 content，跳过 reasoning_content
              const delta = parsed.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                const sseData = JSON.stringify({ delta: { text: delta } });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              }
            } catch { /* skip */ }
          }
        }
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function sseResponse(stream) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ─── API 路由处理 ──────────────────────────────────────
async function handleAPI(path, request, env) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json();

    if (path === '/api/interpret') {
      const { chart, messages: userMessages } = body;
      if (!chart || !userMessages || userMessages.length === 0) {
        return jsonResponse({ error: 'Missing chart or messages' }, 400);
      }
      const systemPrompt = buildChartPrompt(chart);
      const messages = [
        { role: 'system', content: systemPrompt },
        ...userMessages.map(m => ({ role: m.role, content: m.content })),
      ];
      const stream = await streamDeepSeek(messages, env);
      return sseResponse(stream);
    }

    if (path === '/api/heming') {
      const { chartA, chartB, question } = body;
      if (!chartA || !chartB) {
        return jsonResponse({ error: 'Missing chartA or chartB' }, 400);
      }
      const systemPrompt = buildHemingPrompt(chartA, chartB);
      const userContent = question?.trim() || '请全面分析两人的合盘关系，包括：缘分深浅、性格匹配度、感情走势、相处建议。';
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];
      const stream = await streamDeepSeek(messages, env);
      return sseResponse(stream);
    }

    if (path === '/api/generate') {
      // 前端已内嵌排盘算法，返回提示
      return jsonResponse({ error: 'Use client-side chart generation', useClient: true });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ error: msg }, 500);
  }
}

// ─── Worker 入口 ──────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API 路由
    if (path.startsWith('/api/')) {
      return handleAPI(path, request, env);
    }

    // 其余请求走静态资源（Pages 会自动处理）
    // 返回 undefined 让 Pages 接管
    return env.ASSETS.fetch(request);
  },
};
