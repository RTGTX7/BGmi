import {
  Box,
  Divider,
  Heading,
  Link,
  SimpleGrid,
  Stack,
  Tag,
  Text,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';

import { useBangumi } from '~/hooks/use-bangumi';
import { useColorMode } from '~/hooks/use-color-mode';

const CUSTOM_VERSION = 'RTGTX7 定制版 1.0.0';

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box rounded="xl" borderWidth="1px" borderColor="whiteAlpha.160" bg="whiteAlpha.060" p="4">
      <Text fontSize="xs" color="whiteAlpha.700" letterSpacing="0.12em">
        {label}
      </Text>
      <Text mt="2" fontSize="lg" fontWeight="bold" color="gray.50">
        {value}
      </Text>
    </Box>
  );
}

function FeatureTag({
  children,
  colorScheme,
}: {
  children: ReactNode;
  colorScheme: 'cyan' | 'green' | 'orange' | 'pink' | 'yellow' | 'purple';
}) {
  return (
    <Tag
      size="md"
      colorScheme={colorScheme}
      variant="subtle"
      borderRadius="md"
      px="2.5"
      py="1"
      fontSize="md"
      fontWeight="medium"
    >
      {children}
    </Tag>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Box rounded="2xl" borderWidth="1px" borderColor="whiteAlpha.160" bg="whiteAlpha.060" p={{ base: '5', md: '6' }}>
      <Heading size="lg" color="gray.50">
        {title}
      </Heading>
      <Box mt="4">{children}</Box>
    </Box>
  );
}

export default function About() {
  const { data } = useBangumi();
  const { colorMode } = useColorMode();
  const pageBg = colorMode === 'dark' ? '#1b2230' : '#1f2736';
  const titleColor = colorMode === 'dark' ? 'orange.50' : 'orange.100';
  const linkColor = colorMode === 'dark' ? 'orange.300' : 'orange.200';
  const textColor = colorMode === 'dark' ? 'gray.100' : 'gray.50';
  const subTextColor = colorMode === 'dark' ? 'gray.300' : 'gray.200';

  return (
    <Stack spacing="6" color={textColor}>
      <Box rounded="2xl" borderWidth="1px" borderColor="whiteAlpha.200" bg={pageBg} p={{ base: '6', md: '8' }}>
        <Stack spacing="4">
          <Box>
            <Heading size="2xl" color={titleColor}>
              BGmi {data?.version ?? '4.5.1'}
            </Heading>
            <Text mt="3" fontSize="xl" fontWeight="semibold" color="orange.100">
              {CUSTOM_VERSION}
            </Text>
          </Box>

          <Text fontSize="lg" color={textColor}>
            一个面向自用服务器、远程播放和本地播放器联动场景维护的 BGmi 分支。
          </Text>
          <Text color={subTextColor}>HTTP Service 仍基于官方 BGmi 构建，但播放器、字幕与 HLS 体验已按你的使用场景重新整理。</Text>
        </Stack>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="4">
        <StatCard label="后端版本" value={data?.version ? `BGmi ${data.version}` : 'BGmi'} />
        <StatCard label="前端版本" value={`BGmi Frontend ${import.meta.env.VITE_APP_VERSION}`} />
        <StatCard label="定制版本" value={CUSTOM_VERSION} />
      </SimpleGrid>

      <Section title="有什么特性？">
        <Stack spacing="4" color={textColor}>
          <Box>
            <Text as="span" mr="2">
              • 多个数据源可选
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
              • 使用下载器管理订阅任务
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
              • 播放器支持
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

          <Text>• 支持内嵌字幕提取、默认字幕自动挂载，以及多字幕切换显示。</Text>
          <Text>• 支持按需 HLS、NVIDIA GPU 优先转码、转码进度显示与 48 小时缓存回收。</Text>
          <Text>• 支持拖拽当前播放链接到本地播放器窗口，不限于某一个播放器。</Text>
        </Stack>
      </Section>

      <Section title="项目来源">
        <Stack spacing="3" color={subTextColor}>
          <Text>当前版本基于官方 BGmi 持续维护，保留原项目骨架与历史贡献信息，同时对播放器、字幕和远程播放链路做了定制增强。</Text>
          <Text>
            上游项目：
            <Link href="https://github.com/BGmi/BGmi" color={linkColor} ml="2">
              BGmi
            </Link>
          </Text>
          <Text>
            当前仓库：
            <Link href="https://github.com/RTGTX7/BGmi" color={linkColor} ml="2">
              RTGTX7/BGmi
            </Link>
          </Text>
        </Stack>
      </Section>

      <Section title="致谢">
        <Stack spacing="3" color={textColor}>
          <Text>
            • 萌番组
          </Text>
          <Text>
            • 蜜柑计划
          </Text>
          <Text>
            •{' '}
            <Link href="https://aria2.github.io/" color={linkColor}>
              Aria2
            </Link>
          </Text>
          <Text>
            •{' '}
            <Link href="https://dplayer.diygod.dev/" color={linkColor}>
              DPlayer
            </Link>
          </Text>
        </Stack>
      </Section>

      <Section title="贡献保留">
        <Stack spacing="3" color={textColor}>
          <Text>
            BGmi Creator -
            <Link href="https://github.com/RicterZ" color={linkColor} ml="2">
              RicterZ
            </Link>
          </Text>
          <Text>
            BGmi Contributors -
            <Link href="https://github.com/BGmi/BGmi/graphs/contributors" color={linkColor} ml="2">
              Contributors
            </Link>
          </Text>
        </Stack>
        <Divider my="4" borderColor="whiteAlpha.160" />
        <Text color={subTextColor}>这部分会继续保留，不会因为做成你自己的维护版就把原来的贡献信息抹掉。</Text>
      </Section>
    </Stack>
  );
}
