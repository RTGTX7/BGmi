import { Box, Button, Flex, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { useColorMode } from '~/hooks/use-color-mode';

import BangumiCard from './card';

import type { BangumiWithSeason } from '~/lib/bangumi';

interface TodayHeroSectionProps {
  title: string;
  subtitle: string;
  href: string;
  bangumis: BangumiWithSeason[];
}

export default function TodayHeroSection({ title, subtitle, href, bangumis }: TodayHeroSectionProps) {
  const { colorMode } = useColorMode();
  const [expanded, setExpanded] = useState(true);
  const isDark = colorMode === 'dark';

  return (
    <Box
      w="full"
      rounded="3xl"
      bg={isDark ? 'rgba(14,19,29,0.30)' : 'rgba(244,250,252,0.34)'}
      borderWidth="1px"
      borderColor={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.48)'}
      boxShadow={
        isDark
          ? '0 14px 30px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 12px 24px rgba(39,87,116,0.05), inset 0 1px 0 rgba(255,255,255,0.44)'
      }
      backdropFilter="blur(18px) saturate(165%)"
      px={{ base: '3.5', md: '4', xl: '4.5' }}
      py={{ base: '3.5', md: '4' }}
      overflow="hidden"
    >
      <Flex direction={{ base: 'column', lg: 'row' }} gap={{ base: '4', lg: '5' }} align={{ base: 'stretch', lg: 'flex-start' }}>
        <Stack
          spacing="3"
          w={{ base: 'full', lg: '15rem', xl: '16.25rem' }}
          minW={{ base: '0', lg: '15rem', xl: '16.25rem' }}
          flexShrink={0}
          justify="space-between"
        >
          <Stack spacing="2">
            <Heading
              as={RouterLink}
              to={href}
              size={{ base: 'sm', md: 'md' }}
              color={isDark ? 'whiteAlpha.950' : '#25323f'}
              transition="all .2s ease"
              _hover={{
                color: isDark ? 'blue.200' : 'blue.600',
                textDecoration: 'underline',
                textDecorationColor: isDark ? 'rgba(191,219,254,0.72)' : 'rgba(37,99,235,0.68)',
                textUnderlineOffset: '0.2em',
              }}
            >
              {title}
            </Heading>

            <Text fontSize={{ base: 'sm', md: 'sm' }} color={isDark ? 'whiteAlpha.860' : '#486070'} fontWeight="medium">
              {bangumis.length} 部番剧
            </Text>

            <Text fontSize={{ base: 'xs', md: 'sm' }} color={isDark ? 'whiteAlpha.680' : 'rgba(60,78,92,0.76)'}>
              {subtitle}
            </Text>
          </Stack>

          <HStack spacing="2" pt={{ base: '0.5', md: '1' }}>
            <Button
              size="sm"
              rounded="full"
              minW="5.5rem"
              px="4"
              color={isDark ? 'whiteAlpha.860' : '#445566'}
              bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.42)'}
              borderWidth="1px"
              borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.72)'}
              boxShadow={
                isDark
                  ? '0 10px 24px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 10px 22px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.5)'
              }
              _hover={{
                bg: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.56)',
              }}
              onClick={() => setExpanded(value => !value)}
            >
              {expanded ? '收起' : '展开'}
            </Button>

            <Button
              as={RouterLink}
              to={href}
              size="sm"
              rounded="full"
              minW="6.5rem"
              colorScheme="blue"
              variant="solid"
              px="4"
              boxShadow="0 10px 24px rgba(59,130,246,0.22)"
            >
              查看更多
            </Button>
          </HStack>
        </Stack>

        {expanded ? (
          <Box
            flex="1"
            minW="0"
            overflow="hidden"
          >
            <Box
              display="flex"
              gap="4"
              overflowX="auto"
              overflowY="hidden"
              pb="1"
              sx={{
                WebkitOverflowScrolling: 'touch',
                scrollSnapType: 'x mandatory',
                '&::-webkit-scrollbar': {
                  height: '8px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(72,96,112,0.18)',
                  borderRadius: '999px',
                },
              }}
            >
              {bangumis.map(bangumi => (
                <Box
                  key={bangumi.id}
                  flex={{ base: '0 0 8.35rem', md: '0 0 9.4rem', xl: '0 0 10.2rem' }}
                  minW={{ base: '8.35rem', md: '9.4rem', xl: '10.2rem' }}
                  maxW={{ base: '8.35rem', md: '9.4rem', xl: '10.2rem' }}
                  scrollSnapAlign="start"
                >
                  <BangumiCard bangumiData={bangumi} variant="hero" />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
      </Flex>
    </Box>
  );
}
