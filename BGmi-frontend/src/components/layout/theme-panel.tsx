import { useAtom } from 'jotai';
import { opticalSettingsAtom } from '~/hooks/use-accent-theme';
import { Box, Button, Flex, Heading, IconButton, Input, Portal, SimpleGrid, Text, useDisclosure } from '@chakra-ui/react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { FiCheck, FiDroplet, FiX } from 'react-icons/fi';
import { BsMoonFill, BsSunFill } from 'react-icons/bs';

import { palettePresets, windowGlassBlurValue, windowOverlayValue, type PaletteColors, type PaletteMode, useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';
import SidebarNavItem from '../sidebar/sidebar-nav-item';
import WindowGlassRefraction from './window-glass-refraction';

const colorFields: { key: keyof PaletteColors; label: string }[] = [
  { key: 'accent', label: '强调色' },
  { key: 'background', label: '页面' },
  { key: 'sidebar', label: '菜单栏' },
  { key: 'surface', label: '面板' },
  { key: 'text', label: '文字' },
];

export default function ThemePanel({ mobile = false, iconOnly = false, onOpen, onShortPress }: { mobile?: boolean; iconOnly?: boolean; onOpen?: () => void; onShortPress?: () => void }) {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const { isOpen, onOpen: openPanel, onClose } = useDisclosure();
  const { mode, colors, settings, getPalette, selectPreset, saveCustom, glassStyle, setGlassStyle, windowTransparency, setWindowTransparency, backgroundBrightness, setBackgroundBrightness, theme } = useAccentTheme();
  const [optics, setOptics] = useAtom(opticalSettingsAtom);
  const [editMode, setEditMode] = useState<PaletteMode>(mode);
  const [draft, setDraft] = useState<PaletteColors>(getPalette(mode));
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);
  useEffect(() => setDraft(getPalette(editMode)), [editMode, settings]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);

  const open = () => {
    setEditMode(mode);
    setDraft(getPalette(mode));
    onOpen?.();
    openPanel();
  };

  const startMobilePress = (event: PointerEvent<HTMLButtonElement>) => {
    longPressedRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    longPressRef.current = setTimeout(() => {
      longPressedRef.current = true;
      open();
    }, 460);
  };
  const endMobilePress = (event: PointerEvent<HTMLButtonElement>) => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = null;
    pressStartRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handlePanelTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };
  const handlePanelTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dy = start.y - touch.clientY;
    if (dy > 72 && dy > Math.abs(touch.clientX - start.x) * 1.35) onClose();
  };

  return (
    <>
      {mobile ? (
        <IconButton
          aria-label="切换主题，长按打开主题配色"
          title="短按切换主题，长按打开主题配色"
          icon={isOpen ? <FiDroplet size="20" /> : colorMode === 'dark' ? <BsSunFill size="20" /> : <BsMoonFill size="20" />}
          onPointerDown={startMobilePress}
          onPointerMove={event => {
            const start = pressStartRef.current;
            if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10 && longPressRef.current) {
              clearTimeout(longPressRef.current);
              longPressRef.current = null;
            }
          }}
          onPointerUp={endMobilePress}
          onPointerCancel={endMobilePress}
          onClick={() => {
            if (!longPressedRef.current) onShortPress?.();
            longPressedRef.current = false;
          }}
          onContextMenu={event => event.preventDefault()}
          w="full"
          h="full"
          rounded="full"
          bg="transparent"
          borderWidth="0"
          color={colors.accent}
          boxShadow="none"
          _hover={{ bg: 'transparent' }}
        />
      ) : iconOnly ? (
        <IconButton
          aria-label="打开主题配色"
          title="主题配色"
          icon={<FiDroplet size="20" />}
          onClick={open}
          flex="1"
          h="full"
          minW="0"
          rounded="none"
          bg="transparent"
          color={colors.text}
          _hover={{ bg: theme.soft, color: colors.accent }}
        />
      ) : (
        <SidebarNavItem as="button" icon={FiDroplet} onClick={open}>
          主题配色
        </SidebarNavItem>
      )}

      {isOpen ? (
        <Portal>
          <Box
            data-bgmi-window-backdrop="theme"
            position="fixed"
            inset="0"
            zIndex={1400}
            bg={windowOverlayValue(mode, backgroundBrightness?.[mode] || 0)}
            onClick={onClose}
            onPointerDown={onClose}
          />
          <Box
            role="dialog"
            aria-modal="true"
            aria-label="全局主题设置"
            data-bgmi-glass-panel
            data-bgmi-dim-target="theme"
            position="fixed"
            zIndex={1402}
            w={{ base: 'calc(100vw - 24px)', sm: 'min(400px, calc(100vw - 32px))' }}
            maxH="calc(100dvh - 12px)"
            overflowY="auto"
            top={{ base: '50%', lg: '28px' }}
            left={{ base: '50%', lg: 'calc(240px + 18px)' }}
            transform={{ base: 'translate(-50%, -50%)', lg: 'none' }}
            bg="transparent"
            isolation="isolate"
            color={colors.text}
            borderWidth="1px"
            borderColor={isDark ? 'rgba(255,255,255,0.22)' : 'rgba(100,116,139,0.24)'}
            rounded="24px"
            boxShadow="none"
            backdropFilter={`blur(${windowGlassBlurValue(glassStyle)})`}
            sx={{ WebkitBackdropFilter: `blur(${windowGlassBlurValue(glassStyle)})` }}
            onClick={event => event.stopPropagation()}
            onTouchStart={handlePanelTouchStart}
            onTouchEnd={handlePanelTouchEnd}
            onTouchCancel={() => { swipeStartRef.current = null; }}
          >
            <WindowGlassRefraction />
            <Flex align="center" justify="space-between" px="4" py="3" borderBottomWidth="1px" borderColor={theme.border}>
              <Heading size="sm">全局主题</Heading>
              <IconButton aria-label="关闭主题设置" icon={<FiX />} size="sm" variant="ghost" color={colors.text} onClick={onClose} />
            </Flex>

            <Box px={{ base: "3", sm: "4" }} py={{ base: "2", sm: "3" }}>
              <Flex gap="2" mb="2" role="group" aria-label="配色模式">
                {(['light', 'dark'] as const).map(item => (
                  <Button key={item} size="sm" flex="1" h="36px" bg={editMode === item ? (isDark ? 'rgba(148,163,184,0.24)' : 'rgba(100,116,139,0.18)') : 'transparent'} borderWidth="1px" borderColor={editMode === item ? 'rgba(100,116,139,0.62)' : theme.border} color={colors.text} _hover={{ bg: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.62)' }} onClick={() => { setEditMode(item); if (item !== colorMode) toggleColorMode(); }}>
                    {item === 'light' ? '亮色' : '暗色'}
                  </Button>
                ))}
              </Flex>

              <Text fontSize="xs" fontWeight="700" mb="2" color={colors.text}>预设配色</Text>
              <SimpleGrid columns={2} spacing="1" mb="2">
                {palettePresets.map(item => {
                  const selected = settings[editMode].preset === item.name;
                  return (
                    <Button key={item.name} h="36px" px="2.5" justifyContent="space-between" bg={selected ? (isDark ? 'rgba(148,163,184,0.24)' : 'rgba(100,116,139,0.18)') : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)'} color={colors.text} borderWidth="1px" borderColor={selected ? 'rgba(100,116,139,0.62)' : theme.border} _hover={{ bg: isDark ? 'rgba(148,163,184,0.18)' : 'rgba(100,116,139,0.12)', borderColor: 'rgba(100,116,139,0.62)' }} onClick={() => selectPreset(editMode, item.name)}>
                      <Flex align="center" gap="2" minW="0"><Box w="18px" h="18px" flexShrink={0} rounded="full" bg={item[editMode].accent} /><Text fontSize="sm">{item.label}</Text></Flex>
                      {selected ? <FiCheck size="14" /> : null}
                    </Button>
                  );
                })}
              </SimpleGrid>
              <Text fontSize="xs" fontWeight="700" mb="2">玻璃外观 · 磨砂度 {glassStyle}%</Text>
              <Box mb="2">
                <input
                  aria-label="磨砂度"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  list="bgmi-glass-recommended-stops"
                  value={glassStyle}
                  onChange={event => setGlassStyle(Number(event.target.value))}
                  style={{
                    width: '100%',
                    accentColor: colors.accent,
                    background: `linear-gradient(to right, ${colors.accent} 0%, ${colors.accent} ${glassStyle}%, ${colors.text}28 ${glassStyle}%, ${colors.text}28 100%)`,
                  }}
                />
                <datalist id="bgmi-glass-recommended-stops">
                  <option value="0" label="0%" />
                  <option value="25" label="25%" />
                  <option value="50" label="50%" />
                  <option value="75" label="75%" />
                  <option value="100" label="100%" />
                </datalist>
                <Flex justify="space-between" mt="1" fontSize="10px" opacity={0.72}>
                  {[0, 25, 50, 75, 100].map(stop => (
                    <Text key={stop} cursor="pointer" onClick={() => setGlassStyle(stop)} color={glassStyle === stop ? colors.accent : colors.text} fontWeight={glassStyle === stop ? '700' : '400'}>
                      {stop}%
                    </Text>
                  ))}
                </Flex>
                <Flex justify="space-between" mt="1" fontSize="11px" opacity={0.72}>
                  <Text>清澈透镜</Text>
                  <Text>磨砂玻璃</Text>
                </Flex>
              </Box>

              <Box mb="2">
                <Flex justify="space-between" align="center" mb="2">
                  <Text fontSize="xs" fontWeight="700">窗口玻璃层 · 透明度</Text>
                  <Text fontSize="xs">{windowTransparency}%</Text>
                </Flex>
                <input aria-label="窗口玻璃透明度" type="range" min="0" max="100" step="1" value={windowTransparency} onChange={event => setWindowTransparency(Number(event.target.value))} style={{ width: '100%', accentColor: colors.accent }} />
                <Flex justify="space-between" fontSize="11px" opacity={0.72}><Text>不透明</Text><Text>清澈透明</Text></Flex>
              </Box>

              {([
                { key: 'refraction', label: '透镜折射', max: 1, step: 0.01 },
                { key: 'chromAberration', label: '边缘色差', max: 0.1, step: 0.001 },
                { key: 'zRadius', label: '玻璃厚度', max: 65, step: 1 },
              ] as const).map(option => (
                <Box key={option.key} mb="2">
                  <Flex justify="space-between" fontSize="xs"><Text>{option.label}</Text><Text>{optics[option.key]}</Text></Flex>
                  <input aria-label={option.label} type="range" min="0" max={option.max} step={option.step} value={optics[option.key]} onChange={event => setOptics({ ...optics, [option.key]: Number(event.target.value) })} style={{ width: '100%', accentColor: colors.accent }} />
                </Box>
              ))}
              <Text fontSize="xs" fontWeight="700" mb="2">自定义颜色</Text>
              <SimpleGrid columns={2} spacing="2">
                {colorFields.map(({ key, label }) => (
                  <Flex key={key} align="center" gap="2" minW="0" px="2" py="1.5" rounded="8px" borderWidth="1px" borderColor={theme.border} bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.40)'}>
                    <Box as="label" position="relative" w="28px" h="28px" minW="28px" rounded="full" overflow="hidden" bg={draft[key]} boxShadow={isDark ? '0 0 0 1px rgba(255,255,255,0.36)' : '0 0 0 1px rgba(32,52,71,0.22)'} cursor="pointer">
                      <Input aria-label={`${label}颜色`} type="color" value={draft[key]} onChange={event => {
                        const next = { ...draft, [key]: event.target.value };
                        setDraft(next);
                        saveCustom(editMode, next);
                      }} position="absolute" inset="0" w="full" h="full" minW="0" p="0" border="0" opacity="0" cursor="pointer" />
                    </Box>
                    <Text fontSize="xs" whiteSpace="nowrap">{label}</Text>
                  </Flex>
                ))}
              </SimpleGrid>
              <Text mt="3" fontSize="11px" color={colors.text} opacity={0.72}>选择或修改后自动保存，立即应用到整个网站。</Text>
            </Box>
          </Box>
        </Portal>
      ) : null}
    </>
  );
}




