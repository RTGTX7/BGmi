import {
  Badge,
  Box,
  Button,
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
import {
  buildSeasonGroups,
  buildTodayPreview,
  getCurrentSeasonKey,
  getSeasonThemeByKey,
  sortBangumis,
} from '~/lib/bangumi';
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
  const seasonTheme = useMemo(
    () => (!isUnknownSeason ? getSeasonThemeByKey(season, isDark) : undefined),
    [isDark, isUnknownSeason, season]
  );

  const currentGroup = useMemo(() => {
    if (!groupedData || !bangumiData?.data?.length) return undefined;

    if (isTodayView) {
      return buildTodayPreview(bangumiData.data);
    }

    if (isUnknownSeason) {
      return groupedData.unknownItems.length > 0
        ? {
            title: '未知季度',
            longTitle: '未识别季度信息的番剧',
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
        <Button as={RouterLink} to="/bangumi-files" w="fit-content" rounded="full" variant="ghost">
          ← 返回 Archive
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
          <Heading size="md">未找到对应季度</Heading>
          <Text mt="3" color={isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.80)'}>
            当前季度分组不存在，可能已被移除，或者当前筛选条件下没有可显示内容。
          </Text>
        </Box>
      </Stack>
    );
  }

  const pageTitle = allowRecentSort && sortMode === 'recent' ? `最近更新 · ${currentGroup.title}` : currentGroup.title;

  return (
    <Stack spacing={{ base: '4', md: '6' }} w="100%" maxW="none">
      <Helmet>
        <title>{`BGmi - ${pageTitle}`}</title>
      </Helmet>

      <Flex justify="space-between" gap="3" direction={{ base: 'column', md: 'row' }}>
        <Stack spacing="2">
          <Button
            as={RouterLink}
            to="/bangumi-files"
            w="fit-content"
            rounded="full"
            variant="ghost"
            px="0"
            _hover={{ bg: 'transparent' }}
          >
            ← 返回 Archive
          </Button>

          <Flex align="center" gap="2" wrap="wrap">
            <Heading
              size={{ base: 'md', md: 'lg' }}
              bgGradient={seasonTheme?.titleGradient}
              bgClip={seasonTheme ? 'text' : undefined}
              color={seasonTheme?.textColor ?? (isDark ? 'whiteAlpha.950' : '#263544')}
            >
              {currentGroup.title}
            </Heading>
            {allowRecentSort && sortMode === 'recent' ? (
              <Badge
                rounded="full"
                px="3"
                py="1"
                bg={seasonTheme?.backgroundColor ?? (isDark ? 'rgba(250,204,21,0.16)' : 'rgba(254,240,138,0.68)')}
                color={seasonTheme?.badgeTextColor ?? (isDark ? '#FEF3C7' : '#854D0E')}
                borderWidth="1px"
                borderColor={seasonTheme?.borderColor ?? (isDark ? 'rgba(250,204,21,0.22)' : 'rgba(253,224,71,0.78)')}
                textTransform="none"
              >
                最近更新
              </Badge>
            ) : null}
          </Flex>

          <Text color={seasonTheme?.softTextColor ?? (isDark ? 'whiteAlpha.720' : 'rgba(64,84,100,0.80)')}>
            {currentGroup.longTitle} · 共 {currentGroup.items.length} 部番剧
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
