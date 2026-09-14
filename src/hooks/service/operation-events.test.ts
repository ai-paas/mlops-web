import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '@/lib/query-keys';
import { createHookWrapper, createTestQueryClient } from '@/test/utils/test-utils';
import type { SseMessage, SseSubscribeOptions } from '@/lib/sse';
import { useOperationEvents } from './operation-events';

vi.mock('@/lib/sse', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/sse')>()),
  subscribeSse: vi.fn(),
}));

const { subscribeSse } = await import('@/lib/sse');

/** 마지막 구독의 콜백 — 테스트가 직접 이벤트를 밀어 넣는다. */
let captured: SseSubscribeOptions | undefined;

const emit = (message: SseMessage) => captured?.onMessage(message);

beforeEach(() => {
  captured = undefined;
  vi.mocked(subscribeSse).mockImplementation(async (_path, options) => {
    captured = options;
    options.onOpen?.();
  });
});

afterEach(() => vi.clearAllMocks());

describe('useOperationEvents', () => {
  it('operationId 가 없으면 구독하지 않는다', () => {
    renderHook(() => useOperationEvents(undefined), { wrapper: createHookWrapper() });

    expect(subscribeSse).not.toHaveBeenCalled();
  });

  it('enabled=false 면 구독하지 않는다', () => {
    renderHook(() => useOperationEvents('op-1', { enabled: false }), {
      wrapper: createHookWrapper(),
    });

    expect(subscribeSse).not.toHaveBeenCalled();
  });

  it('operation 별 SSE 경로를 구독한다', () => {
    renderHook(() => useOperationEvents('op-1'), { wrapper: createHookWrapper() });

    expect(subscribeSse).toHaveBeenCalledWith(
      'any-cloud/operations/op-1/events',
      expect.anything()
    );
  });

  it('progress 이벤트를 operation 스냅샷으로 노출한다', async () => {
    const { result } = renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(),
    });

    emit({ event: 'progress', data: JSON.stringify({ id: 'op-1', progress: { percent: 42 } }) });

    await waitFor(() => expect(result.current.operation?.progress?.percent).toBe(42));
  });

  it('pulumi 이벤트는 로그로 누적한다', async () => {
    const { result } = renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(),
    });

    emit({ event: 'pulumi', data: JSON.stringify({ type: 'diagnostic', message: 'creating' }) });
    emit({ event: 'pulumi', data: JSON.stringify({ type: 'diagnostic', message: 'created' }) });

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.message)).toEqual(['creating', 'created']);
  });

  it('로그가 maxLogs 를 넘으면 오래된 것부터 버린다', async () => {
    const { result } = renderHook(() => useOperationEvents('op-1', { maxLogs: 2 }), {
      wrapper: createHookWrapper(),
    });

    for (const message of ['a', 'b', 'c']) {
      emit({ event: 'pulumi', data: JSON.stringify({ message }) });
    }

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.message)).toEqual(['b', 'c']);
  });

  it('망가진 JSON 은 무시하고 스트림을 유지한다', async () => {
    const { result } = renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(),
    });

    emit({ event: 'pulumi', data: 'not-json' });
    emit({ event: 'pulumi', data: JSON.stringify({ message: 'ok' }) });

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.events[0].message).toBe('ok');
  });

  it('스냅샷을 react-query 캐시에 써서 폴링 훅과 값이 갈리지 않게 한다', async () => {
    const queryClient = createTestQueryClient();
    renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(queryClient),
    });

    emit({ event: 'progress', data: JSON.stringify({ id: 'op-1', state: 'RUNNING' }) });

    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.operations.detail('op-1'))).toMatchObject({
        state: 'RUNNING',
      })
    );
  });

  it('terminal 이벤트면 operations/clusters 캐시를 무효화한다', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(queryClient),
    });

    emit({ event: 'succeeded', data: JSON.stringify({ id: 'op-1', state: 'SUCCEEDED' }) });

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.operations.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.clusters.all });
  });

  it('진행 중 이벤트로는 캐시를 무효화하지 않는다', async () => {
    const queryClient = createTestQueryClient();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(queryClient),
    });

    emit({ event: 'progress', data: JSON.stringify({ id: 'op-1', state: 'RUNNING' }) });

    await waitFor(() => expect(invalidate).not.toHaveBeenCalled());
  });

  it('연결 상태를 노출한다', async () => {
    const { result } = renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => expect(result.current.connected).toBe(true));

    captured?.onClose?.();
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  it('언마운트하면 구독을 끊는다', async () => {
    const { unmount } = renderHook(() => useOperationEvents('op-1'), {
      wrapper: createHookWrapper(),
    });

    const signal = captured?.signal;
    expect(signal?.aborted).toBe(false);

    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
