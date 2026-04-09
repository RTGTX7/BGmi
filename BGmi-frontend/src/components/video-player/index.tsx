import { Box, Button, Flex, HStack, Progress, Spinner, Text, useToast } from '@chakra-ui/react';
import { Select as GlassSelect } from 'chakra-react-select';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import DPlayer from 'dplayer';
import type { DPlayerOptions } from 'dplayer';
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

interface SubtitleScaleState {
  fontSize: number;
  bottomOffset: number;
  lineHeight: number;
  maxWidth: string;
  strokeWidth: number;
}

interface StyledSubtitleLine {
  text: string;
  variant: 'primary' | 'secondary';
}

interface SubtitleScaleContext {
  isCoarsePointer?: boolean;
  isFullscreen?: boolean;
}

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

type WebkitVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitPresentationMode?: 'fullscreen' | 'inline' | 'picture-in-picture';
};

interface ParsedCue {
  start: number;
  end: number;
  text: string;
}

function parseSubtitleTimestamp(ts: string): number {
  const trimmed = ts.trim();
  const longMatch = trimmed.match(/^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/);
  if (longMatch) {
    const [, h, m, s, ms] = longMatch;
    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
  }
  const shortMatch = trimmed.match(/^(\d{1,2}):(\d{2})[.,](\d{1,3})$/);
  if (shortMatch) {
    const [, m, s, ms] = shortMatch;
    return Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
  }
  return 0;
}

function parseSubtitleText(content: string): ParsedCue[] {
  const cues: ParsedCue[] = [];
  const stripped = content
    .replace(/^\uFEFF/, '')
    .replace(/^WEBVTT[^\n]*\n/, '')
    .replace(/^NOTE[\s\S]*?(?=\n\n)/gm, '');
  const blocks = stripped.trim().replace(/\r\n/g, '\n').split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    const tsIndex = lines.findIndex(line => line.includes(' --> '));
    if (tsIndex < 0) continue;
    const tsParts = lines[tsIndex].split(' --> ');
    const start = parseSubtitleTimestamp(tsParts[0]);
    const end = parseSubtitleTimestamp((tsParts[1] || '').split(/\s/)[0]);
    const text = lines
      .slice(tsIndex + 1)
      .join('\n')
      .trim();
    if (text && end > start) cues.push({ start, end, text });
  }
  return cues;
}

function findActiveCueLines(cues: ParsedCue[], time: number): string[] {
  const active = cues.filter(cue => time >= cue.start && time < cue.end);
  return active.flatMap(cue => normalizeCueText(cue.text));
}

function formatSubtitleOptionLabel(label: string) {
  if (!label) return '更多语言';
  if (label === '关闭字幕') return '关闭字幕';
  return `${label} · 更多语言`;
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
      .replace(/\{\\[^}]+\}/g, ' ')
      .replace(/\\h/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  return text.replace(/\\N/gi, '\n').replace(/\\n/g, '\n').split(/\r?\n/).map(stripMarkup).filter(Boolean);
}

function hasEastAsianGlyphs(value: string) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\uff66-\uff9f]/.test(value);
}

function latinCharacterRatio(value: string) {
  const normalized = value.replace(/\s+/g, '');
  if (!normalized) return 0;
  const latinCount = normalized.match(/[A-Za-z]/g)?.length ?? 0;
  return latinCount / normalized.length;
}

function buildSubtitleLineModels(lines: string[]): StyledSubtitleLine[] {
  return lines.map((line, index) => {
    const previousLine = lines[index - 1] ?? '';
    const nextLine = lines[index + 1] ?? '';
    const currentHasEastAsian = hasEastAsianGlyphs(line);
    const neighboringEastAsian = hasEastAsianGlyphs(previousLine) || hasEastAsianGlyphs(nextLine);
    const isAnnotation = /^[([{（【「『].+[)\]}）】」』]$/.test(line);
    const isSecondary = !currentHasEastAsian && neighboringEastAsian && latinCharacterRatio(line) >= 0.55;

    return {
      text: line,
      variant: isAnnotation || isSecondary ? 'secondary' : 'primary',
    };
  });
}

function disableNativeTracks(video: HTMLVideoElement) {
  for (let index = 0; index < video.textTracks.length; index += 1) {
    video.textTracks[index].mode = 'disabled';
  }
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
const defaultSubtitleScale: SubtitleScaleState = {
  fontSize: 18,
  bottomOffset: 72,
  lineHeight: 1.42,
  maxWidth: '82%',
  strokeWidth: 1.5,
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function detectCoarsePointer() {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
  }
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

function isNativeVideoFullscreen(video: HTMLVideoElement | null | undefined) {
  const target = video as WebkitVideoElement | null | undefined;
  return Boolean(target?.webkitDisplayingFullscreen || target?.webkitPresentationMode === 'fullscreen');
}

function isPlayerInDocumentFullscreen(root: HTMLElement | null) {
  if (!root || typeof document === 'undefined') return false;
  const fullscreenElement = document.fullscreenElement || (document as WebkitDocument).webkitFullscreenElement || null;
  if (!fullscreenElement) return false;
  return fullscreenElement === root || root.contains(fullscreenElement) || fullscreenElement.contains(root);
}

function createSubtitleScale(width: number, height: number, context: SubtitleScaleContext = {}): SubtitleScaleState {
  const safeHeight = Math.max(height, 1);
  const shortEdge = Math.min(width, safeHeight);
  const isCoarsePointer = context.isCoarsePointer ?? false;
  const isFullscreen = context.isFullscreen ?? false;
  const isLandscape = width > safeHeight * 1.08;
  const isHandheld = isCoarsePointer && shortEdge <= 900;

  let nextFontSize = clampNumber(Math.round(width * 0.021), 14, 28);
  let nextBottomOffset = clampNumber(Math.round(safeHeight * 0.11), 48, 96);
  let nextLineHeight = 1.38;
  let nextMaxWidth = '84%';
  let nextStrokeWidth = 1.5;

  if (isHandheld && (isFullscreen || isLandscape)) {
    nextFontSize = clampNumber(Math.round(shortEdge * (isLandscape ? 0.056 : 0.05)), 17, 24);
    nextBottomOffset = clampNumber(Math.round(safeHeight * (isLandscape ? 0.1 : 0.082)), 20, 36);
    nextLineHeight = 1.26;
    nextMaxWidth = isLandscape ? '82%' : '88%';
    nextStrokeWidth = 1.7;
  } else if (isHandheld) {
    nextFontSize = clampNumber(Math.round(width * 0.044), 15, 22);
    nextBottomOffset = clampNumber(Math.round(safeHeight * 0.072), 14, 24);
    nextLineHeight = 1.3;
    nextMaxWidth = '92%';
    nextStrokeWidth = 1.4;
  } else if (isFullscreen) {
    nextFontSize = clampNumber(Math.round(shortEdge * 0.035), 20, 32);
    nextBottomOffset = clampNumber(Math.round(safeHeight * 0.1), 72, 130);
    nextLineHeight = 1.48;
    nextMaxWidth = width >= 1600 ? '72%' : '76%';
    nextStrokeWidth = 1.78;
  } else if (width >= 1400) {
    nextLineHeight = 1.5;
    nextMaxWidth = '74%';
    nextStrokeWidth = 1.65;
  } else if (width >= 1320) {
    nextLineHeight = 1.46;
    nextMaxWidth = '74%';
  } else if (width >= 1000) {
    nextLineHeight = 1.46;
    nextMaxWidth = '80%';
  }

  return {
    fontSize: nextFontSize,
    bottomOffset: nextBottomOffset,
    lineHeight: nextLineHeight,
    maxWidth: nextMaxWidth,
    strokeWidth: nextStrokeWidth,
  };
}

function createCustomHlsFactory(hls: Hls, fallbackUrl: string, toast: ReturnType<typeof useToast>, toastId: string) {
  return {
    customHls(video: HTMLVideoElement) {
      if (Hls.isSupported()) {
        hls.loadSource(video.src || video.currentSrc || fallbackUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => undefined);
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
  const playerRef = useRef<DPlayer | null>(null);
  const assRendererRef = useRef<ASS | null>(null);
  const restoredTimeRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState('source');
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState<number>(0);
  const [currentSourceUrl, setCurrentSourceUrl] = useState('');
  const [currentSourceType, setCurrentSourceType] = useState('auto');
  const [subtitleLines, setSubtitleLines] = useState<string[]>([]);
  const [subtitleOverlayRoot, setSubtitleOverlayRoot] = useState<HTMLElement | null>(null);
  const [subtitleScale, setSubtitleScale] = useState<SubtitleScaleState>(defaultSubtitleScale);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
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
  const selectedSubtitleOption =
    subtitleOptions.find(option => option.value === selectedSubtitleValue) ?? subtitleOptions[0];
  const activeSubtitle =
    subtitleTracks.length > 0 && selectedSubtitleIndex >= 0
      ? subtitleTracks[selectedSubtitleIndex] || subtitleTracks[0]
      : undefined;
  const isAssSubtitle = usesAssRenderer(activeSubtitle);
  const activeSubtitleRenderStyle = activeSubtitle?.render_style;
  const subtitleLineModels = useMemo(() => buildSubtitleLineModels(subtitleLines), [subtitleLines]);
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
    setSubtitleOverlayRoot(containerRef.current.querySelector<HTMLElement>('.dplayer-video-wrap'));
    setSubtitleLines([]);

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
      assRendererRef.current?.destroy();
      assRendererRef.current = null;
      playerRef.current = null;
      setSubtitleOverlayRoot(null);
      setSubtitleLines([]);
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
    if (isAssSubtitle || !activeSubtitle) {
      disableNativeTracks(video);
      setSubtitleLines([]);
      return;
    }

    disableNativeTracks(video);
    setSubtitleLines([]);

    const subUrl = activeSubtitle.original_path
      ? createAbsoluteUrl(`.${toEncodedBangumiAssetPath(activeSubtitle.original_path)}`)
      : createAbsoluteUrl(`.${toEncodedBangumiAssetPath(activeSubtitle.path)}`);

    const abortController = new AbortController();
    let cues: ParsedCue[] = [];
    let ready = false;

    fetch(subUrl, { signal: abortController.signal })
      .then(res => res.text())
      .then(content => {
        if (abortController.signal.aborted) return;
        cues = parseSubtitleText(content);
        ready = true;
        const lines = findActiveCueLines(cues, video.currentTime);
        setSubtitleLines(lines);
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.error('Failed to load subtitle:', err);
      });

    let prevLineKey = '';
    const handleTimeUpdate = () => {
      if (!ready) return;
      const lines = findActiveCueLines(cues, video.currentTime);
      const lineKey = lines.join('\n');
      if (lineKey !== prevLineKey) {
        prevLineKey = lineKey;
        setSubtitleLines(lines);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      abortController.abort();
      video.removeEventListener('timeupdate', handleTimeUpdate);
      setSubtitleLines([]);
    };
  }, [activeSubtitle, currentSourceUrl, isAssSubtitle]);

  useEffect(() => {
    const video = playerRef.current?.video;

    assRendererRef.current?.destroy();
    assRendererRef.current = null;
    if (!isAssSubtitle || !activeSubtitle?.original_path || !video) return;

    disableNativeTracks(video);
    setSubtitleLines([]);

    const container = video.parentElement;
    if (!container) return;

    const abortController = new AbortController();
    const subUrl = createAbsoluteUrl(`.${toEncodedBangumiAssetPath(activeSubtitle.original_path)}`);

    fetch(subUrl, { signal: abortController.signal })
      .then((res) => res.text())
      .then((content) => {
        if (abortController.signal.aborted) return;
        const renderer = new ASS(content, video, { container });
        assRendererRef.current = renderer;
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('Failed to load ASS subtitle:', err);
      });

    return () => {
      abortController.abort();
      assRendererRef.current?.destroy();
      assRendererRef.current = null;
    };
  }, [activeSubtitle, currentSourceUrl, isAssSubtitle]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const playerRoot = containerRef.current?.closest<HTMLElement>('.bgmi-player-shell') ?? containerRef.current;
    const video = playerRef.current?.video ?? containerRef.current?.querySelector('video');
    if (!playerRoot && !video) return;

    const syncFullscreenState = () => {
      setIsPlayerFullscreen(
        isNativeVideoFullscreen(video) || isPlayerInDocumentFullscreen(playerRoot)
      );
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    window.addEventListener('resize', syncFullscreenState);
    window.addEventListener('orientationchange', syncFullscreenState);
    window.visualViewport?.addEventListener('resize', syncFullscreenState);
    video?.addEventListener('webkitbeginfullscreen', syncFullscreenState as EventListener);
    video?.addEventListener('webkitendfullscreen', syncFullscreenState as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
      window.removeEventListener('resize', syncFullscreenState);
      window.removeEventListener('orientationchange', syncFullscreenState);
      window.visualViewport?.removeEventListener('resize', syncFullscreenState);
      video?.removeEventListener('webkitbeginfullscreen', syncFullscreenState as EventListener);
      video?.removeEventListener('webkitendfullscreen', syncFullscreenState as EventListener);
    };
  }, [currentSourceUrl]);

  useEffect(() => {
    const target = subtitleOverlayRoot;
    if (!target || typeof window === 'undefined') return;

    const updateScale = () => {
      const width = target.clientWidth || containerRef.current?.clientWidth || 960;
      const height = target.clientHeight || Math.round(width * 0.5625);
      setSubtitleScale(
        createSubtitleScale(width, height, {
          isCoarsePointer: detectCoarsePointer(),
          isFullscreen: isPlayerFullscreen,
        })
      );
    };

    updateScale();
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            updateScale();
          });
    observer?.observe(target);
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    window.visualViewport?.addEventListener('resize', updateScale);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
      window.visualViewport?.removeEventListener('resize', updateScale);
    };
  }, [isPlayerFullscreen, subtitleOverlayRoot]);

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
            '& .dplayer': {
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            },
            '& #DPlayer': {
              width: '100%',
            },
            '& .dplayer-video-wrap': {
              width: '100%',
              height: '100%',
              position: 'relative',
              background: '#000',
            },
            '& .dplayer-video-wrap .JASSUB': {
              position: 'absolute',
              inset: '0',
              pointerEvents: 'none',
              zIndex: 12,
            },
            '& .dplayer-video-wrap video': {
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain',
            },
            '& .dplayer-controller': {
              paddingBottom: '4px',
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
          <Box
            id="DPlayer"
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
        {subtitleOverlayRoot && subtitleLineModels.length > 0 && !isAssSubtitle
          ? createPortal(
              <Flex
                className="bgmi-subtitle-overlay"
                position="absolute"
                left="0"
                right="0"
                bottom={`${subtitleScale.bottomOffset}px`}
                zIndex={12}
                px={{ base: '0.75rem', md: '1.2rem', xl: '1.6rem' }}
                pointerEvents="none"
                justify="center"
                transition="bottom 0.18s ease-out"
              >
                <Box
                  maxW={subtitleScale.maxWidth}
                  textAlign="center"
                  position="relative"
                  px={{ base: '0.25rem', md: '0.45rem' }}
                  py={{ base: '0.1rem', md: '0.15rem' }}
                  sx={{
                    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.18))',
                  }}
                  _before={{
                    content: '""',
                    position: 'absolute',
                    inset: '-0.35rem -0.45rem',
                    borderRadius: '1.3rem',
                    background:
                      'radial-gradient(circle at center, rgba(0,0,0,0.18), rgba(0,0,0,0.08) 48%, rgba(0,0,0,0) 82%)',
                    filter: 'blur(8px)',
                    opacity: 0.72,
                    pointerEvents: 'none',
                  }}
                >
                  {subtitleLineModels.map((line, index) => {
                    const isSecondary = line.variant === 'secondary';
                    const lineFontSize = Math.max(12, Math.round(subtitleScale.fontSize * (isSecondary ? 0.82 : 1)));
                    const useSoftOutline = Boolean(activeSubtitleRenderStyle?.font_family);
                    const strokeWidth = `${Math.max(
                      0.42,
                      Math.min(
                        1.05,
                        subtitleScale.strokeWidth *
                          (isSecondary ? 0.56 : 0.72) *
                          (useSoftOutline ? 0.74 : 1)
                      )
                    ).toFixed(2)}px`;

                    return (
                      <Text
                        key={`${index}-${line.text}`}
                        position="relative"
                        color={isSecondary ? 'rgba(243,247,255,0.95)' : 'rgba(255,255,255,0.99)'}
                        fontFamily={activeSubtitleRenderStyle?.font_family}
                        fontSize={`${lineFontSize}px`}
                        fontWeight={activeSubtitleRenderStyle?.font_weight ?? (isSecondary ? '500' : '600')}
                        fontStyle={activeSubtitleRenderStyle?.font_style}
                        letterSpacing={isSecondary ? '0.012em' : '0.016em'}
                        lineHeight={subtitleScale.lineHeight}
                        textShadow={
                          isSecondary
                            ? '0 1px 3px rgba(0,0,0,0.42), 0 0 6px rgba(151,182,255,0.10)'
                            : useSoftOutline
                            ? '0 1px 2px rgba(0,0,0,0.38), 0 0 5px rgba(0,0,0,0.16)'
                            : '0 1px 4px rgba(0,0,0,0.46), 0 0 8px rgba(255,255,255,0.06), 0 0 14px rgba(106,168,255,0.08)'
                        }
                        mb={index === subtitleLineModels.length - 1 ? '0' : isSecondary ? '0.08rem' : '0.18rem'}
                        sx={{
                          WebkitTextStroke: `${strokeWidth} rgba(0,0,0,0.72)`,
                          paintOrder: 'stroke fill',
                        }}
                      >
                        {line.text}
                      </Text>
                    );
                  })}
                </Box>
              </Flex>,
              subtitleOverlayRoot
            )
          : null}

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
                        minH: '2.55rem',
                        bg: colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
                        borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(174,200,210,0.92)',
                        borderRadius: '999px',
                        boxShadow:
                          colorMode === 'dark'
                            ? '0 6px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.05)'
                            : '0 6px 14px rgba(39,87,116,0.05), inset 0 1px 0 rgba(255,255,255,0.40)',
                        backdropFilter: 'blur(8px) saturate(145%)',
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
                        fontSize: '0.86rem',
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
