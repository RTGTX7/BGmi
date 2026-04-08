import {
  Box,
  Button,
  Flex,
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

export default function ExternalPlayer({ url }: { url: string }) {
  const { colorMode } = useColorMode();
  const [isOpen, setOpen] = useState(false);

  const handleDragStart = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/uri-list', url);
    event.dataTransfer.setData('text/plain', url);
  };

  return (
    <Box bg={colorMode === 'light' ? 'blackAlpha.100' : 'whiteAlpha.100'} p="4" mt="4" h="50%">
      <Text mb="4">使用本地播放器</Text>
      <Flex gap={2} flexWrap="wrap">
        <Button onClick={() => setOpen(true)} size="sm">
          复制播放器链接
        </Button>
        {players.map(player => (
          <Button key={player.name} as="a" href={player.scheme(url)} rel="noreferrer" size="sm" fontSize="xs">
            {player.name}
          </Button>
        ))}
      </Flex>
      <Modal isOpen={isOpen} onClose={() => setOpen(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader pb={1}>复制链接</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={4}>
            <Text mb="3" fontSize="sm" opacity="0.8">
              拖动下面这个链接卡片到 mpv 窗口即可播放。
            </Text>
            <Box
              p="3"
              rounded="md"
              bg={colorMode === 'light' ? 'blackAlpha.100' : 'whiteAlpha.200'}
              borderWidth="1px"
              borderColor={colorMode === 'light' ? 'blackAlpha.200' : 'whiteAlpha.300'}
              cursor="grab"
              draggable
              onDragStart={handleDragStart}
              userSelect="none"
            >
              <Text fontSize="sm" fontWeight="bold" mb="2">
                拖动此链接到 mpv
              </Text>
              <Link href={url} isExternal wordBreak="break-all" fontSize="sm">
                {url}
              </Link>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
