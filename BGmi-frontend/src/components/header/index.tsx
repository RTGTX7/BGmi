import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { useLocation } from 'react-router-dom';
import { FiMenu } from 'react-icons/fi';

import { useColorMode } from '~/hooks/use-color-mode';
import { handleSecondaryTitle } from '~/lib/utils';

export default function Header({ sidebarToggle }: { sidebarToggle: () => void }) {
  const { pathname } = useLocation();
  const secondaryTitle = handleSecondaryTitle(pathname);

  const { colorMode } = useColorMode();
  return (
    <Box pb={{ base: '16', lg: 'unset' }}>
      <Flex
        alignItems="center"
        bg={colorMode === 'dark' ? 'rgba(14, 18, 31, 0.74)' : 'rgba(206, 227, 231, 0.58)'}
        py="2.5"
        px={{ base: '2', sm: '3' }}
        as="header"
        w="full"
        pos="fixed"
        top="0"
        zIndex="200"
        backdropFilter="auto"
        saturate="165%"
        backdropBlur="18px"
        borderBottomWidth="1px"
        borderBottomColor={colorMode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.56)'}
        boxShadow={colorMode === 'dark' ? '0 10px 30px rgba(2,4,14,0.20)' : '0 10px 30px rgba(36,78,88,0.08)'}
        display={{ base: 'flex', lg: 'none' }}
      >
        <Box display={{ base: 'block', lg: 'none' }}>
          <IconButton aria-label="Menu" onClick={sidebarToggle} icon={<FiMenu />} size="sm" variant="ghost" />
        </Box>
        <Text ml="3" flex="1" minW="0" fontSize={{ base: 'md', sm: 'lg' }} fontWeight="semibold" noOfLines={1} color={colorMode === 'dark' ? 'rgba(255,255,255,0.94)' : 'rgba(35,60,68,0.94)'}>
          BGmi - {pathname === '/' ? 'Bangumi' : secondaryTitle}
        </Text>
      </Flex>
    </Box>
  );
}
