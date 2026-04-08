import { Box, Grid } from '@chakra-ui/react';

import Skeleton from './skeleton';

import { useColorMode } from '~/hooks/use-color-mode';

function FallbackCard() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const posterBg = isDark ? 'gray.900' : 'gray.100';
  const borderColor = isDark ? 'whiteAlpha.180' : 'blackAlpha.100';

  return (
    <Box
      mx="auto"
      maxW="16rem"
      overflow="hidden"
      rounded="2xl"
      borderWidth="1px"
      borderColor={borderColor}
      bg={posterBg}
      boxShadow={isDark ? '0 18px 40px rgba(0,0,0,0.28)' : '0 18px 40px rgba(15,23,42,0.10)'}
    >
      <Box aspectRatio={3 / 4} bg={posterBg} position="relative">
        <Skeleton h="full" w="full" />
        <Box
          position="absolute"
          left="3.5"
          right="3.5"
          bottom="3.5"
          rounded="2xl"
          px="3.5"
          py="3"
          bg={isDark ? 'rgba(30, 34, 46, 0.34)' : 'rgba(255, 255, 255, 0.22)'}
          borderWidth="1px"
          borderColor={isDark ? 'whiteAlpha.220' : 'whiteAlpha.800'}
          backdropFilter="blur(22px) saturate(165%)"
          boxShadow={isDark ? '0 12px 30px rgba(0,0,0,0.22)' : '0 12px 30px rgba(15,23,42,0.10)'}
        >
          <Skeleton h="6" w="78%" rounded="md" />
          <Skeleton h="4" w="42%" rounded="md" mt="2" />
        </Box>
      </Box>
    </Box>
  );
}

export default function FallbackBangumi() {
  const renderBox: JSX.Element[] = [];

  for (let i = 0; i < 12; ++i) {
    renderBox.push(<FallbackCard key={i} />);
  }

  return (
    <Grid
      templateColumns={{
        base: 'repeat(3, minmax(0, 1fr))',
        sm: 'repeat(auto-fill, minmax(15rem, 16rem))',
      }}
      justifyContent="start"
      gap={{ base: 2.5, sm: 6 }}
    >
      {...renderBox}
    </Grid>
  );
}
