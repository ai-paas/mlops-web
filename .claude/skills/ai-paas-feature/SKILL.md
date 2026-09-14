---
name: ai-paas-feature
description: AI-PaaS 도메인의 CRUD 기능(목록·상세·생성·수정·삭제)을 기존 도메인과 같은 패턴으로 추가·확장합니다. 새 리소스 페이지, 모달 CRUD 버튼, 목록 Table, 상세 페이지·탭, 라우트·메뉴 등록과 그에 딸린 훅·타입·MSW 핸들러·테스트까지 한 번에 다룰 때 사용하세요.
---

# AI-PaaS CRUD 기능 개발

기준 도메인은 **service**다. 새 도메인은 아래 기준 파일을 본떠 만든다. 이 문서는 코드를 복제하지 않고 기준 파일을 가리킨다. 문서와 코드가 어긋나는 것을 막기 위해서다. 기준 파일이 바뀌면 이 표를 고친다.

| 역할 | 기준 파일 |
|---|---|
| 타입 | `src/types/service.ts`, 목록 봉투 `Page<T>`는 `src/types/api.ts` |
| 쿼리 키 | `src/lib/query-keys.ts` (`queryKeys.services`) |
| 훅 | `src/hooks/service/services.ts` + `services.test.ts` |
| MSW 핸들러 | `src/test/mocks/handlers/services.ts` → `handlers.ts` 배럴 |
| 생성/수정 모달 버튼 | `src/components/features/service/create-service-button.tsx`, `edit-service-button.tsx` |
| 삭제 버튼 | `src/components/features/dataset/delete-dataset-button.tsx`(상세에서 `redirect`), `workflow/delete-workflow-template-button.tsx`(`isPending` 처리) |
| 전체 페이지 폼 | `src/components/features/dataset/dataset-form.tsx`(파일 업로드·Select·`Controller`) |
| 공유 폼 스키마 | `src/components/features/member-management/member-form.ts`. 두 파일 이상이 쓸 때만 |
| 목록 페이지 | `src/pages/service/page.tsx` + `page.test.tsx` |
| 상세 페이지 | `src/pages/service/[id]/page.tsx` |
| 라우트 / 메뉴 | `src/router/router.tsx` / `src/components/layout/menu.tsx` |

## 작업 순서 (의존 순)

1. **타입** `src/types/<domain>.ts`: `Xxx`, `XxxDetail extends Xxx`, `GetXxxsParams { page?; size?; search?; sort? }`, `CreateXxxRequest`, `UpdateXxxRequest`(식별자 포함). 타입만 둔다. 라벨맵·헬퍼 금지.
2. **쿼리 키** `queryKeys.<domain> = { all, list(params = {}), detail(id?) }`. `all`이 무효화 prefix다. 다른 도메인과 첫 세그먼트가 겹치지 않게 한다(`modelProviders`와 `infraProviders`가 갈라진 이유).
3. **훅** `src/hooks/service/<domain>.ts`: `useGetXxxs`, `useGetXxx`, `useCreateXxx`, `useUpdateXxx`, `useDeleteXxx`. 형태는 아래.
4. **MSW 핸들러** 새 도메인의 첫 테스트 전에 추가한다. `onUnhandledRequest: 'error'`라 핸들러 없는 요청은 즉시 실패한다. URL은 `handlers/base.ts`의 `BASE_URL`.
5. **컴포넌트** create/edit/delete 버튼(모달). 입력이 많거나 파일 업로드면 `create/page.tsx` + `<domain>-form.tsx` 전체 페이지 폼.
6. **페이지** 목록·상세.
7. **라우트·메뉴**.
8. **테스트** 훅·버튼·목록 페이지.
9. **검증** `pnpm typecheck` → `pnpm lint` → `pnpm test:coverage`.

## 훅 형태

```ts
// services.ts — 목록. 반환은 이름 붙은 필드, data/mutate를 그대로 노출하지 않는다.
export const useGetServices = (params: GetServicesParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.services.list(params),
    queryFn: () => api.get<Page<Service>>('services/', { searchParams: { ...params } }).json(),
  });
  return {
    services: data?.data ?? [],
    page: { number: data?.page ?? 1, size: data?.size ?? 1, total: data?.total ?? 1 },
    isPending, isError, error,
  };
};
```

- 상세는 `(id?, enabled = true)` 시그니처에 `enabled: enabled && !!id`. 편집 모달은 `useGetXxx(id, isModalOpen && !!id)`로 열릴 때만 조회한다.
- 뮤테이션은 `{ createService: mutate, isPending, isError, error, isSuccess }`. `onSuccess`에서 `queryClient.invalidateQueries({ queryKey: queryKeys.<domain>.all })`만 한다. 토스트·네비게이션은 호출부.
- 훅에 `retry`를 넣지 않는다. 전역 정책(`react-query-provider.tsx`)이 처리한다.

## 모달 CRUD 버튼

- `@innogrid/ui`: `Button`, `Modal`(생성·수정), `AlertDialog`(삭제), `Input`·`Textarea`·`Select`, `useToast`.
- 폼은 `react-hook-form` + `zodResolver`. 스키마는 컴포넌트 파일 상단 `const schema = z.object(...)`, `type Schema = z.infer<typeof schema>`. 두 파일 이상이 공유할 때만 `<domain>-form.ts`로 뺀다.
- 생성: `Modal`에 `action={handleSubmit(onSubmit)}`, `isButtonLoading={isPending}`, `buttonDisabled={isPending}`, `subButton`은 취소 버튼. 닫을 때 `reset(defaultValues)`.
- 수정: 서버 값이 오면 `useEffect`에서 `reset(...)`. 트리거 버튼은 `disabled={!id}`.
- 삭제: `AlertDialog`. 버튼 `disabled={!id || isPending}`, `confirmButtonText={isPending ? '삭제 중...' : '확인'}`. 상세 페이지에서 쓰면 `redirect`(또는 `onDeleted`) prop으로 목록으로 보낸다.
- 토스트는 버튼 로컬이다.

```ts
onSuccess: () => {
  toast.open({ status: 'positive', title: '서비스 생성 성공', children: '서비스가 성공적으로 생성되었습니다.' });
  closeModal();
},
onError: (error) => {
  toast.open({
    status: 'negative',
    title: '서비스 생성 실패',
    children: getServerErrorMessage(error, '서비스 생성 중 오류가 발생했습니다.'),
  });
},
```

- 필드 마크업: 라벨 `page-input_item-name`(필수는 `page-icon-requisite` 추가), 값 `page-input_item-data`. `Input`의 `errMessage={errors.x?.message}`.
- 숫자 필드는 `type="number"` + 단위에 맞는 `step`(소수 필드 필수) + `min`.

## 목록 페이지

- `@innogrid/ui` `Table` + `useTablePagination` + `useTableSelection` + `useSearchInputState`/`SearchInput` + `BreadCrumb`. 정렬은 `useState<SortValue[]>`.
- 서버 페이지네이션 파라미터: `page: pagination.pageIndex + 1`, `size`, `search`, `sort`(`-` 접두 DESC, `,`로 결합). 검색어가 바뀌면 `initializePagination()`.
- 단일 선택만 허용한다. `rowSelection` 키가 1개일 때만 `selectedId`를 계산해 편집·삭제 버튼에 넘긴다.
- 쿼리 실패는 `emptyMessage`에 인라인으로 보인다. 토스트를 띄우지 않는다.
- 골격 클래스: `breadcrumbBox`, `page-title-box`/`page-title`, `page-content`, `page-toolBox`/`page-toolBox-btns`. Table 래퍼 높이는 `h-[481px]`.
- 이름 컬럼은 `<Link to={`/<domain>/${id}`} className="table-td-link">`.

## 상세 페이지

`useParams()` → `useGetXxx(id)`. `BreadCrumb`에 `onNavigate={navigate}`. 상단에 편집·삭제 버튼. 값 목록은 `page-detail-list-box` > `page-detail-list`(ul 최대 3개, li 5개), 각 값은 `DetailValue isLoading width`. 하위 목록은 `Tabs labels components`.

## 라우트·메뉴

- `router.tsx`: `const XxxPage = lazy(() => import('@/pages/xxx/page'))` 후 children에 `xxx`, `xxx/:id`, `xxx/create`. 관리자 전용은 `AdminRoute` 하위에 둔다.
- `menu.tsx`에 메뉴 항목을 추가한다.

## 테스트 (필수)

- 훅: `renderHook(() => useGetXxxs(), { wrapper: createHookWrapper() })`. 무효화 검증은 `createTestQueryClient({ gcTime: Infinity })`로 시드 후 `getQueryState().isInvalidated` 단언(`models.test.ts`).
- 버튼: `import '@/test/mocks/innogrid-ui'`(경량 목) + `render`/`renderWithUser`. 토스트는 `toastOpenSpy`로, 실패 경로는 `server.use()`로 500 오버라이드. 기준 `create-service-button.test.tsx`, `delete-service-button.test.tsx`.
- 목록 페이지: `@/test/utils/list-page`의 `renderListPage`, `createPagedListHandler`로 요청 파라미터를 단언한다. 기준 `pages/service/page.test.tsx`.
- 실브라우저 좌표가 필요한 여정만 E2E(`e2e/smoke.spec.ts` 복제).

## 체크리스트

- [ ] `src/types`에 런타임 값 없음
- [ ] `queryKeys` 팩토리 사용, 인라인 키 없음
- [ ] 훅 반환은 이름 붙은 필드, 훅 안에 retry·토스트·navigate 없음
- [ ] 토스트는 버튼 로컬, 실패 본문은 `getServerErrorMessage`
- [ ] MSW 핸들러 + 훅·버튼·페이지 테스트
- [ ] 라우트 `lazy` + 메뉴
- [ ] `infra-management` 영역은 건드리지 않았다
- [ ] `pnpm typecheck` → `pnpm lint` → `pnpm test:coverage` 통과
