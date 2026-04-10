import { Box, Button, Flex, HStack, Progress, Spinner, Text, useToast } from '@chakra-ui/react';
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

function usesAssRenderer(subtitle: SubtitleAsset | undefined) {
  const fmt = (subtitle?.source_format || subtitle?.format || '').toLowerCase();
  return Boolean(subtitle?.original_path && ['ass', 'ssa'].includes(fmt));
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
      return '原画';
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
  const [artMountSeq, setArtMountSeq] = useState(0);
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
  const defaultSubtitleIndex = useMemo(() => {
    const index = subtitleTracks.findIndex(track => track.default);
    return index >= 0 ? index : 0;
  }, [subtitleTracks]);
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
    setArtMountSeq(n => n + 1);

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


    const isMobile = /mobile|android|iphone|ipad|ipod|phone|touch/i.test(navigator.userAgent);
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressActive = false;
    const LONG_PRESS_MS = 500;
    const LONG_PRESS_RATE = 2;
    let lastTap = 0;

    // 桌面端长按 2x
    const onPressStart = (e: PointerEvent) => {
      if (isMobile) return;
      longPressTimer = setTimeout(() => {
        longPressActive = true;
        art.playbackRate = LONG_PRESS_RATE;
        art.notice.show = '2x 倍速';
      }, LONG_PRESS_MS);
    };
    const onPressEnd = (e: PointerEvent) => {
      if (isMobile) return;
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (longPressActive) {
        longPressActive = false;
        art.playbackRate = 1;
        art.notice.show = '正常速度';
      }
    };
    const onContextMenu = (e: Event) => {
      if (isMobile) {
        e.preventDefault();
        return;
      }
      if (longPressActive) e.preventDefault();
    };
    art.video.addEventListener('pointerdown', onPressStart);
    art.video.addEventListener('pointerup', onPressEnd);
    art.video.addEventListener('pointerleave', onPressEnd);
    art.video.addEventListener('pointercancel', onPressEnd);
    art.video.addEventListener('contextmenu', onContextMenu);
    // Prevent long-press menu on mobile
    art.video.addEventListener('touchstart', e => isMobile && e.preventDefault(), { passive: false });
    art.video.addEventListener('touchend', e => isMobile && e.preventDefault(), { passive: false });

    // 移动端双击切换 2x/1x
    const onMobileDoubleTap = (e: TouchEvent) => {
      if (!isMobile) return;
      const now = Date.now();
      if (now - lastTap < 400) {
        // 双击
        if (art.playbackRate === 1) {
          art.playbackRate = 2;
          art.notice.show = '2x 倍速';
        } else {
          art.playbackRate = 1;
          art.notice.show = '正常速度';
        }
        lastTap = 0;
        e.preventDefault();
      } else {
        lastTap = now;
      }
    };
    art.video.addEventListener('touchend', onMobileDoubleTap, { passive: false });

    return () => {
      if (longPressTimer !== null) clearTimeout(longPressTimer);
      assRendererRef.current?.destroy();
      assRendererRef.current = null;
      playerRef.current = null;
      setArtMountSeq(n => n + 1);
      art.video.removeEventListener('canplay', handleCanPlay);
      art.video.removeEventListener('timeupdate', handleTimeUpdate);
      art.video.removeEventListener('pointerdown', onPressStart);
      art.video.removeEventListener('pointerup', onPressEnd);
      art.video.removeEventListener('pointerleave', onPressEnd);
      art.video.removeEventListener('pointercancel', onPressEnd);
      art.video.removeEventListener('contextmenu', onContextMenu);
      art.video.removeEventListener('touchstart', e => isMobile && e.preventDefault());
      art.video.removeEventListener('touchend', e => isMobile && e.preventDefault());
      art.video.removeEventListener('touchend', onMobileDoubleTap);
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
      const subPath = activeSubtitle.original_path ?? activeSubtitle.path;
      const subUrl = createAbsoluteUrl(`.${toEncodedBangumiAssetPath(subPath)}`);
      const srcFmt = (activeSubtitle.source_format || activeSubtitle.format || '').toLowerCase();
      const type: 'srt' | 'vtt' = srcFmt === 'srt' ? 'srt' : 'vtt';
      void art.subtitle.switch(subUrl, { type, name: activeSubtitle.label });
    }
    return () => {
      assRendererRef.current?.destroy();
      assRendererRef.current = null;
    };
  }, [activeSubtitle, artMountSeq, isAssSubtitle]); // artMountSeq instead of currentSourceUrl to avoid double-run when both change simultaneously

  // Sync subtitle selector into ArtPlayer settings panel
  useEffect(() => {
    const art = playerRef.current;
    if (!art) return;
    try { art.setting.remove('切换字幕'); } catch {}
    if (subtitleTracks.length === 0) return;
    art.setting.add({
      html: '切换字幕',
      selector: [
        { html: '关闭', default: selectedSubtitleIndex < 0, trackIndex: -1 } as Record<string, unknown>,
        ...subtitleTracks.map((t, i) => ({ html: t.label, default: i === selectedSubtitleIndex, trackIndex: i }) as Record<string, unknown>),
      ] as import('artplayer/types/setting').Setting[],
      onSelect(item) {
        setSelectedSubtitleIndex((item as unknown as { trackIndex: number }).trackIndex);
        return item.html as string;
      },
    });
  }, [artMountSeq, subtitleTracks]); // eslint-disable-line react-hooks/exhaustive-deps

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

          {/* Quality selector overlay — top-right inside player, only when multiple options */}
          {currentSourceUrl && displayedQualityOptions.length > 1 ? (
            <HStack
              position="absolute"
              top="2.5"
              right="2.5"
              spacing="1.5"
              zIndex={20}
              pointerEvents="auto"
            >
              {displayedQualityOptions.map(option => {
                const isActive = selectedProfile === option.profile;
                const isProcessing = hlsProgress.active && hlsProgress.profile === option.profile;
                return (
                  <Button
                    key={option.profile}
                    size="xs"
                    rounded="full"
                    onClick={() => void handleQualitySelect(option)}
                    bg={isActive ? 'rgba(59,130,246,0.88)' : 'rgba(0,0,0,0.58)'}
                    color="white"
                    borderWidth="1px"
                    borderColor={isActive ? 'rgba(147,197,253,0.65)' : 'rgba(255,255,255,0.28)'}
                    _hover={{ bg: isActive ? 'rgba(59,130,246,1)' : 'rgba(0,0,0,0.74)' }}
                    px={{ base: '1.5', md: '2' }}
                    minH={{ base: '1.3rem', md: '1.5rem' }}
                    fontSize={{ base: '0.65rem', md: '0.7rem' }}
                    fontWeight={600}
                    backdropFilter="blur(10px)"
                    leftIcon={isProcessing ? <Spinner size="xs" /> : undefined}
                  >
                    {isProcessing ? `${hlsProgress.progress.toFixed(0)}%` : option.displayName}
                  </Button>
                );
              })}
            </HStack>
          ) : null}

          {/* HLS progress overlay — bottom of player above ArtPlayer controls */}
          {hlsProgress.active ? (
            <Box
              position="absolute"
              bottom="14"
              left="3"
              right="3"
              zIndex={20}
              bg="rgba(0,0,0,0.70)"
              rounded="lg"
              px="3"
              py="2"
              backdropFilter="blur(12px)"
            >
              <Flex align="center" gap="2" mb="1.5">
                <Text color="rgba(191,219,254,0.95)" fontSize="xs" flex="1" fontWeight={500}>
                  {hlsProgress.label} · {formatHlsStageLabel(hlsProgress.stage || 'running')}
                </Text>
                <Text color="rgba(191,219,254,0.95)" fontSize="xs" fontWeight={700}>
                  {hlsProgress.progress.toFixed(0)}%
                </Text>
              </Flex>
              <Progress value={hlsProgress.progress} size="xs" rounded="full" colorScheme="blue" />
            </Box>
          ) : null}

          {/* HLS error overlay */}
          {hlsProgress.error && !hlsProgress.active ? (
            <Box
              position="absolute"
              bottom="14"
              left="3"
              right="3"
              zIndex={20}
              bg="rgba(127,29,29,0.82)"
              rounded="lg"
              px="3"
              py="1.5"
              backdropFilter="blur(12px)"
            >
              <Text color="rgba(252,165,165,0.95)" fontSize="xs">
                {hlsProgress.error}
              </Text>
            </Box>
          ) : null}
        </Box>

        {externalUrl ? (
          <Flex justify="flex-end" mt="2" px="0.5">
            <ExternalPlayer url={externalUrl} downloadUrl={downloadUrl} />
          </Flex>
        ) : null}
      </Flex>
      <EpisodeCard flexShrink={0} setPlayState={() => undefined} bangumiData={episodeCardProps} />
    </>
  );
}
