import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Input,
  InputGroup,
  InputLeftAddon,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Portal,
  Spinner,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { deleteCookie, setCookie } from 'cookies-next';
import { BsChevronDown } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '~/hooks/use-auth';

export default function Auth({ children, to }: { children: React.ReactElement; to: string }) {
  const [authToken, setAuthToken] = useState('');
  const [checkingCookie, setCheckingCookie] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const toast = useToast();
  const { tryAuth, hasAuth, cookieToken } = useAuth();
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
      if (!response.ok) throw await response.json();

      clearTimeout(timeoutId);
      toast({
        title: '验证成功',
        status: 'success',
        duration: 2000,
        position: 'top-right',
      });

      setCookie('authToken', authToken, {
        expires: seconds > 0 ? new Date(Date.now() + seconds * 1000) : undefined,
      });
      setIsAuthorized(true);
      navigate(to);
    } catch (error) {
      const authError = error as { status: string; message: string };
      console.error(authError);
      toast({
        title: `验证失败: ${authError.message}`,
        status: 'error',
        duration: 2000,
        position: 'top-right',
      });
    }
  };

  return (
    <Card display="flex" justifyContent="center" mt="20" mx="auto" maxW="xl" overflow="visible">
      <CardHeader>
        <Heading>验证 Token</Heading>
      </CardHeader>
      <CardBody overflow="visible">
        <InputGroup alignItems="stretch">
          <InputLeftAddon pointerEvents="none">TOKEN</InputLeftAddon>
          <Input onChange={event => setAuthToken(event.currentTarget.value)} type="password" placeholder="..." />
          <Menu autoSelect={false} placement="bottom-end" gutter={4}>
            <MenuButton as={Button} ml="2" minW="24" rightIcon={<BsChevronDown size="12" />} h="10">
              验证
            </MenuButton>
            <Portal>
              <MenuList minW="40" zIndex={1600}>
                <MenuItem onClick={() => void handleAuth(0)}>不记住</MenuItem>
                <MenuItem onClick={() => void handleAuth(131557600)}>记住一年</MenuItem>
                <MenuItem onClick={() => void handleAuth(2629800)}>记住一个月</MenuItem>
                <MenuItem onClick={() => void handleAuth(86400)}>记住一天</MenuItem>
                <MenuItem onClick={() => void handleAuth(3600)}>记住一小时</MenuItem>
              </MenuList>
            </Portal>
          </Menu>
        </InputGroup>
      </CardBody>
    </Card>
  );
}
