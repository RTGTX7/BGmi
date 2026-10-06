import type { StyleFunctionProps, ThemeConfig } from '@chakra-ui/react';
import { extendTheme } from '@chakra-ui/react';

import { getPalette } from './design-system';

const config: ThemeConfig = {
  initialColorMode: 'system',
  useSystemColorMode: true,
};

const pickMode = <T,>(props: StyleFunctionProps, light: T, dark: T) => (props.colorMode === 'dark' ? dark : light);

export const theme = extendTheme({
  config,
  fonts: {
    heading: `'Avenir Next', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', sans-serif`,
    body: `'Avenir Next', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Helvetica Neue', sans-serif`,
  },
  styles: {
    global: (props: StyleFunctionProps) => {
      const palette = getPalette(props.colorMode);

      return {
        'html, body, #root': {
          minHeight: '100%',
        },
        body: {
          color: palette.text,
          bg: `${palette.pageGlow}, ${palette.page}`,
          backgroundAttachment: 'fixed',
          letterSpacing: '-0.01em',
          transition: 'color 2500ms ease, background-color 2500ms ease, background 2500ms ease',
        },
        'html, #root': {
          transition: 'color 2500ms ease, background-color 2500ms ease',
        },
        '::view-transition-old(root), ::view-transition-new(root)': {
          animationDuration: '700ms',
          animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          mixBlendMode: 'normal',
        },
        '*': {
          borderColor: palette.border,
        },
        '::selection': {
          background: pickMode(props, 'rgba(52,104,216,0.14)', 'rgba(136,182,255,0.24)'),
        },
        a: {
          transition: 'color 180ms ease, opacity 180ms ease, background-color 180ms ease',
        },
        button: {
          transition: 'transform 180ms ease, background-color 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
        },
        '[data-bgmi-window-glass] ~ *': {
          position: 'relative',
          zIndex: 1,
        },
        '[data-bgmi-dim-target]': {
          color: 'var(--bgmi-window-text)',
        },
        '[data-bgmi-window-backdrop]': {
          maskImage: 'linear-gradient(transparent, transparent)',
          WebkitMaskImage: 'linear-gradient(transparent, transparent)',
        },
        '[data-bgmi-dim-target] .chakra-input': {
          color: 'var(--bgmi-window-text)',
          background: 'var(--bgmi-window-control)',
          borderColor: 'var(--bgmi-window-control-border)',
        },
        '[data-bgmi-dim-target] .chakra-form__label': {
          color: 'var(--bgmi-window-text)',
        },
        '[data-bgmi-dim-target] button:hover': {
          backgroundColor: 'var(--bgmi-window-hover)',
        },
        // Keep window content above the live glass layer.
        '[data-bgmi-optical-target]': {
          background: 'var(--bgmi-window-background, var(--bgmi-glass-background)) !important',
          backdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(var(--bgmi-glass-saturation))',
          WebkitBackdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(var(--bgmi-glass-saturation))',
        },
        // Portal based Chakra surfaces need a global optical-glass treatment.
        '.chakra-modal__content, .chakra-alertdialog__content, .chakra-drawer__content, .chakra-menu__menu-list, .chakra-toast__inner': {
          position: 'relative',
          background: 'var(--bgmi-window-background, var(--bgmi-glass-background)) !important',
          backdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(var(--bgmi-glass-saturation))',
          WebkitBackdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(var(--bgmi-glass-saturation))',
          boxShadow: 'var(--bgmi-window-shadow, var(--bgmi-glass-shadow))',
          isolation: 'isolate',
          overflow: 'hidden',
        },

      };
    },
  },
  components: {
    Card: {
      baseStyle: (props: StyleFunctionProps) => ({
        container: {
          bg: pickMode(props, 'rgba(255,255,255,0.84)', 'rgba(10,18,31,0.82)'),
          borderWidth: '1px',
          borderColor: pickMode(props, 'rgba(15,23,42,0.08)', 'rgba(255,255,255,0.08)'),
          rounded: '28px',
          boxShadow: pickMode(props, '0 24px 60px rgba(35,52,77,0.12)', '0 24px 60px rgba(0,0,0,0.34)'),
          overflow: 'hidden',
          position: 'relative',
        },
      }),
    },
    Button: {
      baseStyle: {
        rounded: '999px',
        fontWeight: '600',
      },
      variants: {
        solid: (props: StyleFunctionProps) => ({
          bg: pickMode(props, '#1f4fd1', '#8cb9ff'),
          color: pickMode(props, 'white', '#08111f'),
          boxShadow: pickMode(props, '0 12px 28px rgba(31,79,209,0.24)', '0 12px 28px rgba(136,182,255,0.16)'),
          _hover: {
            bg: pickMode(props, '#2349b3', '#a7cbff'),
            transform: 'translateY(-1px)',
          },
          _active: {
            transform: 'translateY(0)',
          },
        }),
        outline: (props: StyleFunctionProps) => ({
          bg: pickMode(props, 'rgba(255,255,255,0.68)', 'rgba(255,255,255,0.04)'),
          color: pickMode(props, 'rgba(17,24,39,0.96)', 'rgba(244,247,251,0.94)'),
          borderColor: pickMode(props, 'rgba(15,23,42,0.10)', 'rgba(255,255,255,0.12)'),
          _hover: {
            bg: pickMode(props, 'rgba(255,255,255,0.88)', 'rgba(255,255,255,0.08)'),
            transform: 'translateY(-1px)',
          },
        }),
        ghost: (props: StyleFunctionProps) => ({
          bg: 'transparent',
          color: pickMode(props, 'rgba(17,24,39,0.82)', 'rgba(244,247,251,0.88)'),
          _hover: {
            bg: pickMode(props, 'rgba(15,23,42,0.06)', 'rgba(255,255,255,0.08)'),
          },
        }),
      },
      defaultProps: {
        variant: 'solid',
      },
    },
    Drawer: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: {
          bg: pickMode(props, 'rgba(247,250,252,0.94)', 'rgba(7,15,26,0.94)'),
          borderColor: pickMode(props, 'rgba(15,23,42,0.10)', 'rgba(255,255,255,0.08)'),
          boxShadow: pickMode(props, '0 30px 80px rgba(35,52,77,0.18)', '0 30px 80px rgba(0,0,0,0.42)'),
          backdropFilter: 'blur(22px) saturate(150%)',
        },
      }),
    },
    Input: {
      variants: {
        outline: (props: StyleFunctionProps) => ({
          field: {
            bg: pickMode(props, 'rgba(255,255,255,0.82)', 'rgba(255,255,255,0.04)'),
            borderColor: pickMode(props, 'rgba(15,23,42,0.10)', 'rgba(255,255,255,0.10)'),
            rounded: '999px',
            _hover: {
              borderColor: pickMode(props, 'rgba(15,23,42,0.16)', 'rgba(255,255,255,0.18)'),
            },
            _focusVisible: {
              borderColor: pickMode(props, 'rgba(52,104,216,0.40)', 'rgba(136,182,255,0.40)'),
              boxShadow: pickMode(props, '0 0 0 3px rgba(52,104,216,0.10)', '0 0 0 3px rgba(136,182,255,0.12)'),
            },
          },
        }),
      },
      defaultProps: {
        variant: 'outline',
      },
    },
    Menu: {
      baseStyle: (props: StyleFunctionProps) => ({
        list: {
          bg: pickMode(props, 'rgba(255,255,255,0.92)', 'rgba(10,18,31,0.94)'),
          borderColor: pickMode(props, 'rgba(15,23,42,0.08)', 'rgba(255,255,255,0.08)'),
          borderRadius: '20px',
          boxShadow: pickMode(props, '0 24px 60px rgba(35,52,77,0.16)', '0 24px 60px rgba(0,0,0,0.38)'),
          p: '1.5',
        },
        item: {
          rounded: '14px',
          minH: '11',
        },
      }),
    },
    Modal: {
      baseStyle: (props: StyleFunctionProps) => ({
        dialog: {
          bg: pickMode(props, 'rgba(247,250,252,0.96)', 'rgba(8,17,31,0.96)'),
          borderWidth: '1px',
          borderColor: pickMode(props, 'rgba(15,23,42,0.08)', 'rgba(255,255,255,0.08)'),
          borderRadius: '28px',
          boxShadow: pickMode(props, '0 30px 80px rgba(35,52,77,0.18)', '0 30px 80px rgba(0,0,0,0.42)'),
          backdropFilter: 'blur(22px) saturate(145%)',
        },
      }),
    },
    Progress: {
      baseStyle: (props: StyleFunctionProps) => ({
        track: {
          bg: pickMode(props, 'rgba(15,23,42,0.08)', 'rgba(255,255,255,0.10)'),
        },
        filledTrack: {
          bg: pickMode(props, 'linear-gradient(90deg, #1f4fd1 0%, #5891ff 100%)', 'linear-gradient(90deg, #6da8ff 0%, #9dd2ff 100%)'),
        },
      }),
    },
    Tabs: {
      variants: {
        line: {
          tab: {
            rounded: '999px',
          },
        },
      },
    },
    Tag: {
      baseStyle: (props: StyleFunctionProps) => ({
        rounded: '999px',
        borderWidth: '1px',
        borderColor: pickMode(props, 'rgba(15,23,42,0.08)', 'rgba(255,255,255,0.10)'),
      }),
    },
  },
}) as { config: ThemeConfig };
