import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Input,
  InputGroup,
  InputLeftAddon,
  Spinner,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { deleteCookie, setCookie } from 'cookies-next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '~/hooks/use-auth';
import { glassBlurValue, glassSaturationValue, glassSurfaceAlpha, useAccentTheme } from '~/hooks/use-accent-theme';
import { useColorMode } from '~/hooks/use-color-mode';

export default function Auth({ children, to }: { children: React.ReactElement; to: string }) {
  const [authToken, setAuthToken] = useState('');
  const [checkingCookie, setCheckingCookie] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const toast = useToast();
  const { tryAuth, hasAuth, cookieToken } = useAuth();
  const { colors, glassStyle } = useAccentTheme();
  const { colorMode } = useColorMode();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const validateCookie = async () => {
      if (!hasAuth || !cookieToken) {
        if (mounted) {
          setIsAuthorized(false);
          setCheckingCookie(false);
        }
        return;
      }

      try {
        const { timeoutId, response } = await tryAuth(cookieToken);
        clearTimeout(timeoutId);

        if (!response.ok) {
          deleteCookie('authToken');
          if (mounted) {
            setIsAuthorized(false);
            setCheckingCookie(false);
            toast({
              title: '登录状态已失效，请重新验证 Token',
              status: 'warning',
              duration: 2500,
              position: 'top-right',
            });
          }
          return;
        }

        if (mounted) {
          setIsAuthorized(true);
          setCheckingCookie(false);
        }
      } catch {
        deleteCookie('authToken');
        if (mounted) {
          setIsAuthorized(false);
          setCheckingCookie(false);
        }
      }
    };

    void validateCookie();

    return () => {
      mounted = false;
    };
  }, [cookieToken, hasAuth, toast, tryAuth]);

  if (checkingCookie) {
    return (
      <Stack align="center" justify="center" mt="24" spacing="4">
        <Spinner />
        <Heading size="sm">正在校验登录状态</Heading>
      </Stack>
    );
  }

  if (isAuthorized) return children;

  const handleAuth = async (seconds: number) => {
    if (authToken === '') {
      toast({
        title: '请输入 Token',
        status: 'warning',
        duration: 2000,
        position: 'top-right',
      });
      return;
    }

    try {
      const { timeoutId, response } = await tryAuth(authToken);
      clearTimeout(timeoutId);
      if (!response.ok) throw await response.json();
      toast({
        title: '验证成功',
        status: 'success',
        duration: 2000,
        position: 'top-right',
      });

      setCookie('authToken', authToken, {
        path: '/',
        sameSite: 'lax',
        secure: window.location.protocol === 'https:',
        expires: seconds > 0 ? new Date(Date.now() + seconds * 1000) : undefined,
      });
      setIsAuthorized(true);
      navigate(to);
    } catch (error) {
      const authError = error as { status?: string; message?: string; detail?: string | Array<{ msg?: string }> };
      console.error(authError);
      const detail = Array.isArray(authError.detail)
        ? authError.detail.map(item => item.msg).filter(Boolean).join('; ')
        : authError.detail;
      toast({
        title: `验证失败: ${authError.message || detail || '请求失败，请检查服务状态'}`,
        status: 'error',
        duration: 2000,
        position: 'top-right',
      });
    }
  };

  return (
    <Card display="flex" justifyContent="center" mt="20" mx="auto" maxW="xl" overflow="visible" bg={`${colors.surface}${glassSurfaceAlpha(glassStyle)}`} color={colors.text} borderWidth="1px" borderColor={`${colors.accent}55`} boxShadow={colorMode === 'dark' ? '0 24px 60px rgba(0,0,0,0.28)' : '0 24px 60px rgba(35,52,77,0.12)'} backdropFilter={`blur(${glassBlurValue(glassStyle)}) saturate(${glassSaturationValue(glassStyle)})`} sx={{ WebkitBackdropFilter: `blur(${glassBlurValue(glassStyle)}) saturate(${glassSaturationValue(glassStyle)})` }}>
      <CardHeader>
        <Heading>验证 Token</Heading>
      </CardHeader>
      <CardBody overflow="visible">
        <InputGroup alignItems="stretch">
          <InputLeftAddon pointerEvents="none" bg={`${colors.surface}44`} color={colors.text} borderColor={`${colors.text}28`}>TOKEN</InputLeftAddon>
          <Input onChange={event => setAuthToken(event.currentTarget.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void handleAuth(2629800); } }} type="password" placeholder="输入 Token" color={colors.text} bg={colorMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)'} borderColor={`${colors.text}28`} _placeholder={{ color: `${colors.text}70` }} />
          <Button ml="3" h="10" px="6" rounded="full" bg={colors.accent} color={colorMode === 'dark' ? '#101827' : 'white'} _hover={{ bg: colors.accent, filter: 'brightness(1.08)', transform: 'translateY(-1px)' }} _active={{ transform: 'translateY(0)' }} onClick={() => void handleAuth(2629800)}>验证</Button>
        </InputGroup>
      </CardBody>
    </Card>
  );
}
