export interface UpdateTime {
  Mon: 'Mon';
  Tue: 'Tue';
  Wed: 'Wed';
  Thu: 'Thu';
  Fri: 'Fri';
  Sat: 'Sat';
  Sun: 'Sun';
}

export interface Bangumi {
  bangumi_id: number;
  bangumi_name: string;
  name: string;
  cover: string;
  data_source: string;
  episode: number;
  exclude: string;
  include: string;
  player: { [keys: number]: { player: string } };
  regex: string;
  status: 1;
  subtitle: string;
  update_time: UpdateTime;
  updated_time: number;
}

export interface BangumiData {
  name: string;
  update_time: string;
  cover: string;
  id: number;
  bangumi_name: string;
  episode: number;
  status: number;
  updated_time: number;
  year?: number | null;
  quarter?: number | null;
  season?: string | null;
  player: Record<string, Record<(string & {}) | 'path', string> | undefined>;
}

export interface SubtitleAsset {
  path: string;
  original_path?: string;
  format: string;
  source_format?: string;
  language: string;
  label: string;
  default?: boolean;
  source?: string;
  render_style?: {
    font_family?: string;
    font_weight?: number;
    font_style?: string;
  };
}

export interface QualityAsset {
  name: string;
  url: string;
  type: string;
}

export interface PlayerAsset {
  source_path: string;
  browser_path: string;
  subtitle?: SubtitleAsset;
  subtitles?: SubtitleAsset[];
  qualities?: QualityAsset[];
}

export interface PlayerAssetResponse {
  version: string;
  latest_version: string;
  frontend_version: string[];
  status: string;
  lang: string;
  danmaku_api: string;
  data: PlayerAsset;
}

export interface BangumiResponse {
  version: string;
  latest_version: string;
  frontend_version: string;
  status: string;
  lang: string;
  danmaku_api: string;
  data: BangumiData[];
}
