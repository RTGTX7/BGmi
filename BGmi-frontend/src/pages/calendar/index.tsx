import { Box, Card, CardBody, Fade, Flex, HStack, Image, Link, TabPanel, Tag, Text } from '@chakra-ui/react';
import { useMemo, useState } from 'react';

import CalendarTab from '~/components/calendar-tab';
import { FallbackCalendar } from '~/components/fallback';
import { useCalendar } from '~/hooks/use-calendar';
import { useColorMode } from '~/hooks/use-color-mode';
import { resolveCoverSrc } from '~/lib/utils';

import type { CalendarDataEntries, CalendarDataKey, WeekCalendar } from '~/types/calendar';

function CalendarPanel({ bangumi }: { bangumi: WeekCalendar }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const titleColor = isDark ? 'whiteAlpha.940' : '#203447';
  const linkTagBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.86)';
  const linkTagBorder = isDark ? 'whiteAlpha.140' : 'rgba(252,165,165,0.52)';
  const linkColor = isDark ? 'pink.200' : 'pink.500';
  const statusColor = bangumi.status ? (isDark ? 'green.200' : 'green.700') : isDark ? 'whiteAlpha.860' : '#4b5d71';
  const statusBg = bangumi.status
    ? isDark
      ? 'rgba(34,197,94,0.16)'
      : 'rgba(220,252,231,0.96)'
    : isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(241,245,249,0.96)';
  const statusBorder = bangumi.status
    ? isDark
      ? 'rgba(74,222,128,0.24)'
      : 'rgba(134,239,172,0.92)'
    : isDark
    ? 'whiteAlpha.120'
    : 'rgba(203,213,225,0.96)';

  return (
    <Card
      maxW="full"
      overflow="hidden"
      bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.56)'}
      borderWidth="1px"
      borderColor={isDark ? 'whiteAlpha.120' : 'whiteAlpha.800'}
      backdropFilter="blur(20px) saturate(165%)"
      boxShadow={
        isDark
          ? '0 18px 38px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)'
          : '0 18px 38px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
      }
      position="relative"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '1px',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        background: isDark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 24%)'
          : 'linear-gradient(180deg, rgba(255,255,255,0.52), rgba(255,255,255,0.08) 24%)',
      }}
      _after={{
        content: '""',
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        height: '1px',
        pointerEvents: 'none',
        background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.94)',
      }}
    >
      <CardBody
        display="flex"
        flexDirection="row"
        alignItems="stretch"
        gap={{ base: '3.5', md: '4' }}
        p={{ base: '3.5', md: '5' }}
        position="relative"
        zIndex="1"
      >
        <Box
          position="relative"
          w={{ base: '5.6rem', md: '180px' }}
          minW={{ base: '5.6rem', md: '180px' }}
          maxW={{ base: '5.6rem', md: '180px' }}
          minH={{ base: '7.5rem', md: '250px' }}
          maxH={{ base: '7.5rem', md: '250px' }}
          bg={isDark ? 'gray.900' : 'gray.100'}
          rounded="xl"
          overflow="hidden"
          boxShadow={isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'inset 0 1px 0 rgba(255,255,255,0.48)'}
          _after={{
            content: '""',
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            background: isDark
              ? 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 34%)'
              : 'linear-gradient(135deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 34%)',
          }}
          _before={{
            content: '""',
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            borderRadius: 'inherit',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.46)',
            boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.02)' : 'inset 0 0 0 1px rgba(255,255,255,0.20)',
          }}
        >
          <Fade in={isLoaded}>
            <Image
              src={resolveCoverSrc(bangumi.cover)}
              width="100%"
              height="100%"
              objectFit="cover"
              alt="cover"
              placeholder="empty"
              onLoad={() => setIsLoaded(true)}
            />
          </Fade>
        </Box>

        <Flex direction="column" justify="space-between" minW="0" flex="1" py={{ base: '0.1rem', md: '0.35rem' }}>
          <Text
            mr="-2"
            fontWeight="700"
            fontSize={{ base: 'sm', md: 'md' }}
            lineHeight="1.4"
            color={titleColor}
            noOfLines={{ base: 2, md: 3 }}
            wordBreak="break-word"
          >
            {bangumi.name}
          </Text>

          <HStack mt={{ base: '2.5', md: '3' }} spacing={{ base: '1.5', md: '2' }} flexWrap="wrap" align="center">
            <Tag
              w="fit-content"
              px={{ base: '0.62rem', md: '0.75rem' }}
              py={{ base: '0.1rem', md: '0.15rem' }}
              fontSize={{ base: 'xs', md: 'sm' }}
              bg={linkTagBg}
              borderWidth="1px"
              borderColor={linkTagBorder}
              boxShadow={
                isDark
                  ? '0 8px 20px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : '0 8px 20px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.48)'
              }
              backdropFilter="blur(14px) saturate(160%)"
            >
              <Link
                color={linkColor}
                fontWeight="700"
                href={`https://bgm.tv/subject_search/${bangumi.name}`}
                target="_blank"
              >
                番组计划
              </Link>
            </Tag>
            <Tag
              w="fit-content"
              px={{ base: '0.62rem', md: '0.75rem' }}
              py={{ base: '0.1rem', md: '0.15rem' }}
              fontSize={{ base: 'xs', md: 'sm' }}
              color={statusColor}
              bg={statusBg}
              borderWidth="1px"
              borderColor={statusBorder}
              boxShadow={
                isDark
                  ? '0 8px 20px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 8px 20px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.46)'
              }
              backdropFilter="blur(14px) saturate(160%)"
            >
              {bangumi.status ? '已订阅' : '未订阅'}
            </Tag>
          </HStack>
        </Flex>
      </CardBody>
    </Card>
  );
}

export default function Calendar() {
  const { data } = useCalendar();

  const tabListItems = useMemo(() => Object.keys(data?.data ?? []) as CalendarDataKey[], [data]);
  const tabPanelsItems = useMemo(() => Object.entries(data?.data ?? []) as CalendarDataEntries, [data]);

  if (tabListItems.length === 0 || tabPanelsItems.length === 0) return <FallbackCalendar />;

  return (
    <CalendarTab tabListItems={tabListItems}>
      {tabPanelsItems.map(([week, bangumis]) => (
        <TabPanel
          display="grid"
          gridTemplateColumns={{
            base: '1fr',
            md: 'repeat(auto-fill, minmax(20rem, 1fr))',
            lg: 'repeat(auto-fill, minmax(22rem, 1fr))',
          }}
          justifyContent="center"
          px={{ base: 0, md: 0 }}
          gap={{ base: 3, md: 4, lg: 5 }}
          key={week}
        >
          {bangumis?.map(bangumi => <CalendarPanel key={bangumi.id} bangumi={bangumi} />)}
        </TabPanel>
      ))}
    </CalendarTab>
  );
}
