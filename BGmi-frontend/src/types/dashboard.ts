export interface DashboardStats {
  subscribedTotal: number;
  bangumiTotal: number;
  currentSeasonTotal: number;
  todayUpdatedTotal: number;
  matchedMikanTotal: number;
  anomalyTotal: number;
  localFolderTotal: number;
  lastSyncTime?: string | null;
  currentSeasonKey: string;
  workingDirectory?: string;
  configPath?: string;
  bgmiPath?: string;
}

export interface DashboardAnomalyItem {
  type: string;
  name: string;
  detail: string;
  episode?: string | null;
  filePath?: string | null;
  markedAt?: string | null;
}

export interface DashboardOverview {
  stats: DashboardStats;
  anomalies: {
    summary: {
      total: number;
      missingPoster: number;
      missingSeason: number;
      missingKeyword: number;
      danglingFollowed: number;
      duplicateRecords: number;
      missingEpisodes: number;
      emptyLocalFolder: number;
      missingFolder: number;
      permissionDenied: number;
    };
    items: DashboardAnomalyItem[];
  };
}

export interface DashboardOverviewResponse {
  data: DashboardOverview;
  status: string;
  message?: string;
}

export interface DashboardActionResponse<T = any> {
  data: T;
  status: string;
  message?: string;
}

export interface DashboardCommandResult {
  ok: boolean;
  status: 'success' | 'error';
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  workingDirectory: string;
  configPath: string;
  bgmiPath: string;
}
