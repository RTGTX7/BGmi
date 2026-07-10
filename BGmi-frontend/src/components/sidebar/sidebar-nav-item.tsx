import { Flex, Icon } from '@chakra-ui/react';
import type { FlexProps } from '@chakra-ui/react';
import type { IconType } from 'react-icons';

import { useColorMode } from '~/hooks/use-color-mode';

interface NavItemProps extends FlexProps {
  icon: IconType;
  children: React.ReactNode;
  active?: boolean;
}

export default function SidebarNavItem(props: NavItemProps) {
  const { colorMode } = useColorMode();

  if (colorMode === '') return null;

  const isDark = colorMode === 'dark';
  const { icon, children, active, onClick, ...rest } = props;
  const textColor = active ? (isDark ? '#e0f7ff' : '#075985') : isDark ? 'rgba(226,232,240,0.74)' : '#243447';
  const iconColor = active ? (isDark ? '#8fe7ff' : '#0369a1') : isDark ? 'rgba(203,213,225,0.56)' : 'rgba(51,65,85,0.66)';

  return (
    <Flex
      align="center"
      mx={{ base: '2', lg: '2.5' }}
      my="1"
      px={{ base: '3.5', lg: '4' }}
      py={{ base: '3.5', lg: '4' }}
      cursor="pointer"
      color={textColor}
      bg={
        active
          ? isDark
            ? 'rgba(18,35,62,0.62)'
            : 'rgba(235,248,255,0.76)'
          : isDark
            ? 'rgba(255,255,255,0.045)'
            : 'rgba(255,255,255,0.34)'
      }
      fontWeight={active ? '800' : '700'}
      fontSize={{ base: 'sm', lg: 'md' }}
      onClick={onClick}
      transition="transform 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease"
      rounded="1.15rem"
      borderWidth="1px"
      borderColor={
        active
          ? isDark
            ? 'rgba(125,211,252,0.46)'
            : 'rgba(14,165,233,0.42)'
          : isDark
            ? 'rgba(255,255,255,0.105)'
            : 'rgba(255,255,255,0.66)'
      }
      backdropFilter="blur(18px) saturate(175%) contrast(1.04)"
      WebkitBackdropFilter="blur(18px) saturate(175%) contrast(1.04)"
      boxShadow={
        active
          ? isDark
            ? '0 14px 34px rgba(0,0,0,0.22), 0 0 24px rgba(56,189,248,0.16), inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -14px 28px rgba(56,189,248,0.08)'
            : '0 14px 30px rgba(14,116,144,0.12), 0 0 22px rgba(14,165,233,0.16), inset 0 1px 1px rgba(255,255,255,0.78), inset 0 -14px 26px rgba(255,255,255,0.22)'
          : isDark
            ? '0 10px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.07)'
            : '0 10px 24px rgba(39,87,116,0.07), inset 0 1px 0 rgba(255,255,255,0.54)'
      }
      position="relative"
      overflow="hidden"
      textShadow={
        active
          ? isDark
            ? '0 0 10px rgba(125,211,252,0.48), 0 1px 2px rgba(0,0,0,0.54)'
            : '0 1px 1px rgba(255,255,255,0.92), 0 0 10px rgba(14,165,233,0.18)'
          : isDark
            ? '0 1px 2px rgba(0,0,0,0.38)'
            : '0 1px 1px rgba(255,255,255,0.72)'
      }
      _before={{
        content: '""',
        position: 'absolute',
        inset: '0',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        opacity: active ? 1 : 0.55,
        background:
          isDark
            ? 'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.14), transparent 38%), radial-gradient(circle at 82% 82%, rgba(56,189,248,0.10), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.018))'
            : 'radial-gradient(circle at 28% 18%, rgba(255,255,255,0.82), transparent 40%), radial-gradient(circle at 82% 82%, rgba(14,165,233,0.11), transparent 42%), linear-gradient(180deg, rgba(255,255,255,0.54), rgba(255,255,255,0.13))',
      }}
      _hover={{
        transform: 'translateX(2px) translateY(-1px)',
        color: active ? textColor : isDark ? 'rgba(241,245,249,0.92)' : '#0f172a',
        borderColor: active
          ? isDark
            ? 'rgba(125,211,252,0.62)'
            : 'rgba(14,165,233,0.58)'
          : isDark
            ? 'rgba(255,255,255,0.20)'
            : 'rgba(255,255,255,0.92)',
        bg: active
          ? undefined
          : isDark
            ? 'rgba(255,255,255,0.075)'
            : 'rgba(255,255,255,0.52)',
        boxShadow: active
          ? undefined
          : isDark
            ? '0 12px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.10)'
            : '0 12px 28px rgba(39,87,116,0.09), inset 0 1px 0 rgba(255,255,255,0.70)',
      }}
      _active={{
        transform: 'translateX(1px) translateY(1px) scale(0.99)',
      }}
      {...rest}
    >
      <Icon
        ml={{ base: '2.5', lg: '3' }}
        mr={{ base: '5', lg: '7' }}
        boxSize={{ base: '5', lg: '6' }}
        as={icon}
        color={iconColor}
        position="relative"
        zIndex={1}
        filter={active ? (isDark ? 'drop-shadow(0 0 8px rgba(125,211,252,0.56))' : 'drop-shadow(0 1px 4px rgba(255,255,255,0.86))') : undefined}
      />
      <Flex as="span" position="relative" zIndex={1}>
        {children}
      </Flex>
    </Flex>
  );
}
