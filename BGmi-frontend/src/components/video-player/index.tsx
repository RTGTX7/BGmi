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
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Progress,
  Spinner,
  Text,
  useToast,
} from '@chakra-ui/react';
import { getCookie } from 'cookies-next';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiChevronDown, FiExternalLink } from 'react-icons/fi';
import useSWR from 'swr';

import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import Hls from 'hls.js';
import md5 from 'md5';

import { artplayerAssPlugin } from './artplayer-ass-plugin';
import EpisodeCard from './episode-card';
import ExternalPlayer from './external-player';

import { useColorMode } from '~/hooks/use-color-mode';
import { useAccentTheme } from '~/hooks/use-accent-theme';
import { useVideoCurrentTime } from '~/hooks/use-watch-history';
import { fetcherWithMutation, fetcherWithTimeout } from '~/lib/fetcher';
import {
  getLiquidGlassButtonStyles,
  getLiquidGlassGroupStyles,
  getLiquidGlassStyles,
  useLongPressDragSelect,
} from '~/lib/liquid-glass';
import { buildMediaUrl, createAbsoluteUrl, isBrowser } from '~/lib/utils';
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
  playerGroup?: string;
  activeGroup?: string;
  onGroupSelect?: (group: string) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
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
  const subtitleFormat = (subtitle?.format || subtitle?.source_format || '').toLowerCase();
  return ['ass', 'ssa'].includes(subtitleFormat);
}

function isIOSLike() {
  if (!isBrowser) return false;
  const userAgent = navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(userAgent) || (userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function getNativeSubtitleType(subtitle: SubtitleAsset | undefined) {
  const subtitleFormat = (subtitle?.format || subtitle?.source_format || '').toLowerCase();
  if (subtitleFormat === 'srt' || subtitleFormat === 'subrip') return 'srt';
  if (subtitleFormat === 'ass' || subtitleFormat === 'ssa') return 'ass';
  if (subtitleFormat === 'vtt' || subtitleFormat === 'webvtt') return 'vtt';

  const subtitlePath = (subtitle?.path || subtitle?.original_path || '').toLowerCase();
  if (subtitlePath.endsWith('.srt')) return 'srt';
  if (subtitlePath.endsWith('.ass') || subtitlePath.endsWith('.ssa')) return 'ass';

  return 'vtt';
}

function toSubtitleCssStyle(renderStyle?: SubtitleAsset['render_style']) {
  const style: Partial<CSSStyleDeclaration> = {};

  if (renderStyle?.font_family) {
    style.fontFamily = renderStyle.font_family;
  }
  if (typeof renderStyle?.font_weight !== 'undefined') {
    style.fontWeight = String(renderStyle.font_weight);
  }
  if (renderStyle?.font_style) {
    style.fontStyle = renderStyle.font_style;
  }

  return style;
}

function getResponsiveSubtitleFontSize(width: number, height?: number, fullscreen?: boolean) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 960;
  const safeHeight = Number.isFinite(height) && (height ?? 0) > 0 ? (height as number) : safeWidth * 0.5625;
  const widthSize = safeWidth * 0.026;
  const heightSize = safeHeight * 0.04;
  const baseSize = Math.max(widthSize, heightSize);
  const boostedSize = fullscreen ? baseSize * 1.1 : baseSize;

  return `${Math.max(16, Math.min(fullscreen ? 42 : 34, Math.round(boostedSize)))}px`;
}

function buildNativeSubtitleStyle(
  renderStyle: SubtitleAsset['render_style'] | undefined,
  width: number,
  height?: number,
  fullscreen?: boolean
) {
  return {
    ...toSubtitleCssStyle(renderStyle),
    fontSize: getResponsiveSubtitleFontSize(width, height, fullscreen),
  } as Partial<CSSStyleDeclaration>;
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

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

const SEEK_SENSITIVITY = 0.04;

function getSwipeSeekOffset(deltaX: number) {
  const distance = Math.abs(deltaX);
  const ramp = Math.min(distance / 120, 1);
  const easedRamp = ramp * ramp * (3 - 2 * ramp);
  const fineOffset = distance * SEEK_SENSITIVITY * (0.55 + 0.45 * easedRamp);
  const sustainedDistance = Math.max(0, distance - 160);
  const acceleration = 0.00015 * sustainedDistance * sustainedDistance;
  return Math.sign(deltaX) * (fineOffset + acceleration);
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

function toPlayerQualityUrl(path: string, mediaOrigin?: string) {
  if (!path) return '';
  if (path.startsWith('/api/')) return `.${path}`;
  return buildMediaUrl(toBangumiAssetPath(path), mediaOrigin);
}

function toMediaPath(path: string) {
  if (!path) return '';
  const normalized = path.startsWith('.') ? path.slice(1) : path;
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
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
      return '源';
    case 'range':
      return 'HRR';
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
    case 'range':
      return 1;
    case '1080p_TS':
      return 2;
    case '1080p':
      return 3;
    case '720p':
      return 4;
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
  playerGroup = '',
  activeGroup = '',
  onGroupSelect,
  onEnded,
  autoPlay = false,
}: Props) {
  const { colorMode } = useColorMode();
  const { colors } = useAccentTheme();
  const toast = useToast();
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const pollTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Artplayer | null>(null);
  const subtitleRequestRef = useRef(0);
  const restoredTimeRef = useRef(false);
  const subtitleWidthRef = useRef(960);
  const subtitleHeightRef = useRef(540);
  const autoHlsKeyRef = useRef('');
  const longPressTimerRef = useRef<number | null>(null);
  const longPressPointerIdRef = useRef<number | null>(null);
  const longPressActivatedRef = useRef(false);
  const longPressStartRateRef = useRef(1);
  const longPressStartPointRef = useRef<{ x: number; y: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [artMountSeq, setArtMountSeq] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showLongPressIndicator, setShowLongPressIndicator] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState('source');
  const [autoProtocolActive, setAutoProtocolActive] = useState(true);
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);
  const [currentSourceUrl, setCurrentSourceUrl] = useState('');
  const [currentSourceType, setCurrentSourceType] = useState('auto');
  const [localVideoProbe, setLocalVideoProbe] = useState<{ url: string; status: 'none' | 'checking' | 'connected' | 'unavailable' }>({ url: '', status: 'none' });
  const [readySourceUrl, setReadySourceUrl] = useState('');
  const [hlsProgress, setHlsProgress] = useState<HlsProgressState>({
    active: false,
    profile: '',
    label: '',
    progress: 0,
    stage: '',
    error: '',
  });

  const authToken = getCookie('authToken') as string | undefined;
  const missingEpisodesCancelRef = useRef<HTMLButtonElement | null>(null);
  const [missingEpisodesDialogOpen, setMissingEpisodesDialogOpen] = useState(false);
  const [missingEpisodesLoading, setMissingEpisodesLoading] = useState(false);
  const [hasMissingEpisodes, setHasMissingEpisodes] = useState(Boolean(bangumiData.hasMissingEpisodes));

  const { updateCurrentTime, getCurrentTime } = useVideoCurrentTime(bangumiData.bangumi_name);
  const { data: overview } = useSWR<{ data: { synopsis: string; mikanId: string } }>(
    bangumiData.bangumi_name
      ? `/api/player/overview?bangumi=${encodeURIComponent(bangumiData.bangumi_name)}`
      : null,
    (key: string) => fetcherWithTimeout([key], {}, 60000),
    { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false }
  );

  const rawPath = bangumiData.player_versions?.[episode]?.find(version => version.group === playerGroup)?.path
    ?? bangumiData.player[episode]?.path ?? '';
  const episodeVersions = bangumiData.player_versions?.[episode] ?? [];
  const identifiedVersions = episodeVersions.filter(version => version.groupSource === 'mikan');
  const fileVersions = episodeVersions.filter(version => version.groupSource !== 'mikan');
  const sourcePath = playerAsset?.source_path ?? rawPath;
  const playbackPath = playerAsset?.browser_path ?? sourcePath;
  const routing = playerAsset?.localMediaRouting;
  const configuredOrigin = routing?.localMediaOrigin?.replace(/\/+$/, '') || '';
  const browserHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const configuredHosts = (routing?.localEntryHosts ?? []).map(host => host.toLowerCase().split(':')[0]);
  const originHost = configuredOrigin ? new URL(configuredOrigin).hostname.toLowerCase() : '';
  const isConfiguredLocalHost = Boolean(browserHost && (configuredHosts.includes(browserHost) || browserHost === originHost));
  const mediaOrigin = playerAsset?.mediaOrigin || (routing?.enabled && isConfiguredLocalHost ? configuredOrigin : '');
  const localRoutingEnabled = Boolean(routing?.enabled);
  const localDirectUrl = playbackPath && mediaOrigin ? buildMediaUrl(toBangumiAssetPath(playbackPath), mediaOrigin) : '';
  const localProbeStatus = localVideoProbe.url === localDirectUrl ? localVideoProbe.status : 'checking';
  const effectiveMediaOrigin = localDirectUrl && localProbeStatus === 'connected' ? mediaOrigin : undefined;
  const directUrl = playbackPath ? buildMediaUrl(toBangumiAssetPath(playbackPath), effectiveMediaOrigin) : '';
  const isPlayingLocalSource = Boolean(
    mediaOrigin && currentSourceUrl && readySourceUrl === currentSourceUrl && currentSourceUrl.startsWith(`${mediaOrigin}/`)
  );
  // Show the LAN server state as soon as the Range probe succeeds; waiting for
  // ArtPlayer's ready event made the indicator disappear during startup.
  const localVideoStatus = !localRoutingEnabled
    ? 'disabled'
    : !localDirectUrl || localProbeStatus === 'checking'
    ? 'unavailable'
    : localProbeStatus === 'connected' && (isPlayingLocalSource || !currentSourceUrl)
      ? 'connected'
      : 'unavailable';

  useEffect(() => {
    if (!localDirectUrl || !mediaOrigin) {
      setLocalVideoProbe({ url: '', status: 'none' });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    setLocalVideoProbe({ url: localDirectUrl, status: 'checking' });
    fetch(localDirectUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(response => {
        if (!controller.signal.aborted) setLocalVideoProbe({ url: localDirectUrl, status: response.ok || response.status === 206 ? 'connected' : 'unavailable' });
        void response.body?.cancel().catch(() => undefined);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLocalVideoProbe({ url: localDirectUrl, status: 'unavailable' });
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [localDirectUrl, mediaOrigin]);
  const subtitleTracks = useMemo(
    () => playerAsset?.subtitles ?? (playerAsset?.subtitle ? [playerAsset.subtitle] : []),
    [playerAsset]
  );
  const iosLike = isIOSLike();
  // Safari/iOS has unreliable direct Range playback for several container and
  // codec combinations, so automatic mode prefers original HLS on Apple
  // devices regardless of whether subtitles are present.
  const shouldPreferHlsOnIOS = iosLike;
  const qualityOptions = useMemo<QualityOption[]>(
    () =>
      (playerAsset?.qualities ?? [])
        .map(item => {
          const profile = extractQualityProfile(item);
          return {
            ...item,
            profile,
            playUrl: toPlayerQualityUrl(item.type === 'customHls' && playerGroup ? `${item.url}&player_group=${encodeURIComponent(playerGroup)}` : item.url, effectiveMediaOrigin),
            isHls: item.type === 'customHls',
            displayName: formatQualityLabel(profile, item.name),
          };
        })
        .sort((a, b) => qualityOrder(a.profile) - qualityOrder(b.profile)),
    [effectiveMediaOrigin, playerAsset, playerGroup]
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
  const baseQualityOptions = qualityOptions.length > 0 ? qualityOptions : fallbackQualityOptions;
  const visibleQualityOptions = playerAsset?.advancedHlsQualities
    ? baseQualityOptions
    : baseQualityOptions.filter(option => !['1080p', '720p'].includes(option.profile));
  const displayedQualityOptions = useMemo(() => {
    const source = visibleQualityOptions.find(option => option.profile === 'source');
    if (!source || visibleQualityOptions.some(option => option.profile === 'range')) return visibleQualityOptions;
    return [
      source,
      { ...source, name: 'HTTP Range', profile: 'range', displayName: 'HRR', type: 'range' },
      ...visibleQualityOptions.filter(option => option.profile !== 'source'),
    ];
  }, [visibleQualityOptions]);
  const qualityByProfile = useMemo(
    () => new Map(displayedQualityOptions.map(option => [option.profile, option])),
    [displayedQualityOptions]
  );
  const qualityDragSelect = useLongPressDragSelect(profile => {
    const option = qualityByProfile.get(profile);
    if (option) void handleQualitySelect(option);
  });
  const iosPreferredHlsOption = useMemo(
    () => (shouldPreferHlsOnIOS ? displayedQualityOptions.find(item => item.profile === '1080p_TS') : undefined),
    [displayedQualityOptions, shouldPreferHlsOnIOS]
  );
  const defaultSubtitleIndex = useMemo(() => {
    const index = subtitleTracks.findIndex(track => track.default);
    return index >= 0 ? index : 0;
  }, [subtitleTracks]);
  const activeSubtitle =
    subtitleTracks.length > 0 && selectedSubtitleIndex >= 0
      ? subtitleTracks[selectedSubtitleIndex] || subtitleTracks[0]
      : undefined;
  const isAssSubtitle = usesAssRenderer(activeSubtitle);
  const shouldUseAssWebFullscreen = iosLike && Boolean(activeSubtitle);
  const activeNativeSubtitleType = getNativeSubtitleType(activeSubtitle);
  const activeNativeSubtitlePath =
    activeSubtitle && !isAssSubtitle
      ? buildMediaUrl(toEncodedBangumiAssetPath(activeSubtitle.path), effectiveMediaOrigin)
      : '';
  const activeNativeSubtitleStyle = buildNativeSubtitleStyle(
    activeSubtitle?.render_style,
    subtitleWidthRef.current,
    subtitleHeightRef.current
  );
  const basePlaybackUrl = currentSourceUrl || directUrl;
  const externalUrl = basePlaybackUrl
    ? /^https?:\/\//i.test(basePlaybackUrl)
      ? basePlaybackUrl
      : basePlaybackUrl.startsWith('./api/')
      ? createAbsoluteUrl(basePlaybackUrl)
      : buildMediaUrl(toMediaPath(basePlaybackUrl), effectiveMediaOrigin)
    : '';
  const downloadUrl = sourcePath ? buildMediaUrl(toBangumiAssetPath(sourcePath), effectiveMediaOrigin) : '';

  const toolButtonBg = colorMode === 'light' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.06)';
  const toolButtonBorder = colorMode === 'light' ? 'rgba(255,255,255,0.72)' : 'whiteAlpha.300';
  const toolButtonShadow =
    colorMode === 'light'
      ? '0 8px 18px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.42)'
      : '0 8px 18px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.05)';

  useEffect(() => {
    setSelectedSubtitleIndex(defaultSubtitleIndex);
  }, [defaultSubtitleIndex, subtitleTracks]);


  useEffect(() => {
    setHasMissingEpisodes(Boolean(bangumiData.hasMissingEpisodes));
  }, [bangumiData.hasMissingEpisodes]);

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    setSelectedProfile('source');
    setAutoProtocolActive(true);
    setHlsProgress({
      active: false,
      profile: '',
      label: '',
      progress: 0,
      stage: '',
      error: '',
    });
    stopPolling();
  }, [bangumiData.bangumi_name, episode, playbackPath]);

  useEffect(() => {
    if (selectedProfile !== 'source') return;
    const preferredProfile = shouldPreferHlsOnIOS
      ? '1080p_TS'
      : localVideoStatus !== 'unavailable'
        ? 'source'
        : 'range';
    const directOption = displayedQualityOptions.find(item => item.profile === preferredProfile)
      ?? displayedQualityOptions.find(item => item.profile === 'source');
    const nextUrl = directOption?.playUrl || directUrl;
    const nextType = directOption?.type || 'auto';

    setCurrentSourceUrl(nextUrl);
    setCurrentSourceType(nextType);
  }, [directUrl, displayedQualityOptions, localVideoStatus, selectedProfile, shouldPreferHlsOnIOS]);

  useEffect(() => {
    if (selectedProfile === 'source' || currentSourceType !== 'customHls') return;
    setCurrentSourceUrl(current => {
      if (!current) return current;
      const url = new URL(current, window.location.href);
      if (!url.pathname.startsWith('/bangumi/')) return current;
      return buildMediaUrl(`${url.pathname}${url.search}${url.hash}`, effectiveMediaOrigin);
    });
  }, [currentSourceType, effectiveMediaOrigin, selectedProfile]);

  const pollHlsStatus = (option: QualityOption) => {
    const statusUrl = `./api/player/hls/status?player_group=${encodeURIComponent(playerGroup)}&bangumi=${encodeURIComponent(
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
          setCurrentSourceUrl(buildMediaUrl(toBangumiAssetPath(status.url), effectiveMediaOrigin));
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

  const handleQualitySelect = async (option: QualityOption, automatic = false) => {
    setAutoProtocolActive(automatic);
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

    const startUrl = `./api/player/hls/start?player_group=${encodeURIComponent(playerGroup)}&bangumi=${encodeURIComponent(
      bangumiData.bangumi_name
    )}&episode=${encodeURIComponent(episode)}&profile=${encodeURIComponent(option.profile)}`;

    try {
      const response = await fetch(startUrl, { method: 'POST' });
      const payload = (await response.json()) as HlsStatusResponse;
      const status = payload.data;

      if (status.state === 'ready' && status.url) {
        setCurrentSourceUrl(buildMediaUrl(toBangumiAssetPath(status.url), effectiveMediaOrigin));
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
    if (!shouldPreferHlsOnIOS || !iosPreferredHlsOption) {
      autoHlsKeyRef.current = '';
      return;
    }
    const autoKey = `${bangumiData.bangumi_name}:${episode}:hls-original`;
    if (autoHlsKeyRef.current === autoKey) return;
    autoHlsKeyRef.current = autoKey;
    void handleQualitySelect(iosPreferredHlsOption, true);
  }, [bangumiData.bangumi_name, episode, iosPreferredHlsOption, shouldPreferHlsOnIOS]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMissingEpisodes = async () => {
    if (!authToken) {
      toast({
        title: 'Admin auth required',
        description: 'Please sign in before updating diagnostics flags.',
        status: 'error',
        duration: 3200,
        position: 'top-right',
      });
      return;
    }

    const endpoint = hasMissingEpisodes ? '/api/player/clear-missing-episodes' : '/api/player/mark-missing-episodes';
    const arg = hasMissingEpisodes
      ? { bangumiName: bangumiData.bangumi_name }
      : {
          bangumiName: bangumiData.bangumi_name,
          episode,
          filePath: sourcePath || playerAsset?.browser_path || rawPath,
          note: 'Marked from player',
        };

    try {
      setMissingEpisodesLoading(true);
      await fetcherWithMutation([endpoint, authToken], { arg });
      setHasMissingEpisodes(value => !value);
      setMissingEpisodesDialogOpen(false);
      toast({
        title: hasMissingEpisodes ? 'Missing-episodes mark cleared' : 'Missing-episodes mark saved',
        status: 'success',
        duration: 2600,
        position: 'top-right',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: hasMissingEpisodes ? 'Failed to clear missing-episodes mark' : 'Failed to save missing-episodes mark',
        status: 'error',
        duration: 3600,
        position: 'top-right',
      });
    } finally {
      setMissingEpisodesLoading(false);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !currentSourceUrl) return;

    restoredTimeRef.current = false;
    setLoading(true);

    const isHls = currentSourceType === 'customHls' || /\.m3u8(?:$|[?#])/i.test(currentSourceUrl);
    const hls = !iosLike && Hls.isSupported() ? new Hls({ enableWorker: true }) : null;
    const toastId = `HlsError-${episode}`;
    const fallbackToPublic = () => {
      if (!mediaOrigin || !currentSourceUrl.startsWith(`${mediaOrigin}/`)) return;
      setReadySourceUrl('');
      setLocalVideoProbe({ url: localDirectUrl, status: 'unavailable' });
      setCurrentSourceUrl(buildMediaUrl(toMediaPath(currentSourceUrl.slice(mediaOrigin.length))));
    };

    const plugins: Artplayer['option']['plugins'] = [];
    plugins.push(
      artplayerAssPlugin({
        onError: error => {
          console.error('Failed to load ASS subtitle:', error);
        },
      })
    );
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
              if (hls) {
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  video.play().catch(() => undefined);
                });
                hls.on(Hls.Events.ERROR, (_event, data) => {
                  if (data.fatal) {
                    console.error('HLS fatal error:', data.type, data.details);
                    fallbackToPublic();
                  }
                });
              } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener(
                  'loadedmetadata',
                  () => {
                    video.play().catch(() => undefined);
                  },
                  { once: true }
                );
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
      fullscreen: !shouldUseAssWebFullscreen,
      fullscreenWeb: true,
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      flip: true,
      subtitleOffset: true,
      ...(activeNativeSubtitlePath
        ? {
            subtitle: {
              url: activeNativeSubtitlePath,
              type: activeNativeSubtitleType,
              name: activeSubtitle?.label || '',
              style: activeNativeSubtitleStyle,
            },
          }
        : {}),
      pip: true,
      playsInline: true,
      lang: 'zh-cn',
      hotkey: true,
      plugins,
    });

    // Let the player shell receive touch gestures instead of the native <video> element,
    // otherwise Chrome on mobile may hijack long-press with the browser's save/download menu.
    // Safari cancels PointerEvents when the browser takes over a horizontal pan.
    // Keep the gesture on the video surface; controls retain their own handlers.
    art.template.$player.style.touchAction = art.template.$player.classList.contains('art-mobile') ? 'pan-y' : 'manipulation';
    art.template.$player.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    art.video.style.pointerEvents = 'none';
    art.video.style.setProperty('-webkit-touch-callout', 'none');
    art.video.style.webkitUserSelect = 'none';
    art.video.style.userSelect = 'none';
    art.video.style.setProperty('-webkit-user-drag', 'none');
    art.video.setAttribute('draggable', 'false');
    art.video.setAttribute('playsinline', 'true');
    art.video.setAttribute('webkit-playsinline', 'true');

    playerRef.current = art;
    setArtMountSeq(n => n + 1);
    setControlsVisible(true);

    const handleCanPlay = () => {
      setLoading(false);
      setReadySourceUrl(currentSourceUrl);
      if (autoPlayRef.current) void art.play().catch(() => undefined);
      if (!restoredTimeRef.current) {
        const currentTime = getCurrentTime();
        if (currentTime > 0) {
          art.seek = currentTime;
        }
        restoredTimeRef.current = true;
      }
    };
    const handleMediaError = () => {
      setReadySourceUrl('');
      fallbackToPublic();
    };

    const handleTimeUpdate = () => {
      updateCurrentTime(art.video.currentTime);
    };
    const clearLongPressTimer = () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };
    const restoreLongPressRate = () => {
      if (!longPressActivatedRef.current) return;
      art.playbackRate = longPressStartRateRef.current;
      longPressActivatedRef.current = false;
      setShowLongPressIndicator(false);
    };
    const cancelLongPress = () => {
      clearLongPressTimer();
      restoreLongPressRate();
      longPressPointerIdRef.current = null;
      longPressStartPointRef.current = null;
    };
    const isGestureBlockedTarget = (eventTarget: EventTarget | null) => {
      const element = eventTarget instanceof Element ? eventTarget : null;
      if (!element) return false;

      return Boolean(
        element.closest(
          '.art-controls, .art-control, .art-progress, .art-setting, .art-contextmenu, .bgmi-quality-selector, button, [role="button"], input, select, textarea'
        )
      );
    };
    let swipePointerId: number | null = null;
    let swipeStartPoint: { x: number; y: number } | null = null;
    let swipeStartTime = 0;
    let swipeWasPlaying = false;
    let swipeActive = false;
    const swipeEligible = art.template.$player.classList.contains('art-mobile');
    let swipeSeekTarget: number | null = null;
    let suppressClickUntil = 0;
    const swipeIndicator = document.createElement('div');
    swipeIndicator.className = 'bgmi-swipe-seek-indicator';
    swipeIndicator.setAttribute('aria-live', 'off');
    swipeIndicator.style.cssText = 'display:none;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:70;pointer-events:none;padding:.55rem .95rem;border-radius:.7rem;background:rgba(15,23,42,.78);color:white;font-size:1.15rem;font-weight:700;font-variant-numeric:tabular-nums;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)';
    art.template.$player.appendChild(swipeIndicator);
    const showSwipeTarget = (target: number) => {
      swipeSeekTarget = target;
      swipeIndicator.textContent = `${formatPlaybackTime(target)} / ${formatPlaybackTime(art.duration)}`;
      swipeIndicator.style.display = 'block';
    };
    const finishSwipeSeek = (cancelled = false, restorePlayback = true) => {
      if (swipePointerId === null) return;
      const pointerId = swipePointerId;
      const target = swipeSeekTarget;
      const wasPlaying = swipeWasPlaying;
      const wasActive = swipeActive;
      swipePointerId = null;
      swipeStartPoint = null;
      swipeActive = false;
      swipeSeekTarget = null;
      swipeIndicator.style.display = 'none';
      art.template.$player.classList.remove('bgmi-swipe-seeking');
      if (art.template.$player.hasPointerCapture(pointerId)) {
        art.template.$player.releasePointerCapture(pointerId);
      }
      if (!cancelled && target !== null && Number.isFinite(target)) {
        art.seek = target;
      }
      if (wasActive) suppressClickUntil = Date.now() + 350;
      if (wasActive && wasPlaying && restorePlayback) void art.play().catch(() => undefined);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (event.button !== 0) return;
      if (isGestureBlockedTarget(event.target)) return;

      clearLongPressTimer();
      restoreLongPressRate();
      swipePointerId = swipeEligible ? event.pointerId : null;
      swipeStartPoint = { x: event.clientX, y: event.clientY };
      swipeStartTime = art.video.currentTime || 0;
      swipeWasPlaying = !art.video.paused;
      swipeActive = false;
      swipeSeekTarget = null;
      longPressPointerIdRef.current = event.pointerId;
      longPressStartPointRef.current = { x: event.clientX, y: event.clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        if (longPressPointerIdRef.current !== event.pointerId) return;
        longPressStartRateRef.current = art.playbackRate || 1;
        art.playbackRate = 2;
        longPressActivatedRef.current = true;
        setShowLongPressIndicator(true);
      }, 400);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (swipePointerId !== event.pointerId || !swipeStartPoint) return;
      const startPoint = swipeStartPoint;
      if (!startPoint) return;

      const deltaX = event.clientX - startPoint.x;
      const deltaY = event.clientY - startPoint.y;
      const movedX = Math.abs(deltaX);
      const movedY = Math.abs(deltaY);
      if (longPressPointerIdRef.current === event.pointerId && (movedX > 12 || movedY > 12)) {
        cancelLongPress();
      }
      if (!swipeActive) {
        if (movedX <= 12 || movedX <= movedY || !Number.isFinite(art.duration) || art.duration <= 0) return;
        swipeActive = true;
        art.template.$player.setPointerCapture(event.pointerId);
        art.template.$player.classList.add('bgmi-swipe-seeking');
        if (swipeWasPlaying) art.pause();
      }
      event.preventDefault();
      event.stopPropagation();
      const duration = Number.isFinite(art.duration) ? art.duration : 0;
      const target = Math.max(0, Math.min(duration, swipeStartTime + getSwipeSeekOffset(deltaX)));
      showSwipeTarget(target);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (swipePointerId === event.pointerId && swipeActive) {
        event.preventDefault();
        event.stopPropagation();
        finishSwipeSeek();
        cancelLongPress();
        return;
      }
      if (isGestureBlockedTarget(event.target)) return;
      if (longPressPointerIdRef.current !== event.pointerId) return;
      const wasLongPressActive = longPressActivatedRef.current;
      cancelLongPress();
      finishSwipeSeek(true);
      if (wasLongPressActive) return;
      art.controls.toggle();
    };
    const handlePointerCancel = (event: PointerEvent) => {
      if (swipePointerId === event.pointerId) finishSwipeSeek(true);
      if (longPressPointerIdRef.current !== event.pointerId) return;
      cancelLongPress();
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.art-player')) {
        event.preventDefault();
      }
    };
    const handleDragStart = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest('.art-player')) {
        event.preventDefault();
      }
    };
    const handlePlayerClickCapture = (event: MouseEvent) => {
      if (Date.now() >= suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const handleVisibilityChange = () => {
      if (document.hidden) cancelLongPress();
    };
    const handleSeeking = () => {
      cancelLongPress();
    };

    const syncControlsVisible = () => {
      setControlsVisible(art.template.$player.classList.contains('art-control-show'));
    };

    const classObserver = new MutationObserver(syncControlsVisible);
    classObserver.observe(art.template.$player, {
      attributes: true,
      attributeFilter: ['class'],
    });
    syncControlsVisible();

    art.video.addEventListener('canplay', handleCanPlay);
    art.video.addEventListener('error', handleMediaError);
    const handleEnded = () => onEndedRef.current?.();
    art.video.addEventListener('ended', handleEnded);
    art.video.addEventListener('timeupdate', handleTimeUpdate);
    art.video.addEventListener('seeking', handleSeeking);
    art.video.addEventListener('contextmenu', handleContextMenu);
    art.video.addEventListener('dragstart', handleDragStart);
    art.template.$player.addEventListener('pointerdown', handlePointerDown);
    art.template.$player.addEventListener('pointermove', handlePointerMove);
    art.template.$player.addEventListener('pointerup', handlePointerUp);
    art.template.$player.addEventListener('pointercancel', handlePointerCancel);
    art.template.$player.addEventListener('click', handlePlayerClickCapture, true);
    art.template.$player.addEventListener('contextmenu', handleContextMenu);
    art.template.$player.addEventListener('dragstart', handleDragStart);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelLongPress();
      playerRef.current = null;
      setArtMountSeq(n => n + 1);
      setControlsVisible(true);
      setShowLongPressIndicator(false);
      art.video.removeEventListener('canplay', handleCanPlay);
      art.video.removeEventListener('error', handleMediaError);
      art.video.removeEventListener('ended', handleEnded);
      art.video.removeEventListener('timeupdate', handleTimeUpdate);
      art.video.removeEventListener('seeking', handleSeeking);
      finishSwipeSeek(true, false);
      art.video.removeEventListener('contextmenu', handleContextMenu);
      art.video.removeEventListener('dragstart', handleDragStart);
      art.template.$player.removeEventListener('pointerdown', handlePointerDown);
      art.template.$player.removeEventListener('pointermove', handlePointerMove);
      art.template.$player.removeEventListener('pointerup', handlePointerUp);
      art.template.$player.removeEventListener('pointercancel', handlePointerCancel);
      art.template.$player.removeEventListener('click', handlePlayerClickCapture, true);
      art.template.$player.removeEventListener('contextmenu', handleContextMenu);
      art.template.$player.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      classObserver.disconnect();
      swipeIndicator.remove();
      art.destroy();
      hls?.destroy();
    };
  }, [
    bangumiData.bangumi_name,
    currentSourceType,
    currentSourceUrl,
    danmakuApi,
    episode,
    getCurrentTime,
    localDirectUrl,
    mediaOrigin,
    selectedProfile,
    shouldUseAssWebFullscreen,
    updateCurrentTime,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const art = playerRef.current;
    if (!container || !art) return;

    const applyResponsiveSubtitleStyle = () => {
      const nextWidth = container.clientWidth || art.video.clientWidth || 960;
      const nextHeight = container.clientHeight || art.video.clientHeight || 540;
      const isFullscreen =
        art.fullscreen ||
        art.fullscreenWeb ||
        document.fullscreenElement === art.template.$player ||
        document.fullscreenElement === container;
      subtitleWidthRef.current = nextWidth;
      subtitleHeightRef.current = nextHeight;

      if (!activeSubtitle || usesAssRenderer(activeSubtitle)) return;

      const nextStyle = buildNativeSubtitleStyle(
        activeSubtitle.render_style,
        nextWidth,
        nextHeight,
        isFullscreen
      );
      art.option.subtitle = {
        ...art.option.subtitle,
        style: nextStyle,
      };
      art.subtitle.style(nextStyle);
    };

    applyResponsiveSubtitleStyle();

    const resizeObserver = new ResizeObserver(() => {
      applyResponsiveSubtitleStyle();
    });

    resizeObserver.observe(container);
    art.on('fullscreen', applyResponsiveSubtitleStyle);
    art.on('fullscreenWeb', applyResponsiveSubtitleStyle);
    art.on('video:loaderror', () => {
      if (!autoProtocolActive) return;
      const fallbackProfile = currentSourceType === 'auto' ? 'range' : currentSourceType === 'range' ? '1080p_TS' : 'source';
      const fallback = displayedQualityOptions.find(option => option.profile === fallbackProfile);
      if (fallback && fallback.playUrl !== currentSourceUrl) {
        setCurrentSourceUrl(fallback.playUrl);
        setCurrentSourceType(fallback.type);
      }
    });

    return () => {
      art.off('fullscreen', applyResponsiveSubtitleStyle);
      art.off('fullscreenWeb', applyResponsiveSubtitleStyle);
      resizeObserver.disconnect();
    };
  }, [activeSubtitle, artMountSeq]);


  useEffect(() => {
    const art = playerRef.current;
    const requestId = ++subtitleRequestRef.current;
    const subtitle = activeSubtitle;

    if (!art) return;

    if (!subtitle) {
      art.subtitle.show = false;
      void art.subtitle.switch('', { type: 'vtt' }).catch(err => {
        console.error('Failed to clear subtitle:', err);
      });
      return () => {
        subtitleRequestRef.current += 1;
      };
    }

    const subtitleUrl = buildMediaUrl(
      toEncodedBangumiAssetPath(isAssSubtitle ? subtitle.original_path || subtitle.path : subtitle.path),
      effectiveMediaOrigin
    );
    const subtitleType = getNativeSubtitleType(subtitle);
    const subtitleStyle = buildNativeSubtitleStyle(
      subtitle.render_style,
      containerRef.current?.clientWidth || art.video.clientWidth || subtitleWidthRef.current,
      containerRef.current?.clientHeight || art.video.clientHeight || subtitleHeightRef.current,
      art.fullscreen || art.fullscreenWeb
    );
    let disposed = false;
    let subtitleLoaded = false;

    const applyNativeSubtitle = () => {
      if (disposed || subtitleRequestRef.current !== requestId) return;

      art.subtitle.show = true;
      art.option.subtitle = {
        ...art.option.subtitle,
        url: subtitleUrl,
        type: subtitleType,
        name: subtitle.label,
        style: subtitleStyle,
      };

      void art.subtitle
        .switch(subtitleUrl, {
          type: subtitleType,
          style: subtitleStyle,
        })
        .then(result => {
          if (disposed || subtitleRequestRef.current !== requestId) return;
          subtitleLoaded = Boolean(result);
          if (Object.keys(subtitleStyle).length > 0) {
            art.subtitle.style(subtitleStyle);
          }
        })
        .catch(err => {
          if (err?.name !== 'AbortError') console.error('Failed to load subtitle:', err);
        });
    };
    const retryNativeSubtitle = () => {
      if (isAssSubtitle) return;
      if (!subtitleLoaded) applyNativeSubtitle();
    };

    applyNativeSubtitle();
    art.video.addEventListener('loadedmetadata', retryNativeSubtitle);
    art.video.addEventListener('canplay', retryNativeSubtitle);

    return () => {
      disposed = true;
      subtitleRequestRef.current += 1;
      art.video.removeEventListener('loadedmetadata', retryNativeSubtitle);
      art.video.removeEventListener('canplay', retryNativeSubtitle);
    };
  }, [activeSubtitle, artMountSeq, effectiveMediaOrigin, isAssSubtitle]);

  // Sync subtitle selector into ArtPlayer settings panel
  useEffect(() => {
    const art = playerRef.current;
    if (!art) return;

    try { art.setting.remove('subtitle'); } catch {}

    if (subtitleTracks.length > 0) {
      art.setting.add({
        name: 'subtitle',
        html: 'Subtitle',
        width: 250,
        selector: [
          { html: 'Off', default: selectedSubtitleIndex < 0, trackIndex: -1 } as Record<string, unknown>,
          ...subtitleTracks.map((t, i) => ({ html: t.label, default: i === selectedSubtitleIndex, trackIndex: i }) as Record<string, unknown>),
        ] as import('artplayer/types/setting').Setting[],
        onSelect(item) {
          const trackIndex = (item as unknown as { trackIndex: number }).trackIndex;
          setSelectedSubtitleIndex(trackIndex);
          return item.html as string;
        },
      });
    }
  }, [artMountSeq, selectedSubtitleIndex, subtitleTracks]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const renderSynopsis = (mobile: boolean) => overview?.data?.synopsis ? (
    <Box
      as="section"
      aria-label="番剧简介"
      display={mobile ? { base: 'block', xl: 'none' } : { base: 'none', xl: 'block' }}
      w="full"
      minW="0"
      mt={mobile ? '3' : '7'}
      px={{ base: '4', sm: '5', xl: '6' }}
      py={{ base: '4', xl: '5' }}
      rounded="2xl"
      borderWidth="1px"
      borderColor={colorMode === 'dark' ? 'whiteAlpha.140' : 'rgba(173,197,224,0.55)'}
      bg={colorMode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.62)'}
      boxShadow={colorMode === 'dark' ? '0 12px 28px rgba(0,0,0,0.12)' : '0 12px 28px rgba(39,87,116,0.07)'}
    >
      <Text fontSize={{ base: 'sm', xl: 'md' }} fontWeight="700" color={colorMode === 'dark' ? 'whiteAlpha.940' : '#203447'}>
        简介
      </Text>
      <Text
        mt="3"
        maxW="90ch"
        fontSize="sm"
        lineHeight="1.85"
        whiteSpace="pre-line"
        color={colorMode === 'dark' ? 'whiteAlpha.800' : 'rgba(32,52,71,0.82)'}
      >
        {overview.data.synopsis}
      </Text>
    </Box>
  ) : null;

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
              touchAction: 'manipulation',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none',
            },
            '& .art-player .art-video-player': {
              touchAction: 'manipulation',
              WebkitTouchCallout: 'none',
            },
            '& .art-player .JASSUB': {
              position: 'absolute',
              inset: '0',
              pointerEvents: 'none',
              zIndex: 20,
            },
            '& .art-player video': {
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
              pointerEvents: 'none',
              touchAction: 'none',
              WebkitTouchCallout: 'none',
              WebkitUserSelect: 'none',
              WebkitUserDrag: 'none',
              userSelect: 'none',
            },
            '& .art-bottom': {
              paddingBottom: '4px',
            },
            '& .art-video-player.art-mobile': {
              touchAction: 'pan-y',
            },
            // Artplayer applies negative side margins in its mobile skin;
            // on iPad this clips the pause and fullscreen controls.
            '& .art-video-player.art-mobile .art-controls-left': {
              marginLeft: '0 !important',
              minWidth: '0',
            },
            '& .art-video-player.art-mobile .art-controls-right': {
              marginRight: '0 !important',
              minWidth: '0',
            },
            '@media (pointer: coarse) and (min-width: 768px)': {
              '& .art-video-player .art-controls': {
                paddingLeft: '8px',
                paddingRight: '8px',
              },
              '& .art-video-player .art-control': {
                minWidth: '38px',
              },
            },
            '& .bgmi-quality-selector': {
              transition: 'opacity 180ms ease, transform 180ms ease',
            },
            '& .bgmi-subtitle-overlay': {
              zIndex: 25,
            },
            '& .bgmi-long-press-speed-indicator': {
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 22,
              pointerEvents: 'none',
              padding: '0.5rem 0.9rem',
              borderRadius: '999px',
              background: 'rgba(15, 23, 42, 0.72)',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 700,
              backdropFilter: 'blur(10px)',
              letterSpacing: '0.02em',
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
              className="bgmi-quality-selector"
              position="absolute"
              top="2.5"
              right="2.5"
              spacing="1.5"
              zIndex={20}
              opacity={controlsVisible ? 1 : 0}
              transform={controlsVisible ? 'translateY(0)' : 'translateY(-6px)'}
              pointerEvents={controlsVisible ? 'auto' : 'none'}
              sx={{
                ...getLiquidGlassGroupStyles(colorMode, qualityDragSelect.dragging),
                bg: qualityDragSelect.dragging ? `${colors.accent}18` : undefined,
              }}
            >
              {displayedQualityOptions.map(option => {
                const isActive = selectedProfile === option.profile;
                const isProcessing = hlsProgress.active && hlsProgress.profile === option.profile;
                const autoName = currentSourceType === 'customHls' ? 'HLS' : currentSourceType === 'auto' ? '源' : 'HRR';
                return (
                  <Button
                    key={option.profile}
                    size="xs"
                    rounded="full"
                    onClick={() => void handleQualitySelect(option)}
                    borderWidth="1px"
                    sx={{
                      ...getLiquidGlassButtonStyles(colorMode, isActive, { compact: true }),
                      bg: isActive
                        ? `linear-gradient(135deg, ${colors.accent}1F, ${colors.background}52)`
                        : `${colors.background}52`,
                      color: isActive ? colors.accent : colors.text,
                      borderColor: isActive ? `${colors.accent}75` : `${colors.text}40`,
                      boxShadow: isActive
                        ? `0 0 10px ${colors.accent}2B, inset 0 1px 0 rgba(255,255,255,0.22)`
                        : 'inset 0 1px 0 rgba(255,255,255,0.10)',
                      _before: { background: `${colors.accent}0D`, opacity: isActive ? 0.28 : 0.12 },
                      _hover: {
                        bg: isActive
                          ? `linear-gradient(135deg, ${colors.accent}29, ${colors.background}66)`
                          : `${colors.background}70`,
                        borderColor: isActive ? `${colors.accent}99` : `${colors.text}66`,
                      },
                    }}
                    px={{ base: '1.5', md: '2' }}
                    minH={{ base: '1.3rem', md: '1.5rem' }}
                    fontSize={{ base: '0.65rem', md: '0.7rem' }}
                    fontWeight={600}
                    backdropFilter="blur(10px)"
                    leftIcon={isProcessing ? <Spinner size="xs" /> : undefined}
                    {...qualityDragSelect.getOptionProps(option.profile)}
                  >
                    {isProcessing ? `${hlsProgress.progress.toFixed(0)}%` : autoProtocolActive && option.profile === selectedProfile ? `自动:${autoName}` : option.displayName}
                  </Button>
                );
              })}
            </HStack>
          ) : null}

          {currentSourceUrl && showLongPressIndicator ? (
            <Box className="bgmi-long-press-speed-indicator">2x 倍速中</Box>
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

        <Flex justify="flex-end" align="center" mt="2" px="0.5" gap={{ base: '1.5', sm: '2' }}>
          {episodeVersions.length > 0 ? (
            <HStack spacing="1.5" flex="1" flexWrap="wrap" minW="0" aria-label="字幕组视频">
              {identifiedVersions.map(version => {
                const mikanUrl = version.mikanUrl;
                const isSelected = version.group === activeGroup;
                return (
                  <HStack key={version.path} spacing="0.5">
                    <Button
                      size="xs"
                      rounded="full"
                      aria-pressed={isSelected}
                      onClick={() => onGroupSelect?.(version.group)}
                      bg={isSelected ? 'var(--bgmi-accent, #3b82f6)' : colorMode === 'light' ? 'rgba(248,250,252,0.82)' : toolButtonBg}
                      color={isSelected ? 'white' : colorMode === 'light' ? '#172033' : 'rgba(248,250,252,0.94)'}
                      borderWidth="1px"
                      borderColor={isSelected ? 'var(--bgmi-accent, #3b82f6)' : toolButtonBorder}
                      fontWeight={isSelected ? '800' : '500'}
                      _hover={{ opacity: 0.85 }}
                    >
                      {version.group}
                    </Button>
                    {mikanUrl ? (
                      <IconButton
                        as="a"
                        href={mikanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`在 Mikan 查看 ${version.group}`}
                        title={`在 Mikan 查看 ${version.group}`}
                        icon={<FiExternalLink />}
                        size="xs"
                        rounded="full"
                        variant="ghost"
                        color="var(--bgmi-accent, #3b82f6)"
                      />
                    ) : null}
                  </HStack>
                );
              })}
              {fileVersions.length > 0 ? (
                <Menu placement="bottom-start" isLazy>
                  <MenuButton
                    as={Button}
                    size="sm"
                    h="8"
                    px="3"
                    rounded="full"
                    rightIcon={<FiChevronDown />}
                    bg={colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)'}
                    color={colorMode === 'dark' ? 'whiteAlpha.900' : '#334155'}
                    borderWidth="1px"
                    borderColor={colorMode === 'dark' ? 'whiteAlpha.300' : 'blackAlpha.200'}
                    fontWeight="600"
                    fontSize="xs"
                    _hover={{ bg: colorMode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.92)' }}
                    _active={{ bg: colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.94)' }}
                    aria-label={`选择文件版本，共 ${fileVersions.length} 个`}
                  >
                    文件版本{fileVersions.some(version => version.group === activeGroup) ? ' · 当前' : ''}
                  </MenuButton>
                  <MenuList
                    maxW="min(90vw, 32rem)"
                    maxH="18rem"
                    overflowY="auto"
                    bg={colorMode === 'dark' ? 'rgba(24,31,48,0.96)' : 'rgba(248,250,252,0.96)'}
                    borderColor={toolButtonBorder}
                    color={colorMode === 'dark' ? 'rgba(248,250,252,0.96)' : '#172033'}
                    sx={{ background: colorMode === 'dark' ? 'rgba(24,31,48,0.96) !important' : 'rgba(248,250,252,0.96) !important' }}
                    zIndex={30}
                  >
                    {fileVersions.map(version => (
                      <MenuItem
                        key={version.path}
                        onClick={() => onGroupSelect?.(version.group)}
                        bg={version.group === activeGroup ? colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.100' : undefined}
                        fontWeight={version.group === activeGroup ? '600' : '400'}
                        color={colorMode === 'dark' ? 'rgba(248,250,252,0.96)' : '#172033'}
                        fontSize="xs"
                        whiteSpace="normal"
                        wordBreak="break-all"
                        _hover={{ bg: colorMode === 'dark' ? 'whiteAlpha.150' : 'blackAlpha.100' }}
                      >
                        {version.fileName || version.group}
                      </MenuItem>
                    ))}
                  </MenuList>
                </Menu>
              ) : null}
            </HStack>
          ) : null}
          <HStack spacing="1.5">
            <IconButton
              aria-label={hasMissingEpisodes ? 'Clear missing-episodes mark' : 'Mark missing episodes'}
              title={hasMissingEpisodes ? 'Clear missing-episodes mark' : 'Mark missing episodes'}
              icon={<FiAlertTriangle />}
              onClick={() => setMissingEpisodesDialogOpen(true)}
              size="sm"
              minW={{ base: '1.82rem', sm: '2.55rem' }}
              h={{ base: '1.82rem', sm: '2.55rem' }}
              fontSize={{ base: '0.76rem', sm: '1rem' }}
              rounded="full"
              variant="outline"
              bg={hasMissingEpisodes ? 'rgba(245,158,11,0.18)' : toolButtonBg}
              borderColor={hasMissingEpisodes ? 'rgba(245,158,11,0.42)' : toolButtonBorder}
              boxShadow={hasMissingEpisodes ? '0 0 18px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.08)' : toolButtonShadow}
              backdropFilter="blur(18px) saturate(170%)"
              color={hasMissingEpisodes ? '#FBBF24' : colorMode === 'light' ? '#516274' : 'rgba(255,255,255,0.92)'}
              _hover={{ transform: 'translateY(-1px)', bg: hasMissingEpisodes ? 'rgba(245,158,11,0.24)' : colorMode === 'light' ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.10)' }}
              _active={{ transform: 'translateY(0)' }}
              isLoading={missingEpisodesLoading}
            />
            {externalUrl ? <ExternalPlayer url={externalUrl} downloadUrl={downloadUrl} /> : null}
          </HStack>
        </Flex>
        {renderSynopsis(false)}
      </Flex>
      <EpisodeCard flexShrink={0} setPlayState={() => undefined} bangumiData={episodeCardProps} localVideoStatus={localVideoStatus} />
      {renderSynopsis(true)}

      <AlertDialog isOpen={missingEpisodesDialogOpen} leastDestructiveRef={missingEpisodesCancelRef} onClose={() => setMissingEpisodesDialogOpen(false)} isCentered>
        <AlertDialogOverlay backdropFilter="blur(10px)">
          <AlertDialogContent data-bgmi-glass-panel rounded="3xl">
            <AlertDialogHeader>{hasMissingEpisodes ? 'Clear missing-episodes mark?' : 'Mark missing episodes?'}</AlertDialogHeader>
            <AlertDialogBody>
              {hasMissingEpisodes
                ? 'This bangumi will be removed from the Dashboard diagnostics list.'
                : 'This issue will be reported to the administrator and shown in Dashboard diagnostics for follow-up.'}
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={missingEpisodesCancelRef} onClick={() => setMissingEpisodesDialogOpen(false)} rounded="full" variant="ghost">
                Cancel
              </Button>
              <Button ml="3" rounded="full" colorScheme="orange" onClick={() => void handleToggleMissingEpisodes()} isLoading={missingEpisodesLoading}>
                {hasMissingEpisodes ? 'Clear mark' : 'Confirm mark'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}

