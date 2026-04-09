import type { BoxProps } from '@chakra-ui/react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';

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
  const isDark = colorMode === 'dark';

  const bangumiName = bangumiData.bangumiName;
  const totalMark = watchHistory[bangumiName];
  const markBgColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(217,232,255,0.94)';

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
      bg={embedded ? 'transparent' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)'}
      p={embedded ? '0' : { base: '2.5', sm: '4' }}
      ml={embedded ? '0' : { base: 'unset', xl: '4' }}
      mt={embedded ? '0' : { base: '2', xl: 'unset' }}
      w={{ base: 'full', xl: '18rem' }}
      minW={{ base: '0', xl: '18rem' }}
      alignSelf={{ base: 'stretch', xl: 'flex-start' }}
      rounded={{ base: 'xl', xl: '2xl' }}
      borderWidth={embedded ? '0' : '1px'}
      borderColor={embedded ? 'transparent' : isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.92)'}
      backdropFilter={embedded ? 'none' : 'blur(20px) saturate(170%)'}
      boxShadow={
        embedded
          ? 'none'
          : !isDark
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
        background: embedded
          ? 'transparent'
          : !isDark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.76), rgba(214,255,249,0.18) 22%, rgba(255,255,255,0.08) 48%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 22%)',
      }}
      {...props}
    >
      <Text
        mb={{ base: '2', sm: '4' }}
        fontSize={{ base: 'xs', sm: 'md' }}
        fontWeight="700"
        color={isDark ? 'whiteAlpha.940' : '#203447'}
        position="relative"
        zIndex="1"
      >
        选集
      </Text>
      {bangumiData.totalEpisode.length === 0 && (
        <Text fontSize="sm" color={isDark ? 'whiteAlpha.700' : 'rgba(32,52,71,0.72)'} position="relative" zIndex="1">
          暂无剧集
        </Text>
      )}
      <Flex
        wrap="wrap"
        gap={{ base: '1.5', sm: '2.5' }}
        position="relative"
        zIndex="1"
      >
        {bangumiData.totalEpisode.map(episode => {
          const isCurrentEpisode = bangumiData.currentEpisode === episode;
          const isMarkedEpisode = checkMark(episode);
          const idleBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.84)';
          const idleBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(173,197,224,0.72)';
          const idleColor = isDark ? 'whiteAlpha.900' : '#1f3448';
          const markedColor = isDark ? 'whiteAlpha.940' : '#21456a';

          return (
            <Box key={episode}>
              <Button
                w={{ base: '2.6rem', sm: '3.5rem' }}
                h={{ base: '2.6rem', sm: '3.5rem' }}
                minW={{ base: '2.6rem', sm: '3.5rem' }}
                px="0"
                onClick={() => handlePlay(episode)}
                fontSize={{ base: 'xs', sm: 'sm' }}
                color={isCurrentEpisode ? 'white' : isMarkedEpisode ? markedColor : idleColor}
                bg={
                  isCurrentEpisode
                    ? 'linear-gradient(135deg, #60a5fa, #2563eb)'
                    : isMarkedEpisode
                    ? markBgColor
                    : idleBg
                }
                borderWidth="1px"
                borderColor={
                  isCurrentEpisode ? 'rgba(147,197,253,0.82)' : isMarkedEpisode ? 'rgba(147,197,253,0.68)' : idleBorder
                }
                boxShadow={
                  isCurrentEpisode
                    ? '0 12px 24px rgba(37,99,235,0.26), inset 0 1px 0 rgba(255,255,255,0.26)'
                    : isMarkedEpisode
                    ? isDark
                      ? '0 8px 18px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.06)'
                      : '0 8px 18px rgba(59,130,246,0.14), inset 0 1px 0 rgba(255,255,255,0.56)'
                    : isDark
                    ? '0 8px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 8px 18px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.48)'
                }
                _hover={{
                  transform: 'translateY(-1px)',
                  bg: isCurrentEpisode
                    ? 'linear-gradient(135deg, #60a5fa, #2563eb)'
                    : isMarkedEpisode
                    ? markBgColor
                    : isDark
                    ? 'rgba(255,255,255,0.09)'
                    : 'rgba(248,252,255,0.96)',
                }}
                _active={{
                  transform: 'scale(0.985)',
                }}
                isActive={isCurrentEpisode}
                rounded={{ base: 'lg', sm: 'xl' }}
              >
                {episode}
              </Button>
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
}
