---
name: api-integration
description: 백엔드 REST API를 React Query 훅으로 연결합니다. 새 엔드포인트(GET/POST/PUT/DELETE) 훅 작성, 쿼리 키·캐시 무효화·조건부 조회·폴링, SSE 스트림 구독, 응답 타입 정의, 에러 표시 규칙, MSW 핸들러와 훅 테스트가 필요할 때 사용하세요. ky + TanStack Query v5.
---

# API 연동

기준 파일: `src/lib/api.ts`, `src/lib/query-keys.ts`, `src/components/provider/react-query-provider.tsx`, `src/hooks/service/services.ts`(+ `.test.ts`). 코드 예시는 최소로 두고 나머지는 기준 파일을 본다.

## 클라이언트 (`src/lib/api.ts`)

- `api = ky.create({ prefixUrl: '/api/v1', timeout: 30_000, retry: 0 })`. 경로는 선행 슬래시 없이 `'services/'`, `` `services/${id}` ``.
- **재시도는 ky가 아니라 React Query 한 곳**에서 한다. ky retry를 켜면 요청이 최대 9회로 늘어난다.
- 401이면 `afterResponse` 훅이 리프레시 토큰으로 갱신하고 원 요청을 재시도한다. 훅·컴포넌트에서 401을 따로 처리하지 않는다.
- `beforeError`가 응답 본문의 `detail`을 뽑아 둔다. 사용자에게 보일 문구는 항상 `getServerErrorMessage(error, '기본 문구')`로 만든다(타임아웃·네트워크 단절 문구도 여기서 처리).
- 오래 걸리는 요청(대용량 업로드)만 호출부에서 `timeout: false`로 개별 확대한다.
- 토큰의 원본은 이 파일의 메모리 하나다(`getAccessToken`/`setAccessToken`/`subscribeAccessToken`). `AuthProvider`는 구독 미러다.

## 전역 정책 (`react-query-provider.tsx`)

- 쿼리: `staleTime` 5분, `gcTime` 30분, `retry: shouldRetryQuery`(4xx·타임아웃은 재시도 없음, 5xx·네트워크만 최대 2회 지수 백오프), `refetchOnWindowFocus: false`.
- 뮤테이션: `retry: false`. POST 중복 생성 위험 때문이다.
- `QueryCache`/`MutationCache` `onError`는 로깅만 한다. **전역 토스트 금지.** 쿼리 실패는 페이지 인라인, 뮤테이션 결과는 호출부 로컬 토스트.

## 훅 규칙 (`src/hooks/service/<domain>.ts`)

- 모든 API 호출은 `use*` 훅이다. 상태를 안 써도 일반 함수로 만들지 않는다. 여러 단계 흐름(로그아웃 등)은 컨텍스트 훅(`useAuth`)이 `mutateAsync`로 서비스 훅을 조합한다.
- 반환은 이름 붙은 필드다.

```ts
// 목록: { services, page: { number, size, total }, isPending, isError, error }
// 상세: (id?, enabled = true) → { service, isPending, isError, error }, enabled: enabled && !!id
// 뮤테이션: { createService: mutate, isPending, isError, error, isSuccess }
export const useDeleteService = () => {
  const queryClient = useQueryClient();
  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: async (surro_service_id: string) => {
      await api.delete(`services/${surro_service_id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.services.all }),
  });
  return { deleteService: mutate, isPending, isError, error, isSuccess };
};
```

- 응답 타입은 `api.get(...).json<T>()` 또는 `api.get<T>(...).json()` 중 파일 내 기존 방식을 따른다.
- 폴링은 `refetchInterval`에 함수를 넘겨 상태에 따라 끈다(`useGetWorkflowStatus`: 배포 중이면 7000, 아니면 `false`). 폴링 여부는 옵션 인자로 받는다.
- 낙관적 업데이트는 현재 쓰지 않는다. 필요하면 `onMutate`/`onError` 롤백/`onSettled` 무효화 세트를 갖추고 테스트를 붙인다.

## 쿼리 키 (`src/lib/query-keys.ts`)

- 도메인마다 `all`(무효화 prefix), `list(params = {})`, `detail(id?)`. 하위 리소스는 `detail(id)` 뒤에 세그먼트를 붙여 상세 무효화가 함께 덮게 한다(`knowledgeBases.files`, `vms.operations`).
- 중첩 도메인은 객체로 둔다(`workflows.templates.{all,list,detail}`).
- prefix 충돌 주의: 다른 도메인 무효화에 휩쓸릴 키는 별도 세그먼트를 쓴다(`kubernetes.podsBySelector`가 `pods`와 갈라진 이유, `infraProviders`가 `providers`와 갈라진 이유).
- 파라미터 타입은 `src/types/<domain>.ts`에서 `import type`으로 가져온다. 키 파일에 타입 정의를 늘리지 않는다.

## SSE (`src/lib/sse.ts`)

- `subscribeSse(path, { signal, onMessage, onOpen?, onClose?, onError? })`. 인증 헤더·재연결(1s→15s 백오프)·401 처리를 내부에서 한다.
- 훅 패턴은 `src/hooks/service/operation-events.ts`: `useEffect` 안에서 `AbortController` 생성 → 구독 → cleanup에서 `abort()`. 종료 이벤트를 받으면 스스로 `abort()`. 이벤트 누적은 상한(`maxLogs`)을 둔다. 관련 쿼리는 종료 시 `invalidateQueries`.
- 프로비저닝 진행률 표시는 SSE, 배포 상태처럼 종료가 명확하지 않은 것은 `refetchInterval` 폴링.

## 타입 (`src/types/<domain>.ts`)

- 타입·인터페이스만. 상수·라벨맵·헬퍼는 사용처 파일 로컬 상수.
- 이름 규칙: `Xxx`, `XxxDetail`, `GetXxxsParams`, `CreateXxxRequest`, `UpdateXxxRequest`, `XxxResponse`. 목록 봉투는 `Page<T>`(`src/types/api.ts`). 봉투가 다르면(`{ total, items }` 등) 도메인 타입에 따로 정의한다.
- 백엔드 필드명은 snake_case 그대로 쓴다. 프론트에서 camelCase로 바꾸지 않는다.

## 테스트

- 새 도메인은 `src/test/mocks/handlers/<domain>.ts`부터. `BASE_URL` 사용, 목 데이터는 `export const mockXxxs: Xxx[]`. `handlers.ts` 배럴에 등록.
- 훅 테스트: `renderHook(() => useGetXxxs(), { wrapper: createHookWrapper() })` → `waitFor(() => expect(result.current.isPending).toBe(false))`.
- 무효화 검증: `createTestQueryClient({ gcTime: Infinity })`로 클라이언트를 만들어 `setQueryData` 시드 → 뮤테이션 → `getQueryState(key)?.isInvalidated` 단언(`models.test.ts`). 기본 `gcTime 0`은 옵저버 없는 시드를 즉시 GC한다.
- 에러 경로: `server.use(http.post(`${BASE_URL}/...`, () => HttpResponse.json({ detail: '...' }, { status: 500 })))`. `HttpResponse.json()` 인자는 `unknown` 말고 `Record<string, unknown>` 등 JSON 호환 타입.
- "호출되지 않았다" 검증은 핸들러 안에서 `requestSpy()`를 부르고 `expect(requestSpy).not.toHaveBeenCalled()`.

## 체크리스트

- [ ] `use*` 훅, 반환은 이름 붙은 필드
- [ ] `queryKeys` 팩토리 항목 추가, 인라인 키 없음, prefix 충돌 없음
- [ ] 훅 안에 retry·토스트·navigate·401 처리 없음
- [ ] 뮤테이션 `onSuccess` 무효화는 `.all`(또는 정확한 하위 prefix)
- [ ] 타입만 `src/types`, 파라미터 타입은 `import type`
- [ ] MSW 핸들러 + 훅 테스트(성공·실패·무효화)
- [ ] 인프라 훅(clusters·vms·helm·catalog·addons·observability·operations·providers·credentials·audit-logs·agents)은 보류 영역
- [ ] `pnpm typecheck` → `pnpm lint` → 관련 테스트 통과
