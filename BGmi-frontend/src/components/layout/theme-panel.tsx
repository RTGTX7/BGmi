import { Box, Button, Flex, Heading, IconButton, Input, Portal, SimpleGrid, Text, useDisclosure } from '@chakra-ui/react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { FiCheck, FiDroplet, FiX } from 'react-icons/fi';
import { BsMoonFill, BsSunFill } from 'react-icons/bs';

import { palettePresets, type GlassStyle, type PaletteColors, type PaletteMode, useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';
import SidebarNavItem from '../sidebar/sidebar-nav-item';

const colorFields: { key: keyof PaletteColors; label: string }[] = [
  { key: 'accent', label: '强调色' },
  { key: 'background', label: '页面' },
  { key: 'sidebar', label: '菜单栏' },
  { key: 'surface', label: '面板' },
  { key: 'text', label: '文字' },
];
const glassOptions: { value: GlassStyle; label: string }[] = [
  { value: 'clear', label: '透明玻璃' },
  { value: 'frosted', label: '磨砂玻璃' },
  { value: 'liquid', label: '液态玻璃' },
];

export default function ThemePanel({ mobile = false, iconOnly = false, onOpen, onShortPress }: { mobile?: boolean; iconOnly?: boolean; onOpen?: () => void; onShortPress?: () => void }) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const { isOpen, onOpen: openPanel, onClose } = useDisclosure();
  const { mode, colors, settings, getPalette, selectPreset, saveCustom, glassStyle, setGlassStyle, theme } = useAccentTheme();
  const [editMode, setEditMode] = useState<PaletteMode>(mode);
  const [draft, setDraft] = useState<PaletteColors>(getPalette(mode));
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
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
          <Box position="fixed" inset="0" zIndex={1400} bg={isDark ? 'rgba(2,6,14,0.42)' : 'rgba(15,35,50,0.18)'} onClick={onClose} />
          <Box
            role="dialog"
            aria-modal="true"
            aria-label="全局主题设置"
            position="fixed"
            zIndex={1401}
            w={{ base: 'calc(100vw - 24px)', sm: 'min(400px, calc(100vw - 32px))' }}
            maxH="calc(100dvh - 32px)"
            overflowY="auto"
            top={{ base: '50%', lg: '28px' }}
            left={{ base: '50%', lg: 'calc(240px + 18px)' }}
            transform={{ base: 'translate(-50%, -50%)', lg: 'none' }}
            bg={glassStyle === 'clear' ? `${colors.surface}66` : glassStyle === 'frosted' ? `${colors.surface}E8` : `${colors.surface}C9`}
            color={colors.text}
            borderWidth="1px"
            borderColor={isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.88)'}
            rounded="24px"
            boxShadow={isDark ? 'inset 0 1px 0 rgba(255,255,255,0.16), 0 24px 60px rgba(0,0,0,0.38)' : 'inset 0 1px 0 rgba(255,255,255,0.96), 0 24px 55px rgba(30,65,80,0.20)'}
            backdropFilter={glassStyle === 'clear' ? 'blur(8px) saturate(140%)' : glassStyle === 'frosted' ? 'blur(36px) saturate(145%)' : 'blur(24px) saturate(185%)'}
            sx={{ WebkitBackdropFilter: glassStyle === 'clear' ? 'blur(8px) saturate(140%)' : glassStyle === 'frosted' ? 'blur(36px) saturate(145%)' : 'blur(24px) saturate(185%)' }}
            onClick={event => event.stopPropagation()}
          >
            <Flex align="center" justify="space-between" px="4" py="3" borderBottomWidth="1px" borderColor={theme.border}>
              <Heading size="sm">全局主题</Heading>
              <IconButton aria-label="关闭主题设置" icon={<FiX />} size="sm" variant="ghost" color={colors.text} onClick={onClose} />
            </Flex>

            <Box px="4" py="4">
              <Flex gap="2" mb="4" role="group" aria-label="配色模式">
                {(['light', 'dark'] as const).map(item => (
                  <Button key={item} size="sm" flex="1" h="36px" bg={editMode === item ? theme.soft : 'transparent'} borderWidth="1px" borderColor={editMode === item ? theme.primary : theme.border} color={colors.text} onClick={() => setEditMode(item)}>
                    {item === 'light' ? '亮色' : '暗色'}
                  </Button>
                ))}
              </Flex>

              <Text fontSize="xs" fontWeight="700" mb="2" color={colors.text}>预设配色</Text>
              <SimpleGrid columns={2} spacing="2" mb="4">
                {palettePresets.map(item => {
                  const selected = settings[editMode].preset === item.name;
                  return (
                    <Button key={item.name} h="44px" px="2.5" justifyContent="space-between" bg={selected ? theme.soft : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)'} color={colors.text} borderWidth="1px" borderColor={selected ? theme.primary : theme.border} _hover={{ borderColor: item[editMode].accent }} onClick={() => selectPreset(editMode, item.name)}>
                      <Flex align="center" gap="2" minW="0"><Box w="18px" h="18px" flexShrink={0} rounded="full" bg={item[editMode].accent} /><Text fontSize="sm">{item.label}</Text></Flex>
                      {selected ? <FiCheck size="14" /> : null}
                    </Button>
                  );
                })}
              </SimpleGrid>

              <Text fontSize="xs" fontWeight="700" mb="2">玻璃外观</Text>
              <Flex gap="1.5" mb="4">
                {glassOptions.map(item => (
                  <Button key={item.value} flex="1" minW="0" h="36px" px="1" fontSize="11px" bg={glassStyle === item.value ? theme.soft : 'transparent'} color={colors.text} borderWidth="1px" borderColor={glassStyle === item.value ? theme.primary : theme.border} onClick={() => setGlassStyle(item.value)}>
                    {item.label}
                  </Button>
                ))}
              </Flex>

              <Text fontSize="xs" fontWeight="700" mb="2">自定义颜色</Text>
              <SimpleGrid columns={2} spacing="2">
                {colorFields.map(({ key, label }) => (
                  <Flex key={key} align="center" gap="2" minW="0" px="2" py="1.5" rounded="8px" borderWidth="1px" borderColor={theme.border} bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.40)'}>
                    <Input aria-label={`${label}颜色`} type="color" value={draft[key]} onChange={event => {
                      const next = { ...draft, [key]: event.target.value };
                      setDraft(next);
                      saveCustom(editMode, next);
                    }} w="30px" h="28px" minW="30px" p="0" border="0" cursor="pointer" />
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
