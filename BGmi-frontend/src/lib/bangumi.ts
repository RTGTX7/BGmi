import type { BangumiData } from '~/types/bangumi';

type SeasonMonth = 1 | 4 | 7 | 10;
type QuarterLabel = '冬季' | '春季' | '夏季' | '秋季';
type BangumiSortMode = 'default' | 'recent';

export interface BangumiSeasonMeta {
  sourceDateToken: string;
  seasonKey: string;
  year: number;
  quarter: SeasonMonth;
  label: string;
  longLabel: string;
}

export interface BangumiWithSeason extends BangumiData {
  seasonMeta?: BangumiSeasonMeta;
}

export interface BangumiSeasonGroup {
  seasonKey: string;
  title: string;
  longTitle: string;
  items: BangumiWithSeason[];
}

export interface BangumiTodayGroup {
  title: string;
  longTitle: string;
  items: BangumiWithSeason[];
}

export interface BangumiSeasonTheme {
  seasonName: 'winter' | 'spring' | 'summer' | 'autumn';
  textColor: string;
  softTextColor: string;
  backgroundColor: string;
  borderColor: string;
  glowColor: string;
  titleGradient: string;
  badgeTextColor: string;
}

const hasRenderableBangumiData = (bangumi: BangumiData) => Boolean(bangumi?.bangumi_name?.trim() && bangumi?.cover?.trim());

const extractCoverDateToken = (cover: string) => {
  const matched = cover.match(/Bangumi\/(\d{6})(?:\/|$)/);
  return matched?.[1];
};

const normalizeDateTokenToSeasonKey = (token: string) => {
  if (!/^\d{6}$/.test(token)) return undefined;

  const year = Number(token.slice(0, 4));
  const month = Number(token.slice(4));
  if (month < 1 || month > 12) return undefined;

  let quarter: SeasonMonth = 10;
  let quarterLabel: QuarterLabel = '秋季';

  if (month <= 3) {
    quarter = 1;
    quarterLabel = '冬季';
  } else if (month <= 6) {
    quarter = 4;
    quarterLabel = '春季';
  } else if (month <= 9) {
    quarter = 7;
    quarterLabel = '夏季';
  }

  return {
    sourceDateToken: token,
    seasonKey: `${year}${String(quarter).padStart(2, '0')}`,
    year,
    quarter,
    quarterLabel,
  };
};

const buildSeasonMeta = (bangumi: BangumiData): BangumiSeasonMeta | undefined => {
  const tokenFromApi = bangumi.season ?? (bangumi.year && bangumi.quarter ? `${bangumi.year}${String(bangumi.quarter).padStart(2, '0')}` : undefined);
  const token = tokenFromApi ?? extractCoverDateToken(bangumi.cover);
  if (!token) return undefined;

  const normalized = normalizeDateTokenToSeasonKey(token);
  if (!normalized) return undefined;

  return {
    sourceDateToken: normalized.sourceDateToken,
    seasonKey: normalized.seasonKey,
    year: normalized.year,
    quarter: normalized.quarter,
    label: `${normalized.year}${normalized.quarterLabel}`,
    longLabel: `${normalized.year}年${normalized.quarter}月新番`,
  };
};

const byBangumiName = (a: BangumiData, b: BangumiData) => a.bangumi_name.localeCompare(b.bangumi_name, 'zh-Hans-CN');

export const sortBangumis = (items: BangumiWithSeason[], mode: BangumiSortMode = 'default') => {
  const sorted = [...items];

  if (mode === 'recent') {
    return sorted.sort((a, b) => (b.updated_time ?? 0) - (a.updated_time ?? 0) || b.status - a.status || b.episode - a.episode || byBangumiName(a, b));
  }

  return sorted.sort((a, b) => b.status - a.status || b.episode - a.episode || byBangumiName(a, b));
};

export const toBangumiWithSeason = (items: BangumiData[]) =>
  items.filter(hasRenderableBangumiData).map<BangumiWithSeason>(bangumi => ({
    ...bangumi,
    seasonMeta: buildSeasonMeta(bangumi),
  }));

export const buildSeasonGroups = (items: BangumiData[]) => {
  const enriched = toBangumiWithSeason(items);
  const grouped = new Map<string, BangumiSeasonGroup>();
  const unknown: BangumiWithSeason[] = [];

  enriched.forEach(item => {
    const meta = item.seasonMeta;
    if (!meta) {
      unknown.push(item);
      return;
    }

    const existing = grouped.get(meta.seasonKey);
    if (existing) {
      existing.items.push(item);
      return;
    }

    grouped.set(meta.seasonKey, {
      seasonKey: meta.seasonKey,
      title: meta.label,
      longTitle: meta.longLabel,
      items: [item],
    });
  });

  const seasonGroups = [...grouped.values()]
    .sort((a, b) => Number(b.seasonKey) - Number(a.seasonKey))
    .map(group => ({
      ...group,
      items: sortBangumis(group.items),
    }));

  return {
    seasonGroups,
    unknownItems: sortBangumis(unknown),
  };
};

export const getCurrentSeasonKey = (seasonGroups: BangumiSeasonGroup[]) => seasonGroups[0]?.seasonKey;

export const getCurrentSeasonGroup = (seasonGroups: BangumiSeasonGroup[]) => seasonGroups[0];

export const buildTodayPreview = (items: BangumiData[]): BangumiTodayGroup | undefined => {
  const todayItems = sortBangumis(toBangumiWithSeason(items).filter(item => item.status === 2), 'recent');
  if (todayItems.length === 0) return undefined;

  return {
    title: '今日更新',
    longTitle: '海报带有 NEW 标签的番剧',
    items: todayItems,
  };
};

export const getBangumiGroupBySeason = (items: BangumiData[], seasonKey: string) =>
  buildSeasonGroups(items).seasonGroups.find(group => group.seasonKey === seasonKey);

export const getSeasonTheme = (year?: number, quarter?: number, isDark = true): BangumiSeasonTheme => {
  if (quarter === 1) {
    return {
      seasonName: 'winter',
      textColor: isDark ? '#BFE3FF' : '#2C5E8C',
      softTextColor: isDark ? 'rgba(191,227,255,0.74)' : 'rgba(44,94,140,0.76)',
      backgroundColor: isDark ? 'rgba(90, 180, 255, 0.16)' : 'rgba(219,238,255,0.86)',
      borderColor: isDark ? 'rgba(90, 180, 255, 0.24)' : 'rgba(155,204,255,0.72)',
      glowColor: isDark ? '0 0 18px rgba(90, 180, 255, 0.12)' : '0 10px 24px rgba(90, 180, 255, 0.10)',
      titleGradient: 'linear(to-r, #93C5FD, #E0F2FE)',
      badgeTextColor: isDark ? '#DBEAFE' : '#22577A',
    };
  }

  if (quarter === 4) {
    return {
      seasonName: 'spring',
      textColor: isDark ? '#9AF0BF' : '#1E7A4C',
      softTextColor: isDark ? 'rgba(154,240,191,0.74)' : 'rgba(30,122,76,0.76)',
      backgroundColor: isDark ? 'rgba(80, 220, 150, 0.16)' : 'rgba(222,250,234,0.88)',
      borderColor: isDark ? 'rgba(80, 220, 150, 0.24)' : 'rgba(136,226,177,0.72)',
      glowColor: isDark ? '0 0 18px rgba(80, 220, 150, 0.12)' : '0 10px 24px rgba(80, 220, 150, 0.10)',
      titleGradient: 'linear(to-r, #86EFAC, #DCFCE7)',
      badgeTextColor: isDark ? '#DCFCE7' : '#166534',
    };
  }

  if (quarter === 7) {
    return {
      seasonName: 'summer',
      textColor: isDark ? '#FFB38A' : '#B45309',
      softTextColor: isDark ? 'rgba(255,179,138,0.76)' : 'rgba(180,83,9,0.78)',
      backgroundColor: isDark ? 'rgba(255, 130, 90, 0.16)' : 'rgba(255,232,223,0.9)',
      borderColor: isDark ? 'rgba(255, 130, 90, 0.24)' : 'rgba(255,171,141,0.72)',
      glowColor: isDark ? '0 0 18px rgba(255, 130, 90, 0.12)' : '0 10px 24px rgba(255, 130, 90, 0.10)',
      titleGradient: 'linear(to-r, #FB923C, #FED7AA)',
      badgeTextColor: isDark ? '#FFEDD5' : '#9A3412',
    };
  }

  return {
    seasonName: 'autumn',
    textColor: isDark ? '#FFD77A' : '#A16207',
    softTextColor: isDark ? 'rgba(255,215,122,0.76)' : 'rgba(161,98,7,0.78)',
    backgroundColor: isDark ? 'rgba(255, 190, 80, 0.16)' : 'rgba(255,244,214,0.9)',
    borderColor: isDark ? 'rgba(255, 190, 80, 0.24)' : 'rgba(255,206,121,0.72)',
    glowColor: isDark ? '0 0 18px rgba(255, 190, 80, 0.12)' : '0 10px 24px rgba(255, 190, 80, 0.10)',
    titleGradient: 'linear(to-r, #FCD34D, #FEF3C7)',
    badgeTextColor: isDark ? '#FEF3C7' : '#92400E',
  };
};

export const getSeasonThemeByKey = (seasonKey?: string, isDark = true): BangumiSeasonTheme => {
  if (!seasonKey || seasonKey.length < 6) return getSeasonTheme(undefined, 10, isDark);
  return getSeasonTheme(Number(seasonKey.slice(0, 4)), Number(seasonKey.slice(4, 6)), isDark);
};
