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
    const systemMode = () => (media.matches ? 'dark' : 'light') as Exclude<Theme, ''>;
    setColorMode((stored || systemMode()) as Theme);
    if (stored) return;
    const handleChange = () => setColorMode(systemMode());
    media.addEventListener?.('change', handleChange);
    return () => media.removeEventListener?.('change', handleChange);
  }, [color, setColorMode]);

  const toggle = useCallback(() => toggleColorMode(), [toggleColorMode]);
  return { colorMode: (colorMode || color) as Theme, toggleColorMode: toggle };
};
