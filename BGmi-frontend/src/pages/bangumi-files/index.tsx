import {
  Box,
  Flex,
  IconButton,
  Image,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { Helmet } from 'react-helmet-async';
import { useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import BangumiGroupSection from '~/components/bangumi/group-section';
import { bangumiFilterAtom, useBangumi } from '~/hooks/use-bangumi';
import { useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';
import { buildSeasonGroups, toBangumiWithSeason } from '~/lib/bangumi';
import { normalizePath, resolveCoverSrc } from '~/lib/utils';

export default function BangumiFiles() {
  const { data, kind } = useBangumi();
  const bangumiShow = useAtomValue(bangumiFilterAtom);
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
  const { colors, theme } = useAccentTheme();
  const isDark = colorMode === 'dark';
  const searchModal = useDisclosure();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [keyword, setKeyword] = useState('');

  const bangumiData = useMemo(() => {
    if (!data) return undefined;
    if (bangumiShow === 'new') return kind?.new;
    if (bangumiShow === 'old') return kind?.old;
    return data;
  }, [bangumiShow, data, kind?.new, kind?.old]);

  const groupedData = useMemo(() => {
    if (!bangumiData?.data?.length) return undefined;
    return buildSeasonGroups(bangumiData.data);
  }, [bangumiData]);

  const searchResults = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword || !bangumiData?.data?.length) return [];

    return toBangumiWithSeason(bangumiData.data)
      .map(item => {
        const haystacks = [
          item.bangumi_name,
          item.name,
          item.keyword,
          item.seasonMeta?.label,
          item.seasonMeta?.longLabel,
          item.year ? String(item.year) : '',
          item.quarter ? String(item.quarter) : '',
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const titleMatch = item.bangumi_name.toLowerCase().includes(normalizedKeyword);
        const nameMatch = (item.name || '').toLowerCase().includes(normalizedKeyword);
        const keywordMatch = (item.keyword || '').toLowerCase().includes(normalizedKeyword);
        const score = (titleMatch ? 100 : 0) + (nameMatch ? 60 : 0) + (keywordMatch ? 40 : 0) + (haystacks.includes(normalizedKeyword) ? 10 : 0);

        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (b.item.updated_time ?? 0) - (a.item.updated_time ?? 0) || (b.item.year ?? 0) - (a.item.year ?? 0))
      .slice(0, 40);
  }, [bangumiData, keyword]);

  if (!bangumiData || !groupedData) return null;

  const { seasonGroups, unknownItems } = groupedData;

  return (
    <Stack spacing={{ base: '4', md: '6' }} w="100%" maxW="none" position="relative">
      <Helmet>
        <title>BGmi - Archive</title>
      </Helmet>

      <Flex
        align="center"
        justify="space-between"
        px="0.5"
        pt="0.5"
      >
        <Stack spacing="0.5">
          <Text fontSize="lg" fontWeight="700" color={colors.text}>
            Archive
          </Text>
          <Text fontSize="xs" color={colors.text} opacity={0.7}>
            Search past bangumi
          </Text>
        </Stack>

      </Flex>

      {seasonGroups.map(group => (
        <BangumiGroupSection
          key={group.seasonKey}
          title={group.title}
          href={`/bangumi-group/${group.seasonKey}`}
          bangumis={group.items}
          seasonKey={group.seasonKey}
        />
      ))}

      {unknownItems.length > 0 ? (
        <BangumiGroupSection
          title="其他番剧"
          subtitle="未匹配到季度来源的条目"
          href="/bangumi-group/unknown"
          bangumis={unknownItems}
        />
      ) : null}

      <IconButton
        aria-label="Search archive"
        icon={<FiSearch />}
        onClick={searchModal.onOpen}
        position="fixed"
        right={{ base: '1rem', md: '1.5rem' }}
        bottom={{ base: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)', lg: '1.5rem' }}
        zIndex={20}
        rounded="full"
        size="lg"
        bg={`${colors.surface}D9`}
        borderWidth="1px"
        borderColor={theme.border}
        color={colors.accent}
        boxShadow={isDark ? '0 16px 36px rgba(0,0,0,0.24)' : `0 16px 36px ${colors.accent}29`}
        backdropFilter="blur(18px) saturate(170%)"
        _hover={{ transform: 'scale(1.04)', bg: theme.soft, borderColor: colors.accent }}
        _active={{ transform: 'scale(0.98)' }}
      />

      <Modal isOpen={searchModal.isOpen} onClose={searchModal.onClose} initialFocusRef={searchInputRef} size="3xl" isCentered>
        <ModalOverlay bg={isDark ? `${colors.background}B8` : `${colors.text}57`} backdropFilter="blur(10px)" />
        <ModalContent
          rounded="3xl"
          bg={`${colors.surface}${isDark ? 'EB' : 'F5'}`}
          borderWidth="1px"
          borderColor={theme.border}
          color={colors.text}
          boxShadow={isDark ? '0 28px 70px rgba(0,0,0,0.44)' : `0 28px 70px ${colors.accent}29`}
          backdropFilter="blur(28px) saturate(180%)"
          overflow="hidden"
        >
          <ModalHeader color={colors.text}>Search archive</ModalHeader>
          <ModalCloseButton color={colors.text} _hover={{ bg: theme.soft }} />
          <ModalBody pb="5">
            <Stack spacing="4">
              <Input
                ref={searchInputRef}
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                placeholder="Search title / season / year / Mikan ID"
                rounded="2xl"
                h="3rem"
                bg={`${colors.background}${isDark ? 'A8' : 'BF'}`}
                color={colors.text}
                borderColor={theme.border}
                _placeholder={{ color: colors.text, opacity: 0.55 }}
                _hover={{ borderColor: colors.accent }}
                _focusVisible={{ borderColor: colors.accent, boxShadow: `0 0 0 2px ${theme.border}` }}
              />

              {!keyword.trim() ? (
                <Text color={colors.text} opacity={0.7} fontSize="sm">
                  Search by title, original title, season, year, or Mikan keyword.
                </Text>
              ) : null}

              <Stack spacing="3" maxH="65vh" overflowY="auto" pr="1">
                {keyword.trim() && searchResults.length === 0 ? (
                  <Box rounded="2xl" px="4" py="5" bg={theme.soft}>
                    <Text color={colors.text}>没有找到相关番剧</Text>
                  </Box>
                ) : null}

                {searchResults.map(({ item }) => (
                  <Flex
                    key={`${item.id}-${item.bangumi_name}`}
                    gap="4"
                    rounded="2xl"
                    px="4"
                    py="3"
                    bg={`${colors.background}${isDark ? '70' : 'A8'}`}
                    borderWidth="1px"
                    borderColor={theme.border}
                    align="center"
                    cursor="pointer"
                    _hover={{ transform: 'translateY(-1px)', borderColor: colors.accent, bg: theme.soft }}
                    onClick={() => {
                      searchModal.onClose();
                      navigate(`/player/${normalizePath(item.bangumi_name)}`);
                    }}
                  >
                    <Image src={resolveCoverSrc(item.cover)} alt={item.bangumi_name} w="4rem" h="5.4rem" rounded="xl" objectFit="cover" flexShrink={0} />
                    <Stack spacing="1" minW="0" flex="1">
                      <Text fontWeight="700" color={colors.text} noOfLines={2}>
                        {item.bangumi_name}
                      </Text>
                      <Text fontSize="sm" color={colors.text} opacity={0.72} noOfLines={1}>
                        {item.seasonMeta?.label ?? 'Unknown season'} · 最新集数 {item.episode ?? 0}
                      </Text>
                      {item.keyword ? (
                        <Text fontSize="xs" color={colors.text} opacity={0.62} noOfLines={1}>
                          Mikan ID: {item.keyword}
                        </Text>
                      ) : null}
                    </Stack>
                  </Flex>
                ))}
              </Stack>
            </Stack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Stack>
  );
}
