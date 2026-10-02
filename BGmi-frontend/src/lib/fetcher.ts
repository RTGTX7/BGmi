export class FetchError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = 'FetchError';
    this.status = status;
    this.info = info;
  }
}

const createFetchError = async (res: Response) => {
  let payload: unknown;

  try {
    payload = await res.clone().json();
  } catch {
    try {
      payload = await res.text();
    } catch {
      payload = undefined;
    }
  }

  const message =
    typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
      ? payload.message
      : `fetcher error ${res.status}`;

  return new FetchError(message, res.status, payload);
};

export const fetcher = async <T>([key, authToken]: [string, string?], options: ResponseInit): Promise<T> => {
  const headers = new Headers();
  if (authToken) headers.append('bgmi-token', authToken);

  // request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 10000);

  const res = await fetch(`.${key}`, { signal: controller.signal, headers, ...options });

  if (!res.ok) throw await createFetchError(res);

  clearTimeout(timeoutId);
  return res.json();
};

export const fetcherWithTimeout = async <T>(
  [key, authToken]: readonly [string, string?],
  options: ResponseInit,
  timeout = 10000
): Promise<T> => {
  const headers = new Headers();
  if (authToken) headers.append('bgmi-token', authToken);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  const res = await fetch(`.${key}`, { signal: controller.signal, headers, ...options });

  if (!res.ok) throw await createFetchError(res);

  clearTimeout(timeoutId);
  return res.json();
};

export const fetcherWithMutation = async <T>(
  [key, authToken]: [string, string?],
  { arg }: { arg: Record<string, any> }
): Promise<T> => {
  const headers = new Headers();
  headers.append('content-type', 'application/json');
  if (authToken) headers.append('bgmi-token', authToken);

  const options: RequestInit = {
    headers,
    method: 'POST',
    body: JSON.stringify(arg),
  };

  // request timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 300000);

  const res = await fetch(`.${key}`, { signal: controller.signal, ...options });

  if (!res.ok) throw await createFetchError(res);

  clearTimeout(timeoutId);
  return res.json();
};
