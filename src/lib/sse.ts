import { getAccessToken, getOrCreateRefreshPromise } from './api';

export interface SseMessage {
  /** 서버가 `event:` 를 생략하면 'message'. */
  event: string;
  /** `data:` 여러 줄을 개행으로 이어붙인 원문. */
  data: string;
}

export interface SseSubscribeOptions {
  signal: AbortSignal;
  onMessage: (message: SseMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: unknown) => void;
}

const API_PREFIX = '/api/v1';
const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = getAccessToken() ?? (await getOrCreateRefreshPromise());
  return {
    Accept: 'text/event-stream',
    Authorization: `Bearer ${token}`,
  };
};

const parseFrame = (frame: string): SseMessage | null => {
  let event = 'message';
  const dataLines: string[] = [];

  for (const rawLine of frame.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // 명세: 콜론 뒤 공백 한 칸은 구분자
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');

    if (field === 'event') event = value;
    else if (field === 'data') dataLines.push(value);
  }

  return dataLines.length > 0 ? { event, data: dataLines.join('\n') } : null;
};

const readStream = async (
  body: ReadableStream<Uint8Array>,
  onMessage: (message: SseMessage) => void
): Promise<void> => {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const message = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (message) onMessage(message);
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
};

const delay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * `EventSource` 는 Authorization 헤더를 못 붙여 fetch 로 직접 읽는다.
 * 401 은 토큰 만료 — 프로비저닝 20~30분이라 스트림 수명이 access token 수명을 넘는다.
 */
export const subscribeSse = async (path: string, options: SseSubscribeOptions): Promise<void> => {
  const { signal, onMessage, onOpen, onClose, onError } = options;
  let retryMs = INITIAL_RETRY_MS;
  let refreshed = false;

  while (!signal.aborted) {
    try {
      const response = await fetch(`${API_PREFIX}/${path}`, {
        headers: await authHeaders(),
        signal,
      });

      if (response.status === 401) {
        if (refreshed) throw new Error('SSE 인증 실패: 토큰 갱신 후에도 401');
        refreshed = true;
        await getOrCreateRefreshPromise();
        continue;
      }
      if (!response.ok || !response.body) {
        throw new Error(`SSE 연결 실패: ${response.status}`);
      }

      retryMs = INITIAL_RETRY_MS;
      refreshed = false;
      onOpen?.();
      await readStream(response.body, onMessage);
      onClose?.();
    } catch (error) {
      if (signal.aborted) return;
      onError?.(error);
    }

    if (signal.aborted) return;
    await delay(retryMs, signal);
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
  }
};
