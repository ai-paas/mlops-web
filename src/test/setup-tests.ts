import '@testing-library/jest-dom/vitest';
// vitest-axe 매처(toHaveNoViolations) + vitest 타입 확장 — 접근성 스모크(TEST_PLAN 3D)
import 'vitest-axe/extend-expect';
import { configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { clearAccessToken } from '@/lib/api';
import { server } from './mocks/server';

// waitFor 기본 1s는 커버리지 계측 + 병렬 실행 부하에서 간헐 타임아웃을 일으킨다
// (성공 테스트는 조건 충족 즉시 통과하므로 상향해도 정상 케이스는 느려지지 않는다)
// router.test.tsx처럼 모든 페이지를 lazy로 불러오는 테스트는 vite 트랜스폼 경합에
// 그대로 노출되어(단독 0.3s가 부하 중 5s 초과) 10s까지 올렸다.
configure({ asyncUtilTimeout: 10000 });

// jsdom 환경의 fetch/Request는 Node(undici) 구현이라 브라우저와 달리 상대 URL을
// 해석하지 못한다. 앱 코드(ky prefixUrl '/api/v1', refresh fetch)는 상대 경로를
// 쓰므로 location(http://localhost:3000) 기준으로 절대화해 MSW 핸들러에 도달시킨다.
const toAbsoluteUrl = <T extends RequestInfo | URL>(input: T): T =>
  typeof input === 'string' && input.startsWith('/')
    ? (new URL(input, window.location.href).toString() as T)
    : input;

const OriginalRequest = globalThis.Request;
globalThis.Request = class extends OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(toAbsoluteUrl(input), init);
  }
} as typeof Request;

const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => originalFetch(toAbsoluteUrl(input), init);

// jsdom에 없는 브라우저 API 최소 스텁.
// @innogrid/ui(차트 모듈이 import 시점에 matchMedia 호출)와 Radix 계열이 요구한다.
// XyFlow 캔버스용 스텁(DOMMatrixReadOnly, getBBox 등)은 무겁고 영향 범위가 넓어
// 전역이 아닌 src/test/utils/xyflow-stubs.ts opt-in 헬퍼로 제공한다.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList;
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// MSW 서버 설정 (위 패치 이후에 listen해야 인터셉터가 패치된 fetch를 감싼다)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// RTL cleanup은 vitest globals(afterEach) 감지로 자동 수행되므로 수동 호출 불필요
afterEach(() => {
  server.resetHandlers();
  // src/lib/api.ts의 모듈 스코프 토큰이 테스트 간 누출되지 않도록 리셋
  // (첫 테스트에서 캐시된 토큰이 이후 테스트의 refresh 경로를 건너뛰게 만드는 순서 의존 제거)
  clearAccessToken();
});
afterAll(() => server.close());
