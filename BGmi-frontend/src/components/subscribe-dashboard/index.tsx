import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { getCookie } from 'cookies-next';
import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

import { useColorMode } from '~/hooks/use-color-mode';
import { fetcher, fetcherWithMutation } from '~/lib/fetcher';
import { normalizePath } from '~/lib/utils';

import type {
  DashboardActionResponse,
  DashboardAnomalyItem,
  DashboardCommandResult,
  DashboardOverviewResponse,
} from '~/types/dashboard';

type ConfirmActionKey = 'reset' | 'rebuild' | 'submit-downloads' | 'refresh-metadata' | null;
type Tone = 'cyan' | 'blue' | 'green' | 'amber' | 'red';

type ActionPreview = {
  title: string;
  description: string;
  confirmKeyword?: string;
  payload?: any;
  actionKey: Exclude<ConfirmActionKey, null>;
};

const getPanelBg = (isDark: boolean) =>
  isDark
    ? 'linear-gradient(180deg, rgba(10,16,36,0.80) 0%, rgba(8,12,30,0.72) 100%)'
    : 'linear-gradient(180deg, rgba(247,251,255,0.96) 0%, rgba(238,246,255,0.92) 100%)';
const getPanelBorder = (isDark: boolean) =>
  isDark ? 'rgba(120, 170, 255, 0.14)' : 'rgba(132, 169, 235, 0.24)';
const getPanelShadow = (isDark: boolean) =>
  isDark ? '0 0 20px rgba(80, 140, 255, 0.06)' : '0 12px 30px rgba(80, 140, 255, 0.08)';
const getDashboardTheme = (isDark: boolean) => ({
  textPrimary: isDark ? '#F2F6FF' : '#304254',
  textSecondary: isDark ? 'rgba(220, 230, 255, 0.72)' : 'rgba(79,95,110,0.78)',
  textMuted: isDark ? 'rgba(220, 230, 255, 0.56)' : 'rgba(79,95,110,0.68)',
  textStrong: isDark ? '#F4F8FF' : '#24384d',
  unitText: isDark ? 'rgba(220, 230, 255, 0.65)' : 'rgba(79,95,110,0.72)',
  cardBg: isDark ? 'rgba(8, 14, 32, 0.78)' : 'rgba(255,255,255,0.72)',
  commandBg: isDark ? 'rgba(12, 20, 46, 0.84)' : 'rgba(247,251,255,0.92)',
  commandTitle: isDark ? 'rgba(245, 248, 255, 0.92)' : '#304254',
  commandSubtitle: isDark ? 'rgba(220, 230, 255, 0.58)' : 'rgba(79,95,110,0.72)',
});

function getToneStyles(tone: Tone) {
  const tones = {
    cyan: {
      color: '#67E8F9',
      bg: 'rgba(34,211,238,0.10)',
      border: 'rgba(34,211,238,0.22)',
      glow: '0 0 18px rgba(34,211,238,0.12)',
      lightText: '#0F6E7B',
      lightBg: 'rgba(34,211,238,0.18)',
      lightBorder: 'rgba(34,211,238,0.34)',
    },
    blue: {
      color: '#93C5FD',
      bg: 'rgba(59,130,246,0.10)',
      border: 'rgba(59,130,246,0.22)',
      glow: '0 0 18px rgba(59,130,246,0.10)',
      lightText: '#2258A5',
      lightBg: 'rgba(59,130,246,0.16)',
      lightBorder: 'rgba(59,130,246,0.30)',
    },
    green: {
      color: '#86EFAC',
      bg: 'rgba(16,185,129,0.10)',
      border: 'rgba(16,185,129,0.20)',
      glow: '0 0 18px rgba(16,185,129,0.10)',
      lightText: '#1D7A52',
      lightBg: 'rgba(16,185,129,0.16)',
      lightBorder: 'rgba(16,185,129,0.30)',
    },
    amber: {
      color: '#FBBF24',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.22)',
      glow: '0 0 18px rgba(245,158,11,0.10)',
      lightText: '#9A5C00',
      lightBg: 'rgba(245,158,11,0.18)',
      lightBorder: 'rgba(245,158,11,0.34)',
    },
    red: {
      color: '#FCA5A5',
      bg: 'rgba(239,68,68,0.10)',
      border: 'rgba(239,68,68,0.22)',
      glow: '0 0 18px rgba(239,68,68,0.10)',
      lightText: '#A33A3A',
      lightBg: 'rgba(239,68,68,0.14)',
      lightBorder: 'rgba(239,68,68,0.28)',
    },
  } as const;

  return tones[tone];
}

function StatusChip({ label, tone = 'cyan', isDark = true }: { label: string; tone?: Tone; isDark?: boolean }) {
  const style = getToneStyles(tone);

  return (
    <Box
      px={{ base: '2.5', md: '3' }}
      py={{ base: '1', md: '1.5' }}
      rounded='full'
      borderWidth='1px'
      borderColor={isDark ? style.border : style.lightBorder}
      bg={isDark ? style.bg : style.lightBg}
      color={isDark ? style.color : style.lightText}
      boxShadow={isDark ? style.glow : '0 8px 20px rgba(80, 140, 255, 0.08)'}
      backdropFilter='blur(14px)'
      whiteSpace='nowrap'
    >
      <Text fontSize='10px' fontWeight='700' letterSpacing='0.08em'>
        {label}
      </Text>
    </Box>
  );
}

function formatTime(value?: string | null) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatSeasonKeyLabel(value?: string | null) {
  if (!value) return '--';
  const normalized = String(value).trim();
  const matched = normalized.match(/^(\d{4})(\d{2})$/);
  if (!matched) return normalized;

  const [, year, quarter] = matched;
  const quarterMap: Record<string, string> = {
    '01': '冬季',
    '04': '春季',
    '07': '夏季',
    '10': '秋季',
  };

  return `${year}${quarterMap[quarter] ?? ''}`.trim();
}

function buildSummaryText(result: any) {
  if (!result) return '';

  if ('command' in result) {
    return `Command result: ${result.ok ? 'success' : 'failed'} / exitCode=${result.exitCode ?? '--'} / ${result.durationMs ?? 0}ms`;
  }

  if ('submittedCount' in result) {
    return `Download jobs: submitted ${result.submittedCount ?? 0} / skipped ${result.skippedCount ?? 0} / failed ${result.failedCount ?? 0}`;
  }

  if ('updatedCount' in result || 'posterUpdatedCount' in result || 'episodeUpdatedCount' in result) {
    return `Metadata refresh: updated ${result.updatedCount ?? 0} / posters ${result.posterUpdatedCount ?? 0} / episodes ${result.episodeUpdatedCount ?? 0} / skipped ${result.skippedCount ?? 0} / failed ${result.failedCount ?? 0}`;
  }

  if ('deletedEmptyLocalCount' in result || 'skippedProtectedEmptyCount' in result) {
    return `Rebuild result: success ${result.successCount ?? 0} / deleted empty local ${result.deletedEmptyLocalCount ?? 0} / protected skips ${result.skippedProtectedEmptyCount ?? 0} / skipped ${result.skippedCount ?? 0} / failed ${result.failedCount ?? 0}`;
  }

  return `Maintenance result: success ${result?.successCount ?? 0} / failed ${result?.failedCount ?? 0} / skipped ${result?.skippedCount ?? 0}`;
}

function summarizeOutput(output?: string) {
  if (!output) return '--';
  const normalized = output.trim();
  if (!normalized) return '--';
  return normalized.length > 400 ? `${normalized.slice(0, 400)}...` : normalized;
}

export default function SubscribeDashboard() {
  const authToken = getCookie('authToken') as string | undefined;
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const toast = useToast();
  const theme = getDashboardTheme(isDark);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmDialog = useDisclosure();
  const [confirmInput, setConfirmInput] = useState('');
  const [confirmState, setConfirmState] = useState<ActionPreview | null>(null);
  const [latestActionResult, setLatestActionResult] = useState<any>(null);
  const [anomalyItems, setAnomalyItems] = useState<DashboardAnomalyItem[]>([]);
  const [rebuildPreview, setRebuildPreview] = useState<any>(null);
  const [showDiagnosticsDetail, setShowDiagnosticsDetail] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<DashboardOverviewResponse>(['/api/dashboard', authToken], fetcher, {
    revalidateOnFocus: false,
  });

  const { trigger: previewReset, isMutating: previewResetMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], Record<string, never>>(
    ['/api/dashboard-reset-preview', authToken],
    fetcherWithMutation
  );

  const { trigger: executeReset, isMutating: executeResetMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], { confirmText: string }>(
    ['/api/dashboard-reset', authToken],
    fetcherWithMutation
  );

  const { trigger: previewRebuild, isMutating: previewRebuildMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], Record<string, never>>(
    ['/api/dashboard-rebuild-preview', authToken],
    fetcherWithMutation
  );

  const { trigger: executeRebuild, isMutating: executeRebuildMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], { confirmText: string }>(
    ['/api/dashboard-rebuild', authToken],
    fetcherWithMutation
  );

  const { trigger: syncMikan, isMutating: syncMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], Record<string, never>>(
    ['/api/dashboard-sync', authToken],
    fetcherWithMutation
  );

  const { trigger: submitDownloads, isMutating: submitDownloadsMutating } = useSWRMutation<
    DashboardActionResponse<DashboardCommandResult>,
    Error,
    [string, string | undefined],
    Record<string, never>
  >(
    ['/api/dashboard/submit-download-jobs', authToken],
    fetcherWithMutation
  );

  const { trigger: refreshMetadata, isMutating: refreshMetadataMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], Record<string, never>>(
    ['/api/dashboard-refresh-metadata', authToken],
    fetcherWithMutation
  );

  const { trigger: fetchAnomalies, isMutating: anomalyMutating } = useSWRMutation<DashboardActionResponse, Error, [string, string | undefined], Record<string, never>>(
    ['/api/dashboard-anomalies', authToken],
    fetcherWithMutation
  );

  const { trigger: clearMissingEpisodeMark, isMutating: clearMissingEpisodeMarkMutating } = useSWRMutation<
    DashboardActionResponse,
    Error,
    [string, string | undefined],
    { bangumiName: string }
  >(['/api/player/clear-missing-episodes', authToken], fetcherWithMutation);

  const showError = (title: string, err: unknown) => {
    console.error(err);
    toast({ title, status: 'error', duration: 3200, position: 'top-right' });
  };

  const showSuccess = (title: string) => {
    toast({ title, status: 'success', duration: 2600, position: 'top-right' });
  };

  const openConfirm = (state: ActionPreview) => {
    setConfirmInput('');
    setConfirmState(state);
    confirmDialog.onOpen();
  };

  const closeConfirm = () => {
    confirmDialog.onClose();
    setConfirmInput('');
    setConfirmState(null);
  };

  const handlePreviewReset = async () => {
    try {
      const resp = await previewReset({});
      const payload = resp?.data ?? {};
      openConfirm({
        actionKey: 'reset',
        title: '确认清零剧集进度',
        description: `将重置 ${payload.affectedCount ?? 0} 部番剧的 episode / latestEpisode / watchedEpisode 等剧集字段为 0。`,
        confirmKeyword: payload.confirmKeyword,
        payload,
      });
    } catch (err) {
      showError('获取清零预览失败', err);
    }
  };

  const handlePreviewRebuild = async () => {
    try {
      const resp = await previewRebuild({});
      const payload = resp?.data ?? {};
      setRebuildPreview(payload);
      openConfirm({
        actionKey: 'rebuild',
        title: '确认重建仓库番剧',
        description: `将扫描 ${payload.foldersScanned ?? 0} 个本地文件夹，并尝试与 Bangumi / Mikan 数据匹配后修复数据库记录。`,
        confirmKeyword: payload.confirmKeyword,
        payload,
      });
    } catch (err) {
      showError('获取重建预览失败', err);
    }
  };

  const handleOpenSubmitDownloadsConfirm = () => {
    openConfirm({
      actionKey: 'submit-downloads',
      title: '确认提交下载任务',
      description: 'Run bgmi update --download on the backend and return stdout / stderr, exit code, and status.',
    });
  };

  const handleOpenRefreshMetadataConfirm = () => {
    openConfirm({
      actionKey: 'refresh-metadata',
      title: '确认更新剧集和海报',
      description: '将从 Mikan / 现有数据源刷新最新集数、海报、标题与更新时间等元数据，不会清空观看进度。',
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;

    try {
      if (confirmState.actionKey === 'reset') {
        const resp = await executeReset({ confirmText: confirmInput });
        setLatestActionResult(resp?.data ?? null);
        showSuccess('剧集进度已清零');
      }

      if (confirmState.actionKey === 'rebuild') {
        const resp = await executeRebuild({ confirmText: confirmInput });
        setLatestActionResult(resp?.data ?? null);
        showSuccess('仓库番剧重建完成');
      }

      if (confirmState.actionKey === 'submit-downloads') {
        const resp = await submitDownloads({});
        setLatestActionResult(resp?.data ?? null);
        showSuccess(resp?.data?.ok ? 'bgmi update --download completed' : 'bgmi update --download failed');
      }

      if (confirmState.actionKey === 'refresh-metadata') {
        const resp = await refreshMetadata({});
        setLatestActionResult(resp?.data ?? null);
        showSuccess(`已刷新 ${resp?.data?.updatedCount ?? 0} 条番剧元数据`);
      }

      closeConfirm();
      await mutate();
    } catch (err) {
      showError('维护操作执行失败', err);
    }
  };

  const handleSync = async () => {
    try {
      const resp = await syncMikan({});
      setLatestActionResult(resp?.data ?? null);
      showSuccess('Mikan 数据同步完成');
      await mutate();
    } catch (err) {
      showError('同步 Mikan 数据失败', err);
    }
  };

  const handleCheckAnomalies = async () => {
    try {
      const resp = await fetchAnomalies({});
      const payload = resp?.data ?? {};
      setAnomalyItems(Array.isArray(payload.items) ? payload.items : []);
      setLatestActionResult(payload.summary ?? null);
      setShowDiagnosticsDetail((payload.items?.length ?? 0) > 0);
      showSuccess('异常数据检查完成');
      await mutate();
    } catch (err) {
      showError('检查异常数据失败', err);
    }
  };


  const handleClearMissingEpisodes = async (bangumiName: string) => {
    try {
      await clearMissingEpisodeMark({ bangumiName });
      setAnomalyItems(current => current.filter(item => !(item.type === 'missing_episodes' && item.name === bangumiName)));
      showSuccess('Missing-episodes mark cleared');
      await mutate();
    } catch (err) {
      showError('Failed to clear missing-episodes mark', err);
    }
  };

  const stats: any = data?.data?.stats ?? {};
  const anomalySummary: any = data?.data?.anomalies?.summary ?? {};
  const fallbackAnomalies = data?.data?.anomalies?.items ?? [];
  const anomalyList = useMemo(() => (anomalyItems.length ? anomalyItems : fallbackAnomalies), [anomalyItems, fallbackAnomalies]);

  const allNormal =
    (anomalySummary.missingPoster ?? 0) === 0 &&
    (anomalySummary.missingSeason ?? 0) === 0 &&
    (anomalySummary.missingKeyword ?? 0) === 0 &&
    (anomalySummary.danglingFollowed ?? 0) === 0 &&
    (anomalySummary.duplicateRecords ?? 0) === 0 &&
    (anomalySummary.missingEpisodes ?? 0) === 0 &&
    (anomalySummary.emptyLocalFolder ?? 0) === 0 &&
    (anomalySummary.missingFolder ?? 0) === 0 &&
    (anomalySummary.permissionDenied ?? 0) === 0;

  const statCards = [
    { label: '当前订阅', value: stats.subscribedTotal ?? 0, unit: '部', tone: 'cyan' as Tone },
    { label: 'Bangumi 总数', value: stats.bangumiTotal ?? 0, unit: '部', tone: 'blue' as Tone },
    { label: '当季番剧', value: stats.currentSeasonTotal ?? 0, unit: '部', tone: 'green' as Tone },
    { label: '今日更新', value: stats.todayUpdatedTotal ?? 0, unit: '部', tone: 'cyan' as Tone },
    { label: '已匹配 Mikan', value: stats.matchedMikanTotal ?? 0, unit: '部', tone: 'blue' as Tone },
    { label: '异常数据', value: stats.anomalyTotal ?? 0, unit: '项', tone: ((stats.anomalyTotal ?? 0) > 0 ? 'amber' : 'green') as Tone },
  ];

  const diagnostics = [
    { label: 'Missing poster', value: anomalySummary.missingPoster ?? 0 },
    { label: 'Missing season', value: anomalySummary.missingSeason ?? 0 },
    { label: 'Missing keyword', value: anomalySummary.missingKeyword ?? 0 },
    { label: 'Dangling followed', value: anomalySummary.danglingFollowed ?? 0 },
    { label: 'Duplicate records', value: anomalySummary.duplicateRecords ?? 0 },
    { label: 'Missing episodes', value: anomalySummary.missingEpisodes ?? 0 },
    { label: 'Empty local folder', value: anomalySummary.emptyLocalFolder ?? 0 },
    { label: 'Missing folder', value: anomalySummary.missingFolder ?? 0 },
    { label: 'Permission denied', value: anomalySummary.permissionDenied ?? 0 },
  ];

  const commandCards = [
    { title: '重新同步 Mikan 数据', subtitle: 'Fetch metadata', tone: 'cyan' as Tone, onClick: handleSync, loading: syncMutating },
    { title: '提交下载任务', subtitle: 'bgmi update --download', tone: 'blue' as Tone, onClick: handleOpenSubmitDownloadsConfirm, loading: submitDownloadsMutating },
    { title: '更新剧集和海报', subtitle: 'Refresh episodes & posters', tone: 'green' as Tone, onClick: handleOpenRefreshMetadataConfirm, loading: refreshMetadataMutating },
    { title: '检查异常数据', subtitle: 'Scan issues', tone: 'blue' as Tone, onClick: handleCheckAnomalies, loading: anomalyMutating },
    { title: '重建仓库番剧', subtitle: 'Match folders', tone: 'amber' as Tone, onClick: handlePreviewRebuild, loading: previewRebuildMutating || executeRebuildMutating },
    { title: '剧集全部清零', subtitle: 'Reset progress', tone: 'red' as Tone, onClick: handlePreviewReset, loading: previewResetMutating || executeResetMutating },
  ];

  if (isLoading) {
    return (
      <Box py='10' textAlign='center'>
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        rounded='22px'
        borderWidth='1px'
        borderColor={getPanelBorder(isDark)}
        bg={getPanelBg(isDark)}
        px={{ base: 4, md: 5 }}
        py={{ base: 5, md: 6 }}
        boxShadow={getPanelShadow(isDark)}
        backdropFilter='blur(18px)'
      >
          <Stack spacing='2'>
            <Heading size='sm' color={theme.textPrimary}>
              Dashboard 加载失败
            </Heading>
            <Text fontSize='sm' color={theme.textSecondary}>
              {(error as Error)?.message ?? '未知错误'}
            </Text>
          </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={{ base: 3, md: 3.5 }} px={{ base: 0.5, md: 0 }} pb={{ base: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)', md: 6 }}>
      <Box
        rounded='22px'
        borderWidth='1px'
        borderColor={getPanelBorder(isDark)}
        bg={getPanelBg(isDark)}
        px={{ base: 3.5, md: 5 }}
        py={{ base: 3, md: 4 }}
        minH={{ base: '58px', md: '72px' }}
        boxShadow={getPanelShadow(isDark)}
        backdropFilter='blur(18px)'
        position='relative'
        overflow='hidden'
        _before={{
          content: '""',
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: isDark
            ? 'radial-gradient(circle at 90% 0%, rgba(80,140,255,0.14), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.05), transparent 50%)'
            : 'radial-gradient(circle at 90% 0%, rgba(80,140,255,0.10), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.28), transparent 50%)',
        }}
      >
        <Grid templateColumns='1fr auto' alignItems='center' gap='3' position='relative' zIndex='1'>
          <Box minW='0'>
            <Heading size='sm' color={theme.textPrimary}>
              Dashboard
            </Heading>
            <Text mt='1' fontSize='11px' color={theme.textSecondary} noOfLines={1}>
              {formatSeasonKeyLabel(stats.currentSeasonKey)} · Synced {formatTime(stats.lastSyncTime)}
            </Text>
            <Text mt='1' fontSize='10px' color={theme.textMuted} noOfLines={1}>
              cwd: {stats.workingDirectory ?? '--'}
            </Text>
            <Text mt='0.5' fontSize='10px' color={theme.textMuted} noOfLines={1}>
              config: {stats.configPath ?? '--'}
            </Text>
          </Box>
          <StatusChip label='SYNC OK' tone='green' isDark={isDark} />
        </Grid>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={{ base: 2, md: 2.5 }}>
        {statCards.map(item => {
          const toneStyle = getToneStyles(item.tone);
          return (
            <Box
              key={item.label}
              rounded='18px'
              borderWidth='1px'
              borderColor={getPanelBorder(isDark)}
              bg={isDark ? theme.cardBg : getPanelBg(isDark)}
              minH={{ base: '66px', md: '76px' }}
              px={{ base: '3', md: '3.5' }}
              py={{ base: '2.5', md: '3' }}
              boxShadow={getPanelShadow(isDark)}
              backdropFilter='blur(18px)'
              position='relative'
              overflow='hidden'
            >
              <Box
                position='absolute'
                inset='0'
                pointerEvents='none'
                background={`radial-gradient(circle at 100% 0%, ${toneStyle.bg.replace('0.10', '0.18')}, transparent 36%)`}
                opacity={0.9}
              />
              <Grid templateRows='auto 1fr' h='full' position='relative' zIndex='1'>
                <Grid templateColumns='1fr auto' alignItems='start' gap='2'>
                  <Text fontSize='11px' color={theme.textSecondary} noOfLines={1}>
                    {item.label}
                  </Text>
                  <Box w='6px' h='6px' rounded='full' bg={toneStyle.color} mt='1' boxShadow={isDark ? `inset 0 1px 0 rgba(255,255,255,0.04), ${toneStyle.glow}` : toneStyle.glow} />
                </Grid>
                <Flex align='end' gap='1.5' mt='1.5'>
                  <Text fontSize={{ base: '22px', md: '28px' }} lineHeight='1' fontWeight='700' color={theme.textStrong}>
                    {item.value}
                  </Text>
                  <Text pb='1' fontSize='11px' color={theme.textSecondary}>
                    {item.unit}
                  </Text>
                </Flex>
              </Grid>
            </Box>
          );
        })}
      </SimpleGrid>

      <Box
        rounded='22px'
        borderWidth='1px'
        borderColor={getPanelBorder(isDark)}
        bg={getPanelBg(isDark)}
        px={{ base: 3.5, md: 5 }}
        py={{ base: 3.5, md: 4.5 }}
        boxShadow={getPanelShadow(isDark)}
        backdropFilter='blur(18px)'
        position='relative'
        overflow='hidden'
      >
        <Flex align='center' justify='space-between' gap='3' mb='3'>
          <Box>
            <Heading size='sm' color={theme.textPrimary}>
              Command Center
            </Heading>
            <Text mt='1' fontSize='11px' color={theme.textSecondary}>
              执行订阅维护、同步与诊断任务
            </Text>
          </Box>
          <StatusChip label='READY' tone='cyan' isDark={isDark} />
        </Flex>

        <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} spacing={{ base: 2, md: 2.5 }}>
          {commandCards.map(card => {
            const toneStyle = getToneStyles(card.tone);
            return (
              <Button
                key={card.title}
                onClick={card.onClick}
                isLoading={card.loading}
                rounded='18px'
                h={{ base: '58px', md: '66px' }}
                px='3'
                py='2.5'
                borderWidth='1px'
                borderColor={toneStyle.border}
                bg={isDark ? theme.commandBg : `linear-gradient(180deg, ${toneStyle.bg}, rgba(255,255,255,0.82))`}
                display='flex'
                alignItems='center'
                justifyContent='flex-start'
                textAlign='left'
                whiteSpace='normal'
                boxShadow={isDark ? `inset 0 1px 0 rgba(255,255,255,0.04), ${toneStyle.glow}` : toneStyle.glow}
                transition='transform .18s ease, box-shadow .18s ease'
                _hover={{ bg: isDark ? 'rgba(16, 26, 58, 0.9)' : `linear-gradient(180deg, ${toneStyle.bg}, rgba(255,255,255,0.92))`, transform: 'translateY(-1px)', boxShadow: isDark ? `0 0 22px ${toneStyle.border}, inset 0 1px 0 rgba(255,255,255,0.05)` : toneStyle.glow }}
                _active={{ transform: 'scale(0.985)' }}
              >
                <Box minW='0'>
                  <Text fontSize={{ base: '12px', md: '13px' }} fontWeight='600' color={theme.textPrimary} noOfLines={1}>
                    {card.title}
                  </Text>
                  <Text mt='0.5' fontSize='10px' color={theme.textSecondary} noOfLines={1}>
                    {card.subtitle}
                  </Text>
                </Box>
              </Button>
            );
          })}
        </SimpleGrid>

        {rebuildPreview ? (
          <SimpleGrid columns={{ base: 2, md: 3 }} spacing='2' mt='3'>
            {[
              ['扫描目录', rebuildPreview.foldersScanned ?? 0],
              ['成功匹配', rebuildPreview.matchedCount ?? 0],
              ['未匹配', rebuildPreview.unmatchedCount ?? 0],
              ['多候选', rebuildPreview.multiCandidateCount ?? 0],
              ['即将新增', rebuildPreview.createCount ?? 0],
              ['即将更新', rebuildPreview.updateCount ?? 0],
            ].map(([label, value]) => (
              <Box
                key={String(label)}
                rounded='16px'
                px='3'
                py='2.5'
                bg={isDark ? 'rgba(14, 20, 40, 0.84)' : 'rgba(255,255,255,0.42)'}
                borderWidth='1px'
                borderColor={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(132,169,235,0.16)'}
              >
                <Text fontSize='10px' color={theme.textSecondary}>
                  {label}
                </Text>
                <Text mt='1' fontWeight='700' color={theme.textPrimary}>
                  {value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        ) : null}
      </Box>

      <Box
        rounded='22px'
        borderWidth='1px'
        borderColor={getPanelBorder(isDark)}
        bg={getPanelBg(isDark)}
        px={{ base: 3.5, md: 5 }}
        py={{ base: 3.5, md: 4.5 }}
        boxShadow={getPanelShadow(isDark)}
        backdropFilter='blur(18px)'
      >
        <Flex align='center' justify='space-between' gap='3' mb='3'>
          <Box>
            <Heading size='sm' color={theme.textPrimary}>
              Diagnostics
            </Heading>
            <Text mt='1' fontSize='11px' color={theme.textSecondary}>
              快速查看当前数据库异常与缺失状态
            </Text>
          </Box>
          {allNormal ? <StatusChip label='ALL SYSTEMS NORMAL' tone='green' isDark={isDark} /> : <StatusChip label='CHECK REQUIRED' tone='amber' isDark={isDark} />}
        </Flex>

        <SimpleGrid columns={{ base: 2, md: 5 }} spacing='2'>
          {diagnostics.map(item => {
            const isWarning = item.value > 0;
            return (
              <Box
                key={item.label}
                rounded='16px'
                px='3'
                py='2.5'
                minH='36px'
                bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.40)'}
                borderWidth='1px'
                borderColor={isWarning ? 'rgba(245,158,11,0.22)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(132,169,235,0.12)'}
              >
                <Text fontSize='10px' color={theme.textSecondary}>
                  {item.label}
                </Text>
                <Text mt='0.5' fontWeight='bold' color={isWarning ? '#FBBF24' : isDark ? 'whiteAlpha.940' : '#304254'}>
                  {item.value}
                </Text>
              </Box>
            );
          })}
        </SimpleGrid>

        {allNormal ? (
          <Box
            mt='3'
            rounded='16px'
            px='3.5'
            py='2.5'
            bg={isDark ? 'rgba(16,185,129,0.08)' : 'rgba(220,252,231,0.58)'}
            borderWidth='1px'
            borderColor='rgba(16,185,129,0.14)'
          >
            <Text fontSize='sm' color={isDark ? '#86EFAC' : '#166534'} fontWeight='semibold'>
              无异常数据 / All systems normal
            </Text>
          </Box>
        ) : (
          <>
            <Button mt='3' variant='ghost' px='0' h='auto' minH='unset' onClick={() => setShowDiagnosticsDetail(value => !value)} _hover={{ bg: 'transparent' }}>
              {showDiagnosticsDetail ? '收起详情' : '查看详情'}
            </Button>
            {showDiagnosticsDetail ? (
              <Stack spacing='2' mt='3'>
                {anomalyList.length ? (
                  anomalyList.map((item, index) => (
                    <Box
                      key={`${item.type}-${item.name}-${index}`}
                      rounded='16px'
                      px='3.5'
                      py='3'
                      bg={isDark ? 'rgba(14, 20, 40, 0.86)' : 'rgba(255,255,255,0.42)'}
                      borderWidth='1px'
                      borderColor='rgba(245,158,11,0.16)'
                    >
                      <Stack spacing='1'>
                        <Text fontWeight='600' color={theme.textPrimary}>
                          {item.name ?? '未命名番剧'}
                        </Text>
                        <Text fontSize='xs' color={theme.textSecondary}>
                          {item.type ?? 'unknown'}
                        </Text>
                        <Text fontSize='sm' color={theme.textSecondary}>
                          {item.detail ?? '--'}
                        </Text>
                      </Stack>
                    </Box>
                  ))
                ) : (
                  <Text color={theme.textSecondary}>暂无异常明细</Text>
                )}
              </Stack>
            ) : null}
          </>
        )}
      </Box>

      {latestActionResult ? (
        <Box
          rounded='18px'
          borderWidth='1px'
          borderColor={getPanelBorder(isDark)}
          bg={isDark ? 'rgba(14, 20, 40, 0.84)' : 'rgba(255,255,255,0.42)'}
          px='4'
          py='3'
          boxShadow={getPanelShadow(isDark)}
        >
          <Text fontSize='sm' color={theme.textPrimary}>
            {buildSummaryText(latestActionResult)}
          </Text>
          {'command' in latestActionResult ? (
            <Stack spacing='2' mt='3'>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing='2'>
                <Box rounded='14px' px='3' py='2.5' bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)'}>
                  <Text fontSize='10px' color={theme.textSecondary}>
                    Status
                  </Text>
                  <Text mt='1' fontWeight='700' color={latestActionResult.ok ? '#86EFAC' : '#FCA5A5'}>
                    {latestActionResult.ok ? 'SUCCESS' : 'FAILED'}
                  </Text>
                </Box>
                <Box rounded='14px' px='3' py='2.5' bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)'}>
                  <Text fontSize='10px' color={theme.textSecondary}>
                    Exit Code
                  </Text>
                  <Text mt='1' fontWeight='700' color={theme.textPrimary}>
                    {latestActionResult.exitCode ?? '--'}
                  </Text>
                </Box>
              </SimpleGrid>
              <Box rounded='14px' px='3' py='2.5' bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)'}>
                <Text fontSize='10px' color={theme.textSecondary}>
                  Command
                </Text>
                <Text mt='1' fontSize='sm' color={theme.textPrimary}>
                  {latestActionResult.command}
                </Text>
              </Box>
              <Box rounded='14px' px='3' py='2.5' bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)'}>
                <Text fontSize='10px' color={theme.textSecondary}>
                  stdout
                </Text>
                <Text mt='1' fontSize='sm' color={theme.textPrimary} whiteSpace='pre-wrap'>
                  {summarizeOutput(latestActionResult.stdout)}
                </Text>
              </Box>
              <Box rounded='14px' px='3' py='2.5' bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)'}>
                <Text fontSize='10px' color={theme.textSecondary}>
                  stderr
                </Text>
                <Text mt='1' fontSize='sm' color={theme.textPrimary} whiteSpace='pre-wrap'>
                  {summarizeOutput(latestActionResult.stderr)}
                </Text>
              </Box>
            </Stack>
          ) : null}
          {Array.isArray(latestActionResult?.errors) && latestActionResult.errors.length ? (
            <Stack spacing='2' mt='3'>
              {latestActionResult.errors.slice(0, 6).map((errorItem: any, index: number) => (
                <Box key={`${errorItem?.bangumi || errorItem?.folderName || 'error'}-${index}`} rounded='14px' px='3' py='2.5' bg={isDark ? 'rgba(127,29,29,0.22)' : 'rgba(254,226,226,0.72)'}>
                  <Text fontSize='xs' color={theme.textSecondary}>
                    {errorItem?.bangumi || errorItem?.folderName || 'Error'}
                  </Text>
                  <Text mt='1' fontSize='sm' color={theme.textPrimary}>
                    {errorItem?.error || '--'}
                  </Text>
                </Box>
              ))}
            </Stack>
          ) : null}
        </Box>
      ) : null}

      <AlertDialog isOpen={confirmDialog.isOpen} leastDestructiveRef={cancelRef} onClose={closeConfirm} isCentered>
        <AlertDialogOverlay backdropFilter='blur(10px)'>
          <AlertDialogContent
            rounded='3xl'
            bg={isDark ? 'rgba(22,28,40,0.92)' : 'rgba(245,251,253,0.96)'}
            borderWidth='1px'
            borderColor={isDark ? 'whiteAlpha.160' : 'rgba(255,255,255,0.82)'}
            boxShadow={isDark ? '0 24px 60px rgba(0,0,0,0.36)' : '0 24px 60px rgba(39,87,116,0.16)'}
          >
            <AlertDialogHeader color={theme.textPrimary}>{confirmState?.title}</AlertDialogHeader>
            <AlertDialogBody>
              <Stack spacing='3'>
                <Text color={theme.textSecondary}>{confirmState?.description}</Text>
                {confirmState?.payload ? (
                  <Box rounded='2xl' px='4' py='3.5' bg={isDark ? 'rgba(14, 20, 40, 0.84)' : 'rgba(255,255,255,0.42)'}>
                    <Text fontSize='sm' color={theme.textPrimary}>
                      预计影响：{confirmState.payload.affectedCount ?? confirmState.payload.foldersScanned ?? confirmState.payload.submittedCount ?? confirmState.payload.updatedCount ?? 0}
                    </Text>
                    {'matchedCount' in (confirmState.payload ?? {}) ? (
                      <Text mt='1.5' fontSize='sm' color={theme.textSecondary}>
                        匹配 {confirmState.payload.matchedCount ?? 0} / 未匹配 {confirmState.payload.unmatchedCount ?? 0} / 多候选 {confirmState.payload.multiCandidateCount ?? 0}
                      </Text>
                    ) : null}
                  </Box>
                ) : null}
                {confirmState?.confirmKeyword ? (
                  <Box>
                    <Text mb='2' fontSize='sm' color={theme.textSecondary}>
                      请输入 <strong>{confirmState.confirmKeyword}</strong> 以继续执行
                    </Text>
                    <Input value={confirmInput} onChange={event => setConfirmInput(event.target.value)} autoComplete='off' />
                  </Box>
                ) : null}
              </Stack>
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={closeConfirm} rounded='full' variant='ghost'>
                取消
              </Button>
              <Button
                ml='3'
                colorScheme={confirmState?.actionKey === 'reset' ? 'red' : confirmState?.actionKey === 'rebuild' ? 'orange' : 'blue'}
                rounded='full'
                onClick={handleConfirmAction}
                isDisabled={!!confirmState?.confirmKeyword && confirmInput !== confirmState.confirmKeyword}
                isLoading={executeResetMutating || executeRebuildMutating || submitDownloadsMutating || refreshMetadataMutating}
              >
                确认执行
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Stack>
  );
}
