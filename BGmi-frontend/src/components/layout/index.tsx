import { Box } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { memo, useEffect, useState, type CSSProperties } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccentTheme } from '~/hooks/use-accent-theme';
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
  const glassBackground = glassStyle === 'clear' ? `${colors.surface}55` : glassStyle === 'frosted' ? `${colors.surface}D9` : `${colors.surface}A8`;
  const glassSidebar = colorMode === 'dark'
    ? glassStyle === 'clear' ? `${colors.sidebar}80` : glassStyle === 'frosted' ? `${colors.sidebar}C7` : `${colors.sidebar}A3`
    : glassStyle === 'clear' ? `${colors.sidebar}88` : glassStyle === 'frosted' ? `${colors.sidebar}F2` : `${colors.sidebar}CC`;
  const glassBlur = glassStyle === 'clear' ? '5px' : glassStyle === 'frosted' ? '28px' : '18px';
  const glassShadow = glassStyle === 'clear' ? 'inset 0 1px 0 #ffffff55, 0 5px 18px #00000012' : glassStyle === 'frosted' ? '0 12px 28px #0000001c' : 'inset 0 1px 0 #ffffff66, 0 12px 28px #00000020';

  useEffect(() => {
    const root = document.documentElement.style;
    const previousBodyBackground = document.body.style.backgroundColor;
    document.body.style.backgroundColor = colors.background;
    root.setProperty('--bgmi-glass-background', glassBackground);
    root.setProperty('--bgmi-glass-sidebar', glassSidebar);
    root.setProperty('--bgmi-glass-blur', glassBlur);
    root.setProperty('--bgmi-glass-shadow', glassShadow);
    return () => {
      document.body.style.backgroundColor = previousBodyBackground;
    };
  }, [colors.background, glassBackground, glassSidebar, glassBlur, glassShadow]);

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
      } as CSSProperties}
      sx={{
        '[data-bgmi-glass-panel]': {
          bg: 'var(--bgmi-glass-background)',
          backdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(160%)',
          WebkitBackdropFilter: 'blur(var(--bgmi-glass-blur)) saturate(160%)',
          boxShadow: 'var(--bgmi-glass-shadow)',
        },
      }}
      bg={colors.background}
    >
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
