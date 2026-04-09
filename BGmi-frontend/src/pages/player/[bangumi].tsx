import { Box, Flex, Heading } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import useSWR from 'swr';

import { useParams } from 'react-router-dom';

import VideoPlayer from '~/components/video-player';
import { useBangumi } from '~/hooks/use-bangumi';
import { useWatchHistory } from '~/hooks/use-watch-history';
import { FetchError, fetcherWithTimeout } from '~/lib/fetcher';

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

  if (!data) return null;
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

      <Heading
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
          danmakuApi={data.danmaku_api}
          playerAsset={playerAssetData}
          playerAssetLoading={playerAssetLoading}
          playerAssetErrorMessage={playerAssetErrorMessage}
          playerAssetErrorStatus={playerAssetErrorStatus}
          playerAssetMissing={playerAssetMissing}
        />
      </Flex>
    </Box>
  );
}
