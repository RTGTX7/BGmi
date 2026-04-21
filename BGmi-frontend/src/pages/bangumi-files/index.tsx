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
import { useColorMode } from '~/hooks/use-color-mode';
import { buildSeasonGroups, toBangumiWithSeason } from '~/lib/bangumi';
import { normalizePath, resolveCoverSrc } from '~/lib/utils';

export default function BangumiFiles() {
  const { data, kind } = useBangumi();
  const bangumiShow = useAtomValue(bangumiFilterAtom);
  const navigate = useNavigate();
  const { colorMode } = useColorMode();
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
        display={{ base: 'flex', md: 'none' }}
        align="center"
        justify="space-between"
        px="0.5"
        pt="0.5"
      >
        <Stack spacing="0.5">
          <Text fontSize="lg" fontWeight="700" color={isDark ? 'whiteAlpha.940' : '#24384d'}>
            Archive
          </Text>
          <Text fontSize="xs" color={isDark ? 'whiteAlpha.700' : 'rgba(64,84,100,0.78)'}>
            Search past bangumi
          </Text>
        </Stack>

        <IconButton
          aria-label="Search archive"
          icon={<FiSearch />}
          onClick={searchModal.onOpen}
          rounded="full"
          size="md"
          bg={isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.82)'}
          borderWidth="1px"
          borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.92)'}
          color={isDark ? 'whiteAlpha.900' : '#304254'}
          boxShadow={isDark ? '0 12px 28px rgba(0,0,0,0.22)' : '0 12px 28px rgba(39,87,116,0.12)'}
          backdropFilter="blur(18px) saturate(170%)"
          _hover={{ transform: 'scale(1.03)' }}
          _active={{ transform: 'scale(0.98)' }}
        />
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
        display={{ base: 'none', md: 'inline-flex' }}
        right={{ base: '1rem', md: '1.5rem' }}
        bottom={{ base: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)', md: '1.5rem' }}
        zIndex={20}
        rounded="full"
        size="lg"
        bg={isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.78)'}
        borderWidth="1px"
        borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)'}
        color={isDark ? 'whiteAlpha.900' : '#304254'}
        boxShadow={isDark ? '0 16px 36px rgba(0,0,0,0.24)' : '0 16px 36px rgba(39,87,116,0.16)'}
        backdropFilter="blur(18px) saturate(170%)"
        _hover={{ transform: 'scale(1.04)', boxShadow: isDark ? '0 18px 40px rgba(251,146,60,0.24)' : '0 18px 40px rgba(251,146,60,0.18)' }}
        _active={{ transform: 'scale(0.98)' }}
      />

      <Modal isOpen={searchModal.isOpen} onClose={searchModal.onClose} initialFocusRef={searchInputRef} size="3xl" isCentered>
        <ModalOverlay bg={isDark ? 'rgba(5,10,18,0.54)' : 'rgba(12,18,28,0.34)'} backdropFilter="blur(10px)" />
        <ModalContent
          rounded="3xl"
          bg={isDark ? 'rgba(17,23,35,0.84)' : 'rgba(245,251,253,0.92)'}
          borderWidth="1px"
          borderColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.78)'}
          boxShadow={isDark ? '0 28px 70px rgba(0,0,0,0.44)' : '0 28px 70px rgba(39,87,116,0.16)'}
          backdropFilter="blur(28px) saturate(180%)"
          overflow="hidden"
        >
          <ModalHeader>Search archive</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="5">
            <Stack spacing="4">
              <Input
                ref={searchInputRef}
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
                placeholder="Search title / season / year / Mikan ID"
                rounded="2xl"
                h="3rem"
                bg={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)'}
                borderColor={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(132,169,235,0.22)'}
              />

              {!keyword.trim() ? (
                <Text color={isDark ? 'whiteAlpha.700' : 'rgba(64,84,100,0.78)'} fontSize="sm">
                  Search by title, original title, season, year, or Mikan keyword.
                </Text>
              ) : null}

              <Stack spacing="3" maxH="65vh" overflowY="auto" pr="1">
                {keyword.trim() && searchResults.length === 0 ? (
                  <Box rounded="2xl" px="4" py="5" bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.62)'}>
                    <Text color={isDark ? 'whiteAlpha.800' : '#304254'}>没有找到相关番剧</Text>
                  </Box>
                ) : null}

                {searchResults.map(({ item }) => (
                  <Flex
                    key={`${item.id}-${item.bangumi_name}`}
                    gap="4"
                    rounded="2xl"
                    px="4"
                    py="3"
                    bg={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.62)'}
                    borderWidth="1px"
                    borderColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(132,169,235,0.18)'}
                    align="center"
                    cursor="pointer"
                    _hover={{ transform: 'translateY(-1px)', borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(132,169,235,0.28)' }}
                    onClick={() => {
                      searchModal.onClose();
                      navigate(`/player/${normalizePath(item.bangumi_name)}`);
                    }}
                  >
                    <Image src={resolveCoverSrc(item.cover)} alt={item.bangumi_name} w="4rem" h="5.4rem" rounded="xl" objectFit="cover" flexShrink={0} />
                    <Stack spacing="1" minW="0" flex="1">
                      <Text fontWeight="700" color={isDark ? 'whiteAlpha.920' : '#24384d'} noOfLines={2}>
                        {item.bangumi_name}
                      </Text>
                      <Text fontSize="sm" color={isDark ? 'whiteAlpha.700' : 'rgba(64,84,100,0.78)'} noOfLines={1}>
                        {item.seasonMeta?.label ?? 'Unknown season'} · 最新集数 {item.episode ?? 0}
                      </Text>
                      {item.keyword ? (
                        <Text fontSize="xs" color={isDark ? 'whiteAlpha.600' : 'rgba(64,84,100,0.64)'} noOfLines={1}>
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
