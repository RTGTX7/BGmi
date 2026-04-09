import { Box, Flex, Icon, IconButton, Text } from '@chakra-ui/react';
import {
  BsCalendar2CheckFill,
  BsChevronLeft,
  BsFillCollectionPlayFill,
  BsFolderFill,
  BsInfoSquareFill,
  BsMoonFill,
  BsPlayBtnFill,
  BsSunFill,
} from 'react-icons/bs';
import type { IconType } from 'react-icons';
import { FiChevronLeft, FiChevronRight, FiMenu } from 'react-icons/fi';
import { useState } from 'react';
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
  { label: 'Files', href: '/bangumi', icon: BsFolderFill, external: true },
  { label: 'About', href: '/about', icon: BsInfoSquareFill },
];

export default function MobileBottomNav({ sidebarToggle }: { sidebarToggle: () => void }) {
  const { pathname } = useLocation();
  const { colorMode, toggleColorMode } = useColorMode();
  const [expanded, setExpanded] = useState(false);

  const panelBg = colorMode === 'dark' ? 'rgba(18, 22, 38, 0.76)' : 'rgba(240, 248, 251, 0.68)';
  const panelBorder = colorMode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.70)';

  return (
    <Box display={{ base: 'block', lg: 'none' }}>
      <Flex
        position="fixed"
        right="0"
        bottom="6.75rem"
        zIndex="211"
        align="center"
        transform={expanded ? 'translateX(0)' : 'translateX(5.4rem)'}
        transition="transform 240ms cubic-bezier(0.22, 1, 0.36, 1)"
      >
        <IconButton
          aria-label={expanded ? 'Hide quick tools' : 'Show quick tools'}
          onClick={() => setExpanded(v => !v)}
          icon={expanded ? <FiChevronRight /> : <FiChevronLeft />}
          size="sm"
          w="1.65rem"
          minW="1.65rem"
          h="2.95rem"
          roundedLeft="full"
          roundedRight="none"
          borderWidth="1px"
          borderRightWidth="0"
          borderColor={panelBorder}
          bg={panelBg}
          boxShadow={
            colorMode === 'dark'
              ? '0 14px 30px rgba(0,0,0,0.24)'
              : '0 14px 30px rgba(36,78,88,0.12)'
          }
          backdropFilter="blur(16px) saturate(170%)"
        />

        <Flex
          align="center"
          gap="1.5"
          px="2"
          py="1.5"
          roundedRight="full"
          borderWidth="1px"
          borderColor={panelBorder}
          bg={panelBg}
          boxShadow={
            colorMode === 'dark'
              ? '0 14px 30px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 14px 30px rgba(36,78,88,0.12), inset 0 1px 0 rgba(255,255,255,0.46)'
          }
          backdropFilter="blur(16px) saturate(170%)"
        >
          <IconButton
            aria-label="Theme Toggle"
            onClick={toggleColorMode}
            icon={colorMode === 'dark' ? <BsSunFill /> : <BsMoonFill />}
            size="sm"
            rounded="full"
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.50)'}
            bg={colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.42)'}
          />
          <IconButton
            aria-label="Menu"
            onClick={sidebarToggle}
            icon={<FiMenu />}
            size="sm"
            rounded="full"
            borderWidth="1px"
            borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.50)'}
            bg={colorMode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.42)'}
          />
        </Flex>
      </Flex>

      <Box
        position="fixed"
        left="3"
        right="3"
        bottom="3"
        zIndex="210"
        rounded="2xl"
        borderWidth="1px"
        borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.84)'}
        bg={colorMode === 'dark' ? 'rgba(18, 22, 38, 0.68)' : 'rgba(240, 248, 251, 0.58)'}
        boxShadow={
          colorMode === 'dark'
            ? '0 20px 44px rgba(0,0,0,0.34), 0 6px 18px rgba(96,126,255,0.10), inset 0 1px 0 rgba(255,255,255,0.12)'
            : '0 20px 44px rgba(36,78,88,0.16), 0 6px 18px rgba(94,188,214,0.10), inset 0 1px 0 rgba(255,255,255,0.62)'
        }
        backdropFilter="blur(18px) saturate(240%)"
        overflow="hidden"
      >
        <Flex align="stretch" justify="space-between">
          {navItems.map(item => {
            const active = !item.external && pathname === item.href;
            const content = (
              <Flex
                direction="column"
                align="center"
                justify="center"
                gap="1"
                minH="4.1rem"
                flex="1"
                color={
                  active
                    ? colorMode === 'dark'
                      ? 'blue.100'
                      : 'blue.600'
                    : colorMode === 'dark'
                      ? 'whiteAlpha.700'
                      : 'gray.600'
                }
                bg={active ? (colorMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)') : 'transparent'}
              >
                <Icon as={item.icon} boxSize="4.5" />
                <Text fontSize="xs" fontWeight={active ? '700' : '600'}>
                  {item.label}
                </Text>
              </Flex>
            );

            if (item.external) {
              return (
                <Box key={item.label} as="a" href={item.href} target="_blank" rel="noreferrer" flex="1">
                  {content}
                </Box>
              );
            }

            return (
              <Link key={item.label} href={item.href} flex="1">
                {content}
              </Link>
            );
          })}
        </Flex>
      </Box>
    </Box>
  );
}
