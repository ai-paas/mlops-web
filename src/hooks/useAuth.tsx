import {
  getAccessToken,
  getOrCreateRefreshPromise,
  setAccessToken as setApiAccessToken,
  subscribeAccessToken,
} from '@/lib/api';
import { useLogout } from '@/hooks/service/authentication';
import { parseJwt } from '@/util/jwt';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

interface AuthContext {
  accessToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  setAccessToken: (token: string | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContext | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // 토큰의 원본은 lib/api의 메모리 하나다. 컨텍스트는 구독으로 따라가는 미러라서
  // ky 훅 안에서 일어나는 refresh 성공(새 토큰)·실패(null → 레이아웃 가드가 /login으로 보냄)가
  // 별도 배선 없이 인증 상태에 반영된다.
  const accessToken = useSyncExternalStore(subscribeAccessToken, getAccessToken);
  const [isLoading, setIsLoading] = useState(!accessToken);
  const queryClient = useQueryClient();
  const { mutateAsync: requestLogout } = useLogout();

  const isAdmin = useMemo(() => {
    return accessToken ? parseJwt(accessToken)?.role === 'admin' : false;
  }, [accessToken]);

  const logout = useCallback(async () => {
    // 서버의 리프레시 토큰을 먼저 무효화하고(Authorization 헤더에 토큰 필요),
    // 응답과 무관하게 로컬 토큰·캐시를 정리한다 — 요청이 실패해도 클라이언트는 로그아웃된다.
    try {
      await requestLogout();
    } catch {
      // 서버 무효화 실패는 무시
    }
    setApiAccessToken(null);
    queryClient.clear();
  }, [requestLogout, queryClient]);

  useEffect(() => {
    const init = async () => {
      if (!getAccessToken()) {
        try {
          // 성공 시 새 토큰은 lib/api가 메모리에 쓰고 구독으로 반영된다
          await getOrCreateRefreshPromise();
        } catch {
          // 실패 시 lib/api가 메모리를 비운 상태(null) 그대로 — 비인증으로 로딩만 끝낸다
        }
      }
      setIsLoading(false);
    };

    init();
  }, []);

  const value = useMemo(
    () => ({
      accessToken,
      isAuthenticated: !!accessToken,
      isAdmin,
      isLoading,
      setAccessToken: setApiAccessToken,
      logout,
    }),
    [accessToken, isAdmin, isLoading, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext<AuthContext | null>(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
