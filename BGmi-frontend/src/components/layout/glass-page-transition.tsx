import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccentTheme } from '~/hooks/use-accent-theme';

type CardRect = { left: number; top: number; width: number; height: number };
type GlassCard = {
  rect: CardRect;
  cover: string;
  title: string;
  origin: string;
  destination: string;
  scrollY: number;
  viewport: { width: number; height: number; left: number };
  titleTarget: { left: number; top: number; fontSize: number };
};

type GlassTransitionContextValue = {
  openCard: (element: HTMLElement, title: string, cover: string, destination: string) => void;
  closeCard: () => void;
  canClose: boolean;
  progress: MotionValue<number>;
};

const GlassTransitionContext = createContext<GlassTransitionContextValue | null>(null);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (start: number, end: number, progress: number) => start + (end - start) * progress;

export function useGlassPageTransition() {
  return useContext(GlassTransitionContext);
}

function GlassSurface({ card, progress, opacity }: { card: GlassCard; progress: MotionValue<number>; opacity: MotionValue<number> }) {
  const { colors } = useAccentTheme();
  const targetWidth = card.viewport.width - card.viewport.left;
  const left = useTransform(progress, value => lerp(card.rect.left, card.viewport.left, value));
  const top = useTransform(progress, value => lerp(card.rect.top, 0, value));
  const width = useTransform(progress, value => lerp(card.rect.width, targetWidth, value));
  const height = useTransform(progress, value => lerp(card.rect.height, card.viewport.height, value));
  const radius = useTransform(progress, value => lerp(24, 0, value));
  const posterOpacity = useTransform(progress, [0, 0.2, 0.38], [1, 0.65, 0]);
  const posterScale = useTransform(progress, [0, 0.38], [1, 0.96]);
  const titleLeft = useTransform(progress, value => lerp(14, card.titleTarget.left - card.viewport.left, value));
  const titleTop = useTransform(progress, value => lerp(Math.max(12, card.rect.height - 68), card.titleTarget.top, value));
  const titleSize = useTransform(progress, value => lerp(18, card.titleTarget.fontSize, value));
  const titleColor = useTransform(progress, [0, 0.18, 0.42], ['#ffffff', '#ffffff', colors.text]);
  const surfaceBorder = useTransform(progress, [0, 1], ['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']);
  const surfaceShadow = useTransform(progress, [0, 1], ['0 28px 80px rgba(0,0,0,0.28)', '0 0 0 rgba(0,0,0,0)']);
  const glassBlur = useTransform(progress, value => `url(#bgmi-page-glass-refraction) blur(${lerp(8, 0, value)}px) saturate(${lerp(175, 100, value)}%)`);

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed', left, top, width, height, borderRadius: radius, opacity,
        zIndex: 220, overflow: 'hidden', pointerEvents: 'none',
        backgroundColor: colors.background,
        border: '1px solid',
        borderColor: surfaceBorder,
        boxShadow: surfaceShadow,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        willChange: 'left, top, width, height, border-radius, opacity',
      }}
    >
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="bgmi-page-glass-refraction">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.015" numOctaves="2" seed="7" result="texture" />
          <feDisplacementMap in="SourceGraphic" in2="texture" scale="8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <motion.img
        src={card.cover}
        alt=""
        style={{
          position: 'absolute', left: 0, top: 0, width: card.rect.width, height: card.rect.height,
          borderRadius: 22, objectFit: 'cover', opacity: posterOpacity, scale: posterScale,
          transformOrigin: 'top left',
        }}
      />
      <motion.div
        style={{
          position: 'absolute', left: titleLeft, top: titleTop, right: 14,
          color: titleColor, fontWeight: 700, fontSize: titleSize, lineHeight: 1.25,
          fontFamily: "'Avenir Next', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
          textShadow: '0 2px 12px rgba(0,0,0,0.2)',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transformOrigin: 'left center', willChange: 'left, top, font-size, color',
        }}
      >
        {card.title}
      </motion.div>
    </motion.div>
  );
}

export function GlassPageTransitionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const progress = useMotionValue(0);
  const opacity = useMotionValue(1);
  const [surface, setSurface] = useState<GlassCard | null>(null);
  const lastCardRef = useRef<GlassCard | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const swipeRef = useRef<{ pointerId: number; startX: number; lastX: number; lastTime: number; velocity: number } | null>(null);
  const canClose = Boolean(lastCardRef.current && location.pathname === lastCardRef.current.destination);

  const clearSurface = useCallback(() => {
    animationRef.current?.stop();
    setSurface(null);
    progress.set(0);
    opacity.set(1);
  }, [opacity, progress]);

  const hideExpandedSurface = useCallback(() => {
    animationRef.current = animate(opacity, 0, {
      duration: reduceMotion ? 0 : 0.2,
      onComplete: clearSurface,
    });
  }, [clearSurface, opacity, reduceMotion]);

  const openCard = useCallback((element: HTMLElement, title: string, cover: string, destination: string) => {
    const bounds = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const desktop = viewportWidth >= 992;
    const sidebarWidth = desktop ? 240 : 0;
    const mainPadding = viewportWidth >= 1280 ? 32 : desktop ? 24 : viewportWidth >= 768 ? 20 : viewportWidth >= 480 ? 16 : 12;
    const card: GlassCard = {
      rect: { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height },
      cover, title, destination,
      origin: `${location.pathname}${location.search}`,
      scrollY: window.scrollY,
      viewport: { width: viewportWidth, height: window.innerHeight, left: sidebarWidth },
      titleTarget: {
        // Match the player page's main padding and its xl-only heading margin.
        left: sidebarWidth + mainPadding + (viewportWidth < 1280 && viewportWidth < 992 ? 2.4 : 0) + (viewportWidth >= 1280 ? 40 : 0),
        top: (desktop ? 24 : 12) + 48,
        fontSize: desktop ? 24 : viewportWidth >= 480 ? 18 : 14,
      },
    };
    animationRef.current?.stop();
    lastCardRef.current = card;
    progress.set(0);
    opacity.set(1);
    setSurface(card);
    if (reduceMotion) {
      navigate(destination);
      window.scrollTo(0, 0);
      clearSurface();
      return;
    }
    let navigated = false;
    animationRef.current = animate(progress, 1, {
      type: 'spring', stiffness: 210, damping: 27, mass: 0.9,
      onUpdate: value => {
        if (value > 0.68 && !navigated) {
          navigated = true;
          navigate(destination);
          window.scrollTo(0, 0);
        }
      },
      onComplete: () => {
        if (!navigated) navigate(destination);
        hideExpandedSurface();
      },
    });
  }, [clearSurface, hideExpandedSurface, location.pathname, location.search, navigate, opacity, progress, reduceMotion]);

  const finishReturn = useCallback((card: GlassCard, velocity = 0) => {
    navigate(card.origin);
    requestAnimationFrame(() => window.scrollTo(0, card.scrollY));
    animationRef.current?.stop();
    animationRef.current = animate(progress, 0, {
      type: 'spring', stiffness: 240, damping: 28, mass: 0.85, velocity,
      onComplete: clearSurface,
    });
  }, [clearSurface, navigate, progress]);

  const closeCard = useCallback(() => {
    const card = lastCardRef.current;
    if (!card) {
      navigate(-1);
      return;
    }
    animationRef.current?.stop();
    progress.set(1);
    opacity.set(1);
    setSurface(card);
    if (reduceMotion) {
      navigate(card.origin);
      requestAnimationFrame(() => window.scrollTo(0, card.scrollY));
      clearSurface();
      return;
    }
    finishReturn(card);
  }, [clearSurface, finishReturn, navigate, opacity, progress, reduceMotion]);

  const onEdgePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canClose || event.pointerType !== 'touch' || !lastCardRef.current) return;
    swipeRef.current = { pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    animationRef.current?.stop();
    progress.set(1);
    opacity.set(1);
    setSurface(lastCardRef.current);
  };

  const onEdgePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    const delta = Math.max(0, event.clientX - swipe.startX);
    const elapsed = Math.max(8, event.timeStamp - swipe.lastTime);
    swipe.velocity = (event.clientX - swipe.lastX) / elapsed;
    swipe.lastX = event.clientX;
    swipe.lastTime = event.timeStamp;
    progress.set(1 - clamp(delta / (window.innerWidth * 0.82)));
  };

  const onEdgePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    swipeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const card = lastCardRef.current;
    if (!card) return clearSurface();
    if (progress.get() < 0.68 || swipe.velocity > 0.55) {
      finishReturn(card, -Math.abs(swipe.velocity));
    } else {
      animationRef.current = animate(progress, 1, {
        type: 'spring', stiffness: 280, damping: 30, mass: 0.7,
        onComplete: hideExpandedSurface,
      });
    }
  };

  useEffect(() => () => animationRef.current?.stop(), []);
  useEffect(() => {
    const update = (value: number) => document.documentElement.style.setProperty('--bgmi-page-transition', String(value));
    update(progress.get());
    const unsubscribe = progress.on('change', update);
    return () => {
      unsubscribe();
      document.documentElement.style.removeProperty('--bgmi-page-transition');
    };
  }, [progress]);

  const value = useMemo(() => ({ openCard, closeCard, canClose, progress }), [openCard, closeCard, canClose, progress]);
  return (
    <GlassTransitionContext.Provider value={value}>
      {children}
      {canClose ? (
        <div
          aria-hidden="true"
          onPointerDown={onEdgePointerDown}
          onPointerMove={onEdgePointerMove}
          onPointerUp={onEdgePointerUp}
          onPointerCancel={onEdgePointerUp}
          style={{ position: 'fixed', left: 0, top: 0, bottom: 96, width: 22, zIndex: 219, touchAction: 'none' }}
        />
      ) : null}
      {surface ? <GlassSurface card={surface} progress={progress} opacity={opacity} /> : null}
    </GlassTransitionContext.Provider>
  );
}
