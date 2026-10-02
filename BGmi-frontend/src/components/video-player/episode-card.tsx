import type { BoxProps } from '@chakra-ui/react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { FiServer } from 'react-icons/fi';

import { useAccentTheme } from '~/hooks/use-accent-theme';
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
  localVideoStatus?: 'none' | 'connected' | 'unavailable';
}

export default function EpisodeCard({ setPlayState, bangumiData, embedded = false, localVideoStatus = 'none', ...props }: Props & BoxProps) {
  const { colorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();
  const [watchHistory, setWatchHistory] = useWatchHistory();
  const isDark = colorMode === 'dark';

  const bangumiName = bangumiData.bangumiName;
  const totalMark = watchHistory[bangumiName];
  const markBgColor = isDark ? `${colors.accent}27` : `${colors.accent}1C`;

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
      bg={embedded ? 'transparent' : `${colors.surface}${isDark ? 'A8' : 'D9'}`}
      p={embedded ? '0' : { base: '2.5', sm: '4' }}
      ml={embedded ? '0' : { base: 'unset', xl: '4' }}
      mt={embedded ? '0' : { base: '2', xl: 'unset' }}
      w={{ base: 'full', xl: '18rem' }}
      minW={{ base: '0', xl: '18rem' }}
      alignSelf={{ base: 'stretch', xl: 'flex-start' }}
      rounded={{ base: 'xl', xl: '2xl' }}
      borderWidth={embedded ? '0' : '1px'}
      borderColor={embedded ? 'transparent' : isDark ? `${colors.accent}36` : `${colors.accent}26`}
      backdropFilter={embedded ? 'none' : 'blur(20px) saturate(170%)'}
      boxShadow={
        embedded
          ? 'none'
          : !isDark
          ? `0 18px 38px ${colors.accent}1A, 0 6px 16px ${colors.accent}12, inset 0 1px 0 rgba(255,255,255,0.56)`
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
          ? `linear-gradient(180deg, rgba(255,255,255,0.76), ${colors.accent}12 22%, rgba(255,255,255,0.08) 48%)`
          : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 22%)',
      }}
      {...props}
    >
      <Flex mb={{ base: '2', sm: '4' }} align="center" justify="space-between" gap="2" position="relative" zIndex="1">
        <Text fontSize={{ base: 'xs', sm: 'md' }} fontWeight="700" color={colors.text}>
          选集
        </Text>
        {localVideoStatus !== 'none' && (
          <Box
            role="status"
            aria-label={localVideoStatus === 'connected' ? '正在使用本地服务器播放' : '正在使用公网播放'}
            title={localVideoStatus === 'connected' ? '正在使用本地服务器播放' : '正在使用公网播放'}
            position="relative"
            color={localVideoStatus === 'connected' ? '#22C55E' : isDark ? '#8B95A5' : '#788797'}
            pr="1"
            flexShrink={0}
          >
            <FiServer size="18" aria-hidden="true" />
            <Box position="absolute" right="0" bottom="0" w="7px" h="7px" rounded="full" bg={localVideoStatus === 'connected' ? '#22C55E' : '#8B95A5'} border="1px solid" borderColor={colors.surface} />
          </Box>
        )}
      </Flex>
      {bangumiData.totalEpisode.length === 0 && (
        <Text fontSize="sm" color={colors.text} opacity={0.72} position="relative" zIndex="1">
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
          const idleBg = isDark ? `${colors.surface}B8` : `${colors.surface}D6`;
          const idleBorder = `${colors.accent}${isDark ? '38' : '30'}`;
          const idleColor = colors.text;
          const markedColor = colors.accent;

          return (
            <Box key={episode}>
              <Button
                w={{ base: '2.6rem', sm: '3.5rem' }}
                h={{ base: '2.6rem', sm: '3.5rem' }}
                minW={{ base: '2.6rem', sm: '3.5rem' }}
                px="0"
                onClick={() => handlePlay(episode)}
                fontSize={{ base: 'xs', sm: 'sm' }}
                color={isCurrentEpisode ? (isDark ? colors.background : '#FFFFFF') : isMarkedEpisode ? markedColor : idleColor}
                bg={
                  isCurrentEpisode
                    ? colors.accent
                    : isMarkedEpisode
                    ? markBgColor
                    : idleBg
                }
                borderWidth="1px"
                borderColor={
                  isCurrentEpisode ? colors.accent : isMarkedEpisode ? theme.border : idleBorder
                }
                boxShadow={
                  isCurrentEpisode
                    ? `0 12px 24px ${colors.accent}52, inset 0 1px 0 rgba(255,255,255,0.26)`
                    : isMarkedEpisode
                    ? isDark
                      ? '0 8px 18px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.06)'
                      : `0 8px 18px ${colors.accent}24, inset 0 1px 0 rgba(255,255,255,0.56)`
                    : isDark
                    ? '0 8px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : `0 8px 18px ${colors.accent}14, inset 0 1px 0 rgba(255,255,255,0.48)`
                }
                _hover={{
                  transform: 'translateY(-1px)',
                  bg: isCurrentEpisode
                    ? colors.accent
                    : isMarkedEpisode
                    ? markBgColor
                    : isDark
                    ? `${colors.accent}24`
                    : `${colors.accent}12`,
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
