/**
 * 命盘数据序列化 — 将 ZiweiChart 转为 LLM 可理解的文本摘要
 * 包含：十二宫星曜、四化、大限、格局判定结果
 */

import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';
import { getMingGongSummary } from '@/lib/ziwei/patterns';
import { STEMS, BRANCHES, STAR_DESCRIPTIONS } from '@/lib/ziwei/constants';

const BRIGHTNESS_MAP: Record<string, string> = {
  bright: '庙旺',
  normal: '平',
  dim: '陷',
};

const SIHUA_MAP: Record<string, string> = {
  '禄': '化禄',
  '权': '化权',
  '科': '化科',
  '忌': '化忌',
};

function formatStar(star: Star): string {
  let s = star.name;
  if (star.brightness) {
    s += `(${BRIGHTNESS_MAP[star.brightness] || star.brightness})`;
  }
  if (star.siHua) {
    s += SIHUA_MAP[star.siHua] || star.siHua;
  }
  return s;
}

function formatPalace(palace: Palace, isMingGong: boolean, isShenGong: boolean): string {
  const branchName = BRANCHES[palace.branch] || '?';
  const stemName = STEMS[palace.stem] || '?';
  const majorStars = palace.stars.filter(s => s.type === 'major').map(formatStar);
  const minorStars = palace.stars.filter(s => s.type === 'minor' || s.type === 'lucky' || s.type === 'sha').map(formatStar);

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
  if (minorStars.length > 0) {
    line += ` 辅星[${minorStars.join(', ')}]`;
  }
  if (palace.daXianAge) {
    line += ` 大限${palace.daXianAge[0]}-${palace.daXianAge[1]}岁`;
  }
  if (palace.isCurrentDaXian) {
    line += ` ←当前大限`;
  }
  return line;
}

/**
 * 将完整命盘序列化为 LLM 可读的文本
 */
export function serializeChart(chart: ZiweiChart): string {
  const lines: string[] = [];

  // 基本信息
  const { birthInfo, lunarInfo } = chart;
  lines.push(`=== 命盘基本信息 ===`);
  lines.push(`公历: ${birthInfo.year}年${birthInfo.month}月${birthInfo.day}日 ${BRANCHES[birthInfo.hour]}时 ${birthInfo.gender === 'male' ? '男' : '女'}`);
  lines.push(`农历: ${lunarInfo.lunarYear}年${lunarInfo.isLeapMonth ? '闰' : ''}${lunarInfo.lunarMonth}月${lunarInfo.lunarDay}日`);
  lines.push(`年柱: ${STEMS[lunarInfo.yearStem]}${BRANCHES[lunarInfo.yearBranch]}`);
  lines.push(`五行局: ${chart.wuxingJuName}`);
  lines.push(`当前年龄: ${chart.currentAge}岁`);
  lines.push('');

  // 十二宫
  lines.push(`=== 十二宫星曜 ===`);
  for (const p of chart.palaces) {
    lines.push(formatPalace(p, p.branch === chart.mingGongBranch, p.branch === chart.shenGongBranch));
  }
  lines.push('');

  // 大限
  lines.push(`=== 大限排列 ===`);
  for (const dx of chart.daXians) {
    const marker = chart.currentDaXianIndex >= 0 && dx === chart.daXians[chart.currentDaXianIndex] ? ' ← 当前' : '';
    lines.push(`${dx.startAge}-${dx.endAge}岁: ${dx.palaceName}(${BRANCHES[dx.palaceBranch]})${marker}`);
  }
  lines.push('');

  // 格局判定
  const patterns = detectPatterns(chart);
  if (patterns.length > 0) {
    lines.push(`=== 格局判定 ===`);
    for (const p of patterns) {
      const levelMap: Record<string, string> = {
        excellent: '★上格',
        good: '☆中格',
        neutral: '○普通',
        caution: '△注意',
      };
      lines.push(`[${levelMap[p.level] || p.level}] ${p.name}: ${p.description}`);
      if (p.conditions) {
        if (p.conditions.bonus && p.conditions.bonus.length > 0) {
          lines.push(`  加分: ${p.conditions.bonus.join('; ')}`);
        }
        if (p.conditions.breaking && p.conditions.breaking.length > 0) {
          lines.push(`  破格: ${p.conditions.breaking.join('; ')}`);
        }
      }
    }
  }
  lines.push('');

  // 命宫摘要
  const summary = getMingGongSummary(chart);
  if (summary.stars.length > 0) {
    lines.push(`=== 命宫主星特质 ===`);
    for (const starName of summary.stars) {
      const desc = STAR_DESCRIPTIONS[starName];
      if (desc) {
        lines.push(`${starName}: ${desc.keywords} (${desc.nature}, 五行${desc.element})`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * 构建命盘解读的 system prompt
 */
export function buildChartSystemPrompt(chart: ZiweiChart): string {
  const chartText = serializeChart(chart);

  return `你是一位精通紫微斗数的命理师，特别擅长倪海厦《天纪》体系的命盘解读。

以下是一个完整的紫微斗数命盘数据，请基于此数据进行解读：

${chartText}

解读原则：
1. 严格遵循倪海厦《天纪》体系：命宫为本，三方四正为用，四化永远固定
2. 不使用飞星派的宫干自化、大限四化等工具
3. 庙旺利陷影响星曜力量强弱，需结合判断
4. 格局判定结果已给出，请在解读中引用并展开
5. 解读要具体、有深度，引用倪海厦的原话或观点
6. 语言风格：专业但不晦涩，有温度但不玄乎
7. 用中文回答，使用 markdown 格式

请根据用户的提问，给出有针对性的命盘解读。`;
}

/**
 * 构建合盘分析的 system prompt
 */
export function buildHemingSystemPrompt(chartA: ZiweiChart, chartB: ZiweiChart): string {
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
5. 关注化忌的冲射关系（一方的化忌星是否冲射对方的命宫或夫妻宫）
6. 合盘不是简单的好与坏，而是分析缘分深浅、相处模式、潜在问题
7. 给出具体的相处建议
8. 用中文回答，使用 markdown 格式

请根据用户的提问，给出合盘分析。`;
}
