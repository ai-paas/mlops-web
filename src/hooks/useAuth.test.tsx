import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createTestQueryClient, makeTestJwt } from '@/test/utils/test-utils';
import { api, getAccessToken, setAccessToken } from '@/lib/api';
import { AuthProvider, useAuth } from './useAuth';
import type { ReactNode } from 'react';

// useAuth는 인증 도메인 흐름의 오케스트레이션 계층이다:
// 마운트 시 refresh로 세션 복원, logout 시 서버 무효화 → 로컬 토큰 제거 → 캐시 초기화.

const createAuthWrapper = (queryClient = createTestQueryClient()) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  return { wrapper, queryClient };
};

describe('useAuth', () => {
  // ============================================
  // 마운트 초기화 — 세션 복원
  // ============================================
  describe('초기화', () => {
    it('메모리에 토큰이 없으면 refresh로 세션을 복원한다', async () => {
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // refresh 응답 전까지는 로딩 상태
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.accessToken).toBe('test-access-token');
    });

    it('refresh가 실패하면 비인증 상태로 로딩을 끝낸다', async () => {
      server.use(
        http.post(`${BASE_URL}/auth/refresh`, () =>
          HttpResponse.json({ message: 'expired' }, { status: 401 })
        )
      );
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.accessToken).toBeNull();
    });

    it('메모리에 토큰이 있으면 refresh 없이 즉시 인증 상태가 된다', async () => {
      const refreshSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/auth/refresh`, () => {
          refreshSpy();
          return HttpResponse.json({ access_token: 'test-access-token' });
        })
      );
      setAccessToken(makeTestJwt({ role: 'user' }));

      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('setAccessToken', () => {
    it('컨텍스트 상태와 API 메모리 토큰을 함께 설정하고 해제한다', () => {
      setAccessToken(makeTestJwt({ role: 'user' }));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      const adminToken = makeTestJwt({ role: 'admin' });

      act(() => result.current.setAccessToken(adminToken));

      expect(result.current.accessToken).toBe(adminToken);
      expect(result.current.isAdmin).toBe(true);
      expect(getAccessToken()).toBe(adminToken);

      act(() => result.current.setAccessToken(null));

      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(getAccessToken()).toBeNull();
    });

    it('비인증 마운트 후 세터로 로그인하면 첫 ky 요청이 refresh 왕복 없이 새 토큰을 싣는다', async () => {
      // TODO 12 회귀: 세터가 컨텍스트 state만 갱신하고 lib/api 메모리를 비워 두면
      // ky beforeRequest가 로그인 직후 첫 요청마다 불필요한 /auth/refresh 를 한 번 더 왕복한다.
      let refreshCalls = 0;
      let authHeader: string | null = null;
      server.use(
        http.post(`${BASE_URL}/auth/refresh`, () => {
          refreshCalls += 1;
          // 1회차(마운트 세션 복원)는 실패시켜 비인증으로 시작, 이후 호출은 성공 —
          // 버그가 있으면 여기서 발급한 토큰이 요청에 실리고 호출 수가 2가 된다
          return refreshCalls === 1
            ? HttpResponse.json({ message: 'expired' }, { status: 401 })
            : HttpResponse.json({ access_token: 'refreshed-token' });
        }),
        http.get(`${BASE_URL}/services`, ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return HttpResponse.json({ data: [], total: 0, page: 1, size: 10 });
        })
      );
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.isAuthenticated).toBe(false);

      // 로그인 성공 시 LoginPage가 하는 것과 동일 — 컨텍스트 세터 한 번
      const loginToken = makeTestJwt({ role: 'user' });
      act(() => result.current.setAccessToken(loginToken));
      await api.get('services');

      expect(authHeader).toBe(`Bearer ${loginToken}`);
      expect(refreshCalls).toBe(1);
    });
  });

  // ============================================
  // isAdmin — 토큰 role 클레임 파생
  // ============================================
  describe('isAdmin', () => {
    it('role이 admin인 토큰이면 true다', () => {
      setAccessToken(makeTestJwt({ role: 'admin' }));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAdmin).toBe(true);
    });

    it('role이 admin이 아니면 false다', () => {
      setAccessToken(makeTestJwt({ role: 'user' }));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.isAdmin).toBe(false);
    });
  });

  // ============================================
  // logout — 서버 무효화 → 로컬 토큰 제거 → 캐시 초기화
  // ============================================
  describe('logout', () => {
    it('서버 리프레시 토큰을 무효화하고 로컬 토큰과 쿼리 캐시를 정리한다', async () => {
      let authHeader: string | null = null;
      server.use(
        http.post(`${BASE_URL}/auth/logout`, ({ request }) => {
          authHeader = request.headers.get('Authorization');
          return new HttpResponse(null, { status: 204 });
        })
      );
      const token = makeTestJwt({ role: 'user' });
      setAccessToken(token);

      // gcTime 0이면 옵저버 없는 시드 캐시가 즉시 GC돼 clear() 검증이 무의미해진다
      const { wrapper, queryClient } = createAuthWrapper(
        createTestQueryClient({ gcTime: Infinity })
      );
      queryClient.setQueryData(['services'], { data: [] });
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      // 서버 무효화 요청에 액세스 토큰이 실렸다
      expect(authHeader).toBe(`Bearer ${token}`);
      // 로컬 토큰·상태·캐시가 모두 정리됐다
      expect(getAccessToken()).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.accessToken).toBeNull();
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });

    it('서버 무효화가 실패해도 클라이언트는 로그아웃된다', async () => {
      server.use(
        http.post(`${BASE_URL}/auth/logout`, () =>
          HttpResponse.json({ message: 'error' }, { status: 500 })
        )
      );
      setAccessToken(makeTestJwt({ role: 'user' }));

      const { wrapper, queryClient } = createAuthWrapper(
        createTestQueryClient({ gcTime: Infinity })
      );
      queryClient.setQueryData(['services'], { data: [] });
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.logout();
      });

      expect(getAccessToken()).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    });
  });

  // ============================================
  // 토큰 미러링 — lib/api 메모리가 원본, 컨텍스트는 구독으로 따라간다
  // ============================================
  describe('토큰 미러링', () => {
    it('요청 중 401 → refresh로 갱신된 토큰이 컨텍스트에 반영된다', async () => {
      let servicesCalls = 0;
      server.use(
        http.get(`${BASE_URL}/services`, () => {
          servicesCalls += 1;
          return servicesCalls === 1
            ? HttpResponse.json({ detail: 'expired' }, { status: 401 })
            : HttpResponse.json({ data: [], total: 0, page: 1, size: 10 });
        })
      );
      setAccessToken(makeTestJwt({ role: 'user' }));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });

      // ky afterResponse: 401 → refresh(기본 핸들러가 test-access-token 발급) → 재시도
      await act(async () => {
        await api.get('services');
      });

      expect(getAccessToken()).toBe('test-access-token');
      expect(result.current.accessToken).toBe('test-access-token');
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('refresh 쿠키가 만료되면(요청 401 + refresh 실패) 컨텍스트가 비인증으로 전환된다', async () => {
      // 탭을 열어 둔 채 세션이 만료된 상황 — 이전에는 메모리만 비워지고 컨텍스트는
      // 인증 상태로 남아 요청만 계속 실패했다. 이제 레이아웃 가드가 /login으로 보낼 수 있다.
      server.use(
        http.get(`${BASE_URL}/services`, () =>
          HttpResponse.json({ detail: 'expired' }, { status: 401 })
        ),
        http.post(`${BASE_URL}/auth/refresh`, () =>
          HttpResponse.json({ message: 'expired' }, { status: 401 })
        )
      );
      // api.ts afterResponse가 refresh 실패를 console.error로 남긴다 — 출력만 막는다
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAccessToken(makeTestJwt({ role: 'user' }));
      const { wrapper } = createAuthWrapper();
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isAuthenticated).toBe(true);

      try {
        await act(async () => {
          await expect(api.get('services')).rejects.toThrow();
        });
      } finally {
        consoleError.mockRestore();
      }

      expect(getAccessToken()).toBeNull();
      expect(result.current.accessToken).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  it('AuthProvider 밖에서 호출하면 에러를 던진다', () => {
    // React의 콘솔 중복 출력과 jsdom의 uncaught error 리포팅을 잠시 막는다
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const suppressJsdomReport = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', suppressJsdomReport);

    try {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider'
      );
    } finally {
      window.removeEventListener('error', suppressJsdomReport);
      consoleError.mockRestore();
    }
  });
});
