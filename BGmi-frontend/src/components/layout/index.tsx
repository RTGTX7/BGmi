import { Box } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { memo, useEffect, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { glassBlurValue, glassSaturationValue, glassSurfaceAlpha, useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';
import MobileBottomNav from './mobile-bottom-nav';
import Sidebar from '../sidebar';

const MotionBox = motion(Box);

function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { theme: accentTheme, colors, glassStyle } = useAccentTheme();
  const { colorMode } = useColorMode();
  // Keep light and dark glass tints separate. The light theme must not inherit
  // the bright overlay values used to lift dark surfaces.
  const glassBackground = colorMode === 'dark'
    ? `${colors.surface}${glassSurfaceAlpha(glassStyle)}`
    : `rgba(255,255,255,${0.06 + glassStyle / 1000})`;
  const sidebarAlpha = Math.round(0x10 + (0x38 - 0x10) * (glassStyle / 100)).toString(16).padStart(2, '0');
  const glassSidebar = `${colorMode === 'dark' ? colors.sidebar : colors.sidebar}${sidebarAlpha}`;
  const glassBlur = glassBlurValue(glassStyle);
  const glassShadow = '0 10px 28px rgba(15,23,42,0.16)';

  useEffect(() => {
    const root = document.documentElement.style;
    const previousBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = colors.background;
    root.setProperty('--bgmi-glass-background', glassBackground);
    root.setProperty('--bgmi-glass-sidebar', glassSidebar);
    root.setProperty('--bgmi-glass-blur', glassBlur);
    root.setProperty('--bgmi-glass-shadow', glassShadow);
    root.setProperty('--bgmi-glass-saturation', glassSaturationValue(glassStyle));
    root.setProperty('--bgmi-glass-style', String(glassStyle));
    root.setProperty('--bgmi-glass-edge-opacity', String(1 - glassStyle / 130));
    root.setProperty('--bgmi-glass-glow-opacity', String(0.82 - glassStyle / 210));
    return () => {
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, [colors.background, glassBackground, glassSidebar, glassBlur, glassShadow, glassStyle]);

  const handleToggle = () => setOpen(o => !o);
  return (
    <Box
      minH="100vh"
      ml={{ lg: '60' }}
      position="relative"
      overflowX="hidden"
      data-accent={accentTheme.name}
      data-glass-style={glassStyle}
      style={{
        '--bgmi-accent': accentTheme.primary,
        '--bgmi-accent-soft': accentTheme.soft,
        '--bgmi-accent-border': accentTheme.border,
        '--bgmi-background': colors.background,
        '--bgmi-sidebar': colors.sidebar,
        '--bgmi-surface': colors.surface,
        '--bgmi-text': colors.text,
        '--bgmi-glass-background': glassBackground,
        '--bgmi-glass-sidebar': glassSidebar,
        '--bgmi-glass-blur': glassBlur,
        '--bgmi-glass-shadow': glassShadow,
        '--bgmi-glass-saturation': glassSaturationValue(glassStyle),
        '--bgmi-glass-style': glassStyle,
        '--bgmi-glass-edge-opacity': 1 - glassStyle / 130,
        '--bgmi-glass-glow-opacity': 0.82 - glassStyle / 210,
      } as CSSProperties}
      sx={{
        '[data-bgmi-glass-panel]': {
          position: 'relative',
          bg: 'var(--bgmi-glass-background)',
          backdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(var(--bgmi-glass-saturation))',
          WebkitBackdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(var(--bgmi-glass-saturation))',
          boxShadow: 'var(--bgmi-glass-shadow)',

        },
      }}
      bg={colors.background}
    >
      {/* WebGL glass runtime is disabled until per-window lifecycle support is
          available; CSS glass remains active and keeps the UI responsive. */}
      <Sidebar isOpen={open} onClose={handleToggle} />
      <MobileBottomNav sidebarToggle={handleToggle} />
      <Box
        as="main"
        w="100%"
        maxW="none"
        overflowX="hidden"
        p={{ base: '3', sm: '4', md: '5', lg: '6', xl: '8' }}
        pt={{ base: '3', lg: '6' }}
        pb={{ base: '7.4rem', lg: '6' }}
        minW="0"
        position="relative"
        zIndex="1"
        sx={{
          transform: 'translateY(calc(var(--bgmi-page-transition, 0) * -4px)) scale(calc(1 - var(--bgmi-page-transition, 0) * 0.018))',
          filter: 'blur(calc(var(--bgmi-page-transition, 0) * 2px))',
          transformOrigin: 'center top',
          willChange: 'transform, filter',
        }}
        _before={{
          content: '""',
          position: 'absolute',
          inset: '0',
          pointerEvents: 'none',
          background:
            'none',
          borderRadius: '24px',
        }}
      >
        <MotionBox
          key={location.key}
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.985, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: 'center top' }}
        >
          {children}
        </MotionBox>
      </Box>
    </Box>
  );
}

export default memo(Layout);
