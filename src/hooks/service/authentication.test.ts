import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createHookWrapper } from '@/test/utils/test-utils';
import { setAccessToken } from '@/lib/api';
import { useLogin, useLogout } from './authentication';

const wrapper = createHookWrapper();

describe('useLogout', () => {
  it('액세스 토큰을 Authorization 헤더에 담아 POST /auth/logout 을 호출한다', async () => {
    let authHeader: string | null = null;
    server.use(
      http.post(`${BASE_URL}/auth/logout`, ({ request }) => {
        authHeader = request.headers.get('Authorization');
        return new HttpResponse(null, { status: 204 });
      })
    );
    setAccessToken('test-token');

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(authHeader).toBe('Bearer test-token');
  });

  it('액세스 토큰이 만료(401)돼도 refresh 후 새 토큰으로 재시도해 서버 무효화를 완료한다', async () => {
    // 장시간 대기 후 로그아웃하는 시나리오 — 여기서 401로 끝나면 리프레시 토큰이 살아남아
    // 새로고침 시 자동 재로그인된다(로그아웃 무력화). useLogout이 raw fetch가 아닌 ky를 쓰는 이유.
    const authHeaders: (string | null)[] = [];
    server.use(
      http.post(`${BASE_URL}/auth/logout`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        authHeaders.push(authHeader);
        if (authHeader === 'Bearer expired-token') {
          return HttpResponse.json({ detail: 'Token expired' }, { status: 401 });
        }
        return new HttpResponse(null, { status: 204 });
      })
    );
    setAccessToken('expired-token');

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    // 만료 토큰으로 1회 → refresh(기본 핸들러가 test-access-token 발급) → 새 토큰으로 재시도
    expect(authHeaders).toEqual(['Bearer expired-token', 'Bearer test-access-token']);
  });

  it('서버 에러 시 isError 가 true 가 된다', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/logout`, () =>
        HttpResponse.json({ message: 'error' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useLogout(), { wrapper });
    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toContain('500');
  });
});

describe('useLogin', () => {
  // useLogin은 ky(api)가 아닌 raw fetch를 쓴다 — 토큰이 없는 상태에서
  // beforeRequest의 refresh 선행 호출 없이 곧바로 /auth/login에 도달해야 하기 때문.
  it('자격 증명을 JSON 본문으로 보내고 토큰 응답을 반환한다', async () => {
    let capturedBody: unknown;
    let contentType: string | null = null;
    server.use(
      http.post(`${BASE_URL}/auth/login`, async ({ request }) => {
        capturedBody = await request.json();
        contentType = request.headers.get('Content-Type');
        return HttpResponse.json({
          access_token: 'login-access-token',
          token_type: 'bearer',
          expires_in: 3600,
        });
      })
    );

    const { result } = renderHook(() => useLogin(), { wrapper });
    const response = await result.current.mutateAsync({
      member_id: 'user-a',
      password: 'Password1!',
    });

    expect(capturedBody).toEqual({ member_id: 'user-a', password: 'Password1!' });
    expect(contentType).toBe('application/json');
    expect(response.access_token).toBe('login-access-token');
    expect(response.token_type).toBe('bearer');
  });

  it('에러 응답의 message를 에러 메시지로 사용한다', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/login`, () =>
        HttpResponse.json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
      )
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(
      result.current.mutateAsync({ member_id: 'user-a', password: 'wrong' })
    ).rejects.toThrow('아이디 또는 비밀번호가 올바르지 않습니다.');
  });

  it('에러 본문이 JSON이 아니면 HTTP 상태 코드 메시지로 폴백한다', async () => {
    server.use(
      http.post(
        `${BASE_URL}/auth/login`,
        () => new HttpResponse('Internal Server Error', { status: 500 })
      )
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(
      result.current.mutateAsync({ member_id: 'user-a', password: 'Password1!' })
    ).rejects.toThrow('HTTP 500');
  });

  it('FastAPI 에러 응답의 detail을 에러 메시지로 사용한다', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/login`, () =>
        HttpResponse.json({ detail: '계정이 잠겨 있습니다.' }, { status: 401 })
      )
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(
      result.current.mutateAsync({ member_id: 'user-a', password: 'wrong' })
    ).rejects.toThrow('계정이 잠겨 있습니다.');
  });

  it('FastAPI 검증 오류의 detail 메시지 목록을 표시 가능한 문자열로 변환한다', async () => {
    server.use(
      http.post(`${BASE_URL}/auth/login`, () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ['body', 'member_id'], msg: 'Field required', type: 'missing' },
              { loc: ['body', 'password'], msg: 'Field required', type: 'missing' },
            ],
          },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useLogin(), { wrapper });

    await expect(result.current.mutateAsync({ member_id: '', password: '' })).rejects.toThrow(
      'Field required, Field required'
    );
  });
});
