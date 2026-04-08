import { Badge, Box, Fade, Grid, GridItem, Heading, Image, Text } from '@chakra-ui/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';

import Link from '~/components/router-link';
import { bangumiFilterAtom, useBangumi } from '~/hooks/use-bangumi';
import { useColorMode } from '~/hooks/use-color-mode';
import { normalizePath } from '~/lib/utils';

import type { BangumiData } from '~/types/bangumi';

interface PlayerCardProps {
  bangumiData: BangumiData;
}

function PlayerCard({ bangumiData }: PlayerCardProps) {
  const { colorMode } = useColorMode();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [drawerMaxHeight, setDrawerMaxHeight] = useState('5.35rem');
  const drawerContentRef = useRef<HTMLDivElement | null>(null);
  const isDark = colorMode === 'dark';
  const posterBg = isDark ? 'gray.900' : 'rgba(255,255,255,0.72)';
  const borderColor = isDark ? 'whiteAlpha.180' : 'rgba(148,163,184,0.20)';

  const { bangumi_name: title, cover: coverUrl, episode, status } = bangumiData;
  const statusText = episode > 0 ? `最新：第 ${episode} 集` : '暂无更新';

  useLayoutEffect(() => {
    if (!drawerExpanded || !drawerContentRef.current) {
      setDrawerMaxHeight('5.35rem');
      return;
    }

    setDrawerMaxHeight(`${drawerContentRef.current.scrollHeight + 24}px`);
  }, [drawerExpanded, title, statusText]);

  return (
    <Box
      mx="auto"
      w="full"
      overflow="hidden"
      rounded="2xl"
      borderWidth="1px"
      borderColor={borderColor}
      bg={posterBg}
      boxShadow={isDark ? '0 18px 40px rgba(0,0,0,0.28)' : '0 18px 40px rgba(15,23,42,0.10)'}
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        background: isDark
          ? 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 18%, rgba(255,255,255,0) 42%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0) 42%)',
        zIndex: 3,
      }}
      _after={{
        content: '""',
        position: 'absolute',
        inset: '1px',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.42)',
        boxShadow: isDark
          ? 'inset 0 0 0 1px rgba(255,255,255,0.02)'
          : 'inset 0 0 0 1px rgba(255,255,255,0.12)',
        zIndex: 3,
      }}
    >
      <Link href={`/player/${normalizePath(title)}`} overflow="hidden">
        <Box position="relative" bg={posterBg}>
          {status === 2 ? (
            <Badge pos="absolute" top="3" right="3" zIndex="2" bg="yellow.500" color="white">
              NEW
            </Badge>
          ) : null}

          <Fade in={imageLoaded}>
            <Box aspectRatio={3 / 4} w="full" bg={posterBg} position="relative" overflow="hidden">
              <Image
                h="full"
                w="full"
                src={`.${coverUrl}`}
                alt={`${title} poster`}
                objectFit="cover"
                objectPosition="center center"
                onLoad={() => setImageLoaded(true)}
              />

              <Box
                opacity="0"
                position="absolute"
                inset="0"
                zIndex="1"
                transform="scale(1.04)"
                transition="all 0.3s ease"
                background={
                  "rgba(0,0,0,0.35) url(\"data:image/svg+xml,%3C%3Fxml version='1.0' encoding='utf-8'%3F%3E%3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Cpath fill='%23FFFFFF' d='M35.4,28L18.4,38.6c-2.4,1.5-5.4-0.2-5.4-3V14.3c0-2.8,3.1-4.5,5.4-3L35.3,22C37.6,23.3,37.6,26.6,35.4,28z'/%3E%3C/svg%3E\") center no-repeat"
                }
                backgroundSize="24% 24%"
                _hover={{
                  opacity: '1',
                  transform: 'scale(1)',
                }}
              />

              <Box
                position="absolute"
                left={{ base: '3', md: '3.5' }}
                right={{ base: '3', md: '3.5' }}
                bottom={{ base: '3', md: '3.5' }}
                zIndex="2"
                rounded="2xl"
                px={{ base: '3', md: '3.5' }}
                py={{ base: '2.5', md: '3' }}
                borderWidth="1px"
                borderColor={isDark ? 'whiteAlpha.220' : 'rgba(255,255,255,0.78)'}
                backdropFilter="blur(22px) saturate(165%)"
                boxShadow={
                  isDark
                    ? '0 14px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)'
                    : '0 14px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
                }
                bg={
                  drawerExpanded
                    ? isDark
                      ? 'rgba(30, 34, 46, 0.32)'
                      : 'rgba(246, 253, 255, 0.28)'
                    : isDark
                      ? 'rgba(30, 34, 46, 0.24)'
                      : 'rgba(246, 253, 255, 0.20)'
                }
                maxH={drawerMaxHeight}
                overflow="hidden"
                transform={drawerExpanded ? 'translateY(-3px)' : undefined}
                transition="all 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
                onMouseEnter={() => setDrawerExpanded(true)}
                onMouseLeave={() => setDrawerExpanded(false)}
                onFocus={() => setDrawerExpanded(true)}
                onBlur={event => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setDrawerExpanded(false);
                  }
                }}
                _before={{
                  content: '""',
                  position: 'absolute',
                  inset: '1px',
                  borderRadius: 'inherit',
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05) 34%, rgba(255,255,255,0.02) 100%)'
                    : `linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.18) 34%, rgba(255,255,255,0.06) 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='%23000' fill-opacity='.03'%3E%3Ccircle cx='12' cy='18' r='1'/%3E%3Ccircle cx='34' cy='26' r='1'/%3E%3Ccircle cx='76' cy='12' r='1'/%3E%3Ccircle cx='94' cy='44' r='1'/%3E%3Ccircle cx='20' cy='82' r='1'/%3E%3Ccircle cx='72' cy='96' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
                  pointerEvents: 'none',
                }}
                _after={{
                  content: '""',
                  position: 'absolute',
                  top: '-18%',
                  left: '-28%',
                  width: '68%',
                  height: '58%',
                  borderRadius: '999px',
                  transform: 'rotate(-20deg)',
                  background: isDark
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0))'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0))',
                  pointerEvents: 'none',
                  filter: 'blur(2px)',
                }}
                sx={{
                  '&:hover .card-glass-title, &:focus-within .card-glass-title': {
                    WebkitLineClamp: 'unset',
                  },
                }}
              >
                <Box ref={drawerContentRef}>
                  <Heading
                    className="card-glass-title"
                    position="relative"
                    zIndex="1"
                    fontSize={{ base: 'md', md: 'lg' }}
                    lineHeight="1.22"
                    fontWeight="semibold"
                    color="white"
                    textShadow="0 2px 14px rgba(0,0,0,0.34)"
                    transition="all 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {title}
                  </Heading>
                  <Text
                    position="relative"
                    zIndex="1"
                    mt="1.5"
                    fontSize={{ base: '10px', md: 'xs' }}
                    letterSpacing="0.02em"
                    color={isDark ? 'whiteAlpha.860' : 'rgba(255,255,255,0.92)'}
                    textShadow="0 1px 8px rgba(0,0,0,0.28)"
                  >
                    {statusText}
                  </Text>
                </Box>
              </Box>
            </Box>
          </Fade>
        </Box>
      </Link>
    </Box>
  );
}

export default function Bangumi() {
  const { data, kind } = useBangumi();
  const bangumiShow = useAtomValue(bangumiFilterAtom);

  let bangumiData = data;
  if (!bangumiData) return null;

  if (bangumiShow === 'new') bangumiData = kind?.new;
  if (bangumiShow === 'old') bangumiData = kind?.old;

  return (
    <Grid
      templateColumns={{
        base: 'repeat(auto-fit, minmax(8.5rem, 1fr))',
        sm: 'repeat(auto-fit, minmax(11rem, 1fr))',
        lg: 'repeat(auto-fit, minmax(14rem, 1fr))',
      }}
      justifyContent="stretch"
      justifyItems="stretch"
      gap={{ base: 2, md: 4, lg: 6 }}
      w="full"
    >
      {bangumiData?.data.map(bangumi => (
        <GridItem key={bangumi.id}>
          <PlayerCard bangumiData={bangumi} />
        </GridItem>
      ))}
    </Grid>
  );
}
