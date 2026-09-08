import { HTTPError, TimeoutError, type NormalizedOptions } from 'ky';
import { describe, expect, it, vi } from 'vitest';
import { queryClient, shouldRetryQuery } from './react-query-provider';

// 전역 재시도 정책(TODO 14) — 4xx·타임아웃은 즉시 중단, 5xx·네트워크만 제한 횟수 재시도.
// 실제 ky 에러 클래스로 검증한다(목킹 시 instanceof가 깨진다).

const request = new Request('http://localhost/x');
const httpError = (status: number) =>
  new HTTPError(new Response(null, { status }), request, {} as NormalizedOptions);

describe('shouldRetryQuery', () => {
  it.each([400, 401, 403, 404, 422])('HTTP %i(4xx)는 첫 실패부터 재시도하지 않는다', (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(false);
  });

  it.each([500, 502, 503, 504])('HTTP %i(5xx)는 최대 2회까지만 재시도한다', (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(true);
    expect(shouldRetryQuery(1, httpError(status))).toBe(true);
    expect(shouldRetryQuery(2, httpError(status))).toBe(false);
  });

  it('네트워크 오류(TypeError)는 최대 2회까지만 재시도한다', () => {
    const networkError = new TypeError('Failed to fetch');
    expect(shouldRetryQuery(0, networkError)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(true);
    expect(shouldRetryQuery(2, networkError)).toBe(false);
  });

  it('타임아웃(TimeoutError)은 재시도하지 않는다 — 서버 hang에 스켈레톤만 길어진다', () => {
    expect(shouldRetryQuery(0, new TimeoutError(request))).toBe(false);
  });
});

describe('queryClient 기본 옵션', () => {
  it('쿼리 재시도는 shouldRetryQuery, 뮤테이션은 재시도하지 않는다', () => {
    const { queries, mutations } = queryClient.getDefaultOptions();
    expect(queries?.retry).toBe(shouldRetryQuery);
    expect(mutations?.retry).toBe(false);
  });

  it('QueryCache/MutationCache의 공통 onError가 실패를 로깅한다 (사용자 피드백은 호출부 몫)', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // 캐시 설정 콜백은 제네릭이 넓어 직접 호출 시 타입이 맞지 않는다 — 검증에 필요한 최소 시그니처로 본다
      const queryOnError = queryClient.getQueryCache().config.onError as
        | ((error: Error, query: unknown) => void)
        | undefined;
      const mutationOnError = queryClient.getMutationCache().config.onError as
        | ((error: Error, variables: unknown, context: unknown, mutation: unknown) => void)
        | undefined;
      expect(queryOnError).toBeDefined();
      expect(mutationOnError).toBeDefined();

      const query = queryClient.getQueryCache().build(queryClient, { queryKey: ['services', 'list'] });
      queryOnError?.(new Error('boom'), query);
      expect(consoleError).toHaveBeenCalledWith(
        '[query] 실패',
        expect.objectContaining({ queryKey: ['services', 'list'], message: 'boom' })
      );

      const mutation = queryClient
        .getMutationCache()
        .build(queryClient, { mutationKey: ['deleteService'], mutationFn: async () => undefined });
      mutationOnError?.(new Error('bang'), undefined, undefined, mutation);
      expect(consoleError).toHaveBeenCalledWith(
        '[mutation] 실패',
        expect.objectContaining({ mutationKey: ['deleteService'], message: 'bang' })
      );
    } finally {
      consoleError.mockRestore();
      queryClient.clear();
    }
  });
});
