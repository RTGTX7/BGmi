import { Box, Button, Card, CardBody, Fade, Flex, HStack, Image, Input, Link, Modal, ModalBody, ModalContent, ModalOverlay, Tag, Text, useDisclosure } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getCookie } from 'cookies-next';
import { CiSearch } from 'react-icons/ci';

import CalendarTab from '~/components/calendar-tab';
import WindowGlassRefraction from '~/components/layout/window-glass-refraction';
import { FallbackCalendar } from '~/components/fallback';
import { useCalendar } from '~/hooks/use-calendar';
import { useColorMode } from '~/hooks/use-color-mode';
import { useAccentTheme } from '~/hooks/use-accent-theme';
import { windowGlassBlurValue, windowOverlayValue } from '~/hooks/use-accent-theme';
import { resolveCoverSrc } from '~/lib/utils';
import useSWR from 'swr';
import { fetcherWithTimeout } from '~/lib/fetcher';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
import type { MikanSubtitleGroupResponse } from '~/lib/mikan-subtitle';

import type { CalendarDataKey, WeekCalendar } from '~/types/calendar';

const MotionBox = motion(Box);
const ITEM_EASE = [0.22, 1, 0.36, 1] as const;

function CalendarDetailModal({ bangumi, isOpen, onClose }: { bangumi: WeekCalendar | undefined; isOpen: boolean; onClose: () => void }) {
  const { colors, glassStyle, backgroundBrightness } = useAccentTheme();
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const { handleFetchFilter } = useSubscribeAction();
  const authToken = getCookie('authToken') as string | undefined;
  const { isOpen: isPosterOpen, onOpen: onPosterOpen, onClose: onPosterClose } = useDisclosure();
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const startDismissSwipe = (event: React.TouchEvent<HTMLElement>) => {
    swipeStart.current = null;
    if (!window.matchMedia('(max-width: 767px)').matches || isPosterOpen) return;
    // Scrolling the synopsis or subtitle list remains independent of dismissal.
    let target = event.target instanceof HTMLElement ? event.target : null;
    while (target && target !== event.currentTarget) {
      if (target.scrollHeight > target.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(target).overflowY)) return;
      if (target.closest('button, a, input')) return;
      target = target.parentElement;
    }
    const touch = event.touches[0];
    if (touch) swipeStart.current = { x: touch.clientX, y: touch.clientY };
  };
  const endDismissSwipe = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const distance = start.y - touch.clientY;
    if (distance >= 72 && distance > Math.abs(touch.clientX - start.x) * 1.5) onClose();
  };
  const [followed, setFollowed] = useState<string[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const { data: overview } = useSWR<{ data?: { synopsis?: string } }>(bangumi && isOpen ? `/api/player/overview?bangumi=${encodeURIComponent(bangumi.name)}` : null, key => fetcherWithTimeout([key], {}, 30000), { revalidateOnFocus: false });
  const { data: mikan } = useSWR<MikanSubtitleGroupResponse>(bangumi && isOpen ? `/api/mikan/subtitle-groups?bangumi=${encodeURIComponent(bangumi.name)}` : null, key => fetcherWithTimeout([key], {}, 30000), { revalidateOnFocus: false });
  useEffect(() => {
    if (!bangumi || !isOpen) return;
    let active = true;
    setFollowed([]);
    setAvailableGroups([]);
    if (!authToken) return () => { active = false; };
    void handleFetchFilter(bangumi.name).then(data => {
      if (!active) return;
      setFollowed(data?.data.followed ?? []);
      setAvailableGroups(data?.data.subtitle_group ?? []);
    }).catch(() => {});
    return () => { active = false; };
  }, [authToken, bangumi, handleFetchFilter, isOpen]);
  if (!bangumi) return null;
  const calendarGroups = (bangumi.subtitle_group ?? []).map(item => {
    if (typeof item === 'string') return { id: item, name: item };
    return { id: String(item.id ?? item.name), name: item.name };
  });
  const normalizeGroup = (item: string) => item.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const isOpaqueGroupId = (name: string) => /^[0-9a-f]{16,}$/i.test(name.trim()) || /^\d+$/.test(name.trim());
  const knownGroups = [...calendarGroups, ...(mikan?.data.groups ?? [])].filter(group => group.name && !isOpaqueGroupId(group.name));
  const resolveGroupName = (value: string) => knownGroups.find(group => String(group.id) === value.trim())?.name || value;
  const namedAvailableGroups = availableGroups.map(resolveGroupName).filter(name => name && !isOpaqueGroupId(name));
  const namedMikanGroups = (mikan?.data.groups ?? []).filter(item => item?.name && !isOpaqueGroupId(item.name));
  const groups = [
    ...calendarGroups.filter(item => item.name && !isOpaqueGroupId(item.name)),
    ...namedAvailableGroups.map(name => ({ id: name, name })),
    ...namedMikanGroups.map(item => ({ id: String(item.id ?? item.name), name: item.name })),
    ...followed.map(resolveGroupName).filter(name => !isOpaqueGroupId(name)).map(name => ({ id: `followed-${name}`, name })),
  ].filter(item => item?.name).filter((item, index, list) => list.findIndex(other => normalizeGroup(other.name) === normalizeGroup(item.name)) === index);
  const followedSet = new Set(followed.map(resolveGroupName).map(normalizeGroup));
  return <>
    <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside">
    <ModalOverlay data-bgmi-window-backdrop="calendar" bg={windowOverlayValue(colorMode === 'dark' ? 'dark' : 'light', backgroundBrightness[colorMode === 'dark' ? 'dark' : 'light'])} backdropFilter="none" />
    <ModalContent onTouchStart={startDismissSwipe} onTouchEnd={endDismissSwipe} onTouchCancel={() => { swipeStart.current = null; }} data-bgmi-dim-target="calendar" zIndex={1402} mx="4" maxW="3xl" maxH="calc(100dvh - 2rem)" overflow="hidden" color={colors.text} borderWidth="1px" borderColor={`${colors.accent}44`} boxShadow="none" sx={{ '--bgmi-window-background': 'transparent', '--bgmi-window-shadow': 'none', backdropFilter: `blur(${windowGlassBlurValue(glassStyle)})`, WebkitBackdropFilter: `blur(${windowGlassBlurValue(glassStyle)})` }}>
      <WindowGlassRefraction />
      <Box display={{ base: "block", md: "none" }} w="9" h="1" rounded="full" bg={`${colors.text}38`} mx="auto" mt="2" flexShrink="0" aria-hidden="true" />
      <ModalBody p={{ base: '3', md: '5' }} display="flex" flexDirection="column" minH="0" overflow="hidden">
        <Flex direction="row" align="flex-start" gap={{ base: '3', md: '5' }}>
          <Box w={{ base: '6rem', sm: '9rem', md: '14rem' }} minW={{ base: '6rem', sm: '9rem', md: '14rem' }} aspectRatio={3 / 4} rounded="2xl" overflow="hidden" bg="transparent" cursor="zoom-in" onClick={onPosterOpen}>
            <Image src={resolveCoverSrc(bangumi.cover)} alt={bangumi.name} w="full" h="full" objectFit="contain" display="block" />
          </Box>
          <Flex direction="column" minW="0" flex="1" gap="3">
            <Text fontSize="xl" fontWeight="800">{bangumi.name}</Text>
            <Flex align="center" gap="2" flexWrap="wrap" fontSize="sm">
              {bangumi.episode ? (
                <Tag alignSelf="flex-start" bg={`${colors.accent}20`} color={colors.text} borderWidth="1px" borderColor={`${colors.accent}55`}>
                  最新：第 {bangumi.episode} 集
                </Tag>
              ) : (
                <Text fontWeight="600" color={colors.accent}>暂无剧集信息</Text>
              )}
              <Text opacity="0.42" aria-hidden="true">|</Text>
              <Text opacity={isDark ? 0.82 : 1}>更新：{bangumi.update_time || '未知'}</Text>
            </Flex>
            <Text fontSize="sm" fontWeight="700" mt="2">字幕组</Text>
            {groups.length ? (
              <Flex wrap="wrap" gap="2" maxH={{ base: '120px', md: '200px' }} overflowY="auto">
                {groups.map(group => {
                  const subscribed = followedSet.has(normalizeGroup(group.name));
                  return <Tag key={`group-${group.id}-${group.name}`} fontSize="xs" bg={subscribed ? `${colors.accent}2E` : `${colors.surface}66`} color={subscribed ? colors.accent : colors.text} borderWidth="1px" borderColor={subscribed ? `${colors.accent}88` : `${colors.text}28`}>{group.name}</Tag>;
                })}
              </Flex>
            ) : null}
          </Flex>
        </Flex>
        <Box mt="3" pt="3" borderTopWidth="1px" borderColor={`${colors.text}20`} display="flex" flexDirection="column" minH="0" flex="1">
          <Text fontSize="sm" fontWeight="700" mb="2">简介</Text>
          <Text fontSize="sm" lineHeight="1.75" overflowY="auto" minH="0" sx={{ overscrollBehavior: 'contain' }} opacity={isDark ? 0.9 : 1}>{overview?.data?.synopsis || '暂无简介'}</Text>
        </Box>
      </ModalBody>
    </ModalContent>
    </Modal>
    <Modal isOpen={isPosterOpen} onClose={onPosterClose} isCentered size="full">
      <ModalOverlay bg="rgba(2,6,23,0.84)" backdropFilter="blur(10px)" />
      <ModalContent bg="transparent" boxShadow="none" alignItems="center" justifyContent="center" onClick={onPosterClose}>
        <MotionBox
          as={Image}
          src={resolveCoverSrc(bangumi?.cover)}
          alt={bangumi?.name}
          maxH="90vh"
          maxW="90vw"
          objectFit="contain"
          cursor="zoom-out"
          initial={{ opacity: 0, scale: 0.72, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.28, ease: ITEM_EASE }}
          onClick={event => event.stopPropagation()}
        />
      </ModalContent>
    </Modal>
  </>;
}

function CalendarPanel({ bangumi, onOpen }: { bangumi: WeekCalendar; onOpen: (bangumi: WeekCalendar) => void }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const { data: overview } = useSWR<{ data?: { synopsis?: string } }>(`/api/player/overview?bangumi=${encodeURIComponent(bangumi.name)}`, key => fetcherWithTimeout([key], {}, 30000), { revalidateOnFocus: false });
  const { colorMode } = useColorMode();
  const reduceMotion = useReducedMotion();
  const isDark = colorMode === 'dark';
  const titleColor = isDark ? 'whiteAlpha.940' : '#203447';
  const linkTagBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.86)';
  const linkTagBorder = isDark ? 'whiteAlpha.140' : 'rgba(252,165,165,0.52)';
  const linkColor = isDark ? 'pink.200' : 'pink.500';
  const statusColor = bangumi.status ? (isDark ? 'green.200' : 'green.700') : isDark ? 'whiteAlpha.860' : '#4b5d71';
  const statusBg = bangumi.status
    ? isDark
      ? 'rgba(34,197,94,0.16)'
      : 'rgba(220,252,231,0.96)'
    : isDark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(241,245,249,0.96)';
  const statusBorder = bangumi.status
    ? isDark
      ? 'rgba(74,222,128,0.24)'
      : 'rgba(134,239,172,0.92)'
    : isDark
      ? 'whiteAlpha.120'
      : 'rgba(203,213,225,0.96)';

  return (
    <MotionBox
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.992 }}
      transition={reduceMotion ? { duration: 0.14 } : { duration: 0.18, ease: ITEM_EASE }}
    >
      <Card
        onClick={() => onOpen(bangumi)}
        cursor="pointer"
        maxW="full"
        overflow="hidden"
        bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.56)'}
        borderWidth="1px"
        borderColor={isDark ? 'whiteAlpha.120' : 'whiteAlpha.800'}
        backdropFilter="blur(20px) saturate(165%)"
        boxShadow={
          isDark
            ? '0 18px 38px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
            : '0 18px 38px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
        }
        position="relative"
        _before={{
          content: '""',
          position: 'absolute',
          inset: '1px',
          borderRadius: 'inherit',
          pointerEvents: 'none',
          background: isDark
            ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 24%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.52), rgba(255,255,255,0.08) 24%)',
        }}
        _after={{
          content: '""',
          position: 'absolute',
          top: '0',
          left: '0',
          right: '0',
          height: '1px',
          pointerEvents: 'none',
          background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.94)',
        }}
      >
        <CardBody
          display="flex"
          flexDirection="row"
          alignItems="stretch"
          gap={{ base: '3.5', md: '4' }}
          p={{ base: '3.5', md: '5' }}
          position="relative"
          zIndex="1"
        >
          <Box
            position="relative"
            w={{ base: '5.6rem', md: '180px' }}
            minW={{ base: '5.6rem', md: '180px' }}
            maxW={{ base: '5.6rem', md: '180px' }}
            minH={{ base: '9rem', md: '250px' }}
            maxH={{ base: '9rem', md: '250px' }}
            bg={isDark ? 'gray.900' : 'gray.100'}
            rounded="xl"
            overflow="hidden"
            boxShadow={isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.48)'}
            _after={{
              content: '""',
              position: 'absolute',
              inset: '0',
              pointerEvents: 'none',
              background: isDark
                ? 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 34%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 34%)',
            }}
            _before={{
              content: '""',
              position: 'absolute',
              inset: '0',
              pointerEvents: 'none',
              borderRadius: 'inherit',
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.46)',
              boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.02)' : 'inset 0 0 0 1px rgba(255,255,255,0.20)',
            }}
          >
            <Fade in={isLoaded}>
              <Image
                src={resolveCoverSrc(bangumi.cover)}
                loading="lazy"
                decoding="async"
                width="100%"
                height="100%"
                objectFit="cover"
                alt="cover"
                placeholder="empty"
                onLoad={() => setIsLoaded(true)}
              />
            </Fade>
          </Box>

          <Flex direction="column" minW="0" flex="1" minH={{ base: '9rem', md: '250px' }} maxH={{ base: '9rem', md: '250px' }} overflow="hidden" py={{ base: '0.1rem', md: '0.35rem' }}>
            <Text
              mr="-2"
              fontWeight="700"
              fontSize={{ base: 'sm', md: 'md' }}
              lineHeight="1.4"
              color={titleColor}
              noOfLines={{ base: 2, md: 3 }}
              wordBreak="break-word"
            >
              {bangumi.name}
            </Text>

            <Text
              mt="2"
              fontSize={{ base: 'xs', md: 'sm' }}
              lineHeight={{ base: '1.5', md: '1.6' }}
              minH={{ base: 'auto', md: '4.1rem' }}
              maxW="full"
              color={isDark ? 'whiteAlpha.700' : '#64748B'}
              wordBreak="break-word"
              noOfLines={{ base: 3, md: 6 }}
            >
              {overview?.data?.synopsis || '暂无简介'}
            </Text>

            <HStack mt={{ base: '2.5', md: 'auto' }} pt={{ base: '0', md: '3' }} spacing={{ base: '1.5', md: '2' }} flexWrap="wrap" align="center">
              <Tag
                w="fit-content"
                px={{ base: '0.62rem', md: '0.75rem' }}
                py={{ base: '0.1rem', md: '0.15rem' }}
                fontSize={{ base: 'xs', md: 'sm' }}
                bg={linkTagBg}
                borderWidth="1px"
                borderColor={linkTagBorder}
                boxShadow={
                  isDark
                    ? '0 8px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
                    : '0 8px 20px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.48)'
                }
                backdropFilter="blur(14px) saturate(160%)"
              >
                <Link color={linkColor} fontWeight="700" href={`https://bgm.tv/subject_search/${bangumi.name}`} target="_blank">
                  番剧计划
                </Link>
              </Tag>
              <Tag
                w="fit-content"
                px={{ base: '0.62rem', md: '0.75rem' }}
                py={{ base: '0.1rem', md: '0.15rem' }}
                fontSize={{ base: 'xs', md: 'sm' }}
                color={statusColor}
                bg={statusBg}
                borderWidth="1px"
                borderColor={statusBorder}
                boxShadow={
                  isDark
                    ? '0 8px 20px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.04)'
                    : '0 8px 20px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.46)'
                }
                backdropFilter="blur(14px) saturate(160%)"
              >
                {bangumi.status ? '已订阅' : '未订阅'}
              </Tag>
            </HStack>
          </Flex>
        </CardBody>
      </Card>
    </MotionBox>
  );
}

export default function Calendar() {
  const { data } = useCalendar();
  const { colorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();
  const isDark = colorMode === 'dark';
  const [activeTab, setActiveTab] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [detailBangumi, setDetailBangumi] = useState<WeekCalendar>();

  const tabListItems = useMemo(() => Object.keys(data?.data ?? []) as CalendarDataKey[], [data]);

  useEffect(() => {
    if (tabListItems.length === 0) return;
    const todayWeekday = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()] ?? 'sun';
    const fallbackTab = tabListItems.includes(todayWeekday as CalendarDataKey) ? todayWeekday : tabListItems[0];

    if (!activeTab || !tabListItems.includes(activeTab as CalendarDataKey)) {
      setActiveTab(fallbackTab);
    }
  }, [activeTab, tabListItems]);

  const activeBangumis = useMemo(() => {
    if (!data?.data) return undefined;
    if (!searchOpen) return activeTab ? data.data[activeTab as CalendarDataKey] : undefined;

    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const unique = new Map<string, WeekCalendar>();
    Object.values(data.data).forEach(items => items?.forEach(item => {
      if (item.name.toLocaleLowerCase().includes(normalized)) unique.set(item.id, item);
    }));
    return [...unique.values()];
  }, [activeTab, data, keyword, searchOpen]);

  const activeContent = (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: '1fr',
        md: 'repeat(auto-fill, minmax(20rem, 1fr))',
        lg: 'repeat(auto-fill, minmax(22rem, 1fr))',
      }}
      justifyContent="center"
      px={{ base: 0, md: 0 }}
      gap={{ base: 3, md: 4, lg: 5 }}
    >
      {activeBangumis?.length ? (
        activeBangumis.map(bangumi => <CalendarPanel key={bangumi.id} bangumi={bangumi} onOpen={setDetailBangumi} />)
      ) : (
        <MotionBox
          minH={{ base: '11rem', md: '13rem' }}
          align="center"
          justify="center"
          display="flex"
          rounded="2xl"
          borderWidth="1px"
          borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.72)'}
          bg={isDark ? 'rgba(18,24,36,0.38)' : 'rgba(255,255,255,0.42)'}
          boxShadow={
            isDark
              ? '0 16px 32px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 16px 32px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
          }
          backdropFilter="blur(18px) saturate(160%)"
          px="4"
          textAlign="center"
          gridColumn="1 / -1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Text color={isDark ? 'whiteAlpha.760' : '#5b6b7c'} fontSize={{ base: 'sm', md: 'md' }}>
            {searchOpen ? (keyword.trim() ? '没有找到相关番剧' : '输入番剧名称开始搜索') : '当前分类暂无番剧'}
          </Text>
        </MotionBox>
      )}
    </Box>
  );

  if (tabListItems.length === 0) return <FallbackCalendar />;

  return (
    <>
    <CalendarTab
      activeTabKey={activeTab}
      onActiveTabChange={tab => { setActiveTab(tab); setSearchOpen(false); }}
      tabListItems={tabListItems}
      standaloneContent={activeContent}
      contentKey={searchOpen ? 'search' : activeTab || 'calendar'}
      searchOpen={searchOpen}
      searchPanel={
        <Box data-bgmi-glass-panel w="full" rounded="2xl" bg={`${colors.surface}BF`} borderWidth="1px" borderColor={theme.border} backdropFilter="blur(20px) saturate(170%)" p="2">
          <Input
            autoFocus
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            placeholder="搜索番剧名称"
            bg={`${colors.background}9C`}
            color={colors.text}
            borderColor={theme.border}
            _placeholder={{ color: colors.text, opacity: 0.55 }}
            _focusVisible={{ borderColor: colors.accent, boxShadow: `0 0 0 2px ${theme.border}` }}
          />
        </Box>
      }
      railActions={[{
        key: 'search',
        label: '搜索',
        icon: CiSearch,
        active: searchOpen,
        onSelect: () => setSearchOpen(true),
        ariaLabel: '搜索 Calendar',
      }]}
    />
    <CalendarDetailModal bangumi={detailBangumi} isOpen={Boolean(detailBangumi)} onClose={() => setDetailBangumi(undefined)} />
    </>
  );
}
