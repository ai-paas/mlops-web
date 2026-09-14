/**
 * 라우팅/인증 가드 통합 테스트 (TEST_PLAN 3A).
 *
 * 실제 routes(router.tsx)를 createMemoryRouter로 렌더해 main.tsx와 동일한 프로바이더
 * 구성(QueryClient > AuthProvider > ToastProvider > RouterProvider) 위에서
 * 세션 복원(/auth/refresh) → 가드 리다이렉트 → 실제 페이지 렌더, 그리고 로그아웃 →
 * 세션 정리 → 가드 리다이렉트까지 전체 흐름을 검증한다.
 *
 * 실제 @innogrid/ui를 렌더하므로(ServicePage의 Table 등) 경량 목을 import하지 않고
 * installDomMeasurementStubs()를 사용한다 (src/test/README.md 참고).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@innogrid/ui';
import { HttpResponse, http } from 'msw';
import { routes } from './router';
import { AuthProvider } from '@/hooks/useAuth';
import { getAccessToken, setAccessToken } from '@/lib/api';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createTestQueryClient, makeTestJwt, userEvent } from '@/test/utils/test-utils';
import { installDomMeasurementStubs } from '@/test/utils/dom-measure-stubs';

// 세션 복원 실패(리프레시 쿠키 없음/만료) 상태 시뮬레이션
const failRefresh = () =>
  server.use(
    http.post(`${BASE_URL}/auth/refresh`, () =>
      HttpResponse.json({ message: 'expired' }, { status: 401 })
    )
  );

// 라우터를 테스트에서 만들어 넘긴다 — 렌더 후 router.state.location으로 최종 경로를 단언
const createRouter = (initialEntry: string) =>
  createMemoryRouter(routes, { initialEntries: [initialEntry] });

function renderApp(router: ReturnType<typeof createRouter>) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('라우팅/인증 가드', () => {
  installDomMeasurementStubs();

  // 주의: 이 테스트는 파일 내에서 가장 먼저 실행되어야 한다 — routes의 lazy 모듈은
  // 한 번 로드되면 이후 테스트에서는 동기 렌더되어 fallback이 나타나지 않는다.
  it('lazy 페이지 최초 진입 시 Suspense fallback(로딩 스피너)이 먼저 렌더된다', async () => {
    failRefresh();
    renderApp(createRouter('/login'));

    // 동기 시점: LoginPage 청크 로드 전 — PageLoading이 표시된다
    expect(screen.getByRole('status', { name: '로딩 중' })).toBeInTheDocument();

    // 청크 로드가 끝나면 로그인 폼으로 대체된다
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '로딩 중' })).not.toBeInTheDocument();
  });

  it('비인증(refresh 실패) 상태로 보호 라우트 진입 시 /login으로 리다이렉트한다', async () => {
    failRefresh();
    const router = createRouter('/');
    renderApp(router);

    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('refresh 성공 시 세션을 복원해 보호 페이지를 레이아웃과 함께 렌더한다', async () => {
    const router = createRouter('/service');
    renderApp(router);

    // 기본 refresh 핸들러가 토큰을 발급 → 서비스 목록 페이지 + 데이터 렌더
    expect(await screen.findByRole('heading', { name: '서비스' })).toBeInTheDocument();
    expect(await screen.findByText('테스트 서비스 1')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/service');

    // 레이아웃(헤더·사이드바 메뉴)도 함께 렌더된다
    expect(screen.getByRole('button', { name: '내 계정' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '서비스' })).toBeInTheDocument();
  });

  it('인증 상태로 /login 진입 시 홈(/)을 거쳐 /service로 리다이렉트한다', async () => {
    // AuthProvider가 마운트 시점에 읽도록 렌더 전에 토큰 주입 (refresh 호출 없음)
    setAccessToken(makeTestJwt({ role: 'user' }));
    const router = createRouter('/login');
    renderApp(router);

    // LoginPage → Navigate('/') → HomePage → Navigate('/service') 체인
    expect(await screen.findByRole('heading', { name: '서비스' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/service');
    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument();
  });

  it('로그아웃 메뉴 선택 시 서버 무효화 후 세션을 비우고 /login으로 리다이렉트한다', async () => {
    let authHeader: string | null = null;
    server.use(
      http.post(`${BASE_URL}/auth/logout`, ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return new HttpResponse(null, { status: 204 });
      })
    );
    const token = makeTestJwt({ role: 'user' });
    setAccessToken(token);
    const user = userEvent.setup();
    const router = createRouter('/service');
    renderApp(router);
    expect(await screen.findByRole('heading', { name: '서비스' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '내 계정' }));
    await user.click(screen.getByRole('menuitem', { name: '로그아웃' }));

    // 별도 navigate 없이 DefaultLayout 가드가 비인증 상태를 감지해 /login으로 보낸다
    // — 레이아웃(헤더)은 언마운트되고 세션은 서버·클라이언트 양쪽에서 정리된다
    expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByRole('button', { name: '내 계정' })).not.toBeInTheDocument();
    expect(authHeader).toBe(`Bearer ${token}`);
    expect(getAccessToken()).toBeNull();
  });

  it('세션이 만료되면(요청 401 + refresh 실패) 보호 페이지에서 /login으로 리다이렉트한다', async () => {
    // 탭을 열어 둔 채 refresh 쿠키가 만료된 상황 — 목록 요청이 401, refresh도 401.
    // lib/api가 메모리 토큰을 비우면 AuthProvider가 구독으로 따라가고 DefaultLayout 가드가 보낸다.
    server.use(
      http.get(`${BASE_URL}/services`, () =>
        HttpResponse.json({ detail: 'expired' }, { status: 401 })
      )
    );
    failRefresh();
    // api.ts afterResponse가 refresh 실패를 console.error로 남긴다 — 출력만 막는다
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setAccessToken(makeTestJwt({ role: 'user' }));
    const router = createRouter('/service');

    try {
      renderApp(router);
      expect(await screen.findByRole('button', { name: '로그인' })).toBeInTheDocument();
    } finally {
      consoleError.mockRestore();
    }

    expect(router.state.location.pathname).toBe('/login');
    expect(getAccessToken()).toBeNull();
    expect(screen.queryByRole('button', { name: '내 계정' })).not.toBeInTheDocument();
  });

  // ============================================
  // 관리자 가드(AdminRoute) — 멤버 관리는 admin 전용
  // ============================================
  it.each(['/member-management', '/member-management/create', '/member-management/user-a/edit'])(
    '일반 계정으로 %s 직접 진입 시 홈을 거쳐 /service로 리다이렉트한다',
    async (path) => {
      setAccessToken(makeTestJwt({ role: 'user' }));
      const router = createRouter(path);
      renderApp(router);

      // AdminRoute → Navigate('/') → HomePage → Navigate('/service')
      expect(await screen.findByRole('heading', { name: '서비스' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/service');
      expect(screen.queryByRole('heading', { name: '멤버 관리' })).not.toBeInTheDocument();
    }
  );

  it('관리자 계정은 /member-management 에 진입해 멤버 목록을 렌더한다', async () => {
    setAccessToken(makeTestJwt({ role: 'admin' }));
    const router = createRouter('/member-management');
    renderApp(router);

    expect(await screen.findByRole('heading', { name: '멤버 관리' })).toBeInTheDocument();
    expect(await screen.findByText('홍길동')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/member-management');
  });
});
