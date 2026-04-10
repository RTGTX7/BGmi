import { Box, Button, Flex, HStack, Progress, Select, Spinner, Text, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';

import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import Hls from 'hls.js';
import ASS from 'assjs';
import md5 from 'md5';

import EpisodeCard from './episode-card';
import ExternalPlayer from './external-player';

import { useColorMode } from '~/hooks/use-color-mode';
import { useVideoCurrentTime } from '~/hooks/use-watch-history';
import { createAbsoluteUrl } from '~/lib/utils';
import type { BangumiData, PlayerAsset, QualityAsset, SubtitleAsset } from '~/types/bangumi';

interface Props {
  bangumiData: BangumiData;
  danmakuApi: string;
  episode: string;
  playerAsset?: PlayerAsset;
  playerAssetLoading?: boolean;
  playerAssetErrorMessage?: string;
  playerAssetErrorStatus?: number;
  playerAssetMissing?: boolean;
}

interface HlsProgressState {
  active: boolean;
  profile: string;
  label: string;
  progress: number;
  stage: string;
  error: string;
}

interface QualityOption extends QualityAsset {
  profile: string;
  playUrl: string;
  isHls: boolean;
  displayName: string;
}

interface HlsStatusResponse {
  data: {
    state: string;
    progress: number;
    profile: string;
    url: string;
    error?: string;
    stage?: string;
  };
}

interface SubtitleOption {
  label: string;
  value: string;
}

function formatSubtitleOptionLabel(label: string) {
  if (!label) return '更多语言';
  if (label === '关闭字幕') return '关闭字幕';
  return `${label} · 更多语言`;
}

function usesAssRenderer(subtitle: SubtitleAsset | undefined) {
  return Boolean(subtitle?.original_path && ['ass', 'ssa'].includes((subtitle?.source_format || '').toLowerCase()));
}

function formatHlsStageLabel(stage: string) {
  switch (stage) {
    case 'queued':
      return '排队中';
    case 'running':
      return '处理中';
    case 'gpu-transcode':
      return 'GPU 转码中';
    case 'cpu-fallback':
      return 'CPU 回退处理中';
    case 'direct-segment':
      return '快速切片中';
    case 'ready':
      return '已完成';
    case 'failed':
      return '失败';
    default:
      return stage || '处理中';
  }
}

function toBangumiAssetPath(path: string) {
  if (!path) return '';
  if (path.startsWith('/bangumi/')) return path;
  return `/bangumi${path.startsWith('/') ? path : `/${path}`}`;
}

function toEncodedBangumiAssetPath(path: string) {
  const bangumiPath = toBangumiAssetPath(path);
  if (!bangumiPath) return '';

  return bangumiPath
    .split('/')
    .map((segment, index) => {
      if (index === 0 || !segment) return segment;

      try {
        return encodeURIComponent(decodeURIComponent(segment));
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

function toPlayerQualityUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('/api/')) return `.${path}`;
  return `.${toBangumiAssetPath(path)}`;
}

function extractQualityProfile(item: QualityAsset) {
  if (item.type !== 'customHls') return 'source';

  try {
    const url = new URL(item.url, 'http://localhost');
    return url.searchParams.get('profile') || item.name;
  } catch {
    return item.name;
  }
}

function formatQualityLabel(profile: string, fallback: string) {
  switch (profile) {
    case 'source':
      return 'Direct Play';
    case '720p':
      return '720p';
    case '1080p':
      return '1080p';
    case '1080p_TS':
      return 'HLS';
    default:
      return fallback;
  }
}

function qualityOrder(profile: string) {
  switch (profile) {
    case 'source':
      return 0;
    case '1080p_TS':
      return 1;
    case '1080p':
      return 2;
    case '720p':
      return 3;
    default:
      return 99;
  }
}

const controlRailWidth = { base: 'full', xl: '28rem' } as const;
const subtitleRailWidth = { base: 'full', xl: '14rem' } as const;
const playerViewportAspectRatio = { base: 16 / 9, xl: undefined } as const;

export default function VideoPlayer({
  bangumiData,
  danmakuApi,
  episode,
  playerAsset,
  playerAssetLoading = false,
  playerAssetErrorMessage,
  playerAssetErrorStatus,
  playerAssetMissing = false,
}: Props) {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const pollTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const assRendererRef = useRef<ASS | null>(null);
  const restoredTimeRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState('source');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);
  const [currentSourceUrl, setCurrentSourceUrl] = useState('');
  const [currentSourceType, setCurrentSourceType] = useState('auto');
  const [hlsProgress, setHlsProgress] = useState<HlsProgressState>({
    active: false,
    profile: '',
    label: '',
    progress: 0,
    stage: '',
    error: '',
  });

  const { updateCurrentTime, getCurrentTime } = useVideoCurrentTime(bangumiData.bangumi_name);

  const rawPath = bangumiData.player[episode]?.path ?? '';
  const sourcePath = playerAsset?.source_path ?? rawPath;
  const playbackPath = playerAsset?.browser_path ?? sourcePath;
  const directUrl = playbackPath ? `.${toBangumiAssetPath(playbackPath)}` : '';
  const subtitleTracks = useMemo(
    () => playerAsset?.subtitles ?? (playerAsset?.subtitle ? [playerAsset.subtitle] : []),
    [playerAsset]
  );
  const qualityOptions = useMemo<QualityOption[]>(
    () =>
      (playerAsset?.qualities ?? [])
        .map(item => {
          const profile = extractQualityProfile(item);
          return {
            ...item,
            profile,
            playUrl: toPlayerQualityUrl(item.url),
            isHls: item.type === 'customHls',
            displayName: formatQualityLabel(profile, item.name),
          };
        })
        .sort((a, b) => qualityOrder(a.profile) - qualityOrder(b.profile)),
    [playerAsset]
  );
  const fallbackQualityOptions = useMemo<QualityOption[]>(() => {
    if (!directUrl) return [];

    return [
      {
        name: 'Direct Play',
        url: directUrl,
        type: 'auto',
        profile: 'source',
        playUrl: directUrl,
        isHls: false,
        displayName: 'Direct Play',
      },
    ];
  }, [directUrl]);
  const displayedQualityOptions = qualityOptions.length > 0 ? qualityOptions : fallbackQualityOptions;
  const subtitleOptions = useMemo<SubtitleOption[]>(
    () => [
      { label: '关闭字幕', value: '-1' },
      ...subtitleTracks.map((track, index) => ({
        label: track.label,
        value: String(index),
      })),
    ],
    [subtitleTracks]
  );
  const defaultSubtitleIndex = useMemo(() => {
    const index = subtitleTracks.findIndex(track => track.default);
    return index >= 0 ? index : 0;
  }, [subtitleTracks]);
  const selectedSubtitleValue = selectedSubtitleIndex >= 0 ? String(selectedSubtitleIndex) : '-1';
  const activeSubtitle =
    subtitleTracks.length > 0 && selectedSubtitleIndex >= 0
      ? subtitleTracks[selectedSubtitleIndex] || subtitleTracks[0]
      : undefined;
  const isAssSubtitle = usesAssRenderer(activeSubtitle);
  const basePlaybackUrl = currentSourceUrl || directUrl;
  const externalUrl = basePlaybackUrl ? createAbsoluteUrl(basePlaybackUrl) : '';
  const downloadUrl = sourcePath ? createAbsoluteUrl(`.${toBangumiAssetPath(sourcePath)}`) : '';

  useEffect(() => {
    setSelectedSubtitleIndex(defaultSubtitleIndex);
  }, [defaultSubtitleIndex, subtitleTracks]);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  useEffect(() => {
    const directOption = displayedQualityOptions.find(item => item.profile === 'source');
    const nextUrl = directOption?.playUrl || directUrl;
    const nextType = directOption?.type || 'auto';

    setSelectedProfile('source');
    setCurrentSourceUrl(nextUrl);
    setCurrentSourceType(nextType);
    setHlsProgress({
      active: false,
      profile: '',
      label: '',
      progress: 0,
      stage: '',
      error: '',
    });
    stopPolling();
  }, [directUrl, displayedQualityOptions]);

  const pollHlsStatus = (option: QualityOption) => {
    const statusUrl = `./api/player/hls/status?bangumi=${encodeURIComponent(
      bangumiData.bangumi_name
    )}&episode=${encodeURIComponent(episode)}&profile=${encodeURIComponent(option.profile)}`;

    stopPolling();
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(statusUrl);
        if (!response.ok) return;

        const payload = (await response.json()) as HlsStatusResponse;
        const status = payload.data;

        setHlsProgress({
          active: status.state === 'running',
          profile: option.profile,
          label: option.displayName,
          progress: status.progress ?? 0,
          stage: status.stage ?? status.state,
          error: status.error ?? '',
        });

        if (status.state === 'ready' && status.url) {
          stopPolling();
          setCurrentSourceUrl(`.${status.url}`);
          setCurrentSourceType('customHls');
          setLoading(true);
          setHlsProgress({
            active: false,
            profile: option.profile,
            label: option.displayName,
            progress: 100,
            stage: 'ready',
            error: '',
          });
        }

        if (status.state === 'failed') {
          stopPolling();
          setHlsProgress({
            active: false,
            profile: option.profile,
            label: option.displayName,
            progress: 0,
            stage: 'failed',
            error: status.error ?? 'HLS 生成失败',
          });
          if (!toastRef.current.isActive(`HlsFailed-${option.profile}`)) {
            toastRef.current({
              title: 'HLS 切片失败',
              description: status.error ?? '服务器生成切片失败，已保留当前播放源。',
              status: 'error',
              duration: 5000,
              position: 'top-right',
              id: `HlsFailed-${option.profile}`,
            });
          }
        }
      } catch {}
    }, 1000);
  };

  const handleQualitySelect = async (option: QualityOption) => {
    setSelectedProfile(option.profile);

    if (!option.isHls) {
      stopPolling();
      setHlsProgress({
        active: false,
        profile: '',
        label: '',
        progress: 0,
        stage: '',
        error: '',
      });
      setCurrentSourceUrl(option.playUrl);
      setCurrentSourceType(option.type);
      setLoading(true);
      return;
    }

    setHlsProgress({
      active: true,
      profile: option.profile,
      label: option.displayName,
      progress: 0,
      stage: 'queued',
      error: '',
    });

    const startUrl = `./api/player/hls/start?bangumi=${encodeURIComponent(
      bangumiData.bangumi_name
    )}&episode=${encodeURIComponent(episode)}&profile=${encodeURIComponent(option.profile)}`;

    try {
      const response = await fetch(startUrl, { method: 'POST' });
      const payload = (await response.json()) as HlsStatusResponse;
      const status = payload.data;

      if (status.state === 'ready' && status.url) {
        setCurrentSourceUrl(`.${status.url}`);
        setCurrentSourceType('customHls');
        setLoading(true);
        setHlsProgress({
          active: false,
          profile: option.profile,
          label: option.displayName,
          progress: 100,
          stage: 'ready',
          error: '',
        });
        return;
      }

      pollHlsStatus(option);
    } catch {
      setHlsProgress({
        active: false,
        profile: option.profile,
        label: option.displayName,
        progress: 0,
        stage: 'failed',
        error: '无法启动 HLS 任务',
      });
    }
  };

  useEffect(() => {
    if (!containerRef.current || !currentSourceUrl) return;

    restoredTimeRef.current = false;
    setLoading(true);

    const isHls = currentSourceType === 'customHls' || currentSourceUrl.endsWith('.m3u8');
    const hls = new Hls();
    const toastId = `HlsError-${episode}`;

    const plugins: Artplayer['option']['plugins'] = [];
    if (danmakuApi) {
      const danmakuId = md5(`${bangumiData.bangumi_name}-${episode}-${selectedProfile}`);
      plugins.push(
        artplayerPluginDanmuku({
          danmuku: async () => {
            try {
              const resp = await fetch(
                `${danmakuApi}/v3/comment?id=${encodeURIComponent(danmakuId)}&max=100&unlimitedMax=true`,
              );
              const json = (await resp.json()) as { data?: [number, number, number, unknown, string][] } | [number, number, number, unknown, string][];
              const items = Array.isArray(json) ? json : (json.data ?? []);
              return items.map(([time, type, color, , text]) => ({
                time: Number(time),
                text: String(text),
                mode: Number(type) as 0 | 1 | 2,
                color: `#${Number(color).toString(16).padStart(6, '0').toUpperCase()}`,
              }));
            } catch {
              return [];
            }
          },
        }),
      );
    }

    const art = new Artplayer({
      container: containerRef.current,
      url: currentSourceUrl,
      type: isHls ? 'm3u8' : '',
      customType: isHls
        ? {
            m3u8: (video: HTMLVideoElement, url: string) => {
              if (Hls.isSupported()) {
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  video.play().catch(() => undefined);
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                  if (data.fatal) {
                    console.error('HLS fatal error:', data.type, data.details);
                  }
                });
              } else if (!toastRef.current.isActive(toastId)) {
                toastRef.current({
                  title: '浏览器暂不支持 HLS，建议使用最新版 Chrome 浏览器',
                  status: 'error',
                  duration: 3000,
                  position: 'top-right',
                  id: toastId,
                });
              }
            },
          }
        : {},
      screenshot: true,
      autoplay: false,
      fullscreen: true,
      setting: true,
      playbackRate: true,
      pip: true,
      lang: 'zh-cn',
      hotkey: true,
      plugins,
    });

    playerRef.current = art;

    const handleCanPlay = () => {
      setLoading(false);
      if (!restoredTimeRef.current) {
        const currentTime = getCurrentTime();
        if (currentTime > 0) {
          art.seek = currentTime;
        }
        restoredTimeRef.current = true;
      }
    };

    const handleTimeUpdate = () => {
      updateCurrentTime(art.video.currentTime);
    };

    art.video.addEventListener('canplay', handleCanPlay);
    art.video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      assRendererRef.current?.destroy();
      assRendererRef.current = null;
      playerRef.current = null;
      art.video.removeEventListener('canplay', handleCanPlay);
      art.video.removeEventListener('timeupdate', handleTimeUpdate);
      art.destroy();
      hls.destroy();
    };
  }, [
    bangumiData.bangumi_name,
    currentSourceType,
    currentSourceUrl,
    danmakuApi,
    episode,
    getCurrentTime,
    selectedProfile,
    updateCurrentTime,
  ]);

  useEffect(() => {
    const art = playerRef.current;
    assRendererRef.current?.destroy();
    assRendererRef.current = null;
    if (!art || !activeSubtitle) {
      art?.subtitle.switch('', { type: 'vtt' });
      return;
    }
    if (isAssSubtitle) {
      if (!activeSubtitle.original_path) return;
      const subUrl = createAbsoluteUrl(`.${toEncodedBangumiAssetPath(activeSubtitle.original_path)}`);
      fetch(subUrl)
        .then(res => res.text())
        .then(content => {
          if (!playerRef.current) return;
          const renderer = new ASS(content, art.video, { container: art.template.$player });
          assRendererRef.current = renderer;
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error('Failed to load ASS subtitle:', err);
        });
    } else {
      const subUrl = activeSubtitle.original_path
        ? createAbsoluteUrl(`.${toEncodedBangumiAssetPath(activeSubtitle.original_path)}`)
        : createAbsoluteUrl(`.${toEncodedBangumiAssetPath(activeSubtitle.path)}`);
      const srcFmt = (activeSubtitle.source_format || '').toLowerCase();
      const type: 'srt' | 'vtt' = srcFmt === 'srt' ? 'srt' : 'vtt';
      void art.subtitle.switch(subUrl, { type, name: activeSubtitle.label });
    }
    return () => {
      assRendererRef.current?.destroy();
      assRendererRef.current = null;
    };
  }, [activeSubtitle, currentSourceUrl, isAssSubtitle]);

  const episodeCardProps = useMemo(
    () => ({
      totalEpisode: Object.keys(bangumiData.player),
      bangumiName: bangumiData.bangumi_name,
      currentEpisode: episode,
    }),
    [bangumiData.bangumi_name, bangumiData.player, episode]
  );
  const showAssetLoading = !currentSourceUrl && playerAssetLoading;
  const showAssetError = !currentSourceUrl && !playerAssetLoading && Boolean(playerAssetErrorMessage);
  const showMissingState = !currentSourceUrl && !playerAssetLoading && playerAssetMissing;
  const showPendingState =
    !currentSourceUrl && !playerAssetLoading && !playerAssetMissing && !playerAssetErrorMessage;
  const playerShellMinH = currentSourceUrl ? { base: 'auto', xl: '26rem' } : { base: '14rem', xl: '26rem' };
  const playerStateMinH = { base: '14rem', xl: '26rem' } as const;
  const hasControlBar = displayedQualityOptions.length > 0 || subtitleTracks.length > 0 || Boolean(externalUrl);
  const isControlBarEnhancing =
    playerAssetLoading && qualityOptions.length === 0 && subtitleTracks.length === 0 && displayedQualityOptions.length > 0;
  const controlBarEnhanceError =
    playerAssetErrorMessage && displayedQualityOptions.length > 0 && qualityOptions.length === 0 && subtitleTracks.length === 0;

  return (
    <>
      <Flex flexDirection="column" flex="1" minW="0">
        <Box
          className="bgmi-player-shell"
          rounded={{ base: '1.65rem', xl: '2xl' }}
          bg={colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(226,239,246,0.52)'}
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'whiteAlpha.140' : 'rgba(255,255,255,0.68)'}
          boxShadow={
            colorMode === 'dark'
              ? '0 18px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 18px 40px rgba(31,84,110,0.10), 0 6px 16px rgba(94,188,214,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
          }
          backdropFilter="blur(22px) saturate(170%)"
          w="full"
          position="relative"
          overflow="hidden"
          minH={playerShellMinH}
          _before={{
            content: '""',
            position: 'absolute',
            inset: '1px',
            borderRadius: 'inherit',
            pointerEvents: 'none',
            background:
              colorMode === 'dark'
                ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 22%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.52), rgba(206,232,242,0.16) 22%, rgba(255,255,255,0.04) 60%)',
          }}
          sx={{
            '& .art-player': {
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              background: '#000',
            },
            '& .art-player .JASSUB': {
              position: 'absolute',
              inset: '0',
              pointerEvents: 'none',
              zIndex: 12,
            },
            '& .art-player video': {
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
            },
            '& .art-bottom': {
              paddingBottom: '4px',
            },
            '& .bgmi-subtitle-overlay': {
              zIndex: 25,
            },
          }}
        >
          <Spinner
            display={loading && currentSourceUrl ? 'block' : 'none'}
            zIndex="100"
            position="absolute"
            left="0"
            right="0"
            top="0"
            bottom="0"
            m="auto"
            color={colorMode === 'dark' ? 'white' : 'blue.500'}
          />
          <Box
            ref={containerRef}
            display={currentSourceUrl ? 'block' : 'none'}
            overflow="hidden"
            aspectRatio={playerViewportAspectRatio}
          />
          {showAssetLoading ? (
            <Flex
              minH={playerStateMinH}
              align="center"
              justify="center"
              direction="column"
              gap="3"
              px="6"
              textAlign="center"
            >
              <Text fontSize="sm" opacity="0.82">
                正在加载播放路径和字幕信息，请稍候...
              </Text>
            </Flex>
          ) : null}
          {showMissingState ? (
            <Flex
              minH={playerStateMinH}
              align="center"
              justify="center"
              direction="column"
              gap="3"
              px="6"
              textAlign="center"
            >
              <Text fontSize="sm" fontWeight="600" opacity="0.9">
                当前剧集还没有可播放的视频文件
              </Text>
              <Text fontSize="sm" opacity="0.74">
                请先提交下载，或等待下载器完成后再播放。
              </Text>
            </Flex>
          ) : null}
          {showAssetError ? (
            <Flex
              minH={playerStateMinH}
              align="center"
              justify="center"
              direction="column"
              gap="3"
              px="6"
              textAlign="center"
            >
              <Text fontSize="sm" fontWeight="600" color="red.300">
                播放资源接口异常{playerAssetErrorStatus ? ` (${playerAssetErrorStatus})` : ''}
              </Text>
              <Text fontSize="sm" opacity="0.82">
                {playerAssetErrorMessage}
              </Text>
            </Flex>
          ) : null}
          {showPendingState ? (
            <Flex
              minH={playerStateMinH}
              align="center"
              justify="center"
              direction="column"
              gap="3"
              px="6"
              textAlign="center"
            >
              <Text fontSize="sm" opacity="0.82">
                正在准备播放资源，请稍候...
              </Text>
            </Flex>
          ) : null}
        </Box>
        {hasControlBar ? (
          <Box
            mt={{ base: '2.5', xl: '2.75' }}
            p={{ base: '2.5', md: '3.5' }}
            w="full"
            alignSelf="stretch"
            rounded={{ base: '1.5rem', xl: '1.75rem' }}
            bg={colorMode === 'dark' ? 'rgba(20,26,38,0.72)' : 'rgba(239,247,250,0.9)'}
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(203,222,229,0.9)'}
            backdropFilter="blur(10px) saturate(135%)"
            boxShadow={
              colorMode === 'dark'
                ? '0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 14px 30px rgba(58,98,110,0.08), inset 0 1px 0 rgba(255,255,255,0.46)'
            }
            position="relative"
            overflow="visible"
          >
            <Flex gap={{ base: '2', xl: '4' }} direction="column" position="relative" zIndex={1}>
              {isControlBarEnhancing ? (
                <Text fontSize="sm" color={colorMode === 'dark' ? 'whiteAlpha.760' : 'rgba(36,48,66,0.76)'}>
                  正在检查字幕并准备更多画质...
                </Text>
              ) : null}
              {controlBarEnhanceError ? (
                <Text fontSize="sm" color={colorMode === 'dark' ? 'orange.200' : 'orange.600'}>
                  字幕或 HLS 画质信息暂未返回，当前先使用 Direct Play。
                </Text>
              ) : null}

              {/* Row 1: quality buttons + external player icons on the same line */}
              <Flex align="center" gap={{ base: '2', xl: '3' }} wrap="wrap">
                {displayedQualityOptions.length > 0 ? (
                  <HStack spacing="2" flexWrap="wrap" flex="1" minW="0">
                    {displayedQualityOptions.map(option => (
                      <Button
                        key={option.profile}
                        size="sm"
                        minH={{ base: '1.78rem', md: '2.55rem' }}
                        px={{ base: '0.68rem', md: '1.15rem' }}
                        fontSize={{ base: '0.72rem', md: '0.92rem' }}
                        rounded="full"
                        variant={selectedProfile === option.profile ? 'solid' : 'outline'}
                        colorScheme={selectedProfile === option.profile ? 'blue' : undefined}
                        borderColor={
                          selectedProfile === option.profile
                            ? undefined
                            : colorMode === 'dark'
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(174,200,210,0.92)'
                        }
                        bg={
                          selectedProfile === option.profile
                            ? undefined
                            : colorMode === 'dark'
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(255,255,255,0.72)'
                        }
                        boxShadow={
                          selectedProfile === option.profile
                            ? colorMode === 'dark'
                              ? '0 10px 22px rgba(86,163,255,0.22), inset 0 1px 0 rgba(255,255,255,0.18)'
                              : '0 10px 24px rgba(94,188,214,0.18), 0 3px 10px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.38)'
                            : colorMode === 'dark'
                            ? '0 6px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04)'
                            : '0 6px 14px rgba(39,87,116,0.05), inset 0 1px 0 rgba(255,255,255,0.34)'
                        }
                        backdropFilter="blur(8px) saturate(140%)"
                        position="relative"
                        _after={
                          selectedProfile === option.profile
                            ? {
                                content: '""',
                                position: 'absolute',
                                left: '18%',
                                right: '18%',
                                bottom: '0.28rem',
                                height: '2px',
                                borderRadius: '999px',
                                background:
                                  colorMode === 'dark' ? 'rgba(191,219,254,0.95)' : 'rgba(255,255,255,0.92)',
                              }
                            : undefined
                        }
                        onClick={() => void handleQualitySelect(option)}
                      >
                        {option.displayName}
                      </Button>
                    ))}
                  </HStack>
                ) : null}

                <Box flexShrink={0} ml={displayedQualityOptions.length > 0 ? 'auto' : undefined}>
                  <ExternalPlayer url={externalUrl} downloadUrl={downloadUrl} />
                </Box>
              </Flex>

              {/* Row 2: subtitle selector full width */}
              {subtitleTracks.length > 0 ? (
                <Box w="full" maxW={subtitleRailWidth}>
                  <Select
                    value={selectedSubtitleValue}
                    onChange={e => setSelectedSubtitleIndex(Number(e.target.value))}
                    size="sm"
                    borderRadius="999px"
                    bg={colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)'}
                    borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(174,200,210,0.92)'}
                    color={colorMode === 'dark' ? 'rgba(255,255,255,0.94)' : '#243042'}
                    fontWeight={600}
                    fontSize="0.86rem"
                    h="2.55rem"
                    cursor="pointer"
                    sx={{
                      backdropFilter: 'blur(8px) saturate(145%)',
                      boxShadow:
                        colorMode === 'dark'
                          ? '0 6px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
                          : '0 6px 14px rgba(39,87,116,0.05), inset 0 1px 0 rgba(255,255,255,0.40)',
                    }}
                  >
                    {subtitleOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value === selectedSubtitleValue
                          ? formatSubtitleOptionLabel(opt.label)
                          : opt.label}
                      </option>
                    ))}
                  </Select>
                </Box>
              ) : null}
            </Flex>
          </Box>
        ) : null}

        {hlsProgress.active ? (
          <Box
            mt="3"
            p="3.5"
            rounded="2xl"
            bg={colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.58)'}
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'whiteAlpha.140' : 'whiteAlpha.900'}
            backdropFilter="blur(18px) saturate(165%)"
            boxShadow={
              colorMode === 'dark'
                ? '0 14px 30px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'
                : '0 14px 30px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.48)'
            }
          >
            <Text mb="2" fontSize="sm" color={colorMode === 'dark' ? 'blue.200' : 'blue.700'}>
              服务器正在优化 {hlsProgress.label}，当前阶段：{formatHlsStageLabel(hlsProgress.stage || 'running')}
            </Text>
            <Progress value={hlsProgress.progress} size="sm" rounded="md" colorScheme="blue" />
            <Text mt="1" fontSize="xs" opacity="0.8">
              {hlsProgress.progress.toFixed(1)}%
            </Text>
          </Box>
        ) : null}

        {hlsProgress.error ? (
          <Text mt="3" fontSize="sm" color="red.400">
            {hlsProgress.error}
          </Text>
        ) : null}
      </Flex>
      <EpisodeCard flexShrink={0} setPlayState={() => undefined} bangumiData={episodeCardProps} />
    </>
  );
}
