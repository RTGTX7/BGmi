import {
  Box,
  Button,
  Flex,
  IconButton,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useColorMode,
} from '@chakra-ui/react';
import type { DragEvent } from 'react';
import { useState } from 'react';
import { BsDownload, BsPlayBtnFill } from 'react-icons/bs';

export const players: { icon: string; name: string; scheme: (url: string) => string }[] = [
  { icon: 'iina', name: 'IINA', scheme: url => `iina://weblink?url=${url}` },
  { icon: 'potplayer', name: 'PotPlayer', scheme: url => `potplayer://${url}` },
  { icon: 'vlc', name: 'VLC', scheme: url => `vlc://${url}` },
  { icon: 'nplayer', name: 'nPlayer', scheme: url => `nplayer-${url}` },
  { icon: 'omniplayer', name: 'OmniPlayer', scheme: url => `omniplayer://weblink?url=${url}` },
  { icon: 'figplayer', name: 'Fig Player', scheme: url => `figplayer://weblink?url=${url}` },
  { icon: 'infuse', name: 'Infuse', scheme: url => `infuse://x-callback-url/play?url=${url}` },
  {
    icon: 'mxplayer',
    name: 'MX Player',
    scheme: url => `intent:${url}#Intent;package=com.mxtech.videoplayer.ad;end`,
  },
  {
    icon: 'mxplayer-pro',
    name: 'MX Player Pro',
    scheme: url => `intent:${url}#Intent;package=com.mxtech.videoplayer.pro;end`,
  },
];

interface Props {
  url: string;
  downloadUrl: string;
}

export default function ExternalPlayer({ url, downloadUrl }: Props) {
  const { colorMode } = useColorMode();
  const [isOpen, setOpen] = useState(false);

  const triggerBrowserDownload = (targetUrl: string) => {
    if (!targetUrl) return;

    const anchor = document.createElement('a');
    anchor.href = targetUrl;
    anchor.download = targetUrl.split('/').pop()?.split('?')[0] || 'video';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/uri-list', url);
    event.dataTransfer.setData('text/plain', url);
  };

  const toolButtonBg = colorMode === 'light' ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.06)';
  const toolButtonBorder = colorMode === 'light' ? 'rgba(255,255,255,0.72)' : 'whiteAlpha.300';
  const toolButtonShadow =
    colorMode === 'light'
      ? '0 8px 18px rgba(39,87,116,0.08), inset 0 1px 0 rgba(255,255,255,0.42)'
      : '0 8px 18px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.05)';

  return (
    <>
      <Box position="relative" w={{ base: 'full', xl: 'auto' }} overflow="visible">
        <Flex justify={{ base: 'flex-end', xl: 'flex-start' }} gap={{ base: '1.5', sm: '2' }}>
          {downloadUrl ? (
            <IconButton
              aria-label="下载原始视频"
              icon={<BsDownload />}
              onClick={() => triggerBrowserDownload(downloadUrl)}
              size="sm"
              minW={{ base: '1.9rem', sm: '2.55rem' }}
              h={{ base: '1.9rem', sm: '2.55rem' }}
              fontSize={{ base: '0.8rem', sm: '1rem' }}
              rounded="full"
              variant="outline"
              bg={toolButtonBg}
              borderColor={toolButtonBorder}
              boxShadow={toolButtonShadow}
              backdropFilter="blur(18px) saturate(170%)"
              color={colorMode === 'light' ? '#516274' : 'rgba(255,255,255,0.92)'}
              _hover={{
                transform: 'translateY(-1px)',
                bg: colorMode === 'light' ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.10)',
              }}
              _active={{ transform: 'translateY(0)' }}
            />
          ) : null}
          <IconButton
            aria-label="打开本地播放器面板"
            onClick={() => setOpen(true)}
            icon={<BsPlayBtnFill />}
            size="sm"
            minW={{ base: '1.9rem', sm: '2.55rem' }}
            h={{ base: '1.9rem', sm: '2.55rem' }}
            fontSize={{ base: '0.8rem', sm: '1rem' }}
            rounded="full"
            variant="outline"
            bg={toolButtonBg}
            borderColor={toolButtonBorder}
            boxShadow={toolButtonShadow}
            backdropFilter="blur(18px) saturate(170%)"
            color={colorMode === 'light' ? '#516274' : 'rgba(255,255,255,0.92)'}
            _hover={{
              transform: 'translateY(-1px)',
              bg: colorMode === 'light' ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.10)',
            }}
            _active={{ transform: 'translateY(0)' }}
          />
        </Flex>
      </Box>

      <Modal isOpen={isOpen} onClose={() => setOpen(false)} isCentered>
        <ModalOverlay
          bg={colorMode === 'light' ? 'rgba(12,18,28,0.34)' : 'rgba(5,10,18,0.54)'}
          backdropFilter="blur(10px) saturate(130%)"
        />
        <ModalContent
          maxW={{ base: 'calc(100vw - 1.25rem)', md: '38rem' }}
          rounded="2xl"
          bg={colorMode === 'light' ? 'rgba(226,239,246,0.60)' : 'rgba(17,23,35,0.72)'}
          borderWidth="1px"
          borderColor={colorMode === 'light' ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.12)'}
          boxShadow={
            colorMode === 'light'
              ? '0 30px 80px rgba(25,55,84,0.18), 0 10px 30px rgba(94,188,214,0.08), inset 0 1px 0 rgba(255,255,255,0.56)'
              : '0 28px 70px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.07)'
          }
          backdropFilter="blur(28px) saturate(180%)"
          overflow="hidden"
        >
          <ModalHeader pb="2">本地播放器</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb="5">
            <Text fontSize="sm" opacity="0.76" mb="4">
              复制链接、拖拽链接，或者直接调用本地播放器。
            </Text>

            <Flex gap="2.5" flexWrap="wrap" mb="4">
              <Button
                onClick={() => window.open(downloadUrl || url, '_blank', 'noopener,noreferrer')}
                size="sm"
                rounded="full"
                bg={colorMode === 'light' ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.10)'}
                borderWidth="1px"
                borderColor={colorMode === 'light' ? 'rgba(255,255,255,0.82)' : 'whiteAlpha.180'}
              >
                打开直链
              </Button>
              <Button
                onClick={() => navigator.clipboard.writeText(url)}
                size="sm"
                rounded="full"
                bg={colorMode === 'light' ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.10)'}
                borderWidth="1px"
                borderColor={colorMode === 'light' ? 'rgba(255,255,255,0.82)' : 'whiteAlpha.180'}
              >
                复制播放器链接
              </Button>
            </Flex>

            <Flex gap="2" flexWrap="wrap" mb="4">
              {players.map(player => (
                <Button
                  key={player.name}
                  as="a"
                  href={player.scheme(url)}
                  rel="noreferrer"
                  size="sm"
                  fontSize="sm"
                  rounded="full"
                  bg={colorMode === 'light' ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.08)'}
                  borderWidth="1px"
                  borderColor={colorMode === 'light' ? 'rgba(255,255,255,0.78)' : 'whiteAlpha.160'}
                  boxShadow={
                    colorMode === 'light'
                      ? '0 8px 18px rgba(39,87,116,0.06), inset 0 1px 0 rgba(255,255,255,0.42)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.05)'
                  }
                >
                  {player.name}
                </Button>
              ))}
            </Flex>

            <Flex
              p="3.5"
              direction="column"
              rounded="xl"
              bg={colorMode === 'light' ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.06)'}
              borderWidth="1px"
              borderColor={colorMode === 'light' ? 'rgba(255,255,255,0.66)' : 'rgba(255,255,255,0.10)'}
              backdropFilter="blur(16px) saturate(160%)"
              cursor="grab"
              draggable
              onDragStart={handleDragStart}
              userSelect="none"
            >
              <Text fontSize="sm" fontWeight="bold" mb="2">
                拖动此链接到播放器
              </Text>
              <Link href={url} isExternal wordBreak="break-all" fontSize="sm">
                {url}
              </Link>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
