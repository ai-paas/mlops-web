import { HTTPError, TimeoutError } from 'ky';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BASE_URL } from '@/test/mocks/handlers';
import { server } from '@/test/mocks/server';
import {
  DEFAULT_TIMEOUT_MS,
  api,
  getAccessToken,
  getServerErrorMessage,
  getOrCreateRefreshPromise,
  refreshAccessToken,
  setAccessToken,
} from './api';

// api.ts 인터셉터 통합 테스트 (TEST_PLAN 2A).
// 여기서 쓰는 protected/one/two 등의 엔드포인트는 실제 도메인이 아니라
// 인터셉터 동작 검증용 가상 경로 — 각 테스트에서 server.use()로 등록한다.
// (기본 /auth/refresh 핸들러는 handlers/auth.ts가 제공 — 'test-access-token' 반환)

// vitest 러너는 Node 위에서 돌므로 전역 process가 실제로 존재하지만, src의
// tsconfig(app)는 브라우저 타깃이라 @types/node 선언에 기대지 않도록
// 여기서 쓰는 4개 메서드의 최소 시그니처만 직접 선언한다.
type UnhandledRejectionHandler = (reason: unknown, promise: Promise<unknown>) => void;
type NodeProcessEvents = {
  listeners(event: 'unhandledRejection'): UnhandledRejectionHandler[];
  removeAllListeners(event: 'unhandledRejection'): void;
  on(event: 'unhandledRejection', handler: UnhandledRejectionHandler): void;
  removeListener(event: 'unhandledRejection', handler: UnhandledRejectionHandler): void;
};
const nodeProcess = (globalThis as unknown as { process: NodeProcessEvents }).process;

// refresh 실패 경로에서 미처리 rejection이 새지 않는지 검증하기 위해 가로채 수집한다.
// (과거 api.ts가 큐 프로미스 queuedResponse를 흡수하지 않아 1건/동시 2건이 잡혔다 — 2026-09-04 수정,
// 아래 describe의 0건 단언이 회귀 테스트다) 테스트 후 반드시 restore.
const captureUnhandledRejections = () => {
  const captured: unknown[] = [];
  const original = nodeProcess.listeners('unhandledRejection');
  nodeProcess.removeAllListeners('unhandledRejection');
  const handler = (reason: unknown) => {
    captured.push(reason);
  };
  nodeProcess.on('unhandledRejection', handler);
  return {
    captured,
    restore: () => {
      nodeProcess.removeListener('unhandledRejection', handler);
      original.forEach((listener) => nodeProcess.on('unhandledRejection', listener));
    },
  };
};

// ============================================
// beforeRequest — 토큰 첨부
// ============================================
describe('beforeRequest — 토큰 첨부', () => {
  it('메모리에 토큰이 있으면 Authorization 헤더로 첨부하고 refresh를 호출하지 않는다', async () => {
    setAccessToken('memory-token');
    const refreshSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshSpy();
        return HttpResponse.json({ access_token: 'unused' });
      }),
      http.get(`${BASE_URL}/protected`, ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') })
      )
    );

    const body = await api.get('protected').json();

    expect(body).toEqual({ auth: 'Bearer memory-token' });
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('메모리에 토큰이 없으면 요청 전에 refresh로 토큰을 발급받아 첨부한다', async () => {
    // setAccessToken 미호출 — setup-tests afterEach가 항상 비워둔 상태
    server.use(
      http.get(`${BASE_URL}/protected`, ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') })
      )
    );

    const body = await api.get('protected').json();

    expect(body).toEqual({ auth: 'Bearer test-access-token' });
    expect(getAccessToken()).toBe('test-access-token');
  });

  it('토큰이 없고 refresh도 실패하면 본 요청을 보내지 않고 실패한다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => HttpResponse.json({}, { status: 500 })),
      http.get(`${BASE_URL}/protected`, () => {
        requestSpy();
        return HttpResponse.json({});
      })
    );

    await expect(api.get('protected')).rejects.toThrow('토큰 재발급이 실패했습니다.');
    expect(requestSpy).not.toHaveBeenCalled();
  });
});

// ============================================
// afterResponse — 401 재발급·재시도
// ============================================
describe('afterResponse — 401 재발급·재시도', () => {
  it('401 응답 시 refresh 후 x-retried 헤더와 새 토큰으로 재시도해 성공 응답을 반환한다', async () => {
    setAccessToken('stale-token');
    const seenRequests: Array<{ auth: string | null; retried: string | null }> = [];
    server.use(
      http.get(`${BASE_URL}/protected`, ({ request }) => {
        seenRequests.push({
          auth: request.headers.get('authorization'),
          retried: request.headers.get('x-retried'),
        });
        if (request.headers.get('authorization') === 'Bearer stale-token') {
          return HttpResponse.json({ detail: 'expired' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      })
    );

    const body = await api.get('protected').json();

    expect(body).toEqual({ ok: true });
    expect(seenRequests).toEqual([
      { auth: 'Bearer stale-token', retried: null },
      { auth: 'Bearer test-access-token', retried: 'true' },
    ]);
    // 재발급된 토큰이 메모리에 반영되어 이후 요청에 사용된다
    expect(getAccessToken()).toBe('test-access-token');
  });

  it('본문이 있는 POST 요청도 재시도 시 본문이 유지된다', async () => {
    setAccessToken('stale-token');
    const seenBodies: unknown[] = [];
    server.use(
      http.post(`${BASE_URL}/items`, async ({ request }) => {
        seenBodies.push(await request.json());
        if (request.headers.get('authorization') === 'Bearer stale-token') {
          return HttpResponse.json({ detail: 'expired' }, { status: 401 });
        }
        return HttpResponse.json({ created: true }, { status: 201 });
      })
    );

    const body = await api.post('items', { json: { name: '테스트' } }).json();

    expect(body).toEqual({ created: true });
    expect(seenBodies).toEqual([{ name: '테스트' }, { name: '테스트' }]);
  });

  it('재시도 요청이 다시 401을 받아도 refresh 루프에 진입하지 않는다', async () => {
    setAccessToken('stale-token');
    const refreshSpy = vi.fn();
    let protectedCallCount = 0;
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshSpy();
        return HttpResponse.json({ access_token: 'new-token' });
      }),
      http.get(`${BASE_URL}/protected`, () => {
        protectedCallCount += 1;
        return HttpResponse.json({ detail: '여전히 만료됨' }, { status: 401 });
      })
    );

    // 재시도(x-retried)의 401은 재발급 없이 그대로 에러로 전달된다
    await expect(api.get('protected')).rejects.toThrow('여전히 만료됨');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(protectedCallCount).toBe(2); // 원 요청 + 재시도 1회, 추가 루프 없음
  });

  it('x-retried 헤더가 이미 있는 요청의 401은 refresh 없이 그대로 실패한다', async () => {
    setAccessToken('stale-token');
    const refreshSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshSpy();
        return HttpResponse.json({ access_token: 'unused' });
      }),
      http.get(`${BASE_URL}/protected`, () => new HttpResponse(null, { status: 401 }))
    );

    await expect(api.get('protected', { headers: { 'x-retried': 'true' } })).rejects.toThrow();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('auth/refresh 경로의 401은 재발급을 시도하지 않는다', async () => {
    setAccessToken('some-token');
    const refreshSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshSpy();
        return new HttpResponse(null, { status: 401 });
      })
    );

    await expect(api.post('auth/refresh')).rejects.toThrow();
    expect(refreshSpy).toHaveBeenCalledTimes(1); // 재발급 재귀 진입 없음
  });
});

// ============================================
// 동시 401 — single-flight
// ============================================
describe('동시 401 — single-flight', () => {
  it('동시 401에서 refresh는 정확히 1회만 호출되고 큐의 요청이 모두 새 토큰으로 재시도된다', async () => {
    setAccessToken('stale-token');
    const refreshSpy = vi.fn();
    const callCounts = { one: 0, two: 0 };

    const protectedHandler = (key: 'one' | 'two', payload: Record<string, unknown>) =>
      http.get(`${BASE_URL}/${key}`, ({ request }) => {
        callCounts[key] += 1;
        if (request.headers.get('authorization') !== 'Bearer new-token') {
          return HttpResponse.json({ detail: 'expired' }, { status: 401 });
        }
        return HttpResponse.json(payload);
      });

    server.use(
      http.post(`${BASE_URL}/auth/refresh`, async () => {
        refreshSpy();
        // 두 요청의 401이 모두 큐에 쌓인 뒤 resolve되도록 지연
        await delay(50);
        return HttpResponse.json({ access_token: 'new-token' });
      }),
      protectedHandler('one', { id: 1 }),
      protectedHandler('two', { id: 2 })
    );

    const [one, two] = await Promise.all([api.get('one').json(), api.get('two').json()]);

    expect(one).toEqual({ id: 1 });
    expect(two).toEqual({ id: 2 });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    // 각 엔드포인트는 실패 1회 + 재시도 1회만 — 큐가 중복 flush되지 않는다
    expect(callCounts).toEqual({ one: 2, two: 2 });
  });
});

// ============================================
// refresh 실패 — 큐 reject
// ============================================
describe('refresh 실패 — 큐 reject', () => {
  let rejections: ReturnType<typeof captureUnhandledRejections>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // afterResponse catch의 console.error 출력 억제
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rejections = captureUnhandledRejections();
  });

  afterEach(async () => {
    // 남은 rejection 이벤트가 다음 테스트로 새지 않도록 플러시 후 복원
    await new Promise((resolve) => setTimeout(resolve, 20));
    rejections.restore();
    consoleErrorSpy.mockRestore();
  });

  it('refresh 실패 시 호출부에는 원본 401 에러가 전달되고 토큰이 비워진다', async () => {
    setAccessToken('stale-token');
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => HttpResponse.json({}, { status: 500 })),
      http.get(`${BASE_URL}/protected`, () =>
        HttpResponse.json({ detail: '인증이 만료되었습니다.' }, { status: 401 })
      )
    );

    const error = await api.get('protected').then(
      () => {
        throw new Error('요청이 성공해서는 안 된다');
      },
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(HTTPError);
    expect((error as HTTPError).response.status).toBe(401);
    expect((error as HTTPError).message).toBe('인증이 만료되었습니다.');
    expect(getAccessToken()).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    // 회귀: 실패 경로에서 큐에 든 재시도 프로미스(queuedResponse)는 catch가 원 응답을 반환해
    // 소비자가 없다 — api.ts가 생성 직후 흡수하므로 미처리 rejection이 남지 않아야 한다.
    // (수정 전에는 '토큰 재발급이 실패했습니다.' 1건이 잡혔다)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rejections.captured).toHaveLength(0);
  });

  it('동시 대기 중이던 요청도 모두 실패하며 refresh는 1회만 시도된다', async () => {
    setAccessToken('stale-token');
    const refreshSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, async () => {
        refreshSpy();
        await delay(50);
        return HttpResponse.json({}, { status: 500 });
      }),
      http.get(`${BASE_URL}/one`, () => HttpResponse.json({ detail: 'expired' }, { status: 401 })),
      http.get(`${BASE_URL}/two`, () => HttpResponse.json({ detail: 'expired' }, { status: 401 }))
    );

    const [one, two] = await Promise.allSettled([api.get('one'), api.get('two')]);

    expect(one.status).toBe('rejected');
    expect(two.status).toBe('rejected');
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    // 회귀: 큐에 쌓였던 2건 모두 각자의 afterResponse 훅이 흡수해 미처리 rejection이 남지 않는다
    // (수정 전에는 2건이 잡혔다)
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rejections.captured).toHaveLength(0);
  });

  it('refresh 실패 후 다음 요청은 새로운 refresh를 시도해 복구된다', async () => {
    setAccessToken('stale-token');
    let refreshCallCount = 0;
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshCallCount += 1;
        if (refreshCallCount === 1) {
          return HttpResponse.json({}, { status: 500 });
        }
        return HttpResponse.json({ access_token: 'recovered-token' });
      }),
      http.get(`${BASE_URL}/protected`, ({ request }) => {
        if (request.headers.get('authorization') !== 'Bearer recovered-token') {
          return HttpResponse.json({ detail: 'expired' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      })
    );

    // 1차: 401 → refresh 실패 → 에러 전달 + 토큰 클리어
    await expect(api.get('protected')).rejects.toThrow();
    expect(getAccessToken()).toBeNull();

    // 2차: 토큰이 없으므로 beforeRequest가 새 refresh를 수행해 성공한다
    // (실패한 refreshPromise가 재사용되지 않고 리셋되었는지 검증)
    const body = await api.get('protected').json();
    expect(body).toEqual({ ok: true });
    expect(refreshCallCount).toBe(2);
  });
});

// ============================================
// beforeError — detail 문자열 처리
// ============================================
describe('beforeError — detail 문자열 처리', () => {
  beforeEach(() => {
    // 401 재발급 경로에 진입하지 않도록 유효 토큰을 심는다
    setAccessToken('valid-token');
  });

  const respondWith = (body: Record<string, unknown>, status = 400) => {
    server.use(http.get(`${BASE_URL}/protected`, () => HttpResponse.json(body, { status })));
  };

  it('detail이 문자열이면 에러 메시지로 사용한다', async () => {
    respondWith({ detail: '이름이 중복되었습니다.' });

    await expect(api.get('protected')).rejects.toThrow('이름이 중복되었습니다.');
  });

  it('detail 문자열은 추가 JSON 파싱 없이 그대로 사용한다', async () => {
    respondWith({ detail: '백엔드 호출 실패: {"detail": "모델을 찾을 수 없습니다."}' });

    await expect(api.get('protected')).rejects.toThrow(
      '백엔드 호출 실패: {"detail": "모델을 찾을 수 없습니다."}'
    );
  });

  it('내장 JSON 파싱에 실패하면 원본 detail을 그대로 사용한다', async () => {
    respondWith({ detail: '중괄호 { 가 있지만 JSON은 아닌 메시지' });

    await expect(api.get('protected')).rejects.toThrow('중괄호 { 가 있지만 JSON은 아닌 메시지');
  });

  it('내장 JSON의 detail이 문자열이 아니면 원본 detail을 유지한다', async () => {
    respondWith({ detail: '오류 응답: {"detail": 42}' });

    await expect(api.get('protected')).rejects.toThrow('오류 응답: {"detail": 42}');
  });

  it('detail이 없으면 ky 기본 에러 메시지를 유지한다', async () => {
    respondWith({ message: 'detail 없는 에러' }, 500);

    const error = await api.get('protected').then(
      () => {
        throw new Error('요청이 성공해서는 안 된다');
      },
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(HTTPError);
    expect((error as HTTPError).message).toMatch(/Request failed/);
  });

  it.each([
    ['배열', [{ loc: ['body', 'name'], msg: '필수값입니다.' }]],
    ['객체', { message: '검증 실패' }],
    ['빈 문자열', '   '],
  ])('detail이 %s이면 ky 기본 에러 메시지를 유지한다', async (_label, detail) => {
    respondWith({ detail }, 422);

    const error = await api.get('protected').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HTTPError);
    expect((error as HTTPError).message).toMatch(/Request failed/);
  });

  it('본문이 JSON이 아니면 ky 기본 에러 메시지를 유지한다', async () => {
    server.use(
      http.get(
        `${BASE_URL}/protected`,
        () => new HttpResponse('<html>server error</html>', { status: 500 })
      )
    );

    const error = await api.get('protected').then(
      () => {
        throw new Error('요청이 성공해서는 안 된다');
      },
      (caught: unknown) => caught
    );

    expect(error).toBeInstanceOf(HTTPError);
    expect((error as HTTPError).message).toMatch(/Request failed/);
  });
});

// ============================================
// refreshAccessToken 단독 동작
// ============================================
describe('refreshAccessToken', () => {
  it('성공 시 토큰을 메모리에 저장하고 반환한다', async () => {
    const token = await refreshAccessToken();

    expect(token).toBe('test-access-token');
    expect(getAccessToken()).toBe('test-access-token');
  });

  it('HTTP 에러 시 토큰을 비우고 실패한다', async () => {
    setAccessToken('old-token');
    server.use(http.post(`${BASE_URL}/auth/refresh`, () => HttpResponse.json({}, { status: 500 })));

    await expect(refreshAccessToken()).rejects.toThrow('토큰 재발급이 실패했습니다.');
    expect(getAccessToken()).toBeNull();
  });

  it('응답에 access_token이 없으면 토큰을 비우고 실패한다', async () => {
    setAccessToken('old-token');
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => HttpResponse.json({ refresh_token: 'only' }))
    );

    await expect(refreshAccessToken()).rejects.toThrow('토큰 재발급 응답이 올바르지 않습니다.');
    expect(getAccessToken()).toBeNull();
  });
});

// ============================================
// getServerErrorMessage — 사용자 오류 문구 (TODO 15)
// ============================================
describe('getServerErrorMessage', () => {
  const FALLBACK = '요청 처리 중 오류가 발생했습니다.';

  it('서버가 detail 문자열을 보내면 그대로 사용한다', async () => {
    setAccessToken('valid-token');
    server.use(
      http.get(`${BASE_URL}/forbidden`, () =>
        HttpResponse.json({ detail: '권한이 없습니다.' }, { status: 403 })
      )
    );

    const error = await api.get('forbidden').then(
      () => null,
      (caught: unknown) => caught
    );

    expect(getServerErrorMessage(error, FALLBACK)).toBe('권한이 없습니다.');
  });

  it('detail이 없거나 문자열이 아니면(422 검증 배열 등) 호출부 기본 문구를 쓴다', async () => {
    setAccessToken('valid-token');
    server.use(
      http.get(`${BASE_URL}/plain`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
      http.get(`${BASE_URL}/validation`, () =>
        HttpResponse.json({ detail: [{ msg: 'Field required' }] }, { status: 422 })
      )
    );

    const plain = await api.get('plain').then(
      () => null,
      (caught: unknown) => caught
    );
    const validation = await api.get('validation').then(
      () => null,
      (caught: unknown) => caught
    );

    expect(getServerErrorMessage(plain, FALLBACK)).toBe(FALLBACK);
    expect(getServerErrorMessage(validation, FALLBACK)).toBe(FALLBACK);
  });

  it('타임아웃·네트워크 단절은 원인을 알 수 있는 문구로, 그 외 에러는 기본 문구로 바꾼다', () => {
    const request = new Request('http://localhost/x');

    expect(getServerErrorMessage(new TimeoutError(request), FALLBACK)).toBe(
      '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
    );
    expect(getServerErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(
      '네트워크 연결을 확인해주세요.'
    );
    // fetch와 무관한 TypeError(코드 결함)는 네트워크 문구로 위장하지 않는다
    expect(getServerErrorMessage(new TypeError('x is not a function'), FALLBACK)).toBe(FALLBACK);
    expect(getServerErrorMessage(new Error('unknown'), FALLBACK)).toBe(FALLBACK);
    expect(getServerErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
  });
});

// ============================================
// 전역 timeout / retry 기본값 (TODO 14)
// ============================================
describe('timeout / retry 기본값', () => {
  it('GET 5xx를 ky가 자체 재시도하지 않는다 — 재시도 계층은 React Query 한 곳', async () => {
    setAccessToken('valid-token');
    let callCount = 0;
    server.use(
      http.get(`${BASE_URL}/flaky`, () => {
        callCount += 1;
        return HttpResponse.json({ detail: 'boom' }, { status: 500 });
      })
    );

    await expect(api.get('flaky')).rejects.toBeInstanceOf(HTTPError);
    // ky 기본값(limit 2)이었다면 3회 요청됐다
    expect(callCount).toBe(1);
  });

  it('응답이 없으면 기본 타임아웃(30초) 후 TimeoutError로 실패한다', async () => {
    vi.useFakeTimers();
    try {
      setAccessToken('valid-token');
      server.use(http.get(`${BASE_URL}/hang`, () => new Promise<never>(() => {})));

      const settled = api.get('hang').then(
        () => 'resolved',
        (error: unknown) => error
      );

      // 타임아웃 직전까지는 여전히 대기 중이다 (ky 기본 10초로 되돌아가면 여기서 잡힌다)
      await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS - 1);
      await expect(Promise.race([settled, Promise.resolve('pending')])).resolves.toBe('pending');

      await vi.advanceTimersByTimeAsync(1);
      await expect(settled).resolves.toBeInstanceOf(TimeoutError);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ============================================
// getOrCreateRefreshPromise — refresh 자체의 single-flight
// ============================================
describe('getOrCreateRefreshPromise', () => {
  it('동시 호출은 하나의 refresh 요청을 공유한다', async () => {
    const refreshSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, async () => {
        refreshSpy();
        await delay(30);
        return HttpResponse.json({ access_token: 'shared-token' });
      })
    );

    const [first, second] = await Promise.all([
      getOrCreateRefreshPromise(),
      getOrCreateRefreshPromise(),
    ]);

    expect(first).toBe('shared-token');
    expect(second).toBe('shared-token');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('완료 후의 호출은 새 refresh 요청을 만든다', async () => {
    const refreshSpy = vi.fn();
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () => {
        refreshSpy();
        return HttpResponse.json({ access_token: 'fresh-token' });
      })
    );

    await getOrCreateRefreshPromise();
    await getOrCreateRefreshPromise();

    expect(refreshSpy).toHaveBeenCalledTimes(2);
  });
});
