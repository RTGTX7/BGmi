import {
  Box,
  Button,
  Flex,
  Image,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Wrap,
  WrapItem,
  Tag,
  Text,
  useBreakpointValue,
  useDisclosure,
} from '@chakra-ui/react';
import type { TouchEvent } from 'react';
import { useRef, useState } from 'react';
import useSWR from 'swr';

import { glassBlurValue, glassSaturationValue, useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
import { fetcherWithTimeout } from '~/lib/fetcher';
import { findMikanSubtitleLink, type MikanSubtitleGroupResponse } from '~/lib/mikan-subtitle';
import { resolveCoverSrc } from '~/lib/utils';

import SubscribeForm from './subscribe-form';

import type { WeekCalendar } from '~/types/calendar';
import type { InitialData } from './subscribe-form';

interface Props {
  bangumi: WeekCalendar;
}

export interface SyncData {
  status: boolean;
  episode: number | undefined;
}

export default function SubscribeCard({ bangumi }: Props) {
  const { colorMode } = useColorMode();
  const { theme: accentTheme, colors, glassStyle } = useAccentTheme();
  const isDark = colorMode === 'dark';
  const detailGlassBackground = isDark
    ? `linear-gradient(135deg, rgba(255,255,255,0.12), rgba(15,23,42,0.28) 42%, rgba(15,23,42,0.38)), linear-gradient(145deg, ${colors.accent}18, transparent 66%)`
    : `linear-gradient(135deg, rgba(255,255,255,0.62), rgba(255,255,255,0.24) 42%, rgba(255,255,255,0.34)), linear-gradient(145deg, ${colors.accent}18, transparent 66%)`;
  const primaryText = isDark ? '#10212F' : '#FFFFFF';
  const [imageLoaded, setImageLoaded] = useState(false);
  const { isOpen, onClose, onOpen } = useDisclosure();
  const {
    isOpen: isPreviewOpen,
    onClose: onPreviewClose,
    onOpen: onPreviewOpen,
  } = useDisclosure();
  const [initialData, setInitialData] = useState<InitialData>();
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const previewTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  const { handleFetchFilter } = useSubscribeAction();
  const [syncData, setSyncData] = useState<SyncData>({
    status: !!bangumi.status,
    episode: bangumi.episode,
  });
  const followedSubtitleGroups = initialData?.follwedSubtitleGroups ?? [];
  const bangumiPlanUrl = `https://bgm.tv/subject_search/${encodeURIComponent(bangumi.name)}`;
  const { data: mikanGroups } = useSWR<MikanSubtitleGroupResponse>(
    isPreviewOpen && bangumi.name ? `/api/mikan/subtitle-groups?bangumi=${encodeURIComponent(bangumi.name)}` : null,
    (key: string) => fetcherWithTimeout([key], {}, 60000),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const availableSubtitleGroups = (bangumi.subtitle_group ?? [])
    .map((item, index) => {
      const raw = item as typeof item & { title?: string; group?: string };
      const name = String(raw?.name || raw?.title || raw?.group || '').trim();
      return { id: String(raw?.id || `available-${index}`), name };
    })
    .filter(item => item.name);
  const mikanAvailableGroups = (mikanGroups?.data.groups ?? [])
    .filter(group => group && typeof group.name === 'string' && group.name.trim())
    .map(group => ({ id: String(group.id || group.name), name: group.name.trim() }));
  const displayAvailableGroups = availableSubtitleGroups.length ? availableSubtitleGroups : mikanAvailableGroups;
  const normalizeGroupName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const subscribedKeys = new Set(followedSubtitleGroups.map(normalizeGroupName));
  const subscribedOnlyGroups = followedSubtitleGroups.filter(name => !displayAvailableGroups.some(item => normalizeGroupName(item.name) === normalizeGroupName(name)));

  const loadFilterData = async (name: string, ep: number) => {
    const data = await handleFetchFilter(name);

    setInitialData({
      bangumiName: name,
      completedEpisodes: syncData.episode ?? ep,
      filterOptions: {
        include: data?.data.include ?? '',
        exclude: data?.data.exclude ?? '',
        regex: data?.data.regex ?? '',
      },
      subtitleGroups: data?.data.subtitle_group ?? [],
      follwedSubtitleGroups: data?.data.followed ?? [],
    });

    return data;
  };

  const handleOpen = async (name: string, ep: number) => {
    onOpen();
    try {
      await loadFilterData(name, ep);
    } catch {
      // The action hook already displays the request failure.
      onClose();
    }
  };

  const handleCardClick = () => {
    void handleOpen(bangumi.name, bangumi.episode ?? 0);
  };

  const handlePreviewTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    previewTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handlePreviewTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = previewTouchStartRef.current;
    previewTouchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) < 72 || Math.abs(deltaY) <= Math.abs(deltaX) * 1.2 || deltaY < 0) return;

    onPreviewClose();
  };

  return (
    <>
      <Box
        role="group"
        w="full"
        minW="0"
        cursor="pointer"
        onClick={handleCardClick}
        position="relative"
        rounded="24px"
        overflow="hidden"
        borderWidth="1px"
        borderColor={isDark ? `${colors.text}22` : `${colors.text}24`}
        bg={`${colors.surface}${isDark ? '66' : '9C'}`}
        boxShadow={isDark ? `0 18px 42px rgba(0,0,0,0.24), inset 0 1px 0 ${colors.text}12` : `0 18px 42px rgba(15,23,42,0.12), inset 0 1px 0 ${colors.text}20`}
        transition="transform 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease"
        _hover={{
          transform: 'translateY(-3px) scale(1.008)',
          boxShadow: isDark ? `0 24px 54px rgba(0,0,0,0.30), inset 0 1px 0 ${colors.text}18` : `0 24px 54px rgba(15,23,42,0.16), inset 0 1px 0 ${colors.text}28`,
        }}
      >
        <Box position="relative" aspectRatio={3 / 4} w="full" overflow="hidden" bg={isDark ? 'gray.900' : 'gray.100'}>
          <Image
            h="full"
            w="full"
            src={resolveCoverSrc(bangumi.cover)}
            loading="lazy"
            decoding="async"
            alt={bangumi.name}
            objectFit="cover"
            opacity={imageLoaded ? 1 : 0}
            onLoad={() => setImageLoaded(true)}
            transition="opacity 180ms ease, transform 260ms ease"
            _groupHover={{ transform: 'scale(1.025)' }}
          />

          <Box
            position="absolute"
            inset="0"
            pointerEvents="none"
            bg="linear-gradient(to bottom, rgba(0,0,0,0.02) 34%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.56) 100%)"
          />

          <Box
            position="absolute"
            inset="0"
            pointerEvents="none"
            bg={
              isDark
                ? 'radial-gradient(circle at 22% 86%, rgba(83,240,193,0.12), transparent 26%), radial-gradient(circle at 78% 20%, rgba(123,181,255,0.12), transparent 26%)'
                : 'radial-gradient(circle at 20% 84%, rgba(83,240,193,0.16), transparent 28%), radial-gradient(circle at 82% 20%, rgba(123,181,255,0.16), transparent 28%)'
            }
          />

          <Box
            position="absolute"
            left={{ base: '2', md: '3.5' }}
            right={{ base: '2', md: '3.5' }}
            bottom={{ base: '2', md: '3.5' }}
            zIndex="2"
            rounded="22px"
            borderWidth="1px"
            borderColor={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.18)'}
            bg={isDark ? 'rgba(19,24,36,0.30)' : 'rgba(16,22,34,0.46)'}
            backdropFilter="blur(2px) saturate(165%)"
            boxShadow={
              isDark
                ? '0 16px 34px rgba(3,8,20,0.24), inset 0 1px 0 rgba(255,255,255,0.10)'
                : '0 16px 34px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.16)'
            }
            px={{ base: '2.5', md: '3.5' }}
            py={{ base: '1.35', md: '2.15' }}
            minH={{ base: '3.9rem', md: '5rem' }}
            h={{ base: '3.9rem', md: '5rem' }}
            overflow="hidden"
            cursor="pointer"
            onClick={event => {
              event.stopPropagation();
              void handleOpen(bangumi.name, bangumi.episode ?? 0);
            }}
            transition="transform 240ms cubic-bezier(0.22, 1, 0.36, 1), height 240ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 240ms ease, filter 240ms ease"
            _groupHover={{
              transform: 'translateY(-2px)',
              h: { base: '3.9rem', md: '6.3rem' },
              filter: 'saturate(1.03)',
              boxShadow: isDark
                ? '0 20px 38px rgba(3,8,20,0.28), inset 0 1px 0 rgba(255,255,255,0.12)'
                : '0 20px 38px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.24)',
            }}
            _before={{
              content: '""',
              position: 'absolute',
              inset: '1px',
              borderRadius: 'inherit',
              pointerEvents: 'none',
              border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(255,255,255,0.12)',
              background: isDark
                ? 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.028) 30%, rgba(255,255,255,0.008) 62%, rgba(255,255,255,0) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.02) 62%, rgba(255,255,255,0) 100%)',
            }}
            _after={{
              content: '""',
              position: 'absolute',
              inset: '0',
              borderRadius: 'inherit',
              pointerEvents: 'none',
              background: isDark
                ? 'radial-gradient(circle at 18% -8%, rgba(255,255,255,0.14), transparent 28%), radial-gradient(circle at 84% 18%, rgba(120,194,255,0.06), transparent 28%)'
                : 'radial-gradient(circle at 18% -8%, rgba(255,255,255,0.28), transparent 28%), radial-gradient(circle at 84% 18%, rgba(120,194,255,0.06), transparent 28%)',
              opacity: isDark ? 0.4 : 0.56,
            }}
          >
            <Flex align="center" gap={{ base: '2', md: '3.5' }} position="relative" zIndex="1" h="full">
              <Flex align="center" minW="0" flex="1" h="full">
                <Text
                  w="full"
                  color="rgba(248,250,252,0.98)"
                  fontSize={{ base: 'sm', md: 'lg' }}
                  fontWeight="700"
                  lineHeight="1.1"
                  textShadow="0 3px 14px rgba(0,0,0,0.64)"
                  sx={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: '2',
                    overflow: 'hidden',
                    '@media (min-width: 48em)': {
                      '[role="group"]:hover &': {
                        WebkitLineClamp: 'unset',
                      },
                    },
                  }}
                >
                  {bangumi.name}
                </Text>
              </Flex>

            </Flex>
          </Box>
        </Box>
      </Box>

      <SubscribeForm
        initialData={initialData}
        isOpen={isOpen}
        onClose={onClose}
        setSyncData={(data: SyncData) => setSyncData(data)}
        syncData={syncData}
      />

      <Modal isOpen={isMobile && isPreviewOpen} onClose={onPreviewClose} autoFocus={false} isCentered motionPreset="slideInBottom">
        <ModalOverlay bg="rgba(2,6,23,0.72)" backdropFilter="blur(10px)" />
        <ModalContent
          data-bgmi-glass-panel
          mx="4"
          rounded="28px"
          overflow="hidden"
          position="relative"
          bg={`${colors.surface}${isDark ? 'A6' : 'B8'}`}
          borderWidth="1px"
          borderColor={`${colors.text}${isDark ? '28' : '22'}`}
          boxShadow={isDark ? `0 28px 64px rgba(0,0,0,0.42), inset 0 1px 0 ${colors.text}18` : `0 28px 64px rgba(15,23,42,0.22), inset 0 1px 0 ${colors.text}24`}
          backdropFilter={`blur(${glassBlurValue(glassStyle)}) saturate(${glassSaturationValue(glassStyle)})`}
          sx={{ WebkitBackdropFilter: `blur(${glassBlurValue(glassStyle)}) saturate(${glassSaturationValue(glassStyle)})`,
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: isDark
                ? `linear-gradient(135deg, rgba(255,255,255,0.13), transparent 32%, rgba(255,255,255,0.025) 72%), linear-gradient(145deg, ${colors.accent}09, transparent 58%)`
                : `linear-gradient(135deg, rgba(255,255,255,0.72), transparent 34%, rgba(255,255,255,0.18) 74%), linear-gradient(145deg, ${colors.accent}08, transparent 58%)`,
            },
          }}
        >
          <ModalCloseButton
            top="3"
            right="3"
            rounded="full"
            bg={isDark ? 'rgba(15,23,42,0.56)' : 'rgba(255,255,255,0.66)'}
            borderWidth="1px"
            borderColor={isDark ? 'whiteAlpha.180' : 'rgba(255,255,255,0.82)'}
          />
          <ModalBody p="0" onTouchStart={handlePreviewTouchStart} onTouchEnd={handlePreviewTouchEnd}>
            <Box px="5" pt="3" pb="2" display="flex" justifyContent="center">
              <Box w="2.75rem" h="0.3rem" rounded="full" bg={isDark ? 'whiteAlpha.300' : 'blackAlpha.200'} />
            </Box>

            <Box px={{ base: '5', md: '6' }} pb={{ base: '5', md: '6' }}>
              <Flex justify="center">
                <Box
                  w="full"
                  maxW="18rem"
                  rounded="24px"
                  overflow="hidden"
                  bg={isDark ? 'rgba(2,6,23,0.56)' : 'rgba(255,255,255,0.72)'}
                  borderWidth="1px"
                  borderColor={isDark ? 'whiteAlpha.120' : 'rgba(255,255,255,0.74)'}
                  boxShadow={isDark ? '0 22px 44px rgba(0,0,0,0.28)' : '0 20px 40px rgba(15,23,42,0.12)'}
                >
                  <Box aspectRatio={3 / 4} display="flex" alignItems="center" justifyContent="center" bg="black">
                    <Image
                      src={resolveCoverSrc(bangumi.cover)}
                      alt={bangumi.name}
                      w="full"
                      h="full"
                      objectFit="contain"
                    />
                  </Box>
                </Box>
              </Flex>

              <Box
                mt="4"
                rounded="24px"
                borderWidth="1px"
                borderColor={`${colors.accent}${isDark ? '55' : '42'}`}
                bg="transparent"
                boxShadow={
                  isDark
                    ? '0 18px 36px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.06)'
                    : '0 18px 36px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.52)'
                }
                backdropFilter={`blur(${glassBlurValue(glassStyle)}) saturate(${glassSaturationValue(glassStyle)})`}
                sx={{
                  background: detailGlassBackground,
                  WebkitBackdropFilter: `blur(${glassBlurValue(glassStyle)}) saturate(${glassSaturationValue(glassStyle)})`,
                }}
                px="4"
                py="4"
              >
                <Text color={isDark ? 'whiteAlpha.960' : '#203447'} fontSize="lg" fontWeight="700" lineHeight="1.28">
                  {bangumi.name}
                </Text>

                <Flex mt="3" gap="2" flexWrap="wrap">
                  <Tag rounded="full" bg={`${colors.surface}${isDark ? '28' : '52'}`} borderWidth="1px" borderColor={`${colors.text}${isDark ? '20' : '16'}`}>
                    {bangumi.episode ? `最新：第 ${bangumi.episode} 集` : '暂无剧集信息'}
                  </Tag>
                  <Tag rounded="full" bg={`${colors.surface}${isDark ? '28' : '52'}`} borderWidth="1px" borderColor={`${colors.text}${isDark ? '20' : '16'}`}>
                    更新：{bangumi.update_time || '未知'}
                  </Tag>
                </Flex>

                {displayAvailableGroups.length || followedSubtitleGroups.length ? (
                  <Box mt="3">
                    {displayAvailableGroups.length ? (
                      <Box>
                        <Text mb="2" color={isDark ? 'whiteAlpha.760' : '#526274'} fontSize="sm" lineHeight="1.6">
                          可用字幕组
                        </Text>
                        <Wrap spacing="2">
                          {displayAvailableGroups.map(item => {
                            const isSubscribed = subscribedKeys.has(normalizeGroupName(item.name));
                            const url = findMikanSubtitleLink(mikanGroups?.data.groups, item.name, item.id);
                            return (
                              <WrapItem key={`available-${item.id}-${item.name}`}>
                                <Link href={url} target={url ? '_blank' : undefined} rel={url ? 'noopener noreferrer' : undefined} display="block">
                            <Tag
                              rounded="lg"
                              px="3"
                              py="1.5"
                              fontSize="xs"
                              whiteSpace="normal"
                              overflowWrap="anywhere"
                              color={isDark ? 'whiteAlpha.900' : '#64748B'}
                              bg={isSubscribed
                                ? (isDark ? 'rgba(96,165,250,0.26)' : 'rgba(219,234,254,0.90)')
                                : `${colors.accent}${isDark ? '18' : '12'}`}
                              borderWidth="1px"
                              borderColor={isSubscribed
                                ? (isDark ? 'rgba(147,197,253,0.62)' : 'rgba(96,165,250,0.62)')
                                : `${colors.accent}${isDark ? '55' : '42'}`}
                              boxShadow={isSubscribed ? '0 5px 16px rgba(37,99,235,0.16), inset 0 1px 0 rgba(255,255,255,0.28)' : 'inset 0 1px 0 rgba(255,255,255,0.18)'}
                              backdropFilter="blur(12px) saturate(165%)"
                              _hover={url ? { borderColor: isDark ? 'whiteAlpha.300' : 'rgba(148,163,184,0.72)' } : undefined}
                            >
                              {item.name}
                            </Tag>
                                </Link>
                              </WrapItem>
                            );
                          })}
                        </Wrap>
                      </Box>
                    ) : null}
                    {subscribedOnlyGroups.length ? (
                      <Box mt={displayAvailableGroups.length ? '3' : '0'}>
                        <Text mb="2" color={isDark ? 'whiteAlpha.760' : '#526274'} fontSize="sm" lineHeight="1.6">
                          已订阅字幕组
                        </Text>
                        <Wrap spacing="2">
                          {subscribedOnlyGroups.map(name => {
                            const matched = displayAvailableGroups.find(item => item.name === name);
                            const url = findMikanSubtitleLink(mikanGroups?.data.groups, name, matched?.id);
                            return (
                              <WrapItem key={`followed-${name}`}>
                                <Link href={url} target={url ? '_blank' : undefined} rel={url ? 'noopener noreferrer' : undefined} display="block">
                                  <Tag
                                    rounded="lg"
                                    px="3"
                                    py="1.5"
                                    fontSize="xs"
                                    whiteSpace="normal"
                                    overflowWrap="anywhere"
                                    color={isDark ? 'whiteAlpha.860' : '#64748B'}
                                    bg={isDark ? 'whiteAlpha.140' : 'rgba(226,232,240,0.82)'}
                                    borderWidth="1px"
                                    borderColor={isDark ? 'whiteAlpha.220' : 'rgba(148,163,184,0.52)'}
                                    backdropFilter="blur(12px) saturate(165%)"
                                    _hover={url ? { borderColor: isDark ? 'whiteAlpha.360' : 'rgba(100,116,139,0.78)' } : undefined}
                                  >
                                    {name}
                                  </Tag>
                                </Link>
                              </WrapItem>
                            );
                          })}
                        </Wrap>
                      </Box>
                    ) : null}
                  </Box>
                ) : null}

                <Flex mt="4" justify="flex-end" gap="2" flexWrap="wrap">
                  <Button
                    as="a"
                    href={bangumiPlanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    h="2.5rem"
                    minW="5.75rem"
                    px="4"
                    fontSize="sm"
                    fontWeight="700"
                    color="#be185d"
                    bg="rgba(251,207,232,0.92)"
                    borderWidth="1px"
                    borderColor="rgba(236,72,153,0.48)"
                    boxShadow={
                      isDark
                        ? '0 10px 22px rgba(190,24,93,0.16), inset 0 1px 0 rgba(255,255,255,0.06)'
                        : '0 10px 22px rgba(236,72,153,0.12), inset 0 1px 0 rgba(255,255,255,0.42)'
                    }
                    _hover={{ bg: 'rgba(249,168,212,0.96)', borderColor: '#ec4899' }}
                  >
                    番剧计划
                  </Button>
                </Flex>
              </Box>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
