import { Box, Flex, Heading } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import useSWR from 'swr';

import { useParams } from 'react-router-dom';

import VideoPlayer from '~/components/video-player';
import { useBangumi } from '~/hooks/use-bangumi';
import { useWatchHistory } from '~/hooks/use-watch-history';
import { fetcherWithTimeout } from '~/lib/fetcher';
import type { PlayerAssetResponse } from '~/types/bangumi';

export default function Player() {
  const params = useParams();
  const [currentWatchHistory] = useWatchHistory();
  const { data } = useBangumi();

  const bangumiData = data?.data.find(bangumi => bangumi.bangumi_name === params.bangumi);
  const currentBangumiHistory = bangumiData ? currentWatchHistory[bangumiData.bangumi_name] : undefined;
  const episode = currentBangumiHistory?.['current-watch']?.episode ?? '1';
  const playerAssetKey = bangumiData
    ? `/api/player?bangumi=${encodeURIComponent(bangumiData.bangumi_name)}&episode=${encodeURIComponent(episode)}`
    : null;

  const { data: playerAsset, isLoading: playerAssetLoading } = useSWR<PlayerAssetResponse>(
    playerAssetKey,
    (key: string) => fetcherWithTimeout<PlayerAssetResponse>([key], {}, 120000),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      revalidateOnReconnect: false,
    }
  );

  if (!data) return null;

  if (!bangumiData) return <div>加载播放器出错，数据不存在</div>;

  return (
    <Box>
      <Helmet>
        <title>{`BGmi - ${bangumiData.bangumi_name}`}</title>
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <Heading
        ml={{ lg: '10', base: '5' }}
        mb="6"
        fontSize="2xl"
        whiteSpace="nowrap"
        overflow="hidden"
        textOverflow="ellipsis"
      >
        {bangumiData.bangumi_name} {`- 第 ${episode} 集`}
      </Heading>
      {playerAssetLoading ? (
        <Box ml={{ lg: '10', base: '5' }} mb="4" fontSize="sm" opacity="0.8">
          正在准备字幕和播放资源，首次加载可能需要稍等一下。
        </Box>
      ) : null}
      <Flex position="relative" mx={{ lg: '30', base: 'unset' }} flexDirection={{ xl: 'row', base: 'column' }}>
        <VideoPlayer
          episode={episode}
          bangumiData={bangumiData}
          danmakuApi={data.danmaku_api}
          playerAsset={playerAsset?.data}
        />
      </Flex>
    </Box>
  );
}
