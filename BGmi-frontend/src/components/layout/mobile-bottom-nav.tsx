import { Box, Flex, Icon } from '@chakra-ui/react';
import { BsCalendar2CheckFill, BsFillCollectionPlayFill, BsPlayBtnFill } from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { FiMenu } from 'react-icons/fi';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useColorMode } from '~/hooks/use-color-mode';
import { useAccentTheme } from '~/hooks/use-accent-theme';
import ThemePanel from './theme-panel';
import MobileLiquidGlass from './mobile-liquid-glass-legacy';

interface NavItem {
  label: string;
  href?: string;
  icon: IconType;
  action?: 'menu';
  external?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Bangumi', href: '/', icon: BsPlayBtnFill },
  { label: 'Calendar', href: '/calendar', icon: BsCalendar2CheckFill },
  { label: 'Subscribe', href: '/subscribe', icon: BsFillCollectionPlayFill },
  { label: 'Menu', action: 'menu', icon: FiMenu },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

interface RailSize {
  width: number;
  height: number;
}

export default function MobileBottomNav({ sidebarToggle }: { sidebarToggle: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { colorMode, toggleColorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();
  const isPlayerPage = pathname.startsWith('/player/');
  const navRailRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startValue: '',
    lastValue: '',
    lastX: 0,
    lastMoveAt: 0,
  });
  const suppressClickRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const dropletPosition = useMotionValue(0);
  const dropletTilt = useMotionValue(0);
  const dropletStretchX = useMotionValue(1);
  const dropletStretchY = useMotionValue(1);
  const springPosition = useSpring(dropletPosition, { stiffness: 400, damping: 22, mass: 0.65 });
  const springTilt = useSpring(dropletTilt, { stiffness: 260, damping: 12, mass: 0.55 });
  const springStretchX = useSpring(dropletStretchX, { stiffness: 300, damping: 14, mass: 0.5 });
  const springStretchY = useSpring(dropletStretchY, { stiffness: 300, damping: 14, mass: 0.5 });
  const activeIndex = Math.max(0, navItems.findIndex(item => item.href && pathname === item.href));
  const [railSize, setRailSize] = useState<RailSize>({ width: 0, height: 0 });
  const [dragState, setDragState] = useState({
    active: false,
    moving: false,
    index: activeIndex,
    x: 0,
  });

  const navBottom = 'calc(env(safe-area-inset-bottom, 0px) + 0.85rem)';
  const navInset = isPlayerPage ? '2.55' : '3';
  const navGap = isPlayerPage ? '0.55rem' : '0.65rem';
  const navItemMinH = isPlayerPage ? '3.65rem' : '3.9rem';
  const navIconSize = isPlayerPage ? '20px' : '21px';
  const toggleButtonSize = railSize.height ? `${railSize.height}px` : isPlayerPage ? '3.65rem' : '3.9rem';
  const itemWidth = railSize.width / navItems.length;
  const dropletWidth = itemWidth * 1.08;
  const dropletHeight = railSize.height * 1.02;
  const dropletX = dragState.x + (itemWidth - dropletWidth) / 2;
  const dropletY = (railSize.height - dropletHeight) / 2;
  const dropletCenterX = dragState.x + itemWidth / 2;

  useEffect(() => {
    dropletPosition.set(dropletX);
  }, [dropletPosition, dropletX]);

  const getItemInfluence = (index: number) => {
    const itemCenterX = itemWidth * index + itemWidth / 2;
    return dragState.moving && itemWidth
      ? clamp(1 - Math.abs(dropletCenterX - itemCenterX) / (itemWidth * 1.05), 0, 1)
      : 0;
  };

  useEffect(() => {
    const rail = navRailRef.current;
    if (!rail) return;

    const syncSize = () => {
      const rect = rail.getBoundingClientRect();
      setRailSize({ width: rect.width, height: rect.height });
    };

    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [isPlayerPage]);

  const getValueFromPoint = (clientX: number, clientY: number) => {
    const option = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-mobile-nav-value]');
    return option?.dataset.mobileNavValue || '';
  };

  const getItemIndex = (value: string) => Math.max(0, navItems.findIndex(item => (item.href || item.action) === value));

  const activateValue = (value: string, openMenu = false) => {
    const item = navItems.find(entry => (entry.href || entry.action) === value);
    if (!item) return;

    if (item.action === 'menu') {
      if (openMenu) sidebarToggle();
      return;
    }

    if (item.href) navigate(item.href);
  };

  const updateDragBubble = (clientX: number, value: string, moving = true) => {
    const rail = navRailRef.current;
    const nextIndex = getItemIndex(value);
    if (!rail) {
      setDragState({ active: true, moving, index: nextIndex, x: 0 });
      return;
    }

    const rect = rail.getBoundingClientRect();
    const itemWidth = rect.width / navItems.length;
    const clampedX = Math.max(itemWidth / 2, Math.min(rect.width - itemWidth / 2, clientX - rect.left));
    setDragState({
      active: true,
      moving,
      index: nextIndex,
      x: clampedX - itemWidth / 2,
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' && event.button !== 0) return;

    const value = getValueFromPoint(event.clientX, event.clientY);
    if (!value) return;

    suppressClickRef.current = false;
    // Keep the browser click for a simple tap. touch-action on the rail still
    // gives the drag gesture control without cancelling the click event.
    const railRect = navRailRef.current?.getBoundingClientRect();
    if (railRect) {
      const slotWidth = railRect.width / navItems.length;
      const center = clamp(event.clientX - railRect.left, slotWidth / 2, railRect.width - slotWidth / 2);
      const startX = center - dropletWidth / 2;
      dropletPosition.set(startX);
      springPosition.set(startX);
    }
    dropletTilt.set(0);
    dropletStretchX.set(1);
    dropletStretchY.set(1);
    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: value,
      lastValue: value,
      lastX: event.clientX,
      lastMoveAt: event.timeStamp,
    };
    activateValue(value);
    updateDragBubble(event.clientX, value, false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    event.preventDefault();
    const movedEnough = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4;
    if (movedEnough && !drag.moved) event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.moved = drag.moved || movedEnough;
    const value = getValueFromPoint(event.clientX, event.clientY) || drag.lastValue;
    if (movedEnough && value && value !== drag.lastValue) {
      drag.lastValue = value;
      activateValue(value);
    }
    if (drag.moved && !reduceMotion) {
      const elapsed = Math.max(8, event.timeStamp - drag.lastMoveAt);
      const velocity = (event.clientX - drag.lastX) / elapsed;
      dropletTilt.set(clamp(velocity * 14, -18, 18));
      dropletStretchX.set(1 + Math.min(Math.abs(velocity) * 0.18, 0.28));
      dropletStretchY.set(1 - Math.min(Math.abs(velocity) * 0.1, 0.15));
    }
    drag.lastX = event.clientX;
    drag.lastMoveAt = event.timeStamp;
    updateDragBubble(event.clientX, value, movedEnough);
  };

  const stopDrag = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.lastValue === 'menu' && (drag.moved || drag.startValue !== 'menu')) {
      sidebarToggle();
    }
    suppressClickRef.current = drag.moved && drag.lastValue !== drag.startValue;
    dropletTilt.set(0);
    dropletStretchX.set(1);
    dropletStretchY.set(1);
    dragRef.current = {
      active: false,
      moved: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      startValue: '',
      lastValue: '',
      lastX: 0,
      lastMoveAt: 0,
    };
    setDragState(current => ({ ...current, active: false, moving: false }));
  };

  return (
    <Box display={{ base: 'block', lg: 'none' }}>
      <Flex
        position="fixed"
        left={navInset}
        right={navInset}
        bottom={navBottom}
        zIndex="210"
        align="center"
        gap={navGap}
      >
        <Box
          ref={navRailRef}
          flex="1"
          rounded="full"
          bg="transparent"
          position="relative"
          overflow="hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onClickCapture={event => {
            if (!suppressClickRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }}
          sx={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {railSize.width > 0 && railSize.height > 0 ? (
            <MobileLiquidGlass
              width={railSize.width}
              height={railSize.height}
              borderRadius={railSize.height / 2}
              strength={18}
              blur={0.55}
              style={{
                zIndex: 1,
                background: 'var(--bgmi-glass-sidebar)',
                borderColor: theme.border,
                boxShadow:
                  colorMode === 'dark'
                    ? 'inset 0 1px 1px rgba(255,255,255,0.38), inset 0 -14px 26px rgba(120,170,220,0.06), 0 16px 38px rgba(0,0,0,0.24)'
                    : 'inset 0 1px 1px rgba(255,255,255,0.74), inset 0 -14px 26px rgba(255,255,255,0.18), 0 20px 50px rgba(34,68,92,0.13)',
              }}
            />
          ) : null}
          <AnimatePresence>
            {dragState.active && railSize.width > 0 && railSize.height > 0 ? (
              <motion.div
                key="nav-droplet"
                data-nav-droplet="true"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.18 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.12 }}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 410, damping: 21, mass: 0.52 }}
                style={{
                  position: 'absolute',
                  top: dropletY,
                  width: dropletWidth,
                  height: dropletHeight,
                  x: springPosition,
                  rotate: springTilt,
                  scaleX: springStretchX,
                  scaleY: springStretchY,
                  zIndex: 3,
                  pointerEvents: 'none',
                  transformOrigin: 'center',
                }}
              >
            <MobileLiquidGlass
              width={dropletWidth}
              height={dropletHeight}
              borderRadius={dropletHeight / 2}
              strength={26}
              blur={0.35}
              opacity={0.94}
              style={{
                zIndex: 3,
                background: theme.soft,
                borderColor: theme.border,
                boxShadow:
                  colorMode === 'dark'
                    ? 'inset 0 1px 2px rgba(255,255,255,0.52), inset 0 -12px 22px rgba(255,255,255,0.10), 0 10px 28px rgba(0,0,0,0.14)'
                    : 'inset 0 1px 2px rgba(255,255,255,0.78), inset 0 -12px 22px rgba(255,255,255,0.20), 0 10px 28px rgba(34,68,92,0.10)',
              }}
            />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Flex align="stretch" justify="space-between" position="relative" zIndex="2" pointerEvents="none">
            {navItems.map(item => {
              const value = item.href || item.action || '';
              const active = item.href ? pathname === item.href : dragState.active && dragRef.current.lastValue === item.action;
              const itemIndex = getItemIndex(value);
              const influence = getItemInfluence(itemIndex);
              const navScale = 1 + influence * 0.16;
              const navLift = influence * -4;
              const iconBoost = (active ? 1.5 : 0) + influence * 4;
              const labelBoost = influence * 1.8;
              return (
                <Flex
                  key={item.label}
                  align="center"
                  justify="center"
                  minH={navItemMinH}
                  flex="1"
                  aria-label={item.label}
                  direction="column"
                  gap="0.5"
                  color={active ? colors.accent : colors.text}
                  bg="transparent"
                  transition="color 0.18s ease, transform 0.18s ease, font-size 0.18s ease"
                  transform={influence ? `translateY(${navLift}px) scale(${navScale})` : active ? 'translateY(-1px)' : 'translateY(0)'}
                  fontSize={{ base: `${10 + labelBoost}px`, sm: `${11 + labelBoost}px` }}
                  fontWeight={active || influence > 0.35 ? '900' : '700'}
                  lineHeight="1"

                >
                  <Icon as={item.icon} boxSize={`calc(${navIconSize} + ${iconBoost}px)`} transition="box-size 0.18s ease" />
                  <Box as="span">{item.label}</Box>
                </Flex>
              );
            })}
          </Flex>

          <Flex align="stretch" justify="space-between" position="absolute" inset="0" zIndex="4">
            {navItems.map(item => {
              const value = item.href || item.action || '';
              return (
                <Flex
                  key={item.label}
                  as="button"
                  type="button"
                  flex="1"
                  minH={navItemMinH}
                  aria-label={item.label}
                  data-mobile-nav-value={value}
                  bg="transparent"
                  color="transparent"
                  onClick={() => activateValue(value, true)}
                />
              );
            })}
          </Flex>
        </Box>

        <Box
          position="relative"
          w={toggleButtonSize}
          minW={toggleButtonSize}
          h={toggleButtonSize}
          rounded="full"
          overflow="hidden"
          sx={{
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {railSize.height > 0 ? (
            <MobileLiquidGlass
              width={railSize.height}
              height={railSize.height}
              borderRadius={railSize.height / 2}
              strength={24}
              blur={0.5}
              style={{
                zIndex: 1,
                background: 'var(--bgmi-glass-sidebar)',
                borderColor: theme.border,
                boxShadow:
                  colorMode === 'dark'
                    ? 'inset 0 1px 2px rgba(255,255,255,0.44), inset 0 -12px 24px rgba(120,170,220,0.07), 0 14px 34px rgba(0,0,0,0.25)'
                    : 'inset 0 1px 2px rgba(255,255,255,0.80), inset 0 -12px 24px rgba(255,255,255,0.20), 0 18px 44px rgba(34,68,92,0.13)',
              }}
            />
          ) : null}
          <Box position="absolute" inset="0" zIndex="3" w="full" h="full" rounded="full">
            <ThemePanel mobile onShortPress={toggleColorMode} />
          </Box>
        </Box>
      </Flex>
    </Box>
  );
}
