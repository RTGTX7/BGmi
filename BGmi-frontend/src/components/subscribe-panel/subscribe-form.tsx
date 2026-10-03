import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { FiArrowLeft, FiCheck, FiPlus, FiRotateCcw, FiSave } from 'react-icons/fi';
import useSWR from 'swr';

import { useAccentTheme } from '~/hooks/use-accent-theme';
import { windowGlassBlurValue, windowOverlayValue } from '~/hooks/use-accent-theme';
import WindowGlassRefraction from '~/components/layout/window-glass-refraction';
import { useColorMode } from '~/hooks/use-color-mode';
import { useSubscribeAction } from '~/hooks/use-subscribe-action';
import { fetcherWithTimeout } from '~/lib/fetcher';
import { findMikanSubtitleLink, type MikanSubtitleGroupResponse } from '~/lib/mikan-subtitle';

import type { SyncData } from './subscribe-card';

export interface InitialData {
  bangumiName: string;
  completedEpisodes: number;
  filterOptions: {
    include: string;
    exclude: string;
    regex: string;
  };
  subtitleGroups: string[];
  follwedSubtitleGroups: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: InitialData | undefined;
  setSyncData: (data: SyncData) => void;
  syncData: SyncData;
}

export default function SubscribeForm({ isOpen, onClose, initialData, setSyncData, syncData }: Props) {
  const { colorMode } = useColorMode();
  const { theme: accentTheme, colors, glassStyle, backgroundBrightness } = useAccentTheme();
  const [formData, setFormData] = useState<InitialData>();
  const [subtitleSearch, setSubtitleSearch] = useState('');
  const [subtitleMutating, setSubtitleMutating] = useState<string>();
  const { handleSaveFilter, handleSaveMark, handleTriggerDownload, handleSubscribe } = useSubscribeAction();

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const { data: mikanGroups } = useSWR<MikanSubtitleGroupResponse>(
    isOpen && formData?.bangumiName ? `/api/mikan/subtitle-groups?bangumi=${encodeURIComponent(formData.bangumiName)}` : null,
    (key: string) => fetcherWithTimeout([key], {}, 60000),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const glassFieldBg = `${colors.surface}${colorMode === 'dark' ? '66' : '80'}`;
  const glassFieldBorder = `${colors.text}38`;
  const primaryText = colorMode === 'dark' ? colors.background : '#FFFFFF';
  const planPink = colorMode === 'dark' ? '#FB8FA7' : '#BE4967';
  const bangumiPlanUrl = formData ? `https://bgm.tv/subject_search/${encodeURIComponent(formData.bangumiName)}` : '';

  const handleSave = async () => {
    if (!formData) return;

    await handleSaveFilter.trigger({
      name: formData.bangumiName,
      include: formData.filterOptions.include,
      exclude: formData.filterOptions.exclude,
      regex: formData.filterOptions.regex,
      subtitle: formData.follwedSubtitleGroups.join(','),
    });

    await handleSaveMark.trigger({
      name: formData.bangumiName,
      episode: formData.completedEpisodes,
    });

    await handleTriggerDownload.trigger({
      name: formData.bangumiName,
      download: true,
    });

    setSyncData({ ...syncData, episode: formData.completedEpisodes });
    onClose();
  };

  const handleSubtitleToggle = async (name: string, selected: boolean) => {
    if (!formData || subtitleMutating) return;

    if (selected) {
      setFormData({ ...formData, follwedSubtitleGroups: formData.follwedSubtitleGroups.filter(item => item !== name) });
      return;
    }

    setSubtitleMutating(name);
    try {
      if (!syncData.status) {
        await handleSubscribe(formData.bangumiName, 0);
        setSyncData({ ...syncData, status: true });
      }
      setFormData({ ...formData, follwedSubtitleGroups: [...formData.follwedSubtitleGroups, name] });
    } catch {
      return;
    } finally {
      setSubtitleMutating(undefined);
    }
  };

  const handleResetCompleted = async () => {
    if (!formData) return;

    await handleSaveMark.trigger({
      name: formData.bangumiName,
      episode: 0,
    });

    setFormData({
      ...formData,
      completedEpisodes: 0,
    });
    setSyncData({ ...syncData, episode: 0 });
  };

  return (
    <Modal onClose={onClose} isOpen={isOpen} closeOnOverlayClick isCentered scrollBehavior="inside">
      <ModalOverlay
        data-bgmi-window-backdrop="subscribe"
        bg={windowOverlayValue(colorMode === 'dark' ? 'dark' : 'light', backgroundBrightness[colorMode === 'dark' ? 'dark' : 'light'])}
        backdropFilter="none"
      />
      <ModalContent
        data-bgmi-glass-panel
        data-bgmi-dim-target="subscribe"
        zIndex={1402}
        maxW={{ base: 'calc(100vw - 1rem)', sm: 'sm', md: 'xl' }}
        maxH="calc(100dvh - 24px)"
        my="3"
        mx="3"
        rounded="24px"
        overflow="hidden"
        color={colors.text}
        borderColor={colorMode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.88)'}
        boxShadow="none"
        sx={{ '--bgmi-window-background': 'transparent', '--bgmi-window-shadow': 'none', backdropFilter: `blur(${windowGlassBlurValue(glassStyle)})`, WebkitBackdropFilter: `blur(${windowGlassBlurValue(glassStyle)})` }}
      >
        <WindowGlassRefraction />
        <ModalHeader pb="2">下载设置</ModalHeader>
        <ModalBody pb="2">
          {!formData ? (
            <Box textAlign="center" my="8">
              <Spinner />
            </Box>
          ) : (
            <Stack spacing="5">
              <Text fontSize="sm" opacity={colorMode === 'dark' ? 0.9 : 1}>
                调整过滤规则、已完成剧集和字幕组偏好。手动下载可立刻触发一次抓取。
              </Text>

              <Flex gap="3" align="stretch" w="full" display="none">
                <Button
                  flex="1"
                  rounded="lg"
                  bg={accentTheme.soft}
                  borderWidth="1px"
                  borderColor={accentTheme.border}
                  color={accentTheme.primary}
                  _hover={{ bg: `${colors.accent}28`, borderColor: colors.accent }}
                  onClick={() => void handleResetCompleted()}
                  isLoading={handleSaveMark.isMutating}
                >
                  完成剧集清零
                </Button>
                <Button
                  flex="1"
                  rounded="lg"
                  bg={accentTheme.primary}
                  color={primaryText}
                  boxShadow={`0 5px 14px ${colors.accent}38`}
                  _hover={{ filter: 'brightness(0.92)' }}
                  onClick={() => undefined}
                  isLoading={false}
                >
                  提交下载
                </Button>
              </Flex>

              <SimpleGrid columns={{ base: 1, md: 2 }} spacing="4">
                <FormControl id="include">
                  <FormLabel>包含字段</FormLabel>
                  <Input
                    value={formData.filterOptions.include}
                    onChange={event =>
                      setFormData({
                        ...formData,
                        filterOptions: { ...formData.filterOptions, include: event.target.value },
                      })
                    }
                    type="text"
                    bg={glassFieldBg}
                    borderColor={glassFieldBorder}
                  />
                </FormControl>
                <FormControl id="exclude">
                  <FormLabel>排除字段</FormLabel>
                  <Input
                    value={formData.filterOptions.exclude}
                    onChange={event =>
                      setFormData({
                        ...formData,
                        filterOptions: { ...formData.filterOptions, exclude: event.target.value },
                      })
                    }
                    type="text"
                    bg={glassFieldBg}
                    borderColor={glassFieldBorder}
                  />
                </FormControl>
              </SimpleGrid>

              <FormControl id="regex">
                <FormLabel>正则表达式</FormLabel>
                <Input
                  value={formData.filterOptions.regex}
                  onChange={event =>
                    setFormData({
                      ...formData,
                      filterOptions: { ...formData.filterOptions, regex: event.target.value },
                    })
                  }
                  type="text"
                  bg={glassFieldBg}
                  borderColor={glassFieldBorder}
                />
              </FormControl>

              <FormControl id="completedEpisodes">
                <FormLabel>已完成下载的剧集</FormLabel>
                <InputGroup>
                  <Input
                    value={String(formData.completedEpisodes)}
                    onChange={event => setFormData({ ...formData, completedEpisodes: Number(event.target.value || 0) })}
                    type="number"
                    bg={glassFieldBg}
                    borderColor={glassFieldBorder}
                    pr="12"
                  />
                  <InputRightElement>
                    <IconButton aria-label="还原已完成剧集" title="还原" icon={<FiRotateCcw />} size="sm" variant="ghost" color={colors.text} isLoading={handleSaveMark.isMutating} onClick={() => void handleResetCompleted()} />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              <FormControl id="subtitleGroups" color={colors.text} sx={{ '& > label': { display: 'none' } }}>
                <Flex align="center" gap="3" mb="2" flexWrap="wrap" sx={{ '& > a': { display: 'none' } }}>
                  <FormLabel mb="0">字幕组订阅（可多选）</FormLabel>
                  <Button alignSelf="flex-start" as="a" href={bangumiPlanUrl} target="_blank" rel="noopener noreferrer" size="sm" h="30px" px="3" rounded="full" bg={colorMode === 'dark' ? 'rgba(251,143,167,0.18)' : 'rgba(251,207,232,0.72)'} borderWidth="1px" borderColor={colorMode === 'dark' ? 'rgba(251,143,167,0.48)' : 'rgba(236,72,153,0.38)'} color={planPink} fontSize="xs" fontWeight="600">番剧计划</Button>
                </Flex>
                <InputGroup mb="3" size="sm" display="none">
                  <Input value={subtitleSearch} onChange={event => setSubtitleSearch(event.target.value)} placeholder="搜索字幕组…" bg={glassFieldBg} borderColor={glassFieldBorder} pl="10" />
                  <InputRightElement pointerEvents="none" />
                </InputGroup>
                <FormLabel>字幕组订阅（可多选）</FormLabel>
                <Flex wrap="wrap" gap="2" display="inline-flex" verticalAlign="middle">
                  {formData.subtitleGroups.length ? formData.subtitleGroups.map(name => {
                    const selected = formData.follwedSubtitleGroups.includes(name);
                    const url = findMikanSubtitleLink(mikanGroups?.data.groups, name);
                    return (
                      <Flex key={name} align="center" gap="1" maxW="full" minW="0" px="2" py="1" rounded="md" borderWidth="1px" borderColor={selected ? accentTheme.primary : glassFieldBorder} bg={selected ? `${colors.accent}${colorMode === 'dark' ? '32' : '20'}` : glassFieldBg}>
                        <Link href={url} target={url ? '_blank' : undefined} rel={url ? 'noopener noreferrer' : undefined} minW="0" fontSize="xs" lineHeight="1.3" overflowWrap="anywhere" color={selected ? colors.accent : colors.text} textDecoration="none">
                          {name}
                        </Link>
                        <IconButton
                          aria-label={selected ? `取消订阅 ${name}` : `订阅 ${name}`}
                          title={selected ? '已订阅，点击取消' : '点击订阅'}
                          icon={selected ? <FiCheck /> : <FiPlus />}
                          size="xs"
                          minW="1.25rem"
                          h="1.25rem"
                          order={-1}
                          rounded="md"
                          flexShrink={0}
                          variant="ghost"
                          bg="transparent"
                          color={selected ? accentTheme.primary : `${colors.text}99`}
                          borderWidth="0"
                          _hover={{ bg: colorMode === 'dark' ? 'whiteAlpha.120' : 'blackAlpha.050' }}
                          isLoading={subtitleMutating === name}
                          onClick={() => void handleSubtitleToggle(name, selected)}
                        />
                      </Flex>
                    );
                  }) : <Text fontSize="sm" opacity={0.7}>暂无已识别字幕组</Text>}
                </Flex>
              </FormControl>
            </Stack>
          )}
        </ModalBody>

        <ModalFooter pt="4">
          <Flex w="full" align="center" justify="space-between">
            <IconButton aria-label="返回" title="返回" icon={<FiArrowLeft size="24" />} size="lg" onClick={onClose} variant="ghost" color={colors.text} _hover={{ bg: `${colors.text}12` }} />
            <IconButton
              aria-label="保存"
              title="保存"
              icon={<FiSave size="24" />}
              onClick={() => void handleSave()}
              isLoading={handleSaveFilter.isMutating || handleSaveMark.isMutating || handleTriggerDownload.isMutating}
              size="lg"
              rounded="none"
              color={colors.accent}
              bg="transparent"
              borderWidth="0"
              boxShadow="none"
              textShadow={`0 0 12px ${colors.accent}AA`}
              _hover={{ bg: 'transparent', filter: 'brightness(1.18)', transform: 'translateY(-1px)', textShadow: `0 0 18px ${colors.accent}` }}
              _active={{ transform: 'translateY(0)', filter: 'brightness(0.96)' }}
              transition="all 160ms ease"
            />
          </Flex>
          <Flex w="full" align="center" gap="3" display="none" gridTemplateColumns="1fr auto 1fr">
            <Button justifySelf="start" minW="4.5rem" onClick={onClose} variant="outline" borderColor={`${colors.accent}66`} color={colors.accent}>
              返回
            </Button>
            <Button
              as="a"
              href={bangumiPlanUrl}
              target="_blank"
              rel="noopener noreferrer"
              rounded="full"
              bg={colorMode === 'dark' ? 'rgba(251,143,167,0.22)' : 'rgba(251,207,232,0.92)'}
              borderWidth="1px"
              borderColor={colorMode === 'dark' ? 'rgba(251,143,167,0.58)' : 'rgba(236,72,153,0.48)'}
              color={colorMode === 'dark' ? '#FBCFE8' : '#BE185D'}
              _hover={{ bg: colorMode === 'dark' ? 'rgba(251,143,167,0.18)' : 'rgba(190,73,103,0.14)' }}
            >
              番剧计划
            </Button>
            <Button
                justifySelf="end"
                minW="4.5rem"
                bg={colors.accent}
                color={primaryText}
                _hover={{ filter: 'brightness(0.92)' }}
                onClick={() => void handleSave()}
                isLoading={handleSaveFilter.isMutating || handleSaveMark.isMutating || handleTriggerDownload.isMutating}
              >
                保存
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
