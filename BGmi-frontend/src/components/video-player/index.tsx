import { Box, Button, Flex, HStack, Progress, Spinner, Text, useToast } from '@chakra-ui/react';
import { Select as GlassSelect } from 'chakra-react-select';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import DPlayer from 'dplayer';
import type { DPlayerOptions } from 'dplayer';
import Hls from 'hls.js';
import md5 from 'md5';

import EpisodeCard from './episode-card';
import ExternalPlayer from './external-player';

import { useColorMode } from '~/hooks/use-color-mode';
import { useVideoCurrentTime } from '~/hooks/use-watch-history';
import { createAbsoluteUrl } from '~/lib/utils';
import type { BangumiData, PlayerAsset, QualityAsset } from '~/types/bangumi';

interface Props {
  bangumiData: BangumiData;
  danmakuApi: string;
  episode: string;
  playerAsset?: PlayerAsset;
  playerAssetLoading?: boolean;
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

function subtitleLangCode(language: string) {
  const normalized = (language || '').trim().toLowerCase();
  if (!normalized) return 'und';
  if (normalized.includes('chinese') || normalized.includes('中文')) return 'zh';
  if (normalized.includes('english')) return 'en';
  if (normalized.includes('japanese')) return 'ja';
  if (normalized.includes('german')) return 'de';
  if (normalized.includes('french')) return 'fr';
  if (normalized.includes('italian')) return 'it';
  if (normalized.includes('russian')) return 'ru';
  if (normalized.includes('spanish')) return 'es';
  if (normalized.includes('arabic')) return 'ar';
  const shortCode = normalized.match(/[a-z]{2,3}/);
  return shortCode?.[0] ?? 'und';
}

function normalizeCueText(text: string) {
  const decodeEntities = (value: string) => {
    if (typeof document === 'undefined') return value;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  };

  const stripMarkup = (value: string) =>
    decodeEntities(value)
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  return text
    .split(/\r?\n/)
    .map(stripMarkup)
    .filter(Boolean);
}

function applyCustomSubtitleTrack(
  video: HTMLVideoElement,
  subtitle: { path: string; label: string; language: string } | undefined,
  onCueChange: (lines: string[]) => void
) {
  Array.from(video.querySelectorAll('track[data-bgmi-subtitle="true"]')).forEach(track => track.remove());

  for (let index = 0; index < video.textTracks.length; index += 1) {
    video.textTracks[index].mode = 'disabled';
  }

  onCueChange([]);
  if (!subtitle) return () => undefined;

  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = subtitle.label;
  track.srclang = subtitleLangCode(subtitle.language);
  track.src = `.${toBangumiAssetPath(subtitle.path)}`;
  track.default = true;
  track.dataset.bgmiSubtitle = 'true';

  let activeTrack: TextTrack | null = null;
  const syncCue = () => {
    if (!activeTrack?.activeCues?.length) {
      onCueChange([]);
      return;
    }

    const lines = Array.from(activeTrack.activeCues)
      .flatMap(cue => normalizeCueText((cue as VTTCue).text || ''));
    onCueChange(lines);
  };

  track.addEventListener('load', () => {
    activeTrack = track.track;
    if (!activeTrack) return;
    activeTrack.mode = 'hidden';
    activeTrack.oncuechange = syncCue;
    syncCue();
  });
  video.appendChild(track);

  return () => {
    if (activeTrack) {
      activeTrack.oncuechange = null;
      activeTrack.mode = 'disabled';
    }
    track.remove();
    onCueChange([]);
  };
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
      return '720p 3M';
    case '1080p':
      return '1080p 5M';
    case '1080p_TS':
      return '1080p HLS';
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

function createCustomHlsFactory(
  hls: Hls,
  fallbackUrl: string,
  toast: ReturnType<typeof useToast>,
  toastId: string
) {
  return {
    customHls(video: HTMLVideoElement) {
      if (Hls.isSupported()) {
        hls.loadSource(video.src || video.currentSrc || fallbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          void video.play();
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data.type, data.details);
          }
        });
      } else if (!toast.isActive(toastId)) {
        toast({
          title: '浏览器暂不支持 HLS，建议使用最新版 Chrome 浏览器',
          status: 'error',
          duration: 3000,
          position: 'top-right',
          id: toastId,
        });
      }
    },
  };
}

export default function VideoPlayer({
  bangumiData,
  danmakuApi,
  episode,
  playerAsset,
  playerAssetLoading = false,
  playerAssetMissing = false,
}: Props) {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const pollTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<DPlayer | null>(null);
  const restoredTimeRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState('source');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);
  const [currentSourceUrl, setCurrentSourceUrl] = useState('');
  const [currentSourceType, setCurrentSourceType] = useState('auto');
  const [subtitleLines, setSubtitleLines] = useState<string[]>([]);
  const [subtitleOverlayRoot, setSubtitleOverlayRoot] = useState<HTMLElement | null>(null);
  const [subtitleScale, setSubtitleScale] = useState({ fontSize: 18, bottomOffset: 72, lineHeight: 1.42 });
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
  const selectedSubtitleOption =
    subtitleOptions.find(option => option.value === selectedSubtitleValue) ?? subtitleOptions[0];
  const activeSubtitle =
    subtitleTracks.length > 0 && selectedSubtitleIndex >= 0
      ? subtitleTracks[selectedSubtitleIndex] || subtitleTracks[0]
      : undefined;
  const externalUrl = createAbsoluteUrl(currentSourceUrl || `.${toBangumiAssetPath(sourcePath)}`);
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
    const directOption = qualityOptions.find(item => item.profile === 'source');
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
  }, [directUrl, qualityOptions]);

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
      } catch {
        return;
      }
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

    const hls = new Hls();
    const customType = createCustomHlsFactory(hls, currentSourceUrl, toastRef.current, `HlsError-${episode}`);
    const options: DPlayerOptions = {
      container: containerRef.current,
      video: {
        url: currentSourceUrl,
        type: currentSourceType === 'customHls' || currentSourceUrl.endsWith('.m3u8') ? 'customHls' : 'auto',
        customType,
      },
      screenshot: true,
      autoplay: false,
    };

    if (danmakuApi) {
      options.danmaku = {
        id: md5(`${bangumiData.bangumi_name}-${episode}-${selectedProfile}`),
        api: danmakuApi,
      };
    }

    const dp = new DPlayer(options);
    playerRef.current = dp;
    setSubtitleOverlayRoot((containerRef.current?.querySelector('.dplayer-video-wrap') as HTMLElement | null) ?? null);
    const cleanupSubtitle = applyCustomSubtitleTrack(dp.video, activeSubtitle, setSubtitleLines);

    const handleCanPlay = () => {
      setLoading(false);
      if (!restoredTimeRef.current) {
        const currentTime = getCurrentTime();
        if (currentTime > 0) {
          dp.seek(currentTime);
        }
        restoredTimeRef.current = true;
      }
    };

    const handleTimeUpdate = () => {
      updateCurrentTime(dp.video.currentTime);
    };

    dp.video.addEventListener('canplay', handleCanPlay);
    dp.video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      playerRef.current = null;
      setSubtitleOverlayRoot(null);
      cleanupSubtitle();
      dp.video.removeEventListener('canplay', handleCanPlay);
      dp.video.removeEventListener('timeupdate', handleTimeUpdate);
      dp.destroy();
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
    const video = playerRef.current?.video;
    if (!video) return;
    return applyCustomSubtitleTrack(video, activeSubtitle, setSubtitleLines);
  }, [activeSubtitle, currentSourceUrl]);

  useEffect(() => {
    const target = subtitleOverlayRoot;
    if (!target || typeof ResizeObserver === 'undefined') return;

    const updateScale = () => {
      const width = target.clientWidth || containerRef.current?.clientWidth || 960;
      const nextFontSize = Math.max(13, Math.min(28, Math.round(width * 0.021)));
      const nextBottomOffset = Math.max(58, Math.min(110, Math.round(width * 0.055)));
      const nextLineHeight = width >= 1400 ? 1.5 : width >= 1000 ? 1.46 : 1.38;
      setSubtitleScale({
        fontSize: nextFontSize,
        bottomOffset: nextBottomOffset,
        lineHeight: nextLineHeight,
      });
    };

    updateScale();
    const observer = new ResizeObserver(() => updateScale());
    observer.observe(target);
    return () => observer.disconnect();
  }, [subtitleOverlayRoot]);

  const episodeCardProps = useMemo(
    () => ({
      totalEpisode: Object.keys(bangumiData.player),
      bangumiName: bangumiData.bangumi_name,
      currentEpisode: episode,
    }),
    [bangumiData.bangumi_name, bangumiData.player, episode]
  );
  const showAssetLoading = !currentSourceUrl && playerAssetLoading;
  const showMissingState = !currentSourceUrl && !playerAssetLoading && playerAssetMissing;
  const showPendingState = !currentSourceUrl && !playerAssetLoading && !playerAssetMissing;

  return (
    <>
      <Flex flexDirection="column" flex="1" minW="0">
        <Box
          className="bgmi-player-shell"
          rounded="2xl"
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
          minH={{ base: '16rem', xl: '26rem' }}
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
            '& .dplayer': {
              width: '100%',
              overflow: 'hidden',
            },
            '& .dplayer-video-wrap': {
              background: '#000',
            },
            '& .dplayer-controller': {
              paddingBottom: '8px',
            },
            '& .dplayer-icons-right': {
              display: 'flex',
              gap: '6px',
            },
            '& .dplayer-menu': {
              backdropFilter: 'blur(18px) saturate(165%)',
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
          <Box id="DPlayer" ref={containerRef} display={currentSourceUrl ? 'block' : 'none'} overflow="hidden" />
          {showAssetLoading ? (
            <Flex minH={{ base: '16rem', xl: '26rem' }} align="center" justify="center" direction="column" gap="3" px="6" textAlign="center">
              <Text fontSize="sm" opacity="0.82">
                正在加载播放路径和字幕信息，请稍候...
              </Text>
            </Flex>
          ) : null}
          {showMissingState ? (
            <Flex minH={{ base: '16rem', xl: '26rem' }} align="center" justify="center" direction="column" gap="3" px="6" textAlign="center">
              <Text fontSize="sm" fontWeight="600" opacity="0.9">
                当前剧集还没有可播放的视频文件
              </Text>
              <Text fontSize="sm" opacity="0.74">
                请先提交下载，或等待下载器完成后再播放。
              </Text>
            </Flex>
          ) : null}
          {showPendingState ? (
            <Flex minH={{ base: '16rem', xl: '26rem' }} align="center" justify="center" direction="column" gap="3" px="6" textAlign="center">
              <Text fontSize="sm" opacity="0.82">
                正在准备播放资源，请稍候...
              </Text>
            </Flex>
          ) : null}
        </Box>
        {subtitleOverlayRoot && subtitleLines.length > 0
          ? createPortal(
              <Flex
                className="bgmi-subtitle-overlay"
                position="absolute"
                left="0"
                right="0"
                bottom={`${subtitleScale.bottomOffset}px`}
                zIndex={12}
                px={{ base: '1rem', xl: '1.6rem' }}
                pointerEvents="none"
                justify="center"
              >
                <Box maxW="82%" textAlign="center">
                  {subtitleLines.map((line, index) => (
                    <Text
                      key={`${index}-${line}`}
                      color="white"
                      fontSize={`${subtitleScale.fontSize}px`}
                      fontWeight="500"
                      lineHeight={subtitleScale.lineHeight}
                      textShadow="-1px -1px 0 rgba(0,0,0,0.92), 1px -1px 0 rgba(0,0,0,0.92), -1px 1px 0 rgba(0,0,0,0.92), 1px 1px 0 rgba(0,0,0,0.92), 0 2px 5px rgba(0,0,0,0.45)"
                      mb="0.22rem"
                    >
                      {line}
                    </Text>
                  ))}
                </Box>
              </Flex>,
              subtitleOverlayRoot
            )
          : null}

        {qualityOptions.length > 0 || subtitleTracks.length > 0 ? (
          <Box
            mt="0"
            p="4"
            w="full"
            alignSelf="stretch"
            roundedBottom="2xl"
            bg={colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(226,239,246,0.44)'}
            borderTopWidth="1px"
            borderTopColor={colorMode === 'dark' ? 'whiteAlpha.140' : 'rgba(255,255,255,0.64)'}
            backdropFilter="blur(18px) saturate(165%)"
            position="relative"
            overflow="visible"
            _before={{
              content: '""',
              position: 'absolute',
              inset: '1px 1px auto 1px',
              h: '3.05rem',
              borderTopLeftRadius: 'inherit',
              borderTopRightRadius: 'inherit',
              pointerEvents: 'none',
              background:
                colorMode === 'dark'
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 80%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.46), rgba(210,236,245,0.10) 80%)',
            }}
          >
            <Flex gap="4" direction="column" position="relative" zIndex={1}>
              <Flex
                gap={{ base: '3.5', xl: '3' }}
                align={{ base: 'stretch', xl: 'flex-start' }}
                direction={{ base: 'column', xl: 'row' }}
              >
                <Flex flex="1" minW="0" direction="column" gap="3" maxW={controlRailWidth}>
                  {qualityOptions.length > 0 ? (
                    <HStack spacing="2" flexWrap="wrap" w="full" maxW={controlRailWidth}>
                      {qualityOptions.map(option => (
                        <Button
                          key={option.profile}
                          size="sm"
                          minH={{ base: '1.9rem', md: '2.55rem' }}
                          px={{ base: '0.72rem', md: '1.15rem' }}
                          fontSize={{ base: '0.76rem', md: '0.92rem' }}
                          rounded="full"
                          variant={selectedProfile === option.profile ? 'solid' : 'outline'}
                          colorScheme={selectedProfile === option.profile ? 'blue' : undefined}
                          borderColor={
                            selectedProfile === option.profile
                              ? undefined
                              : colorMode === 'dark'
                                ? 'whiteAlpha.300'
                                : 'rgba(255,255,255,0.82)'
                          }
                          bg={
                            selectedProfile === option.profile
                              ? undefined
                              : colorMode === 'dark'
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(255,255,255,0.26)'
                          }
                          boxShadow={
                            selectedProfile === option.profile
                              ? colorMode === 'dark'
                                ? '0 10px 22px rgba(86,163,255,0.22), inset 0 1px 0 rgba(255,255,255,0.18)'
                                : '0 10px 24px rgba(94,188,214,0.22), 0 3px 10px rgba(59,130,246,0.18), inset 0 1px 0 rgba(255,255,255,0.4)'
                              : colorMode === 'dark'
                                ? '0 8px 18px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.05)'
                                : '0 8px 18px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.38)'
                          }
                          backdropFilter="blur(16px) saturate(168%)"
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
                                  background: colorMode === 'dark' ? 'rgba(191,219,254,0.95)' : 'rgba(255,255,255,0.92)',
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

                  {subtitleTracks.length > 0 ? (
                    <Box w="full" maxW={subtitleRailWidth}>
                      <GlassSelect<SubtitleOption, false>
                        isSearchable={false}
                        options={subtitleOptions}
                        value={selectedSubtitleOption}
                        onChange={option => setSelectedSubtitleIndex(Number(option?.value ?? -1))}
                        menuPlacement="auto"
                        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                        formatOptionLabel={(option, meta) =>
                          meta.context === 'value' ? formatSubtitleOptionLabel(option.label) : option.label
                        }
                        styles={{
                          menuPortal: (base: any) => ({
                            ...base,
                            zIndex: 1700,
                          }),
                        }}
                        chakraStyles={{
                          container: provided => ({
                            ...provided,
                            w: '100%',
                          }),
                          control: provided => ({
                            ...provided,
                            minH: '2.8rem',
                            bg: colorMode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.22)',
                            borderColor:
                              colorMode === 'dark' ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.68)',
                            borderRadius: '999px',
                            boxShadow:
                              colorMode === 'dark'
                                ? '0 8px 18px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.06)'
                                : '0 8px 18px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.44)',
                            backdropFilter: 'blur(20px) saturate(170%)',
                            overflow: 'hidden',
                            cursor: 'pointer',
                          }),
                          valueContainer: provided => ({
                            ...provided,
                            py: '0.2rem',
                            px: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                          }),
                          singleValue: provided => ({
                            ...provided,
                            color: colorMode === 'dark' ? 'rgba(255,255,255,0.94)' : '#243042',
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            position: 'static',
                            transform: 'none',
                            margin: 0,
                            maxWidth: 'none',
                            lineHeight: '1.25',
                            whiteSpace: 'nowrap',
                            overflow: 'visible',
                            textOverflow: 'clip',
                          }),
                          placeholder: provided => ({
                            ...provided,
                            color: colorMode === 'dark' ? 'rgba(255,255,255,0.54)' : 'rgba(36,48,66,0.54)',
                            position: 'static',
                            transform: 'none',
                            margin: 0,
                          }),
                          inputContainer: provided => ({
                            ...provided,
                            p: 0,
                            m: 0,
                          }),
                          indicatorsContainer: provided => ({
                            ...provided,
                            pr: '0.2rem',
                            bg: 'transparent',
                          }),
                          dropdownIndicator: provided => ({
                            ...provided,
                            px: '0.7rem',
                            bg: 'transparent',
                            color: colorMode === 'dark' ? 'rgba(255,255,255,0.82)' : 'rgba(36,48,66,0.76)',
                          }),
                          indicatorSeparator: provided => ({
                            ...provided,
                            display: 'none',
                          }),
                          menu: provided => ({
                            ...provided,
                            bg: colorMode === 'dark' ? 'rgba(21,27,39,0.86)' : 'rgba(244,252,255,0.84)',
                            border: '1px solid',
                            borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.68)',
                            borderRadius: '1.1rem',
                            overflow: 'hidden',
                            boxShadow:
                              colorMode === 'dark'
                                ? '0 16px 34px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)'
                                : '0 14px 30px rgba(39,87,116,0.08), 0 4px 12px rgba(94,188,214,0.06), inset 0 1px 0 rgba(255,255,255,0.44)',
                            backdropFilter: 'blur(18px) saturate(160%)',
                          }),
                          menuList: provided => ({
                            ...provided,
                            py: '0.4rem',
                            px: '0.2rem',
                            maxH: '14rem',
                            scrollbarWidth: 'thin',
                            scrollbarColor:
                              colorMode === 'dark'
                                ? 'rgba(255,255,255,0.22) transparent'
                                : 'rgba(113,133,164,0.34) transparent',
                            '&::-webkit-scrollbar': {
                              width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                              background: 'transparent',
                            },
                            '&::-webkit-scrollbar-thumb': {
                              background: colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(113,133,164,0.30)',
                              borderRadius: '999px',
                            },
                          }),
                          option: (provided, state) => ({
                            ...provided,
                            mx: '0.25rem',
                            my: '0.12rem',
                            px: '0.85rem',
                            py: '0.72rem',
                            borderRadius: '0.9rem',
                            color: colorMode === 'dark' ? 'rgba(255,255,255,0.90)' : '#243042',
                            fontSize: '0.98rem',
                            fontWeight: state.isSelected ? 600 : 500,
                            whiteSpace: 'normal',
                            boxShadow: state.isFocused
                              ? colorMode === 'dark'
                                ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                                : 'inset 0 1px 0 rgba(255,255,255,0.36)'
                              : 'none',
                            bg: state.isFocused
                              ? colorMode === 'dark'
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(234,248,255,0.58)'
                              : state.isSelected
                                ? colorMode === 'dark'
                                  ? 'rgba(255,255,255,0.05)'
                                  : 'rgba(228,244,255,0.46)'
                                : 'transparent',
                          }),
                        }}
                      />
                    </Box>
                  ) : null}
                </Flex>

                <Box
                  flexShrink={0}
                  minW={{ base: '0', xl: 'auto' }}
                  ml={{ base: '0', xl: 'auto' }}
                  alignSelf="flex-start"
                >
                  <ExternalPlayer url={externalUrl} downloadUrl={downloadUrl} />
                </Box>
              </Flex>
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
