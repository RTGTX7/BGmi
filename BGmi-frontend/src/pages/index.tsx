import { Badge, Box, Button, Flex, Heading, Spinner, Stack, Text } from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { BsChevronRight } from 'react-icons/bs';

import BangumiCard from '~/components/bangumi/card';
import { bangumiFilterAtom, useBangumi } from '~/hooks/use-bangumi';
import { buildSeasonGroups, getCurrentSeasonGroup, getSeasonThemeByKey, sortBangumis } from '~/lib/bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

const MOBILE_BREAKPOINT = 768;
const SWIPE_THRESHOLD = 72;

export default function Bangumi() {
  const { data, kind, isLoading } = useBangumi();
  const bangumiShow = useAtomValue(bangumiFilterAtom);
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const touchStateRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [hintPulse, setHintPulse] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT) return undefined;

    setHintPulse(true);
    const timer = window.setTimeout(() => setHintPulse(false), 1800);
    return () => window.clearTimeout(timer);
  }, []);

  const bangumiData = useMemo(() => {
    if (!data) return undefined;
    if (bangumiShow === 'new') return kind?.new;
    if (bangumiShow === 'old') return kind?.old;
    return data;
  }, [bangumiShow, data, kind?.new, kind?.old]);

  const groupedData = useMemo(() => {
    if (!bangumiData?.data?.length) return undefined;
    return buildSeasonGroups(bangumiData.data);
  }, [bangumiData]);

  const currentGroup = useMemo(
    () => (groupedData ? getCurrentSeasonGroup(groupedData.seasonGroups) : undefined),
    [groupedData]
  );
  const seasonAccent = useMemo(() => getSeasonThemeByKey(currentGroup?.seasonKey, isDark), [currentGroup?.seasonKey, isDark]);
  const displayItems = useMemo(() => (currentGroup ? sortBangumis(currentGroup.items, 'default') : []), [currentGroup]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button, [role="button"], input, textarea, select')) {
      touchStateRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStateRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true,
    };
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT) return;
    const state = touchStateRef.current;
    if (!state?.active) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - state.x;
    const deltaY = touch.clientY - state.y;

    if (deltaX <= 0) {
      setDragOffset(0);
      return;
    }

    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.15) {
      setDragOffset(0);
      return;
    }

    setDragOffset(Math.min(deltaX * 0.22, 34));
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === 'undefined' || window.innerWidth >= MOBILE_BREAKPOINT) return;
    const state = touchStateRef.current;
    touchStateRef.current = null;

    if (!state?.active) {
      setDragOffset(0);
      return;
    }

    const changedTouch = event.changedTouches[0];
    const deltaX = changedTouch.clientX - state.x;
    const deltaY = changedTouch.clientY - state.y;

    if (deltaX > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) {
      setDragOffset(0);
      navigate('/bangumi-files');
      return;
    }

    setDragOffset(0);
  };

  if (isLoading && !bangumiData) {
    return (
      <Flex justifyContent="center" alignItems="center" minH="40vh">
        <Spinner />
      </Flex>
    );
  }

  if (!currentGroup) {
    return (
      <Stack spacing="4">
        <Box
          rounded="3xl"
          borderWidth="1px"
          borderColor={isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.74)'}
          bg={isDark ? 'rgba(17,24,39,0.50)' : 'rgba(245,251,253,0.48)'}
          px={{ base: '4', md: '6' }}
          py={{ base: '6', md: '8' }}
          backdropFilter="blur(22px) saturate(170%)"
        >
          <Heading size="md">暂无当季番剧</Heading>
          <Text mt="3" color={isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.80)'}>
            当前数据源中没有可显示的当季新番，请稍后再试。
          </Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack
      spacing={{ base: '4', md: '6' }}
      w="100%"
      maxW="none"
      transform={{ base: `translateX(${dragOffset}px)`, md: 'none' }}
      transition={dragOffset === 0 ? 'transform .22s ease' : 'none'}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStateRef.current = null;
        setDragOffset(0);
      }}
    >
      <Helmet>
        <title>{`BGmi - ${currentGroup.title}`}</title>
      </Helmet>

      <Flex justify="space-between" gap={{ base: '3', md: '4' }} direction={{ base: 'column', md: 'row' }}>
        <Stack
          spacing={{ base: '2', md: '2.5' }}
          flex="1"
          minW="0"
          px={{ base: '3.5', md: '0' }}
          py={{ base: '3.5', md: '0' }}
          rounded={{ base: '24px', md: 'none' }}
          borderWidth={{ base: '1px', md: '0' }}
          borderColor={{ base: seasonAccent.borderColor, md: 'transparent' }}
          bg={{
            base: isDark ? 'rgba(10,16,36,0.48)' : 'rgba(245,251,253,0.52)',
            md: 'transparent',
          }}
          boxShadow={{
            base: isDark
              ? '0 14px 30px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.03)'
              : '0 12px 26px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.42)',
            md: 'none',
          }}
          backdropFilter={{ base: 'blur(18px) saturate(165%)', md: 'none' }}
        >
          <Flex align={{ base: 'flex-start', md: 'center' }} justify="space-between" gap="3" wrap="nowrap">
            <Flex align="center" gap="2" wrap="wrap" minW="0" flex="1">
              <Heading
                size={{ base: 'md', md: 'lg' }}
                bgGradient={seasonAccent.titleGradient}
                bgClip="text"
                color={seasonAccent.textColor}
                letterSpacing="0.01em"
                minW="0"
              >
                {currentGroup.title}
              </Heading>
              <Badge
                rounded="full"
                px={{ base: '2.5', md: '3' }}
                py={{ base: '0.75', md: '1' }}
                fontSize={{ base: '10px', md: 'xs' }}
                bg={seasonAccent.backgroundColor}
                color={seasonAccent.badgeTextColor}
                borderWidth="1px"
                borderColor={seasonAccent.borderColor}
                boxShadow={seasonAccent.glowColor}
                backdropFilter="blur(14px) saturate(150%)"
                textTransform="none"
              >
                当季新番
              </Badge>
            </Flex>

            <Stack spacing="1.5" align="flex-end" flexShrink={0} display={{ base: 'flex', md: 'none' }} minW="0">
              <Text
                fontSize="11px"
                lineHeight="1.2"
                color={isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.78)'}
                bg={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.34)'}
                borderWidth="1px"
                borderColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.56)'}
                rounded="full"
                px="2.5"
                py="0.9"
                backdropFilter="blur(14px) saturate(150%)"
                whiteSpace="nowrap"
                maxW="9rem"
                overflow="hidden"
                textOverflow="ellipsis"
                boxShadow={isDark ? '0 8px 20px rgba(0,0,0,0.12)' : '0 8px 18px rgba(39,87,116,0.06)'}
              >
                <Text as="span" display={{ base: 'none', sm: 'inline' }}>
                  已订阅 · 共 {currentGroup.items.length} 部番剧
                </Text>
                <Text as="span" display={{ base: 'inline', sm: 'none' }}>
                  {currentGroup.items.length}部
                </Text>
              </Text>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate('/bangumi-files')}
                rightIcon={<BsChevronRight />}
                color={seasonAccent.badgeTextColor}
                bg="transparent"
                borderWidth="0"
                rounded="full"
                px="1"
                minH="1.25rem"
                height="1.25rem"
                fontSize="11px"
                lineHeight="1"
                opacity={0.72}
                transform={hintPulse ? 'translateX(6px)' : 'translateX(0)'}
                transition="transform .45s ease, opacity .2s ease, color .2s ease"
                _hover={{
                  opacity: 1,
                  bg: 'transparent',
                  color: seasonAccent.textColor,
                }}
                _active={{ transform: 'scale(0.98)' }}
              >
                往期番剧
              </Button>
            </Stack>
          </Flex>

          <Text display={{ base: 'none', md: 'block' }} color={isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.80)'}>
            已订阅 · 共 {currentGroup.items.length} 部番剧
          </Text>
        </Stack>

      </Flex>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(auto-fill, minmax(min(100%, 13.75rem), 1fr))',
        }}
        gap={{ base: 3, md: 5 }}
        alignItems="start"
        justifyContent={{ base: 'stretch', md: 'stretch' }}
        width="100%"
      >
        {displayItems.map(bangumi => (
          <Box
            key={bangumi.id}
            minW="0"
            w="full"
            maxW={{ base: 'none', md: '17rem' }}
            justifySelf={{ base: 'stretch', md: 'start' }}
          >
            <BangumiCard bangumiData={bangumi} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
