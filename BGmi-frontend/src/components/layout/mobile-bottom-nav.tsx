import { Box, Flex, Icon, IconButton } from '@chakra-ui/react';
import { BsCalendar2CheckFill, BsFillCollectionPlayFill, BsMoonFill, BsPlayBtnFill, BsSunFill } from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { FiMenu } from 'react-icons/fi';
import { useLocation } from 'react-router-dom';

import Link from '../router-link';

import { useColorMode } from '~/hooks/use-color-mode';

interface NavItem {
  label: string;
  href: string;
  icon: IconType;
  external?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Bangumi', href: '/', icon: BsPlayBtnFill },
  { label: 'Calendar', href: '/calendar', icon: BsCalendar2CheckFill },
  { label: 'Subscribe', href: '/subscribe', icon: BsFillCollectionPlayFill },
];

export default function MobileBottomNav({ sidebarToggle }: { sidebarToggle: () => void }) {
  const { pathname } = useLocation();
  const { colorMode, toggleColorMode } = useColorMode();
  const isPlayerPage = pathname.startsWith('/player/');

  const navBottom = 'calc(env(safe-area-inset-bottom, 0px) + 0.85rem)';
  const navInset = isPlayerPage ? '2.55' : '3';
  const navGap = isPlayerPage ? '0.75rem' : '0.9rem';
  const navItemMinH = isPlayerPage ? '3.7rem' : '4rem';
  const navIconSize = isPlayerPage ? '22px' : '24px';
  const toggleButtonSize = isPlayerPage ? '3.7rem' : '4rem';

  return (
    <Box display={{ base: 'block', lg: 'none' }}>
      <Flex
        position="fixed"
        left={navInset}
        right={navInset}
        bottom={navBottom}
        zIndex="210"
        align="center"
        gap={navGap}
      >
        <Box
          flex="1"
          rounded="1.6rem"
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.84)'}
          bg={colorMode === 'dark' ? 'rgba(18, 22, 38, 0.68)' : 'rgba(240, 248, 251, 0.58)'}
          boxShadow={
            colorMode === 'dark'
              ? '0 20px 44px rgba(0,0,0,0.34), 0 6px 18px rgba(96,126,255,0.10), inset 0 1px 0 rgba(255,255,255,0.12)'
              : '0 20px 44px rgba(36,78,88,0.16), 0 6px 18px rgba(94,188,214,0.10), inset 0 1px 0 rgba(255,255,255,0.62)'
          }
          backdropFilter="blur(1px) saturate(240%)"
          overflow="hidden"
        >
          <Flex align="stretch" justify="space-between">
            {navItems.map(item => {
              const active = pathname === item.href;
              const content = (
                <Flex
                  align="center"
                  justify="center"
                  minH={navItemMinH}
                  flex="1"
                  color={
                    active
                      ? colorMode === 'dark' ? 'blue.100' : 'blue.600'
                      : colorMode === 'dark' ? 'whiteAlpha.600' : 'gray.500'
                  }
                  bg={
                    active
                      ? colorMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)'
                      : 'transparent'
                  }
                  transition="color 0.18s ease, background 0.18s ease"
                >
                  <Icon as={item.icon} boxSize={navIconSize} />
                </Flex>
              );

              return (
                <Link key={item.label} href={item.href} flex="1">
                  {content}
                </Link>
              );
            })}

            <Box as="button" type="button" onClick={sidebarToggle} flex="1">
              <Flex
                align="center"
                justify="center"
                minH={navItemMinH}
                flex="1"
                color={colorMode === 'dark' ? 'whiteAlpha.600' : 'gray.500'}
                transition="color 0.18s ease"
                _hover={{ color: colorMode === 'dark' ? 'whiteAlpha.900' : 'gray.700' }}
              >
                <Icon as={FiMenu} boxSize={navIconSize} />
              </Flex>
            </Box>
          </Flex>
        </Box>

        <IconButton
          aria-label="Toggle day and night mode"
          onClick={toggleColorMode}
          icon={<Icon as={colorMode === 'dark' ? BsSunFill : BsMoonFill} boxSize={navIconSize} />}
          w={toggleButtonSize}
          minW={toggleButtonSize}
          h={toggleButtonSize}
          rounded="full"
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.84)'}
          color={colorMode === 'dark' ? 'blue.100' : 'blue.600'}
          bg={colorMode === 'dark' ? 'rgba(18, 22, 38, 0.82)' : 'rgba(240, 248, 251, 0.74)'}
          boxShadow={
            colorMode === 'dark'
              ? '0 20px 44px rgba(0,0,0,0.34), 0 6px 18px rgba(96,126,255,0.12), inset 0 1px 0 rgba(255,255,255,0.12)'
              : '0 20px 44px rgba(36,78,88,0.16), 0 6px 18px rgba(94,188,214,0.12), inset 0 1px 0 rgba(255,255,255,0.62)'
          }
          backdropFilter="blur(1px) saturate(240%)"
          _hover={{
            transform: 'translateY(-1px)',
            bg: colorMode === 'dark' ? 'rgba(18, 22, 38, 0.9)' : 'rgba(240, 248, 251, 0.88)',
          }}
          _active={{
            transform: 'scale(0.98)',
          }}
        />
      </Flex>
    </Box>
  );
}
