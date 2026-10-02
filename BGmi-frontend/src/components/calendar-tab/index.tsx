import type { BoxProps, TabListProps, TabsProps } from '@chakra-ui/react';
import { Box, Flex, Icon, Tab, TabList, Tabs } from '@chakra-ui/react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import type { TouchEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { IconType } from 'react-icons';

import { useColorMode } from '~/hooks/use-color-mode';
import { getLiquidGlassGroupStyles, getLiquidGlassStyles, useLongPressDragSelect } from '~/lib/liquid-glass';
import MobileLiquidGlass from '../layout/mobile-liquid-glass';

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
  railActions?: RailAction[];
}

interface RailAction {
  key: string;
  label: string;
  icon: IconType;
  active: boolean;
  onSelect: () => void;
  ariaLabel: string;
}

type RailItem =
  | {
      kind: 'tab';
      key: string;
      label: string;
      desktopLabel?: string;
    }
  | {
      kind: 'action';
      key: string;
      label: string;
      icon: IconType;
      active: boolean;
      onSelect: () => void;
      ariaLabel: string;
    };

interface RailItemBounds {
  left: number;
  width: number;
  center: number;
}

const MotionBox = motion(Box);
const CONTENT_EASE = [0.22, 1, 0.36, 1] as const;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getRailItemWeight = (item: RailItem, type?: 'subscribe') => {
  if (type !== 'subscribe') return 1;
  if (item.kind === 'action') return 1.2;
  if (item.key === 'unknown') return 1.55;
  return 1;
};

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
      sx={getLiquidGlassStyles(colorMode, selected)}
      transform="translateY(0)"
      transition="background 0.22s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s cubic-bezier(0.22, 1, 0.36, 1), transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)"
      onClick={onClick}
      flexShrink={0}
      position="relative"
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

function getChipStyles(colorMode: string) {
  return {
    color: colorMode === 'dark' ? 'whiteAlpha.900' : '#425466',
    bg: colorMode === 'dark' ? 'rgba(255,255,255,0.045)' : 'rgba(246,251,253,0.30)',
    borderColor: colorMode === 'dark' ? 'whiteAlpha.120' : 'rgba(255,255,255,0.54)',
    boxShadow:
      colorMode === 'dark'
        ? '0 7px 18px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)'
        : '0 7px 18px rgba(39,87,116,0.06), inset 0 1px 0 rgba(255,255,255,0.30)',
    selected: {
      color: colorMode === 'dark' ? 'blue.100' : '#2563eb',
      bg: colorMode === 'dark' ? 'rgba(96,145,230,0.13)' : 'rgba(241,249,255,0.52)',
      borderColor: colorMode === 'dark' ? 'rgba(191,219,254,0.26)' : 'rgba(147,197,253,0.68)',
      boxShadow:
        colorMode === 'dark'
          ? '0 8px 18px rgba(41,121,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 8px 18px rgba(94,188,214,0.10), inset 0 1px 0 rgba(255,255,255,0.34)',
    },
    hover: {
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(246,251,253,0.42)',
      borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.66)',
      boxShadow:
        colorMode === 'dark'
          ? '0 9px 20px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.07)'
          : '0 9px 20px rgba(94,188,214,0.08), inset 0 1px 0 rgba(255,255,255,0.34)',
    },
    active: {
      bg: colorMode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(246,251,253,0.46)',
      boxShadow:
        colorMode === 'dark'
          ? '0 6px 14px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 6px 14px rgba(94,188,214,0.08), inset 0 1px 0 rgba(255,255,255,0.36)',
    },
  };
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
  railActions = [],
  ...props
}: Props & Omit<TabsProps, 'children'>) {
  const { colorMode } = useColorMode();
  const chipStyles = getChipStyles(colorMode);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion = useReducedMotion();
  const tabScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileRailRef = useRef<HTMLDivElement | null>(null);
  const mobileRailBoundsRef = useRef<{ left: number; width: number } | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousTabKeyRef = useRef<string | undefined>(undefined);
  const mobileDragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastIndex: 0,
  });
  const mobileDropletRef = useRef<HTMLDivElement | null>(null);
  const mobileVisualRef = useRef({ index: 0, moving: false });
  const mobileDragFrameRef = useRef<number | null>(null);
  const pendingMobilePositionRef = useRef<{ x: number; index: number } | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [mobileRailSize, setMobileRailSize] = useState({ width: 0, height: 0 });
  const [mobileDragState, setMobileDragState] = useState({
    active: false,
    moving: false,
    index: 0,
    x: 0,
  });

  useEffect(() => () => {
    if (mobileDragFrameRef.current !== null) window.cancelAnimationFrame(mobileDragFrameRef.current);
  }, []);

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
  const railItems = useMemo<RailItem[]>(
    () => [
      ...tabListItems.map(item => ({
        kind: 'tab' as const,
        key: item,
        label:
          type === 'subscribe'
            ? {
                sun: '日',
                mon: '一',
                tue: '二',
                wed: '三',
                thu: '四',
                fri: '五',
                sat: '六',
                unknown: '未知',
              }[item] ?? engToZh[item] ?? item
            : engToZh[item] ?? item,
        desktopLabel:
          type === 'subscribe'
            ? {
                sun: '周日',
                mon: '周一',
                tue: '周二',
                wed: '周三',
                thu: '周四',
                fri: '周五',
                sat: '周六',
                unknown: '未知',
              }[item] ?? engToZh[item] ?? item
            : undefined,
      })),
      ...railActions.map(action => ({
        kind: 'action' as const,
        ...action,
      })),
    ],
    [railActions, tabListItems, type]
  );
  const activeRailKey = railActions.find(action => action.active)?.key ?? activeTabKey;

  const tabIndex = useMemo(() => {
    if (!activeTabKey || tabListItems.length === 0) return 0;
    const matchedIndex = tabListItems.findIndex(item => item === activeTabKey);
    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [activeTabKey, tabListItems]);
  const railItemBounds = useMemo<RailItemBounds[]>(() => {
    if (railItems.length === 0 || mobileRailSize.width <= 0) return [];

    const weights = railItems.map(item => getRailItemWeight(item, type));
    const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1;
    let left = 0;

    return weights.map(weight => {
      const width = (mobileRailSize.width * weight) / totalWeight;
      const bounds = { left, width, center: left + width / 2 };
      left += width;
      return bounds;
    });
  }, [mobileRailSize.width, railItems, type]);
  const activeDragBounds = railItemBounds[mobileDragState.index];
  const railDropletWidth = (activeDragBounds?.width ?? 0) * (type === 'subscribe' ? 0.98 : 1.12);
  const railDropletHeight = mobileRailSize.height * (type === 'subscribe' ? 0.96 : 1.04);
  const railDropletCenter = mobileDragState.x || activeDragBounds?.center || 0;
  const railDropletX = railDropletCenter - railDropletWidth / 2;
  const railDropletY = (mobileRailSize.height - railDropletHeight) / 2;
  const railDropletCenterX = railDropletCenter;

  const getMobileItemInfluence = (index: number) => {
    const bounds = railItemBounds[index];
    return mobileDragState.moving && bounds
      ? clamp(1 - Math.abs(railDropletCenterX - bounds.center) / (bounds.width * 1.08), 0, 1)
      : 0;
  };

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

  useEffect(() => {
    const rail = mobileRailRef.current;
    if (!rail) return;

    const syncSize = () => {
      const rect = rail.getBoundingClientRect();
      setMobileRailSize({ width: rect.width, height: rect.height });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [railItems.length]);

  const selectTab = (tabKey: string | undefined) => {
    const nextTabKey = !tabKey || tabListItems.length === 0 ? tabListItems[0] : tabListItems.includes(tabKey) ? tabKey : tabListItems[0];
    if (!nextTabKey) return;

    if (controlledActiveTabKey === undefined) {
      setInternalActiveTabKey(nextTabKey);
    }

    onActiveTabChange?.(nextTabKey);
  };
  const tabDragSelect = useLongPressDragSelect(selectTab);

  const selectRailItem = (item: RailItem | undefined) => {
    if (!item) return;

    if (item.kind === 'action') {
      item.onSelect();
      return;
    }

    selectTab(item.key);
  };

  const getMobileIndexFromPoint = (clientX: number) => {
    const rail = mobileRailRef.current;
    if (!rail || railItems.length === 0 || railItemBounds.length === 0) return 0;

    const rect = mobileRailBoundsRef.current ?? rail.getBoundingClientRect();
    const localX = clamp(clientX - rect.left, 0, rect.width);
    const matchedIndex = railItemBounds.findIndex(bounds => localX >= bounds.left && localX <= bounds.left + bounds.width);
    return matchedIndex >= 0 ? matchedIndex : railItems.length - 1;
  };

  const updateMobileDroplet = (clientX: number, index: number, moving: boolean) => {
    const rail = mobileRailRef.current;
    if (!rail || railItems.length === 0 || railItemBounds.length === 0) {
      setMobileDragState({ active: true, moving, index, x: 0 });
      return;
    }

    const rect = mobileRailBoundsRef.current ?? rail.getBoundingClientRect();
    const bounds = railItemBounds[index] ?? railItemBounds[0];
    const safeHalfWidth = Math.max(1, bounds.width / 2);
    const continuousCenter = clamp(clientX - rect.left, safeHalfWidth, rect.width - safeHalfWidth);
    if (mobileDropletRef.current) {
      const dropletWidth = bounds.width * (type === 'subscribe' ? 0.98 : 1.12);
      mobileDropletRef.current.style.left = `${continuousCenter - dropletWidth / 2}px`;
    }
    if (!moving || mobileVisualRef.current.index !== index || !mobileVisualRef.current.moving) {
      mobileVisualRef.current = { index, moving };
      setMobileDragState({ active: true, moving, index, x: continuousCenter });
    }
  };

  const handleMobilePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || railItems.length === 0) return;

    event.preventDefault();
    const rect = mobileRailRef.current?.getBoundingClientRect();
    mobileRailBoundsRef.current = rect ? { left: rect.left, width: rect.width } : null;
    const index = getMobileIndexFromPoint(event.clientX);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    mobileDragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastIndex: index,
    };
    updateMobileDroplet(event.clientX, index, false);
    selectRailItem(railItems[index]);
  };

  const handleMobilePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = mobileDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId || railItems.length === 0) return;

    event.preventDefault();
    const movedEnough = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
    drag.moved = drag.moved || movedEnough;
    if (!drag.moved) return;
    const index = getMobileIndexFromPoint(event.clientX);
    if (index !== drag.lastIndex) {
      drag.lastIndex = index;
      selectRailItem(railItems[index]);
    }
    pendingMobilePositionRef.current = { x: event.clientX, index };
    if (mobileDragFrameRef.current !== null) return;
    mobileDragFrameRef.current = window.requestAnimationFrame(() => {
      mobileDragFrameRef.current = null;
      const pending = pendingMobilePositionRef.current;
      pendingMobilePositionRef.current = null;
      if (pending) updateMobileDroplet(pending.x, pending.index, true);
    });
  };

  const stopMobileDrag = (event: React.PointerEvent<HTMLElement>, cancelled = false) => {
    const drag = mobileDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (mobileDragFrameRef.current !== null) {
      window.cancelAnimationFrame(mobileDragFrameRef.current);
      mobileDragFrameRef.current = null;
    }
    pendingMobilePositionRef.current = null;
    mobileRailBoundsRef.current = null;
    if (!cancelled) {
      const finalIndex = getMobileIndexFromPoint(event.clientX);
      if (finalIndex !== drag.lastIndex) selectRailItem(railItems[finalIndex]);
    }
    mobileVisualRef.current.moving = false;
    mobileDragRef.current = {
      active: false,
      moved: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      lastIndex: 0,
    };
    setMobileDragState(current => ({ ...current, active: false, moving: false }));
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
        position="relative"
        align={{ base: 'stretch', lg: 'center' }}
        direction={{ base: type === 'subscribe' ? 'row' : 'column', lg: 'row' }}
        gap="3"
        justify={{ base: 'flex-start', lg: type === 'subscribe' ? 'center' : 'flex-start' }}
        flexWrap={{ base: 'nowrap', lg: 'nowrap' }}
        overflow="visible"
      >
        <Flex
          ref={tabScrollRef}
          flex={{ base: '1 1 auto', lg: type === 'subscribe' ? '0 1 38rem' : '1 1 auto' }}
          gap={{ base: '1.5', md: '2.5' }}
          align="center"
          overflowX={{ base: 'hidden', sm: 'auto', lg: 'visible' }}
          overflowY="hidden"
          flexWrap="nowrap"
          pr={{ base: '0', sm: '1', lg: '0' }}
          minW="0"
          sx={{
            ...getLiquidGlassGroupStyles(colorMode, tabDragSelect.dragging),
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
            },
          }}
        >
          <Box
            ref={mobileRailRef}
            display="block"
            position="relative"
            w="full"
            maxW={{ base: type === 'subscribe' ? '24.5rem' : 'full', md: type === 'subscribe' ? '38rem' : '42rem', xl: type === 'subscribe' ? '38rem' : '42rem' }}
            mx={{ base: 0, md: 'auto' }}
            minH={{ base: type === 'subscribe' ? '2.65rem' : '2.85rem', md: '3rem', lg: '3.1rem' }}
            rounded="full"
            overflow="hidden"
            onPointerDown={handleMobilePointerDown}
            onPointerMove={handleMobilePointerMove}
            onPointerUp={stopMobileDrag}
            onPointerCancel={event => stopMobileDrag(event, true)}
            sx={{
              touchAction: 'none',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {mobileRailSize.width > 0 && mobileRailSize.height > 0 ? (
              <MobileLiquidGlass
                width={mobileRailSize.width}
                height={mobileRailSize.height}
                borderRadius={mobileRailSize.height / 2}
                strength={16}
                blur={0}
                style={{
                  zIndex: 1,
                  background: colorMode === 'dark' ? 'rgba(24,30,54,0.12)' : 'rgba(210,229,236,0.34)',
                  borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.20)' : 'rgba(104,139,156,0.22)',
                  boxShadow:
                    colorMode === 'dark'
                      ? 'inset 0 1px 1px rgba(255,255,255,0.30), inset 0 -10px 20px rgba(255,255,255,0.05), 0 12px 28px rgba(0,0,0,0.12)'
                      : 'inset 0 1px 1px rgba(255,255,255,0.58), inset 0 -10px 20px rgba(80,125,145,0.08), 0 14px 32px rgba(34,68,92,0.12)',
                }}
              />
            ) : null}
            {mobileDragState.moving && mobileRailSize.width > 0 && mobileRailSize.height > 0 ? (
              <MobileLiquidGlass
                elementRef={mobileDropletRef}
                width={railDropletWidth}
                height={railDropletHeight}
                borderRadius={railDropletHeight / 2}
                x={railDropletX}
                y={railDropletY}
                strength={26}
                blur={0}
                opacity={0.95}
                style={{
                  zIndex: 3,
                  background: colorMode === 'dark' ? 'rgba(30,42,70,0.12)' : 'rgba(226,240,246,0.26)',
                  borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.58)',
                  boxShadow:
                    colorMode === 'dark'
                      ? 'inset 0 1px 2px rgba(255,255,255,0.46), inset 0 -12px 22px rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.12)'
                      : 'inset 0 1px 2px rgba(255,255,255,0.74), inset 0 -12px 22px rgba(255,255,255,0.16), 0 10px 24px rgba(34,68,92,0.08)',
                  transform: 'scale(1.04, 1.03)',
                  transition:
                    'left 90ms linear, width 150ms cubic-bezier(0.2, 0.9, 0.2, 1), transform 160ms cubic-bezier(0.2, 0.9, 0.2, 1)',
                }}
              />
            ) : null}
            <Flex position="relative" zIndex="2" minH={{ base: type === 'subscribe' ? '2.65rem' : '2.85rem', md: '3rem', lg: '3.1rem' }} align="center" pointerEvents="none">
              {railItems.map((item, index) => {
                const isSelected = item.kind === 'action' ? item.active : item.key === activeTabKey;
                const influence = getMobileItemInfluence(index);
                const railFlex = getRailItemWeight(item, type);
                return (
                  <Flex
                    key={item.key}
                    flex={`${railFlex} 1 0`}
                    minW="0"
                    align="center"
                    justify="center"
                    color={
                      isSelected
                        ? colorMode === 'dark' ? '#7dd3fc' : '#006eb6'
                        : colorMode === 'dark' ? 'whiteAlpha.760' : '#173149'
                    }
                    fontSize={{ base: `${(type === 'subscribe' ? 12 : 13) + (isSelected ? 1 : 0) + influence * 2}px`, md: `${14 + (isSelected ? 1 : 0) + influence * 2}px`, lg: `${15 + (isSelected ? 1 : 0) + influence * 2}px` }}
                    fontWeight={isSelected || influence > 0.35 ? '900' : '800'}
                    lineHeight="1"
                    whiteSpace="nowrap"
                    transform={influence ? `translateY(${-2 * influence}px) scale(${1 + influence * 0.11})` : 'translateY(0)'}
                    transition="color 0.18s ease, transform 0.18s ease, font-size 0.18s ease"
                    textShadow={
                      isSelected || influence
                        ? colorMode === 'dark'
                          ? `0 0 ${8 + influence * 7}px rgba(125,211,252,${0.52 + influence * 0.24}), 0 0 ${16 + influence * 8}px rgba(56,189,248,${0.22 + influence * 0.18})`
                          : `0 1px ${3 + influence * 3}px rgba(255,255,255,${0.78 + influence * 0.18}), 0 0 ${10 + influence * 6}px rgba(14,165,233,${0.20 + influence * 0.18})`
                        : 'none'
                    }
                  >
                    {item.kind === 'action' ? (
                      <Icon as={item.icon} boxSize={`${(type === 'subscribe' ? 17 : 18) + influence * 2}px`} transition="box-size 0.18s ease" />
                    ) : (
                      <>
                        <Box as="span" display={{ base: 'inline', lg: type === 'subscribe' ? 'none' : 'inline' }}>
                          {item.label}
                        </Box>
                        {type === 'subscribe' ? (
                          <Box as="span" display={{ base: 'none', lg: 'inline' }}>
                            {item.desktopLabel ?? item.label}
                          </Box>
                        ) : null}
                      </>
                    )}
                  </Flex>
                );
              })}
            </Flex>
            <Flex position="absolute" inset="0" zIndex="4">
              {railItems.map(item => (
                <Box
                  key={item.key}
                  as="button"
                  type="button"
                  flex={`${getRailItemWeight(item, type)} 1 0`}
                  minW="0"
                  aria-label={item.kind === 'action' ? item.ariaLabel : item.label}
                  bg="transparent"
                  borderWidth="0"
                  onClick={event => {
                    if (event.detail === 0) selectRailItem(item);
                  }}
                />
              ))}
            </Flex>
          </Box>

          <LayoutGroup id={`calendar-tab-${type ?? 'default'}`}>
            <TabList
              display="none"
              borderBottom="none"
              p="0"
              m="0"
              gap={{ base: '1.5', md: '2.5' }}
              flexWrap="nowrap"
              flex={{ base: '1 1 auto', sm: '0 0 auto' }}
              w={{ base: 'full', sm: 'auto' }}
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
                    px={{ base: type === 'subscribe' ? '2.25' : '2.5', sm: '3.5', lg: '4' }}
                    py={{ base: '1.9', sm: '2.15', lg: '2.35' }}
                    minH={{ base: '2.35rem', sm: '2.55rem', lg: '2.75rem' }}
                    minW={{ base: '0', sm: 'auto' }}
                    flex={{ base: '1 1 0', sm: '0 0 auto' }}
                    fontSize={{ base: 'sm', lg: 'md' }}
                    fontWeight="semibold"
                    rounded={{ base: 'full', sm: '2xl' }}
                    color={isSelected ? chipStyles.selected.color : chipStyles.color}
                    bg="transparent"
                    borderWidth="1px"
                    borderColor={isSelected ? chipStyles.selected.borderColor : chipStyles.borderColor}
                    boxShadow={isSelected ? chipStyles.selected.boxShadow : chipStyles.boxShadow}
                    backdropFilter="blur(10px) saturate(145%)"
                    sx={getLiquidGlassStyles(colorMode, isSelected, { compact: true, subtle: true })}
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
                    {...tabDragSelect.getOptionProps(week)}
                  >
                    {isSelected ? (
                      <MotionBox
                        layoutId={`tab-indicator-${type ?? 'default'}`}
                        position="absolute"
                        inset="0"
                        rounded={{ base: 'full', sm: '2xl' }}
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

          {false ? (
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
            w={{ base: type === 'subscribe' ? 'auto' : 'full', lg: 'auto' }}
            alignItems="center"
            justifyContent="flex-end"
            gap="2.5"
            ml={{ base: 0, lg: type === 'subscribe' ? 0 : 'auto' }}
            flexWrap="wrap"
            position="static"
            pointerEvents="auto"
          >
            {false ? (
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

      <Box mt={searchOpen ? 0 : type === 'subscribe' ? { base: 4, lg: 3 } : 3} {...boxProps} />
      <Box onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} overflow="hidden">
        {type === 'subscribe' || isMobile ? (
          <Box>{standaloneContent ? standaloneContent : children}</Box>
        ) : (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <MotionBox
              key={resolvedContentKey}
              custom={direction}
              initial={reduceMotion || isMobile ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? animationDistance : -animationDistance }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion || isMobile ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -animationDistance : animationDistance }}
              transition={reduceMotion || isMobile ? { duration: 0.12 } : { duration: 0.32, ease: CONTENT_EASE }}
            >
              {standaloneContent ? standaloneContent : children}
            </MotionBox>
          </AnimatePresence>
        )}
      </Box>
    </Tabs>
  );
}
