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
      missingPlayableSource: number;
      emptyLocalFolder: number;
      missingFolder: number;
      permissionDenied: number;
    };
    items: DashboardAnomalyItem[];
    localScan?: {
      checkedCount: number;
      emptyLocalFolderCount: number;
      missingFolderCount: number;
      permissionDeniedCount: number;
      missingPlayableSourceCount: number;
      clearedCount: number;
      failedCount: number;
      errors: { bangumi?: string; error: string }[];
    };
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

export interface DashboardDatabaseSearchItem {
  id: number;
  name: string;
  keyword: string;
  status: number;
  source: string;
  inLibrary: boolean;
  libraryPath: string;
  isSubscribed: boolean;
  episode: number;
  subtitleGroups: string[];
  updateTime: string;
}

export interface DashboardDatabaseSearchResponse {
  status: string;
  message?: string;
  data: {
    items: DashboardDatabaseSearchItem[];
    count: number;
    query: string;
    id?: number | null;
    limit: number;
  };
}
