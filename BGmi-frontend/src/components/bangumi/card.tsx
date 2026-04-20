import { Badge, Box, Fade, Heading, Image, Text } from '@chakra-ui/react';
import { useLayoutEffect, useRef, useState } from 'react';

import Link from '~/components/router-link';
import { useColorMode } from '~/hooks/use-color-mode';
import { normalizePath, resolveCoverSrc } from '~/lib/utils';

import type { BangumiData } from '~/types/bangumi';

interface BangumiCardProps {
  bangumiData: BangumiData;
  variant?: 'default' | 'hero';
}

export default function BangumiCard({ bangumiData, variant = 'default' }: BangumiCardProps) {
  const { colorMode } = useColorMode();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const collapsedHeight = variant === 'hero' ? '4.5rem' : '5.35rem';
  const [drawerMaxHeight, setDrawerMaxHeight] = useState(collapsedHeight);
  const drawerContentRef = useRef<HTMLDivElement | null>(null);
  const isDark = colorMode === 'dark';
  const posterBg = isDark ? 'gray.900' : 'rgba(255,255,255,0.72)';
  const borderColor = isDark ? 'whiteAlpha.180' : 'rgba(162,186,198,0.24)';

  const { bangumi_name: title, cover: coverUrl, episode, status } = bangumiData;
  const statusText = episode > 0 ? `最新：第 ${episode} 集` : '暂无更新';

  useLayoutEffect(() => {
    if (!drawerExpanded || !drawerContentRef.current) {
      setDrawerMaxHeight(collapsedHeight);
      return;
    }

    setDrawerMaxHeight(`${drawerContentRef.current.scrollHeight + 24}px`);
  }, [collapsedHeight, drawerExpanded, title, statusText]);

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
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.02)' : 'none',
        zIndex: 3,
      }}
    >
      <Link href={`/player/${normalizePath(title)}`} overflow="hidden">
        <Box position="relative" bg={posterBg}>
          {status === 2 ? (
            <Badge
              pos="absolute"
              top={variant === 'hero' ? '2.5' : '3'}
              right={variant === 'hero' ? '2.5' : '3'}
              zIndex="2"
              bg="yellow.500"
              color="white"
              fontSize={variant === 'hero' ? '10px' : undefined}
              px={variant === 'hero' ? '1.5' : undefined}
            >
              NEW
            </Badge>
          ) : null}

          <Fade in={imageLoaded}>
            <Box aspectRatio={3 / 4} w="full" bg={posterBg} position="relative" overflow="hidden">
              <Image
                h="full"
                w="full"
                src={resolveCoverSrc(coverUrl)}
                alt={`${title} poster`}
                objectFit="cover"
                objectPosition="center center"
                onLoad={() => setImageLoaded(true)}
              />

              <Box
                position="absolute"
                inset="0"
                pointerEvents="none"
                bg={
                  isDark
                    ? 'linear-gradient(180deg, rgba(5,10,18,0.02) 24%, rgba(5,10,18,0.12) 48%, rgba(5,10,18,0.76) 100%)'
                    : 'linear-gradient(180deg, rgba(5,10,18,0) 28%, rgba(5,10,18,0.06) 54%, rgba(5,10,18,0.48) 100%)'
                }
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
                left={variant === 'hero' ? { base: '2.5', md: '3' } : { base: '3', md: '3.5' }}
                right={variant === 'hero' ? { base: '2.5', md: '3' } : { base: '3', md: '3.5' }}
                bottom={variant === 'hero' ? { base: '2.5', md: '3' } : { base: '3', md: '3.5' }}
                zIndex="2"
                rounded="2xl"
                px={variant === 'hero' ? { base: '2.5', md: '3' } : { base: '3', md: '3.5' }}
                py={variant === 'hero' ? { base: '2', md: '2.5' } : { base: '2.5', md: '3' }}
                borderWidth="1px"
                borderColor={isDark ? 'whiteAlpha.220' : 'rgba(255,255,255,0.14)'}
                backdropFilter="blur(2px) saturate(155%)"
                boxShadow={
                  isDark
                    ? '0 14px 32px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)'
                    : '0 12px 28px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.08)'
                }
                bg={
                  drawerExpanded
                    ? isDark
                      ? 'rgba(19, 24, 36, 0.58)'
                      : 'rgba(24, 30, 42, 0.42)'
                    : isDark
                    ? 'rgba(19, 24, 36, 0.48)'
                    : 'rgba(24, 30, 42, 0.34)'
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
                    : `linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04) 34%, rgba(255,255,255,0.01) 100%), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='%23fff' fill-opacity='.03'%3E%3Ccircle cx='12' cy='18' r='1'/%3E%3Ccircle cx='34' cy='26' r='1'/%3E%3Ccircle cx='76' cy='12' r='1'/%3E%3Ccircle cx='94' cy='44' r='1'/%3E%3Ccircle cx='20' cy='82' r='1'/%3E%3Ccircle cx='72' cy='96' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
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
                    : 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))',
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
                    fontSize={variant === 'hero' ? { base: 'sm', md: 'md' } : { base: 'md', md: 'lg' }}
                    lineHeight="1.22"
                    fontWeight="semibold"
                    color="rgba(248,250,252,0.98)"
                    textShadow="0 3px 14px rgba(0, 0, 0, 0.72)"
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
                    mt={variant === 'hero' ? '1' : '1.5'}
                    fontSize={variant === 'hero' ? { base: '10px', md: '11px' } : { base: '10px', md: 'xs' }}
                    letterSpacing="0.02em"
                    color="rgba(241,245,249,0.92)"
                    textShadow="0 1px 10px rgba(0,0,0,0.36)"
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
