import { getCookie, hasCookie } from 'cookies-next';
import { useCallback } from 'react';

export const useAuth = () => {
  const tryAuth = useCallback(async (authToken: string) => {
    // request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 3000);

    const options: RequestInit = {
      signal: controller.signal,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: authToken }),
    };

    try {
      return { timeoutId, response: await fetch('/api/auth', options) };
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  return {
    tryAuth,
    hasAuth: hasCookie('authToken'),
    cookieToken: getCookie('authToken') as string | undefined,
  };
};
