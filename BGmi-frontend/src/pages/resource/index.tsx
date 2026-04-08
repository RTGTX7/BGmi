import { Box, Link, Stack, Text } from '@chakra-ui/react';
import { useColorMode } from '~/hooks/use-color-mode';

export default function Resource() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  return (
    <Box
      rounded="2xl"
      borderWidth="1px"
      borderColor={isDark ? 'whiteAlpha.140' : 'whiteAlpha.900'}
      bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.62)'}
      backdropFilter="blur(22px) saturate(170%)"
      boxShadow={
        isDark
          ? '0 18px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'
          : '0 18px 40px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.56)'
      }
      position="relative"
      overflow="hidden"
      p={{ base: '5', md: '6' }}
      _before={{
        content: '""',
        position: 'absolute',
        inset: '1px',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 22%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.08) 22%)',
      }}
    >
      <Stack spacing="4" position="relative" zIndex="1">
        <Text fontSize="lg" fontWeight="semibold">
          资源订阅导出
        </Text>
        <Stack spacing="3">
          <Link href="./resource/feed.xml" target="_blank" color={isDark ? 'blue.200' : 'blue.600'}>
            RSS Feed
          </Link>
          <Link href="./resource/calendar.ics" target="_blank" color={isDark ? 'blue.200' : 'blue.600'}>
            ICS Calendar for mobile phone
          </Link>
        </Stack>
      </Stack>
    </Box>
  );
}
