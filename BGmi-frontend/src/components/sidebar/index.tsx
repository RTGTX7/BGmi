import { Box, Drawer, DrawerContent, DrawerOverlay } from '@chakra-ui/react';
import { memo } from 'react';

import { SidebarContent } from './sidebar-content';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function Sidebar({ isOpen, onClose }: Props) {
  return (
    <Box>
      <SidebarContent display={{ base: 'none', lg: 'unset' }} />
      <Box display={{ base: 'block', lg: 'none' }}>
        <Drawer autoFocus={false} isOpen={isOpen} onClose={onClose} placement="left">
          <DrawerOverlay backdropFilter="blur(8px)" bg="blackAlpha.300" />
          <DrawerContent bg="transparent" maxW="60" boxShadow="none">
            <SidebarContent onClose={onClose} w="full" borderRight="none" />
          </DrawerContent>
        </Drawer>
      </Box>
    </Box>
  );
}

export default memo(Sidebar);
