import { Box, Flex, IconButton, Image, Text } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { FiMenu } from 'react-icons/fi';
import { BsMoonFill, BsSunFill } from 'react-icons/bs';

import { useColorMode } from '~/hooks/use-color-mode';
import { handleSecondaryTitle } from '~/lib/utils';
import LOGO from '../../assets/logo.jpg';

export default function Header({ sidebarToggle }: { sidebarToggle: () => void }) {
  const { pathname } = useLocation();
  const secondaryTitle = handleSecondaryTitle(pathname);
  const { colorMode, toggleColorMode } = useColorMode();

  return (
    <Box display={{ base: 'block', lg: 'none' }}>
      <Flex
        alignItems="center"
        gap="2.5"
        bg={colorMode === 'dark' ? 'rgba(14, 18, 31, 0.82)' : 'rgba(232, 244, 247, 0.76)'}
        py="2.5"
        px="3"
        as="header"
        w="full"
        pos="fixed"
        top="0"
        zIndex="200"
        backdropFilter="blur(12px) saturate(165%)"
        borderBottomWidth="1px"
        borderBottomColor={colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.56)'}
        boxShadow={colorMode === 'dark' ? '0 10px 30px rgba(2,4,14,0.20)' : '0 10px 30px rgba(36,78,88,0.08)'}
      >
        <Image
          src={LOGO}
          width="34px"
          height="34px"
          borderRadius="full"
          alt="logo"
          boxShadow={colorMode === 'dark' ? '0 6px 18px rgba(0,0,0,0.16)' : '0 8px 18px rgba(31,84,110,0.10)'}
        />

        <Box minW="0" flex="1">
          <Text fontSize="lg" fontWeight="bold" lineHeight="1.1" noOfLines={1}>
            BGmi
          </Text>
          <Text fontSize="xs" opacity="0.72" noOfLines={1}>
            {pathname === '/' ? 'Bangumi' : secondaryTitle}
          </Text>
        </Box>

        <IconButton
          aria-label="Theme Toggle"
          onClick={toggleColorMode}
          icon={colorMode === 'dark' ? <BsSunFill /> : <BsMoonFill />}
          size="md"
          rounded="full"
          variant="outline"
          bg={colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.58)'}
        />
        <IconButton aria-label="Menu" onClick={sidebarToggle} icon={<FiMenu />} size="md" rounded="full" variant="outline" />
      </Flex>
    </Box>
  );
}
