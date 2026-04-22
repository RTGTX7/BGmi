import { Box, Heading, Link, SimpleGrid, Stack, Tag, Text, Wrap, WrapItem } from '@chakra-ui/react';
import type { ReactNode } from 'react';

import { useBangumi } from '~/hooks/use-bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

const CUSTOM_VERSION = '定制版 1.1.6';

function FeatureTag({
  children,
  colorScheme,
}: {
  children: ReactNode;
  colorScheme: 'cyan' | 'green' | 'orange' | 'pink' | 'yellow' | 'purple';
}) {
  return (
    <Tag size="md" colorScheme={colorScheme} variant="subtle" px="2.5" py="1" fontSize="md" fontWeight="medium">
      {children}
    </Tag>
  );
}

export default function About() {
  const { data } = useBangumi();
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  const sectionProps = {
    rounded: '2xl',
    borderWidth: '1px',
    borderColor: isDark ? 'whiteAlpha.140' : 'whiteAlpha.900',
    bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.62)',
    backdropFilter: 'blur(22px) saturate(170%)',
    boxShadow: isDark
      ? '0 18px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 18px 40px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.56)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    _before: {
      content: '""',
      position: 'absolute',
      inset: '1px',
      borderRadius: 'inherit',
      pointerEvents: 'none',
      background: isDark
        ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 24%, rgba(255,255,255,0) 54%)'
        : 'linear-gradient(180deg, rgba(255,255,255,0.62), rgba(255,255,255,0.10) 24%, rgba(255,255,255,0.02) 54%)',
    },
  };

  return (
    <Stack spacing="6" color={isDark ? 'gray.100' : 'gray.700'}>
      <Box {...sectionProps} p={{ base: '6', md: '8' }}>
        <Stack spacing="4" position="relative" zIndex="1">
          <Box>
            <Heading size="2xl" color={isDark ? 'orange.50' : 'gray.800'}>
              BGmi {data?.version ?? '4.5.1'}
            </Heading>
            <Text mt="3" fontSize="xl" fontWeight="semibold" color={isDark ? 'orange.100' : 'orange.500'}>
              {CUSTOM_VERSION}
            </Text>
          </Box>

          <Text fontSize="lg">一个面向自用服务器、远程播放和本地播放器联动场景维护的 BGmi 分支。</Text>
          <Text color={isDark ? 'gray.300' : 'gray.600'}>
            HTTP Service 与后端核心仍基于官方 BGmi 构建。
          </Text>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing="4">
        <Box {...sectionProps} p="4">
          <Text fontSize="xs" color={isDark ? 'whiteAlpha.700' : 'gray.500'} letterSpacing="0.12em">
            后端版本
          </Text>
          <Text mt="2" fontSize="lg" fontWeight="bold" color={isDark ? 'gray.50' : 'gray.800'}>
            {data?.version ? `BGmi ${data.version}` : 'BGmi 4.5.1'}
          </Text>
        </Box>
        <Box {...sectionProps} p="4">
          <Text fontSize="xs" color={isDark ? 'whiteAlpha.700' : 'gray.500'} letterSpacing="0.12em">
            前端版本
          </Text>
          <Text mt="2" fontSize="lg" fontWeight="bold" color={isDark ? 'gray.50' : 'gray.800'}>
            {`BGmi Frontend ${import.meta.env.VITE_APP_VERSION}`}
          </Text>
        </Box>
        <Box {...sectionProps} p="4">
          <Text fontSize="xs" color={isDark ? 'whiteAlpha.700' : 'gray.500'} letterSpacing="0.12em">
            定制版本
          </Text>
          <Text mt="2" fontSize="lg" fontWeight="bold" color={isDark ? 'gray.50' : 'gray.800'}>
            {CUSTOM_VERSION}
          </Text>
        </Box>
      </SimpleGrid>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="4" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            有什么特性？
          </Heading>

          <Box>
            <Text as="span" mr="2">
              多个数据源可选
            </Text>
            <Wrap display="inline-flex" spacing="2">
              <WrapItem>
                <FeatureTag colorScheme="cyan">Bangumi_Moe</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="green">Mikan_Project</FeatureTag>
              </WrapItem>
            </Wrap>
          </Box>

          <Box>
            <Text as="span" mr="2">
              使用下载器管理订阅任务
            </Text>
            <Wrap display="inline-flex" spacing="2">
              <WrapItem>
                <FeatureTag colorScheme="orange">Aria2</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="pink">Transmission</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="purple">qBittorrent</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="yellow">Deluge</FeatureTag>
              </WrapItem>
            </Wrap>
          </Box>

          <Box>
            <Text as="span" mr="2">
              播放器支持
            </Text>
            <Wrap display="inline-flex" spacing="2">
              <WrapItem>
                <FeatureTag colorScheme="yellow">Direct Play</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="cyan">1080p HLS</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="green">1080p 5M</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="orange">720p 3M</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="pink">ArtPlayer</FeatureTag>
              </WrapItem>
            </Wrap>
          </Box>

          <Text>支持内嵌字幕提取、默认字幕自动挂载，以及多字幕切换显示。</Text>
          <Text>支持按需 HLS、NVIDIA GPU 优先转码、转码进度显示与 48 小时缓存回收。</Text>
          <Text>支持拖拽当前播放链接到本地播放器窗口，不限于某一个播放器。</Text>
          <Text>支持 Archive 往期番剧浏览、季度归档、历史番剧搜索与海报展示。</Text>
          <Text>支持 Dashboard 提交下载任务、刷新海报元数据、检查异常数据与重建本地仓库番剧。</Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            项目来源
          </Heading>
          <Text color={isDark ? 'gray.300' : 'gray.600'}>
            当前版本基于官方 BGmi 持续维护，保留原项目骨架与历史贡献信息，同时对播放器、字幕和远程播放链路做了定制增强。
          </Text>
          <Text>
            上游项目：
            <Link href="https://github.com/BGmi/BGmi" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              BGmi
            </Link>
          </Text>
          <Text>
            当前仓库：
            <Link href="https://github.com/RTGTX7/BGmi" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              RTGTX7/BGmi
            </Link>
          </Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            致谢
          </Heading>
          <Text>• <Link href="https://mikan.tangbai.cc/" color={isDark ? 'orange.300' : 'orange.500'}>蜜柑计划</Link></Text>
          <Text>• <Link href="https://bangumi.moe/" color={isDark ? 'orange.300' : 'orange.500'}>萌番组</Link></Text>
          <Text>• <Link href="https://aria2.github.io/" color={isDark ? 'orange.300' : 'orange.500'}>Aria2</Link></Text>
          <Text>• <Link href="https://artplayer.org/" color={isDark ? 'orange.300' : 'orange.500'}>ArtPlayer</Link></Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            贡献保留
          </Heading>
          <Text>
            BGmi Creator -
            <Link href="https://github.com/RicterZ" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              RicterZ
            </Link>
          </Text>
          <Text>
            BGmi Contributors -
            <Link href="https://github.com/BGmi/BGmi/graphs/contributors" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              Contributors
            </Link>
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}







