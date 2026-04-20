import { Badge, Box, Flex, Heading, HStack, IconButton, Stack, Text } from '@chakra-ui/react';
import type { MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FiChevronDown } from 'react-icons/fi';

import { getSeasonThemeByKey, type BangumiWithSeason } from '~/lib/bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

import BangumiCard from './card';

interface BangumiGroupSectionProps {
  title: string;
  subtitle?: string;
  href: string;
  bangumis: BangumiWithSeason[];
  compactCount?: number;
  mobilePreviewCount?: number;
  seasonKey?: string;
}

export default function BangumiGroupSection({
  title,
  subtitle,
  href,
  bangumis,
  compactCount = 6,
  mobilePreviewCount = 8,
  seasonKey,
}: BangumiGroupSectionProps) {
  const { colorMode } = useColorMode();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const isDark = colorMode === 'dark';
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [desktopPreviewCount, setDesktopPreviewCount] = useState(compactCount);
  const resolvedSeasonKey = seasonKey ?? bangumis[0]?.seasonMeta?.seasonKey;
  const seasonTheme = useMemo(
    () => (resolvedSeasonKey ? getSeasonThemeByKey(resolvedSeasonKey, isDark) : undefined),
    [resolvedSeasonKey, isDark]
  );

  useEffect(() => {
    const sectionElement = sectionRef.current;
    if (!sectionElement || typeof window === 'undefined') return;

    const updateDesktopPreviewCount = () => {
      const styles = window.getComputedStyle(sectionElement);
      const width = sectionElement.clientWidth;
      const paddingLeft = Number.parseFloat(styles.paddingLeft || '0');
      const paddingRight = Number.parseFloat(styles.paddingRight || '0');
      const contentWidth = Math.max(0, width - paddingLeft - paddingRight);
      const desktopGap = window.matchMedia('(min-width: 80em)').matches ? 20 : 16;
      const desktopCardWidth = 220;
      const nextCount = Math.max(1, Math.floor((contentWidth + desktopGap) / (desktopCardWidth + desktopGap)));

      setDesktopPreviewCount(currentCount => (currentCount === nextCount ? currentCount : nextCount));
    };

    updateDesktopPreviewCount();

    const resizeObserver = new ResizeObserver(() => {
      updateDesktopPreviewCount();
    });

    resizeObserver.observe(sectionElement);
    window.addEventListener('resize', updateDesktopPreviewCount);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDesktopPreviewCount);
    };
  }, [compactCount]);

  const effectiveDesktopPreviewCount = useMemo(
    () => Math.max(1, desktopPreviewCount || compactCount),
    [compactCount, desktopPreviewCount]
  );
  const desktopPreviewItems = useMemo(
    () => bangumis.slice(0, effectiveDesktopPreviewCount),
    [bangumis, effectiveDesktopPreviewCount]
  );
  const desktopItems = useMemo(() => (expanded ? bangumis : desktopPreviewItems), [bangumis, desktopPreviewItems, expanded]);
  const mobileItems = useMemo(
    () => bangumis.slice(0, Math.max(compactCount, mobilePreviewCount)),
    [bangumis, compactCount, mobilePreviewCount]
  );
  const canExpand = bangumis.length > effectiveDesktopPreviewCount;

  const handleNavigateToGroup = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    navigate(href);
  };

  return (
    <Box
      ref={sectionRef}
      w="full"
      rounded="3xl"
      borderWidth="1px"
      borderColor={seasonTheme?.borderColor ?? (isDark ? 'whiteAlpha.090' : 'rgba(255,255,255,0.52)')}
      bg={seasonTheme?.backgroundColor ?? (isDark ? 'rgba(15,20,31,0.36)' : 'rgba(244,250,252,0.36)')}
      boxShadow={
        seasonTheme?.glowColor ??
        (isDark
          ? '0 14px 30px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.03)'
          : '0 12px 26px rgba(39,87,116,0.06), inset 0 1px 0 rgba(255,255,255,0.46)')
      }
      backdropFilter="blur(20px) saturate(170%)"
      px={{ base: '3.5', md: '4.5', xl: '5' }}
      py={{ base: '4', md: '4.5', xl: '5' }}
      transition="transform .18s ease, border-color .18s ease, background .18s ease"
      _hover={{
        borderColor: seasonTheme?.borderColor ?? (isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.72)'),
        bg: seasonTheme ? seasonTheme.backgroundColor : isDark ? 'rgba(15,20,31,0.40)' : 'rgba(244,250,252,0.4)',
      }}
    >
      <Flex
        gap={{ base: '3', md: '4' }}
        align={{ base: 'flex-start', md: 'center' }}
        justify="space-between"
        direction={{ base: 'column', md: 'row' }}
        onClick={handleNavigateToGroup}
        cursor="pointer"
      >
        <Stack spacing="1.5" minW="0" flex="1">
          <HStack spacing="2.5" align="center" flexWrap="wrap">
            <Heading
              as={RouterLink}
              to={href}
              size={{ base: 'sm', md: 'md' }}
              bgGradient={seasonTheme?.titleGradient}
              bgClip={seasonTheme ? 'text' : undefined}
              color={seasonTheme?.textColor ?? (isDark ? 'whiteAlpha.950' : '#25323f')}
              transition="all .2s ease"
              _hover={{
                color: seasonTheme?.textColor ?? (isDark ? 'blue.200' : 'blue.600'),
                textDecoration: 'underline',
                textDecorationColor: seasonTheme?.borderColor ?? (isDark ? 'rgba(191,219,254,0.72)' : 'rgba(37,99,235,0.68)'),
                textUnderlineOffset: '0.2em',
              }}
            >
              {title}
            </Heading>
            <Badge
              rounded="full"
              px="2.5"
              py="1"
              fontSize="10px"
              textTransform="none"
              bg={seasonTheme?.backgroundColor ?? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.58)')}
              color={seasonTheme?.badgeTextColor ?? (isDark ? 'whiteAlpha.880' : '#486070')}
              borderWidth="1px"
              borderColor={seasonTheme?.borderColor ?? (isDark ? 'whiteAlpha.140' : 'rgba(255,255,255,0.74)')}
              boxShadow={seasonTheme?.glowColor}
            >
              {bangumis.length} 部番剧
            </Badge>
          </HStack>
          {subtitle ? (
            <Text fontSize={{ base: 'xs', md: 'sm' }} color={seasonTheme?.softTextColor ?? (isDark ? 'whiteAlpha.700' : 'rgba(60,78,92,0.78)')}>
              {subtitle}
            </Text>
          ) : null}
        </Stack>

        <HStack
          spacing="2"
          alignSelf={{ base: 'stretch', md: 'center' }}
          justify={{ base: 'space-between', md: 'flex-end' }}
          w={{ base: 'full', md: 'auto' }}
          flexShrink={0}
        >
          {canExpand ? (
            <IconButton
              display={{ base: 'none', md: 'inline-flex' }}
              aria-label={expanded ? '收起季度预览' : '展开季度预览'}
              icon={<FiChevronDown />}
              size="sm"
              rounded="full"
              color={seasonTheme?.badgeTextColor ?? (isDark ? 'whiteAlpha.860' : '#445566')}
              bg={seasonTheme?.backgroundColor ?? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.42)')}
              borderWidth="1px"
              borderColor={seasonTheme?.borderColor ?? (isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.72)')}
              boxShadow={seasonTheme?.glowColor ??
                (isDark
                  ? '0 10px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 10px 22px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.5)')}
              _hover={{
                bg: seasonTheme?.backgroundColor ?? (isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.56)'),
              }}
              sx={{
                '& svg': {
                  transition: 'transform .24s ease',
                  transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                },
              }}
              onClick={() => setExpanded(value => !value)}
            />
          ) : null}
        </HStack>
      </Flex>

      <Box
        display={{ base: 'block', md: 'none' }}
        mt="4"
        overflowX="auto"
        pb="1.5"
        sx={{ WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity' }}
        onClick={handleNavigateToGroup}
        cursor="pointer"
      >
        <HStack spacing="3" align="stretch">
          {mobileItems.map(bangumi => (
            <Box key={bangumi.id} minW="9.35rem" maxW="9.35rem" flex="0 0 9.35rem" scrollSnapAlign="start">
              <BangumiCard bangumiData={bangumi} />
            </Box>
          ))}
        </HStack>
      </Box>

      <Box
        display={{ base: 'none', md: 'grid' }}
        mt="5"
        gridTemplateColumns="repeat(auto-fill, minmax(min(100%, 13.75rem), 1fr))"
        gap={{ md: 5 }}
        alignItems="start"
        justifyContent="stretch"
        width="100%"
        onClick={handleNavigateToGroup}
        cursor="pointer"
      >
        {desktopItems.map(bangumi => (
          <Box key={bangumi.id} w="full" maxW="17rem" justifySelf="start">
            <BangumiCard bangumiData={bangumi} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
