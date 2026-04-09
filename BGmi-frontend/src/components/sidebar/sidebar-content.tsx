import { Box, Flex, Text, Image } from '@chakra-ui/react';
import type { BoxProps } from '@chakra-ui/react';

import {
  BsCalendar2CheckFill,
  BsFillCollectionPlayFill,
  BsFolderFill,
  BsInfoSquareFill,
  BsMoonFill,
  BsPlayBtnFill,
  BsRssFill,
  BsSunFill,
} from 'react-icons/bs';

import { useLocation } from 'react-router-dom';

import Link from '../router-link';
import SidebarNavItem from './sidebar-nav-item';

import { useColorMode } from '~/hooks/use-color-mode';
const LOGO = '/logo.png';

export const SidebarContent = ({ onClose, ...props }: BoxProps & { onClose?: () => void }) => {
  const { colorMode, toggleColorMode } = useColorMode();

  const { pathname } = useLocation();
  const currentPath = pathname.slice(1).toLowerCase();

  return (
    <Box
      as="nav"
      pos={{ base: 'relative', lg: 'fixed' }}
      top="0"
      left="0"
      h="full"
      overflowY="auto"
      overscrollBehavior="contain"
      borderRightWidth="1px"
      borderRightColor={colorMode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(122, 167, 176, 0.30)'}
      w={{ base: 'full', lg: '60' }}
      bg={colorMode === 'dark' ? 'rgba(13, 16, 28, 0.78)' : 'rgba(204, 225, 229, 0.62)'}
      backdropFilter="blur(24px) saturate(170%)"
      boxShadow={colorMode === 'dark' ? '0 20px 50px rgba(4,6,18,0.28)' : '0 18px 40px rgba(36,78,88,0.10)'}
      _before={{
        content: '""',
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        background:
          colorMode === 'dark'
            ? 'linear-gradient(180deg, rgba(180,150,255,0.06), rgba(255,255,255,0.01) 22%, rgba(255,255,255,0))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(170,214,220,0.14) 30%, rgba(255,255,255,0.03))',
      }}
      sx={{
        WebkitBackdropFilter: 'blur(24px) saturate(170%)',
      }}
      _after={{
        content: '""',
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        opacity: colorMode === 'dark' ? 0.2 : 0.14,
        mixBlendMode: colorMode === 'dark' ? 'screen' : 'multiply',
        backgroundImage:
          colorMode === 'dark'
            ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='%23fff' fill-opacity='.035'%3E%3Ccircle cx='12' cy='18' r='1'/%3E%3Ccircle cx='34' cy='26' r='1'/%3E%3Ccircle cx='76' cy='12' r='1'/%3E%3Ccircle cx='112' cy='22' r='1'/%3E%3Ccircle cx='58' cy='54' r='1'/%3E%3Ccircle cx='94' cy='64' r='1'/%3E%3Ccircle cx='20' cy='82' r='1'/%3E%3Ccircle cx='118' cy='92' r='1'/%3E%3Ccircle cx='72' cy='108' r='1'/%3E%3Ccircle cx='44' cy='122' r='1'/%3E%3C/g%3E%3C/svg%3E\")"
            : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='%23000' fill-opacity='.03'%3E%3Ccircle cx='12' cy='18' r='1'/%3E%3Ccircle cx='34' cy='26' r='1'/%3E%3Ccircle cx='76' cy='12' r='1'/%3E%3Ccircle cx='112' cy='22' r='1'/%3E%3Ccircle cx='58' cy='54' r='1'/%3E%3Ccircle cx='94' cy='64' r='1'/%3E%3Ccircle cx='20' cy='82' r='1'/%3E%3Ccircle cx='118' cy='92' r='1'/%3E%3Ccircle cx='72' cy='108' r='1'/%3E%3Ccircle cx='44' cy='122' r='1'/%3E%3C/g%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      <Flex px={{ base: '5', lg: '6' }} py={{ base: '5', lg: '6' }} alignItems="center">
        <Image
          src={LOGO}
          width={{ base: '44px', lg: '52px' }}
          height={{ base: '44px', lg: '52px' }}
          borderRadius="50%"
          alt="logo"
          flexShrink={0}
          placeholder="empty"
          boxShadow={colorMode === 'dark' ? '0 6px 18px rgba(0,0,0,0.16)' : '0 8px 18px rgba(31,84,110,0.10)'}
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(123,152,168,0.22)'}
        />
        <Text
          ml="4"
          fontSize={{ base: '2xl', lg: '3xl' }}
          lineHeight="1"
          fontWeight="bold"
          letterSpacing="-0.045em"
          color="transparent"
          bgClip="text"
          bgGradient={
            colorMode === 'dark'
              ? 'linear(to-b, rgba(255,255,255,0.92), rgba(214,225,239,0.66) 48%, rgba(180,196,214,0.40))'
              : 'linear(to-b, rgba(80,120,160,0.96), rgba(60,100,140,0.88) 46%, rgba(40,70,110,0.78))'
          }
          sx={{
            WebkitTextStroke: colorMode === 'dark' ? '1px rgba(255,255,255,0.10)' : '1px rgba(255,255,255,0.42)',
            filter: colorMode === 'dark' ? 'drop-shadow(0 8px 18px rgba(0,0,0,0.20))' : 'drop-shadow(0 8px 18px rgba(31,84,110,0.14))',
          }}
          textShadow={
            colorMode === 'dark'
              ? '0 1px 0 rgba(255,255,255,0.22), 0 0 18px rgba(255,255,255,0.06)'
              : '0 1px 0 rgba(255,255,255,0.72), 0 0 16px rgba(255,255,255,0.18)'
          }
        >
          BGmi
        </Text>
      </Flex>
      <Flex direction="column" as="nav" fontSize="md" color="gray.600" aria-label="main-navigation">
        {/*
         * 兼容 safari，不知道为什么会导致第一个元素被聚焦
         * Drawer 组件已经设置了 autoFocus={false}
         */}
        <Link href="/" _focusVisible={{ outline: 'none' }}>
          <SidebarNavItem active={pathname === '/'} icon={BsPlayBtnFill} onClick={onClose}>
            Bangumi
          </SidebarNavItem>
        </Link>

        <a href="./bangumi" target="_blank">
          <SidebarNavItem icon={BsFolderFill}>Bangumi Files</SidebarNavItem>
        </a>

        <Link href="/calendar">
          <SidebarNavItem active={currentPath === 'calendar'} icon={BsCalendar2CheckFill} onClick={onClose}>
            Calendar
          </SidebarNavItem>
        </Link>
        <Link href="/resource">
          <SidebarNavItem active={currentPath === 'resource'} icon={BsRssFill} onClick={onClose}>
            Resource
          </SidebarNavItem>
        </Link>

        <Box h="4" />

        <Link href="/subscribe">
          <SidebarNavItem
            active={currentPath === 'subscribe' || currentPath === 'auth'}
            icon={BsFillCollectionPlayFill}
            onClick={onClose}
          >
            Subscribe
          </SidebarNavItem>
        </Link>

        <Box h="4" />

        <Link href="/about">
          <SidebarNavItem active={currentPath === 'about'} icon={BsInfoSquareFill} onClick={onClose}>
            About
          </SidebarNavItem>
        </Link>

        <Box h="3" />
        <SidebarNavItem icon={colorMode === 'dark' ? BsSunFill : BsMoonFill} onClick={toggleColorMode}>
          Theme Toggle
        </SidebarNavItem>
      </Flex>
    </Box>
  );
};
