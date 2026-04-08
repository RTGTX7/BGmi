import { Flex, Icon } from '@chakra-ui/react';
import type { IconType } from 'react-icons';

import { useColorMode } from '~/hooks/use-color-mode';

interface NavItemProps {
  icon: IconType;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export default function SidebarNavItem(props: NavItemProps) {
  const { colorMode } = useColorMode();

  if (colorMode === '') return null;

  const hoverBg = colorMode === 'light' ? 'rgba(234,248,255,0.44)' : 'rgba(255,255,255,0.08)';
  const activeBg = colorMode === 'light' ? 'rgba(238,250,255,0.56)' : 'rgba(255,255,255,0.10)';
  const textColor = colorMode === 'light' ? 'gray.900' : 'gray.200';

  const { icon, children, active, onClick } = props;
  return (
    <Flex
      align="center"
      mx={{ base: '2', lg: '2.5' }}
      my="1"
      px={{ base: '3.5', lg: '4' }}
      py={{ base: '3.5', lg: '4' }}
      cursor="pointer"
      color={textColor}
      _hover={{
        bg: active ? activeBg : hoverBg,
        backdropFilter: 'blur(14px) saturate(155%)',
        transform: 'translateX(1px)',
      }}
      bg={active ? activeBg : ''}
      fontWeight="semibold"
      fontSize={{ base: 'sm', lg: 'md' }}
      onClick={onClick}
      transition="0.16s ease"
      rounded="xl"
      borderWidth="1px"
      borderColor={active ? (colorMode === 'light' ? 'whiteAlpha.900' : 'whiteAlpha.160') : 'transparent'}
      backdropFilter={active || colorMode === 'light' ? 'blur(18px) saturate(165%)' : undefined}
      boxShadow={
        active
          ? colorMode === 'light'
            ? '0 16px 30px rgba(39,87,116,0.10), 0 4px 14px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.50)'
            : '0 10px 24px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
          : 'none'
      }
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '1px',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        opacity: active ? 1 : 0,
        background:
          colorMode === 'light'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.56), rgba(255,255,255,0.06) 26%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 26%)',
      }}
    >
      <Icon ml={{ base: '2.5', lg: '3' }} mr={{ base: '5', lg: '7' }} boxSize={{ base: '5', lg: '6' }} as={icon} />
      {children}
    </Flex>
  );
}
