import { useAtomValue } from 'jotai';
import { useLayoutEffect, useRef, useState } from 'react';
import { opticalSettingsAtom, useAccentTheme, windowGlassBlurValue, windowGlassSurfaceValue, windowOverlayValue } from '~/hooks/use-accent-theme';
import MobileLiquidGlass from './mobile-liquid-glass';

type Size = { width: number; height: number; radius: number };

function findBackgroundLayer(target: HTMLElement): HTMLElement | null {
  const name = target.dataset.bgmiDimTarget;
  if (name) return document.querySelector<HTMLElement>(`[data-bgmi-window-backdrop="${name}"]`);
  const modalContainer = target.closest('.chakra-modal__content-container');
  if (modalContainer) return modalContainer.parentElement?.querySelector<HTMLElement>('.chakra-modal__overlay') || null;
  return target.previousElementSibling as HTMLElement | null;
}

/** Apply the mobile glass displacement directly to the window's single surface. */
export default function WindowGlassRefraction() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0, radius: 24 });
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const optics = useAtomValue(opticalSettingsAtom);
  const { glassStyle, windowTransparency, colors, mode, backgroundBrightness } = useAccentTheme();
  const strength = 0.01 + optics.refraction * 60;
  const edgeWidth = 4 + optics.zRadius * 0.45;

  useLayoutEffect(() => {
    if (!target) return;
    const values: Record<string, string> = {
      '--bgmi-window-text': colors.text,
      '--bgmi-window-control': `${colors.surface}66`,
      '--bgmi-window-control-border': `${colors.text}38`,
      '--bgmi-window-hover': `${colors.text}12`,
    };
    const previous = Object.keys(values).map(key => target.style.getPropertyValue(key));
    Object.entries(values).forEach(([key, value]) => target.style.setProperty(key, value));
    return () => Object.keys(values).forEach((key, index) => {
      if (previous[index]) target.style.setProperty(key, previous[index]);
      else target.style.removeProperty(key);
    });
  }, [colors.text, colors.surface, target]);

  useLayoutEffect(() => {
    if (!target) return;
    const previous = target.style.getPropertyValue('--bgmi-window-background');
    const previousColor = target.style.getPropertyValue('background-color');
    const previousPriority = target.style.getPropertyPriority('background-color');
    target.style.setProperty('--bgmi-window-background', windowGlassSurfaceValue(windowTransparency, mode, colors.surface));
    target.style.setProperty('background-color', windowGlassSurfaceValue(windowTransparency, mode, colors.surface), 'important');
    return () => {
      if (previous) target.style.setProperty('--bgmi-window-background', previous);
      else target.style.removeProperty('--bgmi-window-background');
      if (previousColor) target.style.setProperty('background-color', previousColor, previousPriority);
      else target.style.removeProperty('background-color');
    };
  }, [windowTransparency, mode, colors.surface, target]);

  useLayoutEffect(() => {
    const windowElement = hostRef.current?.parentElement;
    if (!windowElement) return;
    setTarget(windowElement);
    const measure = () => {
      const radius = Number.parseFloat(getComputedStyle(windowElement).borderTopLeftRadius) || 24;
      // Modal entrance animations scale the visual rectangle. SVG filters use
      // the untransformed layout coordinates of the element they filter.
      const next = { width: windowElement.offsetWidth, height: windowElement.offsetHeight, radius };
      setSize(previous => previous.width === next.width && previous.height === next.height && previous.radius === next.radius ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(windowElement);
    window.addEventListener('resize', measure);
    windowElement.addEventListener('animationend', measure);
    windowElement.addEventListener('transitionend', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      windowElement.removeEventListener('animationend', measure);
      windowElement.removeEventListener('transitionend', measure);
    };
  }, []);

  useLayoutEffect(() => {
    if (!target) return;
    const overlay = findBackgroundLayer(target);
    if (!overlay) return;
    // The full-screen element only handles dismissal. Its child is the
    // physical backing beneath the glass, never a tint above the window.
    const previousBackground = overlay.style.getPropertyValue('background-color');
    const previousPriority = overlay.style.getPropertyPriority('background-color');
    overlay.style.setProperty('background-color', 'transparent', 'important');
    const backing = document.createElement('div');
    backing.dataset.bgmiWindowBacking = target.dataset.bgmiDimTarget || 'window';
    Object.assign(backing.style, { position: 'absolute', pointerEvents: 'none', zIndex: '0' });
    backing.style.setProperty('background', windowOverlayValue(mode, backgroundBrightness[mode]), 'important');
    overlay.appendChild(backing);
    let frame = 0;
    const sync = () => {
      const rect = target.getBoundingClientRect();
      const parent = overlay.getBoundingClientRect();
      Object.assign(backing.style, {
        left: `${rect.left - parent.left}px`, top: `${rect.top - parent.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        borderRadius: getComputedStyle(target).borderRadius,
      });
    };
    const observer = new ResizeObserver(sync);
    observer.observe(target);
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    // Follow only the entrance animation; no permanent rendering loop.
    const started = performance.now();
    const animate = () => {
      sync();
      if (performance.now() - started < 450) frame = requestAnimationFrame(animate);
    };
    sync();
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
      backing.remove();
      if (previousBackground) overlay.style.setProperty('background-color', previousBackground, previousPriority);
      else overlay.style.removeProperty('background-color');
    };
  }, [target, mode, backgroundBrightness]);

  useLayoutEffect(() => {
    if (!target) return;
    let lastUpdate = 0;
    const move = (event: PointerEvent) => {
      if (event.timeStamp - lastUpdate < 32) return;
      lastUpdate = event.timeStamp;
      const rect = target.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const nearEdge = Math.min(x, y, rect.width - x, rect.height - y) < edgeWidth * 2;
      setPointer(nearEdge ? { x, y } : null);
    };
    const leave = () => setPointer(null);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerleave', leave);
    return () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerleave', leave);
    };
  }, [edgeWidth, target]);

  return (
    <div ref={hostRef} data-bgmi-window-glass aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {target && size.width > 0 && size.height > 0 && (
        <MobileLiquidGlass
          width={size.width}
          height={size.height}
          borderRadius={size.radius}
          strength={strength}
          edgeWidth={edgeWidth}
          resolution={0.32}
          filterOnly
          filterTarget={target}
          droplet={pointer ? { active: true, centerX: pointer.x, centerY: pointer.y, radiusX: 100, radiusY: 100, strength: strength * 0.85 } : undefined}
          blur={Number.parseFloat(windowGlassBlurValue(glassStyle))}
          saturation={100 - glassStyle * 0.3}
        />
      )}
    </div>
  );
}
