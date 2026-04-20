import {
  Badge,
  Box,
  Button,
  ButtonGroup,
  Flex,
  Heading,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';

import BangumiCard from '~/components/bangumi/card';
import { bangumiFilterAtom, useBangumi } from '~/hooks/use-bangumi';
import { buildSeasonGroups, buildTodayPreview, getCurrentSeasonKey, sortBangumis } from '~/lib/bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

export default function BangumiGroupPage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { data, kind, isLoading } = useBangumi();
  const bangumiShow = useAtomValue(bangumiFilterAtom);
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

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

  const season = params.season ?? '';
  const isUnknownSeason = season === 'unknown';
  const isTodayView = searchParams.get('from') === 'today';
  const currentSeasonKey = groupedData ? getCurrentSeasonKey(groupedData.seasonGroups) : undefined;
  const allowRecentSort = isTodayView || (!isUnknownSeason && season === currentSeasonKey);
  const sortMode = allowRecentSort && searchParams.get('sort') === 'recent' ? 'recent' : 'default';

  const currentGroup = useMemo(() => {
    if (!groupedData || !bangumiData?.data?.length) return undefined;

    if (isTodayView) {
      return buildTodayPreview(bangumiData.data);
    }

    if (isUnknownSeason) {
      return groupedData.unknownItems.length > 0
        ? {
            title: '其他番剧',
            longTitle: '未匹配到季度来源的条目',
            items: groupedData.unknownItems,
          }
        : undefined;
    }

    return groupedData.seasonGroups.find(group => group.seasonKey === season);
  }, [bangumiData?.data, groupedData, isTodayView, isUnknownSeason, season]);

  const displayItems = useMemo(() => {
    if (!currentGroup) return [];
    return sortBangumis(currentGroup.items, sortMode);
  }, [currentGroup, sortMode]);

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
        <Button as={RouterLink} to="/" w="fit-content" rounded="full" variant="ghost">
          返回 Bangumi
        </Button>
        <Box
          rounded="3xl"
          borderWidth="1px"
          borderColor={isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.74)'}
          bg={isDark ? 'rgba(17,24,39,0.50)' : 'rgba(245,251,253,0.48)'}
          px={{ base: '4', md: '6' }}
          py={{ base: '6', md: '8' }}
          backdropFilter="blur(22px) saturate(170%)"
        >
          <Heading size="md">未找到对应分类</Heading>
          <Text mt="3" color={isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.80)'}>
            这个季度分类不存在，或者当前筛选条件下没有番剧数据。
          </Text>
        </Box>
      </Stack>
    );
  }

  const pageTitle = allowRecentSort && sortMode === 'recent' ? `今日更新 · ${currentGroup.title}` : currentGroup.title;

  return (
    <Stack spacing={{ base: '4', md: '6' }}>
      <Helmet>
        <title>{`BGmi - ${pageTitle}`}</title>
      </Helmet>

      <Flex justify="space-between" gap="3" direction={{ base: 'column', md: 'row' }}>
        <Stack spacing="2">
          <Button
            as={RouterLink}
            to="/"
            w="fit-content"
            rounded="full"
            variant="ghost"
            px="0"
            _hover={{ bg: 'transparent' }}
          >
            ← 返回 Bangumi
          </Button>

          <Flex align="center" gap="2" wrap="wrap">
            <Heading size={{ base: 'md', md: 'lg' }} color={isDark ? 'whiteAlpha.950' : '#263544'}>
              {currentGroup.title}
            </Heading>
            {allowRecentSort && sortMode === 'recent' ? (
              <Badge colorScheme="yellow" rounded="full" px="3" py="1">
                今日更新排序
              </Badge>
            ) : null}
          </Flex>

          <Text color={isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.80)'}>
            {currentGroup.longTitle} · 共 {currentGroup.items.length} 部番剧
          </Text>
        </Stack>

        {allowRecentSort ? (
          <ButtonGroup
            isAttached
            alignSelf={{ base: 'stretch', md: 'flex-start' }}
            size="sm"
            bg={isDark ? 'rgba(17,24,39,0.56)' : 'rgba(244,250,252,0.52)'}
            rounded="full"
            p="1"
            borderWidth="1px"
            borderColor={isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.72)'}
          >
            <Button
              as={RouterLink}
              to={isTodayView ? `/bangumi-group/${season}?from=today` : `/bangumi-group/${season}`}
              rounded="full"
              variant={sortMode === 'default' ? 'solid' : 'ghost'}
              colorScheme="blue"
            >
              默认排序
            </Button>
            <Button
              as={RouterLink}
              to={isTodayView ? `/bangumi-group/${season}?sort=recent&from=today` : `/bangumi-group/${season}?sort=recent`}
              rounded="full"
              variant={sortMode === 'recent' ? 'solid' : 'ghost'}
              colorScheme="blue"
            >
              最近更新
            </Button>
          </ButtonGroup>
        ) : null}
      </Flex>

      <Box
        display="grid"
        gridTemplateColumns={{
          base: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(auto-fit, minmax(min(100%, 13.75rem), 13.75rem))',
        }}
        gap={{ base: 3, md: 4, xl: 5 }}
        alignItems="start"
        justifyContent={{ base: 'stretch', md: 'start' }}
      >
        {displayItems.map(bangumi => (
          <Box
            key={bangumi.id}
            minW="0"
            w={{ base: 'full', md: '13.75rem' }}
            maxW={{ base: 'none', md: '13.75rem' }}
          >
            <BangumiCard bangumiData={bangumi} />
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
