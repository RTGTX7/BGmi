import { Flex, Icon } from '@chakra-ui/react';
import type { FlexProps } from '@chakra-ui/react';
import type { IconType } from 'react-icons';

import { useColorMode } from '~/hooks/use-color-mode';
import { useAccentTheme } from '~/hooks/use-accent-theme';

interface NavItemProps extends FlexProps {
  icon: IconType;
  children: React.ReactNode;
  active?: boolean;
}

export default function SidebarNavItem(props: NavItemProps) {
  const { colorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();

  if (colorMode === '') return null;

  const isDark = colorMode === 'dark';
  const { icon, children, active, onClick, ...rest } = props;
  const textColor = active ? colors.accent : colors.text;
  const iconColor = active ? colors.accent : colors.text;

  return (
    <Flex
      align="center"
      mx={{ base: '2', lg: '2.5' }}
      my="1"
      px={{ base: '3.5', lg: '4' }}
      py={{ base: '3.5', lg: '4' }}
      cursor="pointer"
      color={textColor}
      bg={active ? theme.soft : isDark ? `${colors.surface}8C` : colors.surface}
      fontWeight={active ? '800' : '700'}
      fontSize={{ base: 'sm', lg: 'md' }}
      onClick={onClick}
      transition="transform 180ms cubic-bezier(0.22, 1, 0.36, 1), color 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease"
      rounded="1.15rem"
      borderWidth="1px"
      borderColor={active ? theme.border : theme.soft}
      backdropFilter="blur(18px) saturate(175%) contrast(1.04)"
      WebkitBackdropFilter="blur(18px) saturate(175%) contrast(1.04)"
      boxShadow={
        active
          ? isDark
            ? `0 14px 34px rgba(0,0,0,0.22), 0 0 24px ${colors.accent}29, inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -14px 28px ${colors.accent}14`
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
            ? `0 0 10px ${colors.accent}7a, 0 1px 2px rgba(0,0,0,0.54)`
            : '0 1px 1px rgba(255,255,255,0.92), 0 0 10px rgba(14,165,233,0.18)'
          : isDark
            ? '0 1px 2px rgba(0,0,0,0.38)'
            : '0 1px 1px rgba(255,255,255,0.72)'
      }
      _before={{ content: 'none' }}
      _hover={{
        transform: 'translateX(2px) translateY(-1px)',
        color: active ? textColor : isDark ? 'rgba(241,245,249,0.92)' : '#0f172a',
        borderColor: theme.border,
        bg: active ? theme.soft : isDark ? `${colors.surface}B3` : colors.surface,
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
        filter={active ? (isDark ? `drop-shadow(0 0 8px ${colors.accent}8f)` : 'drop-shadow(0 1px 4px rgba(255,255,255,0.86))') : undefined}
      />
      <Flex as="span" position="relative" zIndex={1}>
        {children}
      </Flex>
    </Flex>
  );
}
