import { Box, Divider, Heading, Link, SimpleGrid, Stack, Tag, Text } from '@chakra-ui/react';

import { useBangumi } from '~/hooks/use-bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

const CUSTOM_VERSION = 'RTGTX7 定制版 1.0.0';

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Box rounded="xl" borderWidth="1px" p="4" bg="whiteAlpha.100">
      <Text fontSize="xs" opacity="0.68" letterSpacing="0.12em">
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
  const accent = colorMode === 'dark' ? 'orange.200' : 'orange.600';
  const panelBg = colorMode === 'dark' ? 'whiteAlpha.100' : 'blackAlpha.50';
  const borderColor = colorMode === 'dark' ? 'whiteAlpha.300' : 'blackAlpha.200';
  const heroGradient =
    colorMode === 'dark'
      ? 'linear(to-br, orange.400, yellow.300, red.300)'
      : 'linear(to-br, orange.100, yellow.100, red.100)';

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
        <Box position="absolute" inset="0" bgGradient={heroGradient} opacity="0.2" />
        <Stack spacing="5" p={{ base: '5', md: '8' }} position="relative">
          <Tag alignSelf="flex-start" size="lg" colorScheme="orange" variant="solid">
            私有维护版本
          </Tag>
          <Stack spacing="2">
            <Heading size="2xl">RTGTX7 BGmi</Heading>
            <Text fontSize="lg" color={accent} fontWeight="semibold">
              {CUSTOM_VERSION}
            </Text>
            <Text maxW="3xl" opacity="0.88">
              面向自用服务器和远程播放场景维护的 BGmi 定制版本，重点增强了字幕体验、按需 HLS、GPU
              转码和外部播放器联动。
            </Text>
          </Stack>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4">
        <InfoCard label="后端版本" value={data?.version ? `BGmi ${data.version}` : 'BGmi'} />
        <InfoCard label="前端版本" value={`UI ${import.meta.env.VITE_APP_VERSION}`} />
        <InfoCard label="定制版本" value={CUSTOM_VERSION} />
      </SimpleGrid>

      <Box rounded="xl" borderWidth="1px" borderColor={borderColor} bg={panelBg} p={{ base: '5', md: '6' }}>
        <Heading size="md">当前增强</Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4" mt="4">
          <InfoCard label="播放器" value="Direct Play 与按需 HLS" />
          <InfoCard label="字幕" value="内嵌提取与默认自动挂载" />
          <InfoCard label="转码" value="优先使用 NVIDIA GPU" />
          <InfoCard label="本地播放" value="支持拖拽当前播放链接" />
        </SimpleGrid>
      </Box>

      <Box rounded="xl" borderWidth="1px" borderColor={borderColor} bg={panelBg} p={{ base: '5', md: '6' }}>
        <Heading size="md">项目来源</Heading>
        <Text mt="3" opacity="0.82">
          当前版本基于 BGmi 生态继续维护，页面样式与功能已按自用场景调整，但原项目作者与历史贡献者信息仍然保留。
        </Text>
        <Stack spacing="2" mt="4">
          <Text>
            上游项目：
            <Link href="https://github.com/BGmi/BGmi" color={accent} ml="2">
              BGmi
            </Link>
          </Text>
          <Text>
            当前仓库：
            <Link href="https://github.com/RTGTX7/BGmi" color={accent} ml="2">
              RTGTX7/BGmi
            </Link>
          </Text>
        </Stack>
      </Box>

      <Box rounded="xl" borderWidth="1px" borderColor={borderColor} bg={panelBg} p={{ base: '5', md: '6' }}>
        <Heading size="md">致谢与贡献</Heading>
        <Divider my="4" />
        <Stack spacing="3">
          <Text>
            原作者：
            <Link href="https://github.com/RicterZ" color={accent} ml="2">
              RicterZ
            </Link>
          </Text>
          <Text>
            历史贡献者：
            <Link href="https://github.com/BGmi/BGmi/graphs/contributors" color={accent} ml="2">
              BGmi Contributors
            </Link>
          </Text>
          <Text>
            数据源支持：
            <Link href="https://bangumi.moe/" color={accent} ml="2" mr="3">
              萌番组
            </Link>
            <Link href="https://mikanani.me/" color={accent}>
              蜜柑计划
            </Link>
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}
