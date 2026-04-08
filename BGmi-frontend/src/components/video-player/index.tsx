import { Box, Button, Flex, HStack, Progress, Spinner, Text, useToast } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';

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

function createCustomHlsFactory(hls: Hls, fallbackUrl: string, toast: ReturnType<typeof useToast>, toastId: string) {
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
          title: '浏览器不支持 HLS，建议使用最新版 Chrome 浏览器',
          status: 'error',
          duration: 3000,
          position: 'top-right',
          id: toastId,
        });
      }
    },
  };
}

export default function VideoPlayer({ bangumiData, danmakuApi, episode, playerAsset }: Props) {
  const { colorMode } = useColorMode();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const pollTimerRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const restoredTimeRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState('source');
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
  const defaultSubtitleIndex = useMemo(() => {
    const index = subtitleTracks.findIndex(track => track.default);
    return index >= 0 ? index : 0;
  }, [subtitleTracks]);
  const externalUrl = createAbsoluteUrl(currentSourceUrl || `.${toBangumiAssetPath(sourcePath)}`);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  useEffect(() => {
    if (rawPath || toastRef.current.isActive(episode)) return;

    toastRef.current({
      title: '视频文件不存在',
      status: 'error',
      duration: 3000,
      position: 'top-right',
      id: episode,
    });
  }, [episode, rawPath]);

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

    if (subtitleTracks.length > 0) {
      const activeSubtitle = subtitleTracks[defaultSubtitleIndex] || subtitleTracks[0];
      options.subtitle = {
        url: `.${toBangumiAssetPath(activeSubtitle.path)}`,
        type: 'webvtt',
        fontSize: '20px',
        bottom: '10%',
        color: '#fff',
      };
    }

    if (danmakuApi) {
      options.danmaku = {
        id: md5(`${bangumiData.bangumi_name}-${episode}-${selectedProfile}`),
        api: danmakuApi,
      };
    }

    const dp = new DPlayer(options);

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
    defaultSubtitleIndex,
    episode,
    getCurrentTime,
    selectedProfile,
    subtitleTracks,
    updateCurrentTime,
  ]);

  const episodeCardProps = useMemo(
    () => ({
      totalEpisode: Object.keys(bangumiData.player),
      bangumiName: bangumiData.bangumi_name,
      currentEpisode: episode,
    }),
    [bangumiData.bangumi_name, bangumiData.player, episode]
  );

  return (
    <>
      <Flex flexDirection="column">
        <Box
          p="4"
          rounded="4"
          bg={colorMode === 'dark' ? 'whiteAlpha.200' : 'blackAlpha.200'}
          boxShadow="base"
          transition=".5s width"
          w="full"
          position="relative"
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
            color="white"
          />
          <Box id="DPlayer" ref={containerRef} display={currentSourceUrl ? 'block' : 'none'} />
        </Box>
        {qualityOptions.length > 0 ? (
          <HStack mt="3" spacing="1" flexWrap="wrap">
            {qualityOptions.map(option => (
              <Button
                key={option.profile}
                size="sm"
                variant={selectedProfile === option.profile ? 'solid' : 'outline'}
                colorScheme={selectedProfile === option.profile ? 'blue' : undefined}
                onClick={() => void handleQualitySelect(option)}
              >
                {option.displayName}
              </Button>
            ))}
          </HStack>
        ) : null}
        {hlsProgress.active ? (
          <Box mt="3">
            <Text mb="2" fontSize="sm" color={colorMode === 'dark' ? 'blue.200' : 'blue.700'}>
              服务器正在优化 {hlsProgress.label}，当前阶段: {hlsProgress.stage || 'running'}
            </Text>
            <Progress value={hlsProgress.progress} size="sm" rounded="md" colorScheme="blue" />
            <Text mt="1" fontSize="xs" opacity="0.8">
              {hlsProgress.progress.toFixed(1)}%
            </Text>
          </Box>
        ) : null}
        {!currentSourceUrl ? (
          <Text mt="3" fontSize="sm" opacity="0.8">
            正在加载播放路径和字幕信息，请稍候...
          </Text>
        ) : null}
        {hlsProgress.error ? (
          <Text mt="3" fontSize="sm" color="red.400">
            {hlsProgress.error}
          </Text>
        ) : null}
        <ExternalPlayer url={externalUrl} />
      </Flex>
      <EpisodeCard boxShadow="base" setPlayState={() => undefined} bangumiData={episodeCardProps} />
    </>
  );
}
