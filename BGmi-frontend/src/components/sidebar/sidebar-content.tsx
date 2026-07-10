import { Box, Flex, Text, Image } from '@chakra-ui/react';
import type { BoxProps } from '@chakra-ui/react';

import {
  BsCalendar2CheckFill,
  BsClipboardDataFill,
  BsFillCollectionPlayFill,
  BsFolderFill,
  BsInfoSquareFill,
  BsMoonFill,
  BsPlayBtnFill,
  BsRssFill,
  BsSunFill,
} from 'react-icons/bs';

import { useLocation, useNavigate } from 'react-router-dom';

import Link from '../router-link';
import SidebarNavItem from './sidebar-nav-item';

import { useColorMode } from '~/hooks/use-color-mode';
import { getLiquidGlassGroupStyles, useLongPressDragSelect } from '~/lib/liquid-glass';
const LOGO = '/logo.png';

export const SidebarContent = ({ onClose, ...props }: BoxProps & { onClose?: () => void }) => {
  const { colorMode, toggleColorMode } = useColorMode();

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentPath = pathname.slice(1).toLowerCase();
  const navDragSelect = useLongPressDragSelect(value => {
    if (value === '__theme') {
      toggleColorMode();
      return;
    }

    navigate(value);
    onClose?.();
  });

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
      borderRightColor={colorMode === 'dark' ? 'rgba(125,211,252,0.14)' : 'rgba(125, 167, 184, 0.28)'}
      w={{ base: 'full', lg: '60' }}
      bg={colorMode === 'dark' ? 'rgba(6, 10, 22, 0.82)' : 'rgba(238, 248, 252, 0.78)'}
      backdropFilter="blur(26px) saturate(178%) contrast(1.05)"
      boxShadow={
        colorMode === 'dark'
          ? '18px 0 42px rgba(0,0,0,0.28), inset -1px 0 0 rgba(125,211,252,0.08), inset 1px 0 0 rgba(255,255,255,0.05)'
          : '16px 0 36px rgba(36,78,88,0.10), inset -1px 0 0 rgba(255,255,255,0.72), inset 1px 0 0 rgba(255,255,255,0.34)'
      }
      _before={{
        content: '""',
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        background:
          colorMode === 'dark'
            ? 'radial-gradient(circle at 18% 4%, rgba(125,211,252,0.13), transparent 30%), radial-gradient(circle at 110% 24%, rgba(91,141,255,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.012) 38%, rgba(255,255,255,0))'
            : 'radial-gradient(circle at 16% 2%, rgba(255,255,255,0.94), transparent 32%), radial-gradient(circle at 110% 26%, rgba(125,211,252,0.24), transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.18) 38%, rgba(255,255,255,0.04))',
      }}
      sx={{
        WebkitBackdropFilter: 'blur(26px) saturate(178%) contrast(1.05)',
      }}
      _after={{
        content: '""',
        position: 'absolute',
        inset: '0',
        pointerEvents: 'none',
        opacity: colorMode === 'dark' ? 0.20 : 0.10,
        mixBlendMode: colorMode === 'dark' ? 'screen' : 'multiply',
        backgroundImage:
          colorMode === 'dark'
            ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.11'/%3E%3C/svg%3E\")"
            : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.07'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      <Flex px={{ base: '5', lg: '6' }} py={{ base: '5', lg: '6' }} alignItems="center">
        <Box
          position="relative"
          flexShrink={0}
          rounded="full"
          p="1"
          bg={colorMode === 'dark' ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.62)'}
          borderWidth="1px"
          borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.88)'}
          boxShadow={
            colorMode === 'dark'
              ? '0 12px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.16), 0 0 24px rgba(125,211,252,0.08)'
              : '0 12px 26px rgba(36,78,88,0.12), inset 0 1px 0 rgba(255,255,255,0.92)'
          }
          backdropFilter="blur(14px) saturate(160%)"
          _before={{
            content: '""',
            position: 'absolute',
            inset: '1px',
            rounded: 'full',
            pointerEvents: 'none',
            background:
              colorMode === 'dark'
                ? 'linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.02) 48%, rgba(125,211,252,0.12))'
                : 'linear-gradient(135deg, rgba(255,255,255,0.90), rgba(255,255,255,0.08) 50%, rgba(125,211,252,0.16))',
          }}
        >
          <Image
            src={LOGO}
            width={{ base: '44px', lg: '52px' }}
            height={{ base: '44px', lg: '52px' }}
            borderRadius="50%"
            alt="logo"
            placeholder="empty"
            position="relative"
            zIndex={1}
          />
        </Box>
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
              ? 'linear(to-b, rgba(255,255,255,1), rgba(226,244,255,0.86) 44%, rgba(126,166,205,0.62))'
              : 'linear(to-b, rgba(13,42,70,1), rgba(20,86,125,0.98) 46%, rgba(7,57,92,0.94))'
          }
          sx={{
            WebkitTextStroke: colorMode === 'dark' ? '1px rgba(255,255,255,0.16)' : '1px rgba(255,255,255,0.72)',
            filter:
              colorMode === 'dark'
                ? 'drop-shadow(0 8px 18px rgba(0,0,0,0.34)) drop-shadow(0 0 18px rgba(125,211,252,0.16))'
                : 'drop-shadow(0 2px 1px rgba(255,255,255,0.90)) drop-shadow(0 8px 16px rgba(31,84,110,0.24))',
          }}
          textShadow={
            colorMode === 'dark'
              ? '0 1px 0 rgba(255,255,255,0.34), 0 0 18px rgba(125,211,252,0.18)'
              : '0 1px 0 rgba(255,255,255,1), 0 0 10px rgba(255,255,255,0.56), 0 1px 8px rgba(7,57,92,0.22)'
          }
        >
          BGmi
        </Text>
      </Flex>
      <Flex
        direction="column"
        as="nav"
        fontSize="md"
        color="gray.600"
        aria-label="main-navigation"
        sx={{
          ...getLiquidGlassGroupStyles(colorMode, navDragSelect.dragging),
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/*
         * 兼容 safari，不知道为什么会导致第一个元素被聚焦
         * Drawer 组件已经设置了 autoFocus={false}
         */}
        <Link href="/" _focusVisible={{ outline: 'none' }}>
          <SidebarNavItem active={pathname === '/'} icon={BsPlayBtnFill} onClick={onClose} {...navDragSelect.getOptionProps('/')}>
            Bangumi
          </SidebarNavItem>
        </Link>

        <Link href="/bangumi-files">
          <SidebarNavItem active={currentPath === 'bangumi-files'} icon={BsFolderFill} onClick={onClose} {...navDragSelect.getOptionProps('/bangumi-files')}>
            Archive
          </SidebarNavItem>
        </Link>

        <Link href="/calendar">
          <SidebarNavItem active={currentPath === 'calendar'} icon={BsCalendar2CheckFill} onClick={onClose} {...navDragSelect.getOptionProps('/calendar')}>
            Calendar
          </SidebarNavItem>
        </Link>
        <Link href="/resource">
          <SidebarNavItem active={currentPath === 'resource'} icon={BsRssFill} onClick={onClose} {...navDragSelect.getOptionProps('/resource')}>
            Resource
          </SidebarNavItem>
        </Link>

        <Box h="4" />

        <Link href="/dashboard">
          <SidebarNavItem active={currentPath === 'dashboard'} icon={BsClipboardDataFill} onClick={onClose} {...navDragSelect.getOptionProps('/dashboard')}>
            Dashboard
          </SidebarNavItem>
        </Link>

        <Link href="/subscribe">
          <SidebarNavItem
            active={currentPath === 'subscribe' || currentPath === 'auth'}
            icon={BsFillCollectionPlayFill}
            onClick={onClose}
            {...navDragSelect.getOptionProps('/subscribe')}
          >
            Subscribe
          </SidebarNavItem>
        </Link>

        <Box h="4" />

        <Link href="/about">
          <SidebarNavItem active={currentPath === 'about'} icon={BsInfoSquareFill} onClick={onClose} {...navDragSelect.getOptionProps('/about')}>
            About
          </SidebarNavItem>
        </Link>

        <Box h="3" />
        <SidebarNavItem icon={colorMode === 'dark' ? BsSunFill : BsMoonFill} onClick={toggleColorMode} {...navDragSelect.getOptionProps('__theme')}>
          Theme Toggle
        </SidebarNavItem>
      </Flex>
    </Box>
  );
};
