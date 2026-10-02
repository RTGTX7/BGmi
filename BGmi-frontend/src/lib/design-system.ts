export function getPalette(colorMode: string) {
  const isDark = colorMode === 'dark';

  return {
    isDark,
    page:
      colorMode === 'dark'
        ? 'linear-gradient(180deg, #08111f 0%, #0b1524 42%, #09111c 100%)'
        : 'linear-gradient(180deg, #f7fafc 0%, #edf4fb 42%, #eaf2f8 100%)',
    pageGlow:
      colorMode === 'dark'
        ? 'radial-gradient(circle at 12% 12%, rgba(77, 116, 255, 0.18), transparent 28%), radial-gradient(circle at 84% 10%, rgba(53, 162, 142, 0.13), transparent 24%), radial-gradient(circle at 50% 100%, rgba(37, 82, 147, 0.24), transparent 38%)'
        : 'radial-gradient(circle at 14% 12%, rgba(85, 125, 255, 0.12), transparent 26%), radial-gradient(circle at 86% 14%, rgba(83, 170, 145, 0.10), transparent 24%), radial-gradient(circle at 48% 100%, rgba(80, 136, 208, 0.16), transparent 34%)',
    panel:
      colorMode === 'dark'
        ? 'rgba(10, 18, 31, 0.82)'
        : 'rgba(255, 255, 255, 0.82)',
    panelMuted:
      colorMode === 'dark'
        ? 'rgba(14, 24, 39, 0.74)'
        : 'rgba(246, 250, 253, 0.9)',
    panelSubtle:
      colorMode === 'dark'
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(255, 255, 255, 0.58)',
    glass:
      colorMode === 'dark'
        ? 'rgba(14, 23, 38, 0.72)'
        : 'rgba(255, 255, 255, 0.64)',
    border:
      colorMode === 'dark'
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(15, 23, 42, 0.08)',
    borderStrong:
      colorMode === 'dark'
        ? 'rgba(255, 255, 255, 0.14)'
        : 'rgba(15, 23, 42, 0.12)',
    text:
      colorMode === 'dark'
        ? 'rgba(244, 247, 251, 0.96)'
        : 'rgba(17, 24, 39, 0.96)',
    textMuted:
      colorMode === 'dark'
        ? 'rgba(180, 191, 210, 0.78)'
        : 'rgba(74, 85, 104, 0.82)',
    textSoft:
      colorMode === 'dark'
        ? 'rgba(148, 163, 184, 0.72)'
        : 'rgba(100, 116, 139, 0.78)',
    accent:
      colorMode === 'dark' ? '#88b6ff' : '#3468d8',
    accentSoft:
      colorMode === 'dark' ? 'rgba(136, 182, 255, 0.14)' : 'rgba(52, 104, 216, 0.10)',
    accentAlt:
      colorMode === 'dark' ? '#64d2ba' : '#0f9b84',
    shadow:
      colorMode === 'dark'
        ? '0 24px 60px rgba(0, 0, 0, 0.34)'
        : '0 24px 60px rgba(35, 52, 77, 0.12)',
    shadowSoft:
      colorMode === 'dark'
        ? '0 16px 34px rgba(0, 0, 0, 0.22)'
        : '0 16px 34px rgba(35, 52, 77, 0.08)',
    heroOverlay:
      colorMode === 'dark'
        ? 'linear-gradient(180deg, rgba(5, 10, 18, 0.08) 0%, rgba(5, 10, 18, 0.36) 48%, rgba(5, 10, 18, 0.86) 100%)'
        : 'linear-gradient(180deg, rgba(248, 251, 255, 0.12) 0%, rgba(240, 246, 255, 0.42) 48%, rgba(237, 244, 252, 0.94) 100%)',
  };
}

export function getSurfaceStyles(colorMode: string, variant: 'default' | 'muted' | 'glass' = 'default') {
  const palette = getPalette(colorMode);

  const background =
    variant === 'muted' ? palette.panelMuted : variant === 'glass' ? palette.glass : palette.panel;

  return {
    bg: background,
    borderWidth: '1px',
    borderColor: variant === 'glass' ? palette.borderStrong : palette.border,
    boxShadow: variant === 'glass' ? palette.shadowSoft : palette.shadow,
    backdropFilter: variant === 'glass' ? 'blur(18px) saturate(140%)' : 'blur(10px) saturate(110%)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    _before: {
      content: '""',
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      background: palette.isDark
        ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0) 18%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.44), rgba(255,255,255,0) 22%)',
    },
  };
}
