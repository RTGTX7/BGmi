import { Box, Grid, GridItem, Text } from '@chakra-ui/react';

import Skeleton from './skeleton';
import { useColorMode } from '~/hooks/use-color-mode';

export default function FallbackEpisodeCard() {
  const { colorMode } = useColorMode();

  const skeletonItems: JSX.Element[] = [];

  for (let i = 0; i < 10; ++i) {
    skeletonItems.push(
      <GridItem key={i}>
        <Skeleton px="7" maxW="16" fontSize="sm" />
      </GridItem>
    );
  }

  return (
    <Box
      bg={colorMode === 'light' ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.05)'}
      p="4"
      ml={{ base: 'unset', xl: '4' }}
      mt={{ base: '4', xl: 'unset' }}
      w={{ base: 'full', xl: '30%' }}
      h="50%"
      rounded="2xl"
      borderWidth="1px"
      borderColor={colorMode === 'light' ? 'whiteAlpha.900' : 'whiteAlpha.140'}
      backdropFilter="blur(20px) saturate(170%)"
      boxShadow={
        colorMode === 'light'
          ? '0 18px 38px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.56)'
          : '0 18px 38px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'
      }
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '1px',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        background:
          colorMode === 'light'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.58), rgba(255,255,255,0.08) 22%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 22%)',
      }}
    >
      <Text mb="4" position="relative" zIndex="1">
        选集
      </Text>
      <Grid templateColumns={{ base: 'repeat(auto-fill, minmax(3rem, 1fr))', sm: 'repeat(auto-fill, minmax(3.75rem, 1fr))' }} gap={{ base: 3, sm: 6 }} position="relative" zIndex="1">
        {...skeletonItems}
      </Grid>
    </Box>
  );
}
