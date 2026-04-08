import { Box, Divider, Flex, Heading, Link, SimpleGrid, Stack, Tag, Text } from '@chakra-ui/react';

import { useBangumi } from '~/hooks/use-bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

const CUSTOM_VERSION = 'RTGTX7 Edition 1.0.0';

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Box rounded="xl" borderWidth="1px" p="4" bg="whiteAlpha.100">
      <Text fontSize="xs" textTransform="uppercase" opacity="0.7" letterSpacing="0.12em">
        {label}
      </Text>
      <Text mt="2" fontSize="lg" fontWeight="semibold">
        {value}
      </Text>
    </Box>
  );
}

export default function About() {
  const { data } = useBangumi();
  const { colorMode } = useColorMode();
  const accent = colorMode === 'dark' ? 'blue.200' : 'blue.600';
  const panelBg = colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.50';
  const borderColor = colorMode === 'dark' ? 'whiteAlpha.300' : 'blackAlpha.200';

  return (
    <Stack spacing="6">
      <Box
        rounded="2xl"
        borderWidth="1px"
        borderColor={borderColor}
        bg={panelBg}
        overflow="hidden"
        position="relative"
      >
        <Box
          position="absolute"
          inset="0"
          bgGradient={
            colorMode === 'dark'
              ? 'linear(to-br, blue.500, cyan.400, teal.300)'
              : 'linear(to-br, blue.100, cyan.100, teal.100)'
          }
          opacity="0.18"
        />
        <Stack spacing="5" p={{ base: '5', md: '8' }} position="relative">
          <Tag alignSelf="flex-start" size="lg" colorScheme="blue" variant="solid">
            Custom Build
          </Tag>
          <Stack spacing="2">
            <Heading size="2xl">RTGTX7 BGmi</Heading>
            <Text fontSize="lg" color={accent} fontWeight="semibold">
              {CUSTOM_VERSION}
            </Text>
            <Text maxW="3xl" opacity="0.88">
              面向自用服务器和远程播放场景的 BGmi 定制版本，重点增强了字幕、HLS 画质切换、GPU
              转码和外部播放器联动体验。
            </Text>
          </Stack>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4">
        <InfoCard label="Backend" value={data?.version ? `BGmi ${data.version}` : 'BGmi'} />
        <InfoCard label="Frontend" value={`UI ${import.meta.env.VITE_APP_VERSION}`} />
        <InfoCard label="Edition" value={CUSTOM_VERSION} />
      </SimpleGrid>

      <Box rounded="xl" borderWidth="1px" borderColor={borderColor} bg={panelBg} p={{ base: '5', md: '6' }}>
        <Heading size="md">Key Capabilities</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4" mt="4">
          <InfoCard label="Playback" value="Direct Play + On-demand HLS" />
          <InfoCard label="Subtitles" value="Embedded extract + default auto load" />
          <InfoCard label="Transcode" value="NVIDIA GPU preferred" />
          <InfoCard label="External Player" value="Drag current playback link" />
        </SimpleGrid>
      </Box>

      <Box rounded="xl" borderWidth="1px" borderColor={borderColor} bg={panelBg} p={{ base: '5', md: '6' }}>
        <Flex justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap="3" direction={{ base: 'column', md: 'row' }}>
          <Box>
            <Heading size="md">Project Source</Heading>
            <Text mt="2" opacity="0.8">
              当前页面仅保留自定义版本信息，详细维护与部署说明请查看仓库文档。
            </Text>
          </Box>
          <Link href="https://github.com/RTGTX7/BGmi" color={accent} fontWeight="semibold">
            Open GitHub Repository
          </Link>
        </Flex>
        <Divider my="5" />
        <Text fontSize="sm" opacity="0.72">
          Based on the BGmi ecosystem and adapted for private deployment, subtitle-aware playback, and custom Linux
          server workflows.
        </Text>
      </Box>
    </Stack>
  );
}
