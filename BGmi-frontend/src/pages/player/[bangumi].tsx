import { Box, Flex, Heading } from '@chakra-ui/react';
import { FiArrowLeft } from 'react-icons/fi';
import { Helmet } from 'react-helmet-async';
import useSWR from 'swr';
import { useEffect, useState } from 'react';

import { useParams } from 'react-router-dom';

import VideoPlayer from '~/components/video-player';
import { useGlassPageTransition } from '~/components/layout/glass-page-transition';
import { useWatchHistory } from '~/hooks/use-watch-history';
import { FetchError, fetcherWithTimeout } from '~/lib/fetcher';

import type { BangumiData, PlayerAssetResponse } from '~/types/bangumi';

interface PlayerBangumiResponse {
  data: BangumiData;
  status: string;
  danmaku_api: string;
}

export default function Player() {
  const params = useParams();
  const glassTransition = useGlassPageTransition();
  const [currentWatchHistory, setWatchHistory] = useWatchHistory();
  const bangumiName = params.bangumi ? decodeURIComponent(params.bangumi) : '';
  const [preferredGroup, setPreferredGroup] = useState(() =>
    typeof window === 'undefined' ? '' : window.localStorage.getItem(`bgmi-player-group:${bangumiName}`) ?? ''
  );
  const [autoPlayEpisode, setAutoPlayEpisode] = useState('');
  useEffect(() => {
    setPreferredGroup(window.localStorage.getItem(`bgmi-player-group:${bangumiName}`) ?? '');
  }, [bangumiName]);

  const {
    data: bangumiResponse,
    error: bangumiError,
    isLoading: bangumiLoading,
  } = useSWR<PlayerBangumiResponse, FetchError>(
    bangumiName ? `/api/player/bangumi?bangumi=${encodeURIComponent(bangumiName)}` : null,
    (key: string) => fetcherWithTimeout<PlayerBangumiResponse>([key], {}, 30000),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  );

  const bangumiData = bangumiResponse?.data;
  const currentBangumiHistory = bangumiData ? currentWatchHistory[bangumiData.bangumi_name] : undefined;
  const availableEpisodes = bangumiData
    ? Object.keys(bangumiData.player ?? {})
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => b - a)
    : [];
  const defaultEpisode = availableEpisodes.length ? String(availableEpisodes[0]) : '1';
  const historyEpisode = currentBangumiHistory?.['current-watch']?.episode;
  const episode = historyEpisode && availableEpisodes.includes(Number(historyEpisode)) ? historyEpisode : defaultEpisode;
  const versions = bangumiData?.player_versions?.[episode] ?? [];
  const playerGroup = versions.some(version => version.group === preferredGroup) ? preferredGroup : '';
  const activeGroup = playerGroup || versions.find(version => version.path === bangumiData?.player?.[episode]?.path)?.group || versions[0]?.group || '';
  const chooseGroup = (group: string) => {
    if (!bangumiData) return;
    window.localStorage.setItem(`bgmi-player-group:${bangumiData.bangumi_name}`, group);
    setPreferredGroup(group);
  };
  const playNext = () => {
    if (!bangumiData) return;
    const next = availableEpisodes.filter(number => number > Number(episode)).sort((a, b) => a - b)[0];
    if (!next || !bangumiData.player_versions?.[String(next)]?.some(version => version.group === activeGroup)) return;
    chooseGroup(activeGroup);
    setAutoPlayEpisode(String(next));
    setWatchHistory(previous => ({
      ...previous,
      [bangumiData.bangumi_name]: {
        ...previous[bangumiData.bangumi_name],
        [String(next)]: 'mark',
        'current-watch': { episode: String(next), currentTime: '0' },
      },
    }));
  };
  const playerAssetKey = bangumiData
    ? `/api/player?bangumi=${encodeURIComponent(bangumiData.bangumi_name)}&episode=${encodeURIComponent(episode)}&player_group=${encodeURIComponent(playerGroup)}`
    : null;

  const {
    data: playerAsset,
    error: playerAssetError,
    isLoading: playerAssetLoading,
  } = useSWR<PlayerAssetResponse, FetchError>(
    playerAssetKey,
    (key: string) => fetcherWithTimeout<PlayerAssetResponse>([key], {}, 120000),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  );

  if (bangumiLoading) return null;
  if (bangumiError) return <div>加载播放器出错：{bangumiError.message}</div>;
  if (!bangumiData) return <div>加载播放器出错，数据不存在</div>;

  const playerAssetData = playerAsset?.data;
  const playerAssetMissing =
    !playerAssetLoading &&
    !playerAssetError &&
    !playerAssetData?.browser_path &&
    !playerAssetData?.source_path;
  const playerAssetErrorMessage = playerAssetError?.message;
  const playerAssetErrorStatus = playerAssetError?.status;

  return (
    <Box>
      <Helmet>
        <title>{`BGmi - ${bangumiData.bangumi_name}`}</title>
        <meta name="referrer" content="no-referrer" />
      </Helmet>

      {glassTransition?.canClose ? (
        <Box
          as="button"
          type="button"
          aria-label="返回番剧列表"
          title="返回番剧列表"
          onClick={glassTransition.closeCard}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          w="2.5rem"
          h="2.5rem"
          mb="2"
          rounded="full"
          bg="var(--bgmi-glass-background)"
          border="1px solid var(--bgmi-accent-border)"
          backdropFilter="blur(16px) saturate(160%)"
        >
          <FiArrowLeft aria-hidden="true" />
        </Box>
      ) : null}

      <Heading
        data-bgmi-player-title="true"
        ml={{ base: '0', xl: '10' }}
        mb={{ base: '2.5', lg: '6' }}
        px={{ base: '0.15rem', xl: '0' }}
        fontSize={{ base: 'sm', sm: 'lg', lg: '2xl' }}
        noOfLines={{ base: 2, xl: 1 }}
        lineHeight={{ base: '1.28', xl: '1.25' }}
      >
        {bangumiData.bangumi_name} {`- 第 ${episode} 集`}
      </Heading>

      <Flex
        position="relative"
        mx={{ base: '0', xl: '30' }}
        gap={{ base: '2.5', xl: '0' }}
        flexDirection={{ xl: 'row', base: 'column' }}
        align={{ xl: 'flex-start', base: 'stretch' }}
        minW="0"
      >
        <VideoPlayer
          episode={episode}
          bangumiData={bangumiData}
          danmakuApi={bangumiResponse?.danmaku_api ?? ''}
          playerAsset={playerAssetData}
          playerAssetLoading={playerAssetLoading}
          playerAssetErrorMessage={playerAssetErrorMessage}
          playerAssetErrorStatus={playerAssetErrorStatus}
          playerAssetMissing={playerAssetMissing}
          playerGroup={playerGroup}
          activeGroup={activeGroup}
          onGroupSelect={chooseGroup}
          onEnded={playNext}
          autoPlay={autoPlayEpisode === episode}
        />
      </Flex>
    </Box>
  );
}
