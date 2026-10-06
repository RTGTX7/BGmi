import { useCallback, useEffect } from 'react';
import { useColorMode as useChakraColorMode } from '@chakra-ui/react';

import { isBrowser } from '~/lib/utils';
import { atom, useAtom } from 'jotai';

type Theme = 'light' | 'dark' | '';

const themeAtom = atom<Theme>('');

export const useColorMode = () => {
  const [colorMode, setColorMode] = useAtom(themeAtom);
  // 监听 context 的变化，更新主题
  const { colorMode: color, toggleColorMode } = useChakraColorMode();

  useEffect(() => {
    if (!isBrowser) return;
    const stored = localStorage.getItem('chakra-ui-color-mode');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const lightMedia = window.matchMedia('(prefers-color-scheme: light)');
    // When no preference is exposed, use the user's local sunset. Geolocation is
    // optional; the fallback keeps a sensible local evening boundary.
    let sunsetHour = 19;
    const localSunsetMode = () => {
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      return (hour >= 6 && hour < sunsetHour ? 'light' : 'dark') as Exclude<Theme, ''>;
    };
    const systemMode = () => {
      if (media.matches) return 'dark' as const;
      if (lightMedia.matches) return 'light' as const;
      return localSunsetMode();
    };
    setColorMode((stored || systemMode()) as Theme);
    if (stored) return;
    const handleChange = () => setColorMode(systemMode());
    media.addEventListener?.('change', handleChange);
    lightMedia.addEventListener?.('change', handleChange);
    if (!stored && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(({ coords }) => {
        const day = Math.floor((Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()) - Date.UTC(new Date().getFullYear(), 0, 0)) / 86400000);
        const declination = 0.409 * Math.sin((2 * Math.PI * (day - 81)) / 365);
        const latitude = (coords.latitude * Math.PI) / 180;
        const sunsetAngle = Math.acos(Math.max(-1, Math.min(1, -Math.tan(latitude) * Math.tan(declination))));
        const daylightHours = (2 * sunsetAngle * 12) / Math.PI;
        sunsetHour = Math.min(23, Math.max(16, 12 + daylightHours / 2));
        setColorMode(systemMode());
      }, () => undefined, { maximumAge: 86400000, timeout: 3000 });
    }
    const timer = window.setInterval(() => { if (!stored) setColorMode(systemMode()); }, 60000);
    return () => { media.removeEventListener?.('change', handleChange); lightMedia.removeEventListener?.('change', handleChange); window.clearInterval(timer); };
  }, [color, setColorMode]);

  const toggle = useCallback(() => {
    const next = (colorMode === 'dark' ? 'light' : 'dark') as Exclude<Theme, ''>;
    const apply = () => {
      setColorMode(next);
      if (isBrowser) localStorage.setItem('chakra-ui-color-mode', next);
      toggleColorMode();
    };
    if (isBrowser && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const bodyStyle = getComputedStyle(document.body);
      const veil = document.createElement('div');
      veil.style.position = 'fixed';
      veil.style.inset = '0';
      veil.style.zIndex = '2147483647';
      veil.style.pointerEvents = 'none';
      veil.style.backgroundColor = bodyStyle.backgroundColor;
      veil.style.backgroundImage = bodyStyle.backgroundImage;
      veil.style.backgroundAttachment = bodyStyle.backgroundAttachment;
      veil.style.backgroundSize = bodyStyle.backgroundSize;
      veil.style.opacity = '1';
      veil.style.transition = 'opacity 2500ms cubic-bezier(0.22, 1, 0.36, 1)';
      document.body.appendChild(veil);
      void veil.offsetWidth;
      apply();
      requestAnimationFrame(() => requestAnimationFrame(() => { veil.style.opacity = '0'; }));
      window.setTimeout(() => veil.remove(), 2600);
    } else apply();
  }, [colorMode, setColorMode, toggleColorMode]);
  return { colorMode: (colorMode || color) as Theme, toggleColorMode: toggle };
};
