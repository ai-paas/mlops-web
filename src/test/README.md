# 테스트 작성 가이드

> **신규 훅·CRUD 버튼/폼 컴포넌트·순수 함수는 테스트를 동반한다** (PR 템플릿 체크 항목).
> 프로젝트 전반 규칙은 루트의 [CLAUDE.md](../../CLAUDE.md) 참고.

## 실행

```bash
pnpm test            # watch 모드
pnpm test:coverage   # 커버리지 + 임계값 게이트 (CI가 실행하는 명령)
```

- 타임존은 `Asia/Seoul`로 고정되어 있다 (vitest.config.ts `test.env.TZ`) — 날짜 기대값을 로컬 TZ에 의존해도 CI와 동일.
- 커버리지 임계값은 **래칫**: 커버리지가 오르면 vitest.config.ts의 thresholds도 올린다. 내리는 변경은 금지.

## 렌더 헬퍼 (`@/test/utils/test-utils`)

```tsx
import { render, renderWithUser, screen, waitFor } from '@/test/utils/test-utils';

// 기본: QueryClient + MemoryRouter 래핑, queryClient 반환 (캐시 무효화 검증용)
const { queryClient } = render(<MyComponent />);

// 상호작용 테스트 기본형 — userEvent.setup() 포함
const { user } = renderWithUser(<MyComponent />);
await user.click(screen.getByRole('button', { name: '생성' }));

// URL 파라미터 페이지 (useParams)
render(<ServiceDetailPage />, { route: '/service/srv-001', path: '/service/:id' });

// useAuth를 쓰는 컴포넌트 (layout, dashboard, menu 등) — 렌더 전에 role 토큰 주입
render(<DashboardPage />, { auth: 'admin' });  // 'user' | 'admin' | { token }
```

- 훅 테스트는 `renderHook(() => useMyHook(), { wrapper: createHookWrapper() })`.
- `makeTestJwt({ role: 'admin' })`로 `parseJwt` 호환 토큰을 직접 만들 수 있다 (payload는 ASCII만).
- **캐시 무효화 검증**(setQueryData 시드 → `getQueryState().isInvalidated` 단언)은
  `createTestQueryClient({ gcTime: Infinity })` 필수 — 기본(0)은 옵저버 없는 시드 캐시를 즉시 GC한다.
  패턴은 `src/hooks/service/models.test.ts` 참고.

## MSW (API 목킹)

- 핸들러는 `src/test/mocks/handlers/<도메인>.ts`로 분리하고 `handlers.ts` 배럴에 합친다.
- URL은 반드시 `handlers/base.ts`의 `BASE_URL` 사용 — 하드코딩 금지.
- `onUnhandledRequest: 'error'` — **핸들러 없는 도메인의 요청은 테스트가 즉시 실패한다.**
  새 도메인 테스트 전에 핸들러부터 추가할 것 (`/auth/refresh`는 이미 있음 — AuthProvider가 항상 호출).
- 개별 테스트에서 에러 응답 등 오버라이드:

```ts
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';

const requestSpy = vi.fn(); // "호출되지 않았다" 검증에 사용
server.use(
  http.post(`${BASE_URL}/services`, () => {
    requestSpy();
    return HttpResponse.json({ message: 'error' }, { status: 500 });
  })
);
```

## @innogrid/ui — 실제 렌더 vs 경량 목

실제 컴포넌트가 jsdom에서 동작한다 (`server.deps.inline` + 전역 스텁, `innogrid-ui-smoke.test.tsx`가 보증). 선택 기준:

| 상황 | 선택 |
|---|---|
| 페이지/Table/Select/SearchInput 등 실제 동작 검증 | **실제 렌더** + `installDomMeasurementStubs()` (가상화 테이블·Tooltip이 크기 측정에 의존) |
| CRUD 버튼·폼처럼 Modal/Input 골격만 필요 | **경량 목**: `import '@/test/mocks/innogrid-ui';` (사이드이펙트 import — 빠짐 주의) |

- 목 import를 빠뜨리면 실제 라이브러리가 로드되어 원인 파악이 어려운 방식으로 실패할 수 있다.
- 목에 없는 export를 쓰는 컴포넌트를 렌더하면 undefined 렌더 에러 — 목을 확장하거나 실제 렌더로 전환.
- 토스트 내용 단언은 목이 export하는 `toastOpenSpy` 사용:
  `import { toastOpenSpy } from '@/test/mocks/innogrid-ui';` (사이드이펙트 import 겸용).

### 목록 페이지 (Table + SearchInput 패턴)

`@/test/utils/list-page` 헬퍼 사용 — 기준 예시는 `src/pages/service/page.test.tsx`.

- `renderListPage`(ToastProvider 포함 실제 렌더), `searchListFor`, `goToNextPage`,
  `getPageIndexInput`, `toggleRowSelection`, `toggleSelectAll`
- `createPagedListHandler(path, items, options?)`: page/size/search/sort를 서버처럼 처리하는
  MSW 핸들러 + 요청 파라미터 캡처(`lastParams`). Table이 manualSorting/manualPagination이라
  정렬·검색·페이지 이동 검증은 "요청 파라미터 단언"으로 한다. 봉투가 `Page<T>`가 아니면
  `envelope` 옵션 사용(템플릿 목록의 `{ total, items }` 등).
- 가상화 주의: 한 페이지에서 앞쪽 6행 정도만 DOM에 렌더된다 — 행 단언·선택은 앞쪽 행으로.
- 체크박스 개별 클릭은 선택을 **교체**한다(행 클릭 핸들러 버블링) — 다중 선택 상태는
  `toggleSelectAll`로만 만들 수 있다.

## 자주 쓰는 패턴

```ts
// react-router 부분 목 (useNavigate 검증)
const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));
```

- 테스트명은 한국어, `describe`로 섹션 구분 (기존 `create-service-button.test.tsx` 참고).
- `clearMocks: true` 전역 설정 — `beforeEach(vi.clearAllMocks)` 불필요.

## 접근성 스모크 (vitest-axe)

```ts
import { axe } from 'vitest-axe';

// color-contrast는 jsdom(canvas 미구현)에서 판정 불가 — 항상 제외
const results = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
expect(results).toHaveNoViolations(); // 매처는 setup-tests가 전역 등록
```

- **실제 @innogrid/ui로 렌더할 것** — 경량 목의 마크업을 검사하는 것은 무의미.
  로그인처럼 기존 테스트 파일이 목을 쓰면 a11y만 별도 파일로 분리 (`page.a11y.test.tsx`).
- Table을 쓰는 목록 페이지는 업스트림 위반 3종(button-name/label/select-name)이 항상 나온다 —
  `src/pages/service/page.test.tsx`의 특성화 패턴(위반 id 집합 + 노드 allowlist)을 복제할 것.

## 상태 리셋 (전역 싱글턴 오염 방지)

- **api.ts 토큰**: setup-tests.ts의 afterEach가 `clearAccessToken()` 자동 호출. `@/lib/api`를 `vi.mock`할 경우 `clearAccessToken` export를 반드시 유지할 것 (setup이 호출한다).
- **useWorkflowStore**: 스토어를 쓰는 테스트 파일은 `beforeEach(() => resetWorkflowStore())` (`@/test/utils/reset-workflow-store`). test-utils에 넣지 않은 이유: @xyflow/react 로딩 비용 격리.

## jsdom 한계와 스텁

- 전역 스텁(setup-tests.ts): `matchMedia`, `ResizeObserver`.
- 크기 측정(가상화 테이블 등): `installDomMeasurementStubs()` — opt-in.
- XyFlow 캔버스: `installXyflowStubs()` — opt-in. **드래그·엣지 연결·팬·줌은 jsdom으로 불가** — E2E 영역 (아래 참고).
- `navigator.clipboard`, `URL.createObjectURL`, Monaco, WebSocket(xterm)도 jsdom 미지원 — 개별 스텁 또는 E2E.

## E2E (Playwright — `e2e/`)

- 실행: `pnpm test:e2e` (헤디드 디버깅: `pnpm test:e2e:ui`). vite dev 서버(포트 4173)를 자동 기동한다.
- **허메틱 모드**: 모든 `/api/v1` 요청을 `e2e/support/api-mocks.ts`의 `mockApi(page)`가 가로챈다 — 백엔드 불필요. 목킹 밖 요청은 500으로 실패하고 `unmockedRequests`에 기록되므로 테스트 끝에 `expect(api.unmockedRequests).toEqual([])`로 단언할 것 (MSW `onUnhandledRequest: 'error'`와 같은 규약).
- 새 여정을 추가할 때는 `e2e/smoke.spec.ts`를 템플릿으로 복제하고, 필요한 엔드포인트를 `api-mocks.ts`에 증분 추가한다. 응답 형태는 `src/types`를 type-only import해 맞춘다.
- jsdom 스위트와 역할 분담: 세부 분기·에러 경로는 vitest(빠름), **실브라우저 좌표·드래그가 필요한 여정만** E2E로.
