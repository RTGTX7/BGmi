import { Box, Heading, Link, SimpleGrid, Stack, Tag, Text, Wrap, WrapItem } from '@chakra-ui/react';
import type { ReactNode } from 'react';

import { useBangumi } from '~/hooks/use-bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

const CUSTOM_VERSION = 'RTGTX7 定制版 1.1.6';

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

          <Text fontSize="lg">一个面向自建服务器、远程播放、本地媒体库与浏览器播放场景持续维护的 BGmi 分支。</Text>
          <Text color={isDark ? 'gray.300' : 'gray.600'}>
            HTTP Service 仍基于官方 BGmi 构建，额外补充了播放器、本地资源扫描、字幕处理、HLS 转码与 Dashboard 运维能力。
          </Text>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 3 }} spacing="4">
        <Box {...sectionProps} p="4">
          <Text fontSize="xs" color={isDark ? 'whiteAlpha.700' : 'gray.500'} letterSpacing="0.12em">
            后端版本
          </Text>
          <Text mt="2" fontSize="lg" fontWeight="bold" color={isDark ? 'gray.50' : 'gray.800'}>
            {data?.version ? `BGmi ${data.version}` : 'BGmi'}
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
              • 数据源与索引
            </Text>
            <Wrap display="inline-flex" spacing="2">
              <WrapItem>
                <FeatureTag colorScheme="cyan">Mikan</FeatureTag>
              </WrapItem>
              <WrapItem>
                <FeatureTag colorScheme="green">Bangumi Moe</FeatureTag>
              </WrapItem>
            </Wrap>
          </Box>

          <Box>
            <Text as="span" mr="2">
              • 下载委托
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
              • 播放能力
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
                <FeatureTag colorScheme="pink">DPlayer</FeatureTag>
              </WrapItem>
            </Wrap>
          </Box>

          <Text>• Dashboard 支持提交下载任务、刷新元数据、检查异常数据与重建本地仓库番剧。</Text>
          <Text>• 新增本地仓库扫描、空目录保护、海报缓存、缺集标记与播放源缺失检测。</Text>
          <Text>• 支持通过命令行和 Dashboard 查询数据库、按 id 管理记录、执行批量重建。</Text>
          <Text>• Archive / Subscribe / Player 增加了更完整的搜索、异常提示与运维状态展示。</Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            网站
          </Heading>
          <Text>
            蜜柑计划
            <Link href="https://mikan.tangbai.cc/" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              https://mikan.tangbai.cc/
            </Link>
          </Text>
          <Text>
            萌番组
            <Link href="https://bangumi.moe/" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              https://bangumi.moe/
            </Link>
          </Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            项目
          </Heading>
          <Text color={isDark ? 'gray.300' : 'gray.600'}>
            当前分支基于官方 BGmi 持续维护，主要补充自建媒体库和 Web 播放场景所需的能力。
          </Text>
          <Text>
            官方项目
            <Link href="https://github.com/BGmi/BGmi" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              BGmi
            </Link>
          </Text>
          <Text>
            定制仓库
            <Link href="https://github.com/RTGTX7/BGmi" color={isDark ? 'orange.300' : 'orange.500'} ml="2">
              RTGTX7/BGmi
            </Link>
          </Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            技术
          </Heading>
          <Text>• React</Text>
          <Text>• Chakra UI</Text>
          <Text>
            •{' '}
            <Link href="https://aria2.github.io/" color={isDark ? 'orange.300' : 'orange.500'}>
              Aria2
            </Link>
          </Text>
          <Text>
            •{' '}
            <Link href="https://dplayer.diygod.dev/" color={isDark ? 'orange.300' : 'orange.500'}>
              DPlayer
            </Link>
          </Text>
        </Stack>
      </Box>

      <Box {...sectionProps} p={{ base: '5', md: '6' }}>
        <Stack spacing="3" position="relative" zIndex="1">
          <Heading size="lg" color={isDark ? 'orange.50' : 'gray.800'}>
            致谢
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
