/**
 * 로그인 페이지 테스트 (TEST_PLAN 3A).
 *
 * 실제 AuthProvider로 감싸되 /auth/refresh를 401로 오버라이드해 비인증 상태를 고정한다
 * — 기본 refresh 핸들러는 성공을 반환해 즉시 인증 → 리다이렉트되므로 폼 검증이 불가능.
 * 성공 시 이동(navigate('/service'))은 react-router 부분 목으로 검증하고,
 * 라우터 전체와의 결합(리다이렉트 체인)은 src/router/router.test.tsx가 커버한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render, renderWithUser, makeTestJwt, userEvent } from '@/test/utils/test-utils';
import '@/test/mocks/innogrid-ui';
import { HttpResponse, delay, http } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { AuthProvider } from '@/hooks/useAuth';
import LoginPage from './page';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

const loginUrl = `${BASE_URL}/auth/login`;

const successResponse = () =>
  HttpResponse.json({
    access_token: makeTestJwt({ role: 'user' }),
    token_type: 'bearer',
    expires_in: 3600,
  });

function renderLoginPage() {
  return renderWithUser(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
    { route: '/login', path: '/login' }
  );
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('아이디'), 'tester');
  await user.type(screen.getByLabelText('비밀번호'), 'secret1!');
  await user.click(screen.getByRole('button', { name: '로그인' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    // 비인증 상태 고정 — AuthProvider 마운트 시 세션 복원이 실패하도록
    server.use(
      http.post(`${BASE_URL}/auth/refresh`, () =>
        HttpResponse.json({ message: 'expired' }, { status: 401 })
      )
    );
  });

  it('아이디·비밀번호를 비운 채 제출하면 필수 안내를 표시하고 요청하지 않는다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.post(loginUrl, () => {
        requestSpy();
        return successResponse();
      })
    );
    const { user } = renderLoginPage();

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('아이디는 필수입니다.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호는 필수입니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'true');
    // 필드 에러도 서버 에러처럼 aria-describedby로 입력에 연결된다
    expect(screen.getByText('아이디는 필수입니다.')).toHaveAttribute('id', 'member-id-error');
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-describedby', 'member-id-error');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-describedby', 'password-error');
    expect(requestSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('서버 에러가 표시된 뒤 검증에 실패하는 재제출을 하면 서버 에러를 지우고 필드 안내만 남긴다', async () => {
    server.use(http.post(loginUrl, () => HttpResponse.json({}, { status: 401 })));
    const { user } = renderLoginPage();
    await fillAndSubmit(user);
    await screen.findByText('아이디 또는 비밀번호를 확인해주세요.');

    // 서버 에러가 떠 있는 동안은 비운 필드의 검증 에러를 겹쳐 보이지 않는다
    await user.clear(screen.getByLabelText('아이디'));
    expect(screen.queryByText('아이디는 필수입니다.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('아이디는 필수입니다.')).toBeInTheDocument();
    expect(screen.queryByText('아이디 또는 비밀번호를 확인해주세요.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'false');
  });

  it('아이디만 입력하고 제출하면 비밀번호 안내만 표시되고, 입력하면 사라진다', async () => {
    const { user } = renderLoginPage();
    await user.type(screen.getByLabelText('아이디'), 'tester');

    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('비밀번호는 필수입니다.')).toBeInTheDocument();
    expect(screen.queryByText('아이디는 필수입니다.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-invalid', 'false');

    // 제출 후에는 입력 즉시 재검증(reValidateMode: onChange)되어 에러가 지워진다
    await user.type(screen.getByLabelText('비밀번호'), 's');
    await waitFor(() =>
      expect(screen.queryByText('비밀번호는 필수입니다.')).not.toBeInTheDocument()
    );
  });

  it('입력 목적과 자동완성 정보를 제공한다', () => {
    renderLoginPage();

    expect(screen.getByLabelText('아이디')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute(
      'autocomplete',
      'current-password'
    );
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'false');
  });

  it('아이디 지우기 버튼을 키보드로 실행한 뒤 아이디 입력으로 포커스를 돌려준다', async () => {
    const { user } = renderLoginPage();
    const memberIdInput = screen.getByLabelText('아이디');

    await user.type(memberIdInput, 'tester');
    await user.tab();

    expect(screen.getByRole('button', { name: '아이디 지우기' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(memberIdInput).toHaveValue('');
    expect(memberIdInput).toHaveFocus();
  });

  it('성공 시 입력값을 그대로 제출하고 토큰 저장 후 /service로 이동한다', async () => {
    let loginBody: unknown;
    server.use(
      http.post(loginUrl, async ({ request }) => {
        loginBody = await request.json();
        return successResponse();
      })
    );
    const { user } = renderLoginPage();
    await fillAndSubmit(user);

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/service'));
    expect(loginBody).toEqual({ member_id: 'tester', password: 'secret1!' });

    // 컨텍스트 setAccessToken 반영 → isAuthenticated → 폼 대신 <Navigate to="/">로 전환
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument()
    );
  });

  it.each([
    {
      name: '401(빈 본문)이면 아이디/비밀번호 확인 안내를 표시한다',
      // 본문에 message가 없으면 error.message = 'HTTP 401' → '401' 포함 분기
      respond: () => HttpResponse.json({}, { status: 401 }),
      expected: '아이디 또는 비밀번호를 확인해주세요.',
    },
    {
      name: "서버 message에 'Unauthorized'가 포함되면 해당 메시지를 표시한다",
      respond: () => HttpResponse.json({ message: 'Unauthorized user' }, { status: 400 }),
      expected: 'Unauthorized user',
    },
    {
      name: "서버 message에 'Network'가 포함되면 네트워크 안내를 표시한다",
      respond: () => HttpResponse.json({ message: 'Network request failed' }, { status: 503 }),
      expected: '네트워크 연결을 확인해주세요.',
    },
    {
      name: '그 외 서버 에러 메시지를 표시한다',
      respond: () => HttpResponse.json({ message: '서버 오류' }, { status: 500 }),
      expected: '서버 오류',
    },
    {
      name: 'FastAPI detail을 표시한다',
      respond: () => HttpResponse.json({ detail: '계정이 잠겨 있습니다.' }, { status: 403 }),
      expected: '계정이 잠겨 있습니다.',
    },
  ])('$name', async ({ respond, expected }) => {
    server.use(http.post(loginUrl, respond));
    const { user } = renderLoginPage();
    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).toHaveAttribute('id', 'login-error');
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-describedby', 'login-error');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('aria-describedby', 'login-error');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('네트워크 단절(fetch reject) 시 네트워크 안내를 표시한다', async () => {
    server.use(http.post(loginUrl, () => HttpResponse.error()));
    const { user } = renderLoginPage();
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('네트워크 연결을 확인해주세요.');
  });

  it('로그인 요청 진행 중에는 버튼이 비활성화된다', async () => {
    server.use(
      http.post(loginUrl, async () => {
        await delay(150);
        return successResponse();
      })
    );
    const { user } = renderLoginPage();
    await fillAndSubmit(user);

    await waitFor(() => expect(screen.getByRole('button', { name: '로그인' })).toBeDisabled());
    // 응답 후 정상 완료(이동)까지 확인 — pending 고착이 아님을 보증
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/service'));
  });

  it('재제출 시 이전 에러 메시지를 즉시 지운다', async () => {
    server.use(http.post(loginUrl, () => HttpResponse.json({}, { status: 401 })));
    const { user } = renderLoginPage();
    await fillAndSubmit(user);
    await screen.findByRole('alert');

    // 두 번째 제출은 지연 응답 — 응답 도착 전(setErrorMessage('') 직후)에 에러가 사라져야 한다
    server.use(
      http.post(loginUrl, async () => {
        await delay(150);
        return successResponse();
      })
    );
    await user.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('이미 인증된 상태면 폼을 렌더하지 않는다 (즉시 홈으로 이동)', () => {
    render(<LoginPage />, { auth: 'user', route: '/login', path: '/login' });

    expect(screen.queryByRole('button', { name: '로그인' })).not.toBeInTheDocument();
  });
});
