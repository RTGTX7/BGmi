import type { BoxProps, TabListProps, TabsProps } from '@chakra-ui/react';
import { Box, Flex, Tab, TabList, Tabs } from '@chakra-ui/react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useColorMode } from '~/hooks/use-color-mode';

interface Props {
  children?: React.ReactNode;
  customElement?: React.ReactNode;
  searchOpen?: boolean;
  searchPanel?: React.ReactNode;
  standaloneContent?: React.ReactNode;
  onSearchToggle?: () => void;
  activeTabKey?: string;
  onActiveTabChange?: (tabKey: string) => void;
  tabListItems: string[];
  tabListProps?: TabListProps;
  boxProps?: BoxProps;
  type?: 'subscribe';
  contentKey?: string;
}

const MotionBox = motion(Box);
const CONTENT_EASE = [0.22, 1, 0.36, 1] as const;

function getChipStyles(colorMode: string) {
  return {
    color: colorMode === 'dark' ? 'whiteAlpha.900' : '#425466',
    bg: colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)',
    borderColor: colorMode === 'dark' ? 'whiteAlpha.140' : 'rgba(255,255,255,0.82)',
    boxShadow:
      colorMode === 'dark'
        ? '0 10px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.05)'
        : '0 12px 28px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.46)',
    selected: {
      color: colorMode === 'dark' ? 'blue.100' : '#2563eb',
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.44)',
      borderColor: colorMode === 'dark' ? 'rgba(191,219,254,0.30)' : 'rgba(191,219,254,0.86)',
      boxShadow:
        colorMode === 'dark'
          ? '0 12px 28px rgba(41,121,255,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
          : '0 14px 30px rgba(94,188,214,0.16), 0 3px 10px rgba(59,130,246,0.12), inset 0 1px 0 rgba(255,255,255,0.54)',
    },
    hover: {
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.36)',
      borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.92)',
      boxShadow:
        colorMode === 'dark'
          ? '0 14px 30px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.09)'
          : '0 16px 32px rgba(94,188,214,0.14), 0 3px 10px rgba(59,130,246,0.08), inset 0 1px 0 rgba(255,255,255,0.54)',
    },
    active: {
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.42)',
      boxShadow:
        colorMode === 'dark'
          ? '0 8px 18px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.10)'
          : '0 10px 20px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.60)',
    },
  };
}

function ActionChip({
  children,
  colorMode,
  selected = false,
  onClick,
  display,
}: {
  children: React.ReactNode;
  colorMode: string;
  selected?: boolean;
  onClick?: () => void;
  display?: Record<string, string>;
}) {
  const chipStyles = getChipStyles(colorMode);

  return (
    <Box
      as="button"
      type="button"
      display={display}
      whiteSpace="nowrap"
      alignItems="center"
      justifyContent="center"
      px={{ base: '3.5', lg: '4' }}
      h="10"
      minH="10"
      fontSize={{ base: 'sm', lg: 'md' }}
      lineHeight="1"
      fontWeight="semibold"
      rounded="2xl"
      bg={selected ? chipStyles.selected.bg : chipStyles.bg}
      color={selected ? chipStyles.selected.color : chipStyles.color}
      borderWidth="1px"
      borderColor={selected ? chipStyles.selected.borderColor : chipStyles.borderColor}
      boxShadow={selected ? chipStyles.selected.boxShadow : chipStyles.boxShadow}
      backdropFilter="blur(18px) saturate(168%)"
      transform="translateY(0)"
      transition="background 0.22s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)"
      onClick={onClick}
      flexShrink={0}
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        top: '-30%',
        left: '-60%',
        width: '48%',
        height: '160%',
        transform: 'rotate(18deg)',
        background:
          colorMode === 'dark'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.40), rgba(255,255,255,0))',
        opacity: selected ? 0.9 : 0,
        transition: 'opacity 0.22s ease, left 0.28s ease',
        pointerEvents: 'none',
      }}
      _hover={{
        bg: selected ? chipStyles.selected.bg : chipStyles.hover.bg,
        borderColor: selected ? chipStyles.selected.borderColor : chipStyles.hover.borderColor,
        boxShadow: selected ? chipStyles.selected.boxShadow : chipStyles.hover.boxShadow,
        transform: 'translateY(-1px)',
        _before: {
          opacity: 1,
          left: '92%',
        },
      }}
      _active={{
        bg: selected ? chipStyles.selected.bg : chipStyles.active.bg,
        boxShadow: selected ? chipStyles.selected.boxShadow : chipStyles.active.boxShadow,
        transform: 'translateY(1px) scale(0.985)',
      }}
    >
      {children}
    </Box>
  );
}

export default function CalendarTab({
  children,
  customElement,
  searchOpen,
  searchPanel,
  standaloneContent,
  onSearchToggle,
  activeTabKey: controlledActiveTabKey,
  onActiveTabChange,
  tabListItems,
  tabListProps,
  boxProps,
  type,
  contentKey,
  ...props
}: Props & Omit<TabsProps, 'children'>) {
  const { colorMode } = useColorMode();
  const chipStyles = getChipStyles(colorMode);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion = useReducedMotion();
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousTabKeyRef = useRef<string | undefined>(undefined);
  const [direction, setDirection] = useState<1 | -1>(1);

  const engToZh: Record<string, string> = {
    dashboard: 'Dashboard',
    mon: '周一',
    tue: '周二',
    wed: '周三',
    thu: '周四',
    fri: '周五',
    sat: '周六',
    sun: '周日',
    unknown: '未知',
  };

  const weekdayKeyMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayWeekKey = weekdayKeyMap[new Date().getDay()] ?? 'sun';
  const defaultTabKey = useMemo(() => {
    if (tabListItems.length === 0) return undefined;
    const matchedTab = tabListItems.find(item => item === todayWeekKey);
    return matchedTab ?? tabListItems[0];
  }, [tabListItems, todayWeekKey]);
  const [internalActiveTabKey, setInternalActiveTabKey] = useState<string | undefined>(defaultTabKey);
  const activeTabKey = controlledActiveTabKey ?? internalActiveTabKey;

  const tabIndex = useMemo(() => {
    if (!activeTabKey || tabListItems.length === 0) return 0;
    const matchedIndex = tabListItems.findIndex(item => item === activeTabKey);
    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [activeTabKey, tabListItems]);

  useEffect(() => {
    if (tabListItems.length === 0) {
      setInternalActiveTabKey(undefined);
      return;
    }

    setInternalActiveTabKey(current => {
      if (!current) return defaultTabKey;
      return tabListItems.includes(current) ? current : tabListItems[0];
    });
  }, [defaultTabKey, tabListItems]);

  useEffect(() => {
    if (!activeTabKey) return;
    const previousKey = previousTabKeyRef.current;
    if (!previousKey || previousKey === activeTabKey) {
      previousTabKeyRef.current = activeTabKey;
      return;
    }

    const previousIndex = tabListItems.findIndex(item => item === previousKey);
    const nextIndex = tabListItems.findIndex(item => item === activeTabKey);
    if (previousIndex !== -1 && nextIndex !== -1) {
      setDirection(nextIndex > previousIndex ? 1 : -1);
    }
    previousTabKeyRef.current = activeTabKey;
  }, [activeTabKey, tabListItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia('(max-width: 47.99em)');
    const syncMobileState = () => setIsMobile(media.matches);
    syncMobileState();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', syncMobileState);
      return () => media.removeEventListener('change', syncMobileState);
    }

    media.addListener(syncMobileState);
    return () => media.removeListener(syncMobileState);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !activeTabKey) return;
    const container = tabScrollRef.current;
    const target = tabRefs.current[activeTabKey];
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextLeft = target.offsetLeft - container.clientWidth / 2 + target.clientWidth / 2;
    const withinBounds =
      targetRect.left >= containerRect.left + 24 && targetRect.right <= containerRect.right - 24;

    if (withinBounds) return;

    container.scrollTo({
      left: Math.max(0, nextLeft),
      behavior: 'smooth',
    });
  }, [activeTabKey]);

  const selectTab = (tabKey: string | undefined) => {
    const nextTabKey = !tabKey || tabListItems.length === 0 ? tabListItems[0] : tabListItems.includes(tabKey) ? tabKey : tabListItems[0];
    if (!nextTabKey) return;

    if (controlledActiveTabKey === undefined) {
      setInternalActiveTabKey(nextTabKey);
    }

    onActiveTabChange?.(nextTabKey);
  };

  const moveTabIndex = (nextDirection: 'prev' | 'next') => {
    if (tabListItems.length <= 1) return;

    const currentIndex = activeTabKey ? tabListItems.findIndex(item => item === activeTabKey) : -1;
    const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      nextDirection === 'next'
        ? (safeCurrentIndex + 1) % tabListItems.length
        : (safeCurrentIndex - 1 + tabListItems.length) % tabListItems.length;

    selectTab(tabListItems[nextIndex]);
  };

  const isSwipeBlockedTarget = (target: EventTarget | null) => {
    const element = target instanceof Element ? target : null;
    if (!element) return false;

    return Boolean(
      element.closest(
        'button, a, input, textarea, select, [role="button"], [data-swipe-ignore="true"], .chakra-menu__menu-list'
      )
    );
  };

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (isSwipeBlockedTarget(event.target)) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (isSwipeBlockedTarget(event.target)) return;

    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 56 || absX <= absY * 1.25 || absY > 48) return;

    if (deltaX < 0) {
      moveTabIndex('next');
      return;
    }

    moveTabIndex('prev');
  };

  const animationDistance = reduceMotion ? 0 : 18;
  const resolvedContentKey = contentKey ?? activeTabKey ?? 'content';

  return (
    <Tabs
      position="relative"
      isLazy
      lazyBehavior="keepMounted"
      {...props}
      index={tabIndex}
    >
      <Flex
        align={{ base: 'stretch', lg: 'center' }}
        direction={{ base: 'column', lg: 'row' }}
        gap="3"
        flexWrap={{ base: 'nowrap', lg: 'nowrap' }}
        overflow="visible"
      >
        <Flex
          ref={tabScrollRef}
          flex="1 1 auto"
          gap={{ base: '2', md: '2.5' }}
          align="center"
          overflowX={{ base: 'auto', lg: 'visible' }}
          overflowY="hidden"
          flexWrap="nowrap"
          pr={{ base: '1', lg: '0' }}
          sx={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          <LayoutGroup id={`calendar-tab-${type ?? 'default'}`}>
            <TabList
              borderBottom="none"
              p="0"
              m="0"
              gap={{ base: '2', md: '2.5' }}
              flexWrap="nowrap"
              flex="0 0 auto"
              {...tabListProps}
            >
              {tabListItems.map(week => {
                const isSelected = week === activeTabKey;
                return (
                  <Tab
                    key={week}
                    ref={node => {
                      tabRefs.current[week] = node;
                    }}
                    onClick={() => selectTab(week)}
                    whiteSpace="nowrap"
                    mb="0"
                    px={{ base: '3.5', lg: '4' }}
                    py={{ base: '2.5', lg: '2.75' }}
                    minH={{ base: '2.9rem', lg: '3.1rem' }}
                    fontSize={{ base: 'sm', lg: 'md' }}
                    fontWeight="semibold"
                    rounded="2xl"
                    color={isSelected ? chipStyles.selected.color : chipStyles.color}
                    bg="transparent"
                    borderWidth="1px"
                    borderColor={isSelected ? chipStyles.selected.borderColor : chipStyles.borderColor}
                    boxShadow={isSelected ? chipStyles.selected.boxShadow : chipStyles.boxShadow}
                    backdropFilter="blur(18px) saturate(168%)"
                    transition="color 0.22s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)"
                    position="relative"
                    overflow="hidden"
                    _hover={{
                      borderColor: isSelected ? chipStyles.selected.borderColor : chipStyles.hover.borderColor,
                      boxShadow: isSelected ? chipStyles.selected.boxShadow : chipStyles.hover.boxShadow,
                      transform: 'translateY(-1px)',
                    }}
                    _active={{
                      transform: 'translateY(1px) scale(0.985)',
                    }}
                    _selected={{
                      color: chipStyles.selected.color,
                      transform: 'translateY(-1px)',
                    }}
                    flexShrink={0}
                  >
                    {isSelected ? (
                      <MotionBox
                        layoutId={`tab-indicator-${type ?? 'default'}`}
                        position="absolute"
                        inset="0"
                        rounded="2xl"
                        bg={chipStyles.selected.bg}
                        borderWidth="1px"
                        borderColor={chipStyles.selected.borderColor}
                        boxShadow={chipStyles.selected.boxShadow}
                        transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                      />
                    ) : null}
                    <Box position="relative" zIndex={1}>
                      {engToZh[week] ?? week}
                    </Box>
                  </Tab>
                );
              })}
            </TabList>
          </LayoutGroup>

          {type === 'subscribe' ? (
            <ActionChip
              colorMode={colorMode}
              selected={!!searchOpen}
              onClick={onSearchToggle}
              display={{ base: 'inline-flex', lg: 'none' }}
            >
              搜索
            </ActionChip>
          ) : null}
        </Flex>

        {type === 'subscribe' || customElement ? (
          <Box
            flexShrink={0}
            display="flex"
            w={{ base: 'full', lg: 'auto' }}
            alignItems="center"
            justifyContent={{ base: 'flex-start', lg: 'flex-end' }}
            gap="2.5"
            ml={{ base: 0, lg: 'auto' }}
            flexWrap="wrap"
          >
            {type === 'subscribe' ? (
              <ActionChip
                colorMode={colorMode}
                selected={!!searchOpen}
                onClick={onSearchToggle}
                display={{ base: 'none', lg: 'inline-flex' }}
              >
                搜索
              </ActionChip>
            ) : null}
            {customElement}
          </Box>
        ) : null}
      </Flex>

      <AnimatePresence initial={false}>
        {type === 'subscribe' && searchOpen && searchPanel ? (
          <MotionBox
            key="search-panel"
            mt={{ base: '3', lg: '4' }}
            mb={{ base: '3', lg: '4' }}
            w="full"
            display="flex"
            justifyContent="center"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: CONTENT_EASE }}
          >
            <Box w="full" maxW={{ base: 'calc(100% - 0.5rem)', lg: '30rem' }}>
              {searchPanel}
            </Box>
          </MotionBox>
        ) : null}
      </AnimatePresence>

      <Box mt={searchOpen ? 0 : 3} {...boxProps} />
      <Box onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} overflow="hidden">
        {type === 'subscribe' ? (
          <Box key={resolvedContentKey}>{standaloneContent ? standaloneContent : children}</Box>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <MotionBox
              key={resolvedContentKey}
              custom={direction}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? animationDistance : -animationDistance }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -animationDistance : animationDistance }}
              transition={reduceMotion ? { duration: 0.16 } : { duration: 0.32, ease: CONTENT_EASE }}
            >
              {standaloneContent ? standaloneContent : children}
            </MotionBox>
          </AnimatePresence>
        )}
      </Box>
    </Tabs>
  );
}
