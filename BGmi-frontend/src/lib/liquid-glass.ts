import type { SystemStyleObject } from '@chakra-ui/react';
import { useCallback, useRef, useState } from 'react';

type ColorMode = 'light' | 'dark' | string;

interface LiquidGlassStyleOptions {
  radius?: string;
  compact?: boolean;
  subtle?: boolean;
}

export function getLiquidGlassStyles(
  colorMode: ColorMode,
  active = false,
  options: LiquidGlassStyleOptions = {}
): SystemStyleObject {
  const isDark = colorMode === 'dark';
  const { radius = '999px', compact = false, subtle = false } = options;
  const blur = subtle ? 10 : compact ? 12 : 16;
  const activeBlur = subtle ? 12 : compact ? 14 : 18;

  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius,
    borderWidth: '1px',
    borderColor: active
      ? isDark
        ? 'rgba(191,219,254,0.28)'
        : 'rgba(147,197,253,0.66)'
      : isDark
      ? 'rgba(255,255,255,0.12)'
      : 'rgba(255,255,255,0.50)',
    bg: active
      ? isDark
        ? 'rgba(96, 145, 230, 0.14)'
        : 'rgba(245,251,255,0.48)'
      : isDark
      ? 'rgba(255,255,255,0.045)'
      : 'rgba(245,251,255,0.28)',
    boxShadow: active
      ? isDark
        ? '0 8px 20px rgba(69,120,255,0.14), inset 0 1px 0 rgba(255,255,255,0.10)'
        : '0 8px 20px rgba(68,132,196,0.10), inset 0 1px 0 rgba(255,255,255,0.42)'
      : isDark
      ? '0 6px 16px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
      : '0 6px 16px rgba(40,78,116,0.06), inset 0 1px 0 rgba(255,255,255,0.34)',
    backdropFilter: `blur(${active ? activeBlur : blur}px) saturate(${subtle ? 140 : 155}%)`,
    WebkitBackdropFilter: `blur(${active ? activeBlur : blur}px) saturate(${subtle ? 140 : 155}%)`,
    transition:
      'transform 180ms cubic-bezier(0.22, 1, 0.36, 1), background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
    _before: {
      content: '""',
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      background: isDark
        ? 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03) 36%, rgba(91,141,255,0.08))'
        : 'linear-gradient(135deg, rgba(255,255,255,0.46), rgba(255,255,255,0.12) 40%, rgba(117,188,255,0.08))',
      opacity: active ? 0.56 : 0.26,
    },
    _after: {
      content: '""',
      position: 'absolute',
      width: '30%',
      height: '130%',
      top: '-34%',
      left: active ? '72%' : '-58%',
      transform: 'rotate(20deg)',
      pointerEvents: 'none',
      background: isDark
        ? 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0))'
        : 'linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0))',
      opacity: active ? 0.34 : 0,
      transition: 'left 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease',
    },
    _hover: {
      transform: 'translateY(-1px)',
      _after: {
        left: '88%',
        opacity: 0.42,
      },
    },
    _active: {
      transform: 'translateY(1px) scale(0.985)',
    },
  };
}

export function getLiquidGlassGroupStyles(colorMode: ColorMode, dragging = false): SystemStyleObject {
  const isDark = colorMode === 'dark';

  return {
    bg: dragging ? (isDark ? 'rgba(96,145,230,0.10)' : 'rgba(236,248,252,0.24)') : undefined,
    borderRadius: dragging ? '18px' : undefined,
    cursor: dragging ? 'grabbing' : undefined,
    touchAction: 'pan-y',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };
}

export function getLiquidGlassButtonStyles(
  colorMode: ColorMode,
  active = false,
  options: LiquidGlassStyleOptions = {}
): SystemStyleObject {
  const isDark = colorMode === 'dark';

  return {
    ...getLiquidGlassStyles(colorMode, active, { subtle: true, ...options }),
    color: active ? (isDark ? 'blue.100' : 'blue.600') : undefined,
    transform: 'translateY(0)',
    WebkitTapHighlightColor: 'transparent',
    _hover: {
      transform: 'translateY(-1px)',
      borderColor: active
        ? isDark
          ? 'rgba(191,219,254,0.38)'
          : 'rgba(147,197,253,0.92)'
        : isDark
        ? 'rgba(255,255,255,0.22)'
        : 'rgba(255,255,255,0.92)',
      _after: {
        left: '88%',
        opacity: 0.9,
      },
    },
    _active: {
      transform: 'translateY(1px) scale(0.985)',
    },
  };
}

export function useLongPressDragSelect(
  onSelect: (value: string) => void,
  options: { delay?: number; disabled?: boolean } = {}
) {
  const { delay = 260, disabled = false } = options;
  const timerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false);
  const lastValueRef = useRef('');
  const suppressNextClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const selectFromPoint = useCallback(
    (x: number, y: number) => {
      const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-liquid-option-value]');
      const value = element?.dataset.liquidOptionValue;
      if (!value || value === lastValueRef.current) return;

      lastValueRef.current = value;
      onSelect(value);
    },
    [onSelect]
  );

  const stop = useCallback(() => {
    if (activeRef.current) {
      suppressNextClickRef.current = true;
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 0);
    }

    clearTimer();
    activeRef.current = false;
    pointerIdRef.current = null;
    startPointRef.current = null;
    lastValueRef.current = '';
    setDragging(false);
  }, [clearTimer]);

  return {
    dragging,
    getOptionProps: (value: string) => ({
      'data-liquid-option-value': value,
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
        if (disabled || event.button !== 0) return;
        const target = event.currentTarget;
        pointerIdRef.current = event.pointerId;
        startPointRef.current = { x: event.clientX, y: event.clientY };
        lastValueRef.current = value;

        clearTimer();
        timerRef.current = window.setTimeout(() => {
          if (pointerIdRef.current !== event.pointerId) return;
          activeRef.current = true;
          setDragging(true);
          target.setPointerCapture?.(event.pointerId);
          onSelect(value);
        }, delay);
      },
      onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
        if (disabled || pointerIdRef.current !== event.pointerId) return;
        const start = startPointRef.current;
        if (!start) return;

        if (!activeRef.current) {
          const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
          if (distance > 12) {
            clearTimer();
          }
          return;
        }

        event.preventDefault();
        selectFromPoint(event.clientX, event.clientY);
      },
      onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        stop();
      },
      onPointerCancel: (event: React.PointerEvent<HTMLElement>) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        stop();
      },
      onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
        if (!suppressNextClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressNextClickRef.current = false;
      },
      onPointerLeave: (event: React.PointerEvent<HTMLElement>) => {
        if (!activeRef.current && pointerIdRef.current === event.pointerId) stop();
      },
    }),
  };
}
