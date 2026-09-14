import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SseMessage } from './sse';
import { subscribeSse } from './sse';

vi.mock('./api', () => ({
  getAccessToken: () => 'test-token',
  getOrCreateRefreshPromise: vi.fn(async () => 'refreshed-token'),
}));

const streamOf = (...chunks: string[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

const respond = (...chunks: string[]) =>
  ({ ok: true, status: 200, body: streamOf(...chunks) }) as unknown as Response;

/** 첫 연결만 응답하고 재연결은 abort 로 끊는다. */
const collectOnce = async (...chunks: string[]): Promise<SseMessage[]> => {
  const controller = new AbortController();
  const received: SseMessage[] = [];

  vi.mocked(global.fetch).mockImplementation(async () => respond(...chunks));

  await subscribeSse('operations/op-1/events', {
    signal: controller.signal,
    onMessage: (message) => received.push(message),
    onClose: () => controller.abort(),
  });

  return received;
};

describe('subscribeSse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('event 와 data 를 프레임 단위로 파싱한다', async () => {
    const received = await collectOnce('event: progress\ndata: {"percent":33}\n\n');

    expect(received).toEqual([{ event: 'progress', data: '{"percent":33}' }]);
  });

  it('청크 경계가 프레임 중간을 갈라도 합쳐서 파싱한다', async () => {
    const received = await collectOnce('event: pulumi\ndata: {"mes', 'sage":"hi"}\n\n');

    expect(received).toEqual([{ event: 'pulumi', data: '{"message":"hi"}' }]);
  });

  it('한 청크에 담긴 여러 프레임을 모두 전달한다', async () => {
    const received = await collectOnce('event: a\ndata: 1\n\nevent: b\ndata: 2\n\n');

    expect(received.map((m) => m.event)).toEqual(['a', 'b']);
  });

  it('event 필드가 없으면 message 로 본다', async () => {
    const received = await collectOnce('data: bare\n\n');

    expect(received).toEqual([{ event: 'message', data: 'bare' }]);
  });

  it('여러 data 줄은 개행으로 잇는다', async () => {
    const received = await collectOnce('event: log\ndata: line1\ndata: line2\n\n');

    expect(received[0].data).toBe('line1\nline2');
  });

  it('콜론 뒤 공백이 없어도 파싱한다', async () => {
    // Spring SseEmitter 의 실제 출력 형식 — 공백을 필수로 보면 전부 무시된다.
    const received = await collectOnce('event:not-found\ndata:\n\n');

    expect(received).toEqual([{ event: 'not-found', data: '' }]);
  });

  it('주석과 미지원 필드는 버린다', async () => {
    const received = await collectOnce(': keep-alive\nid: 7\nretry: 500\nevent: x\ndata: v\n\n');

    expect(received).toEqual([{ event: 'x', data: 'v' }]);
  });

  it('data 없는 프레임은 이벤트로 올리지 않는다', async () => {
    const received = await collectOnce(': heartbeat\n\nevent: real\ndata: v\n\n');

    expect(received).toEqual([{ event: 'real', data: 'v' }]);
  });

  it('Authorization 헤더와 event-stream Accept 를 붙인다', async () => {
    await collectOnce('event: x\ndata: v\n\n');

    const [, init] = vi.mocked(global.fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect((init?.headers as Record<string, string>).Accept).toBe('text/event-stream');
  });

  it('401 이면 토큰을 갱신하고 다시 연결한다', async () => {
    const controller = new AbortController();
    const received: SseMessage[] = [];
    let call = 0;

    vi.mocked(global.fetch).mockImplementation(async () => {
      call += 1;
      if (call === 1) return { ok: false, status: 401, body: null } as unknown as Response;
      return respond('event: progress\ndata: ok\n\n');
    });

    await subscribeSse('operations/op-1/events', {
      signal: controller.signal,
      onMessage: (message) => received.push(message),
      onClose: () => controller.abort(),
    });

    expect(call).toBe(2);
    expect(received).toEqual([{ event: 'progress', data: 'ok' }]);
  });

  it('갱신 후에도 401 이면 refresh 를 반복하지 않고 백오프로 넘긴다', async () => {
    // 권한 회수처럼 갱신해도 안 풀리는 401 에서 지연 없이 refresh 를 무한 호출하면 안 된다.
    const { getOrCreateRefreshPromise } = await import('./api');
    const controller = new AbortController();
    const onError = vi.fn(() => controller.abort());

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      body: null,
    } as unknown as Response);

    await subscribeSse('operations/op-1/events', {
      signal: controller.signal,
      onMessage: () => undefined,
      onError,
    });

    expect(vi.mocked(getOrCreateRefreshPromise)).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledOnce();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('연결에 성공하면 401 재시도 한도가 초기화된다', async () => {
    // 스트림이 20~30분 살아 있으면 토큰이 여러 번 만료된다. 한 번 쓰고 잠기면 안 된다.
    const { getOrCreateRefreshPromise } = await import('./api');
    const controller = new AbortController();
    const statuses = [401, 200, 401, 200];
    let call = 0;

    vi.mocked(global.fetch).mockImplementation(async () => {
      const status = statuses[call] ?? 200;
      call += 1;
      if (status === 401) return { ok: false, status: 401, body: null } as unknown as Response;
      if (call >= statuses.length) controller.abort();
      return respond('event:progress\ndata:ok\n\n');
    });

    await subscribeSse('operations/op-1/events', {
      signal: controller.signal,
      onMessage: () => undefined,
    });

    expect(vi.mocked(getOrCreateRefreshPromise)).toHaveBeenCalledTimes(2);
  });

  it('이미 abort 된 signal 이면 연결하지 않는다', async () => {
    const controller = new AbortController();
    controller.abort();

    await subscribeSse('operations/op-1/events', {
      signal: controller.signal,
      onMessage: () => undefined,
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('연결 실패는 onError 로 알리고 abort 전까지 재시도한다', async () => {
    const controller = new AbortController();
    const onError = vi.fn(() => controller.abort());

    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'));

    await subscribeSse('operations/op-1/events', {
      signal: controller.signal,
      onMessage: () => undefined,
      onError,
    });

    expect(onError).toHaveBeenCalledOnce();
  });
});
