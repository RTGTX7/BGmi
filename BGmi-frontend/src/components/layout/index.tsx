import { Box } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useColorMode } from '~/hooks/use-color-mode';
import MobileBottomNav from './mobile-bottom-nav';
import Sidebar from '../sidebar';

function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { colorMode } = useColorMode();

  const handleToggle = () => setOpen(o => !o);
  return (
    <Box
      minH="100vh"
      ml={{ lg: '60' }}
      position="relative"
      bg={
        colorMode === 'dark'
          ? 'radial-gradient(circle at 12% 18%, rgba(108,76,255,0.18), transparent 24%), radial-gradient(circle at 82% 22%, rgba(53,95,196,0.16), transparent 26%), radial-gradient(circle at 58% 78%, rgba(124,58,237,0.12), transparent 28%), linear-gradient(180deg, #0b0e17 0%, #0a1020 46%, #0b0f1a 100%)'
          : 'radial-gradient(circle at 14% 16%, rgba(122,203,214,0.22), transparent 24%), radial-gradient(circle at 84% 14%, rgba(170,221,226,0.18), transparent 26%), linear-gradient(180deg, #d9e9eb 0%, #d2e4e7 42%, #ccdde1 100%)'
      }
    >
      <Sidebar isOpen={open} onClose={handleToggle} />
      <MobileBottomNav sidebarToggle={handleToggle} />
      <Box
        as="main"
        w="100%"
        maxW="none"
        p={{ base: '3', sm: '4', md: '5', lg: '6', xl: '8' }}
        pt={{ base: '3', lg: '6' }}
        pb={{ base: '7.4rem', lg: '6' }}
        minW="0"
        position="relative"
        zIndex="1"
        _before={{
          content: '""',
          position: 'absolute',
          inset: '0',
          pointerEvents: 'none',
          background:
            colorMode === 'dark'
              ? 'radial-gradient(circle at 20% 0%, rgba(145,112,255,0.10), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))'
              : 'radial-gradient(circle at 18% 0%, rgba(156,214,221,0.18), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 12%)',
          borderRadius: '24px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default memo(Layout);
