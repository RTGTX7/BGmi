import type { BoxProps } from '@chakra-ui/react';
import { Box, Button, Grid, GridItem, Text } from '@chakra-ui/react';

import { useColorMode } from '~/hooks/use-color-mode';
import { useWatchHistory } from '~/hooks/use-watch-history';

interface Props {
  setPlayState: () => void;
  bangumiData: {
    totalEpisode: string[];
    bangumiName: string;
    currentEpisode: string;
  };
  embedded?: boolean;
}

export default function EpisodeCard({ setPlayState, bangumiData, embedded = false, ...props }: Props & BoxProps) {
  const { colorMode } = useColorMode();
  const [watchHistory, setWatchHistory] = useWatchHistory();

  const bangumiName = bangumiData.bangumiName;
  const totalMark = watchHistory[bangumiName];
  const markBgColor = colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.74)';

  const handlePlay = (episode: string) => {
    setWatchHistory({
      ...watchHistory,
      [bangumiName]: {
        ...(watchHistory[bangumiName] ?? {}),
        [episode]: 'mark',
        'current-watch': {
          ...(watchHistory[bangumiName]?.['current-watch'] ?? {}),
          episode,
          currentTime: '0',
        },
      },
    });
    setPlayState();
  };

  const checkMark = (episode: string) => totalMark?.[episode] === 'mark' || episode === '1';

  return (
    <Box
      bg={
        embedded
          ? 'transparent'
          : colorMode === 'light'
            ? 'rgba(255,255,255,0.58)'
            : 'rgba(255,255,255,0.05)'
      }
      p={embedded ? '0' : '4'}
      ml={embedded ? '0' : { base: 'unset', xl: '4' }}
      mt={embedded ? '0' : { base: '4', xl: 'unset' }}
      w={{ base: 'full', xl: '18rem' }}
      minW={{ base: '0', xl: '18rem' }}
      alignSelf={{ base: 'stretch', xl: 'flex-start' }}
      rounded="2xl"
      borderWidth={embedded ? '0' : '1px'}
      borderColor={embedded ? 'transparent' : colorMode === 'light' ? 'rgba(255,255,255,0.78)' : 'whiteAlpha.140'}
      backdropFilter={embedded ? 'none' : 'blur(20px) saturate(170%)'}
      boxShadow={
        embedded
          ? 'none'
          : colorMode === 'light'
            ? '0 18px 38px rgba(39,87,116,0.10), 0 6px 16px rgba(94,188,214,0.10), inset 0 1px 0 rgba(255,255,255,0.56)'
            : '0 18px 38px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'
      }
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '1px',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        background:
          embedded
            ? 'transparent'
            : colorMode === 'light'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(214,255,249,0.12) 22%, rgba(255,255,255,0.04) 48%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 22%)',
      }}
      {...props}
    >
      <Text mb="4" position="relative" zIndex="1">
        选集
      </Text>
      {bangumiData.totalEpisode.length === 0 && (
        <Text fontSize="sm" opacity="75%" position="relative" zIndex="1">
          暂无剧集
        </Text>
      )}
      <Grid templateColumns={{ base: 'repeat(auto-fill, minmax(3rem, 1fr))', sm: 'repeat(auto-fill, minmax(3.75rem, 1fr))' }} gap={{ base: 3, sm: 4 }} position="relative" zIndex="1">
        {bangumiData.totalEpisode.map(episode => (
          <GridItem key={episode}>
            <Button
              px={{ base: '4', sm: '7' }}
              maxW={{ base: 'full', sm: '16' }}
              onClick={() => handlePlay(episode)}
              fontSize={{ base: 'xs', sm: 'sm' }}
              bg={checkMark(episode) ? markBgColor : undefined}
              isActive={bangumiData.currentEpisode === episode}
            >
              {episode}
            </Button>
          </GridItem>
        ))}
      </Grid>
    </Box>
  );
}
