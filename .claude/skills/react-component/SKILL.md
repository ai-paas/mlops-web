---
name: react-component
description: React 컴포넌트를 생성하거나 리팩토링합니다. CRUD 모달 버튼, react-hook-form + zod 폼, 목록·상세 페이지 조각, 탭, 레이아웃 요소를 @innogrid/ui·Tailwind v4·SCSS 모듈로 이 프로젝트 패턴에 맞게 만들 때 사용하세요.
---

# React 컴포넌트

React 18 + TypeScript strict. UI 킷은 사내 `@innogrid/ui`, 스타일은 Tailwind v4(`@tailwindcss/vite`)와 SCSS 모듈. 코드 예시는 기준 파일을 본다.

| 만들 것 | 기준 파일 |
|---|---|
| 생성/수정 모달 버튼 | `src/components/features/service/create-service-button.tsx`, `edit-service-button.tsx` |
| 삭제 확인 버튼 | `src/components/features/dataset/delete-dataset-button.tsx` |
| 전체 페이지 폼(파일 업로드·Select) | `src/components/features/dataset/dataset-form.tsx` |
| 목록 페이지 / 상세 페이지 | `src/pages/service/page.tsx` / `src/pages/service/[id]/page.tsx` |
| 상세 값 스켈레톤 | `src/components/ui/detail-value.tsx` |
| 도메인 무관 UI(Radix 래퍼) | `src/components/ui/accordion.tsx`, `collapsible.tsx` |
| 레이아웃 | `src/components/layout/header.tsx`(+ `header.module.scss`), `sidebar.tsx`, `menu.tsx`, `error-boundary.tsx` |

## 어디에 두나

- `src/components/features/<domain>/`: 도메인 컴포넌트. CRUD 버튼은 `create/edit/delete-<domain>-button.tsx`, 상세 탭은 `<x>-tab.tsx`, 폼은 `<domain>-form.tsx`.
- `src/components/ui/`: 도메인 무관이고 **사용처가 2곳 이상**일 때만. 1곳이면 사용처 파일 안에 정의한다(예: 라우터의 `PageLoading`은 `router.tsx` 안).
- `src/pages/<domain>/`: 라우트 컴포넌트만(`export default function XxxPage`). 로직은 훅·features로.
- 파일명 kebab-case, 컴포넌트는 named export. 테스트는 같은 폴더 `.test.tsx`.

## `@innogrid/ui` 먼저

직접 구현 전에 `node_modules/@innogrid/ui/dist/main.d.ts`의 export와 `src` 내 기존 사용처를 확인한다. 자주 쓰는 것: `Button`(`size`/`color`), `Modal`, `AlertDialog`, `Input`(`errMessage`), `Textarea`, `Select`, `FileDrop`, `Table` + `useTablePagination`/`useTableSelection`/`HeaderCheckbox`/`CellCheckbox`, `SearchInput` + `useSearchInputState`, `BreadCrumb`, `Tabs`, `DropdownMenu`(트리거를 children으로, `menus` 배열), `useToast`, 차트류.

- fixed 헤더(z-index 1) 위에 뜨는 `DropdownMenu`/팝오버 콘텐츠는 `zIndex={1000}`을 넘긴다. 기본값 `auto`는 가려진다.
- 결함을 발견하면 `pnpm patch`로 막지 않는다. 이 앱에서 실제로 그 경로를 쓰는지 확인하고 업스트림(사내 UI팀)에 제보한다.
- Radix 프리미티브는 `@innogrid/ui`에 없는 것(accordion, collapsible, popover)만 `src/components/ui/`에서 래핑해 쓴다.

## 스타일링

- Tailwind 유틸리티 우선. 조건부 결합은 `cn()`(`src/lib/utils.ts`, clsx + tailwind-merge). prettier-plugin-tailwindcss가 클래스 순서를 정리한다.
- 페이지 골격은 전역 클래스(`src/assets/style/common/common.scss`): `breadcrumbBox`, `page-title-box`/`page-title`, `page-content`, `page-toolBox`/`page-toolBox-btns`, `page-detail-list-box`/`page-detail-list`, `page-input_item-name`(필수 `page-icon-requisite`)/`page-input_item-data`, `table-td-link`. 기존 페이지와 같은 구조를 유지한다.
- 레이아웃이 복잡하면 `*.module.scss`. `variable`·`mixin`은 vite `additionalData`로 자동 주입되므로 `@use` 없이 바로 쓴다.
- 색·간격 하드코딩보다 Tailwind 토큰. 캔버스 전용 CSS는 `src/components/ui/flow-chart.css`.

## 폼

- `react-hook-form` + `zodResolver`. 스키마와 `type Schema = z.infer<typeof schema>`는 컴포넌트 파일 상단. 두 파일 이상이 공유할 때만 `<domain>-form.ts`로 뺀다(`member-form.ts`).
- 텍스트 입력은 `{...register('name')}` + `errMessage={errors.name?.message}`. `Select`·`FileDrop` 같은 비네이티브 입력은 `Controller`.
- `Textarea`는 `watch()` 값을 `value`로 넘기는 기존 패턴을 따른다(제어 컴포넌트).
- 숫자 필드는 `type="number"`에 필드 단위의 `step`(학습률 0.01, weight decay 0.0001 같은 소수 필드는 필수)과 `min`.
- 모달 폼은 닫을 때 `reset(defaultValues)`. 제출 중은 `isButtonLoading`/`buttonDisabled`.
- 라벨 매핑(`DATASET_KIND_LABELS`)은 파일 상단 `Record<string, string>` 로컬 상수, 조회는 `LABELS[value] ?? value`.

## 상태·데이터

- 서버 상태는 `src/hooks/service` 훅으로만. 컴포넌트에서 `api`를 직접 호출하지 않고, 서버 데이터를 zustand에 복제하지 않는다.
- 로컬 UI 상태는 `useState`. zustand는 워크플로우 캔버스(`useWorkflowStore`) 전용.
- 뮤테이션 결과 토스트는 컴포넌트 로컬 `useToast`. 성공 `title: '<대상> <동작> 성공'`, 실패 `children: getServerErrorMessage(error, '기본 문구')`. 전역 토스트 금지.
- 쿼리 실패는 인라인으로(Table `emptyMessage`, 상세는 스켈레톤 유지 + 안내 문구). 페이지 진입 시 토스트 금지.
- 인증은 `useAuth()`(`isAuthenticated`, `isAdmin`, `logout`). 관리자 전용 UI는 `isAdmin`으로 분기하고 라우트는 `AdminRoute`.

## 성능·접근성

- 페이지는 `router.tsx`에서 전부 `lazy`. 새 페이지도 같은 방식. 무거운 라이브러리(Monaco, xterm)는 그 컴포넌트 안에서만 import.
- 목록 컬럼 정의는 모듈 스코프 상수, 파생 값은 `useMemo`. `React.memo`는 캔버스 노드처럼 리렌더가 실측된 곳에만.
- 아이콘만 있는 버튼은 `aria-label` 또는 `sr-only` 텍스트. 토글 버튼은 `aria-pressed`. 삭제 같은 위험 동작은 `AlertDialog` 확인.

## 테스트

- CRUD 버튼·폼: `import '@/test/mocks/innogrid-ui'`(경량 목, 사이드이펙트 import) + `render`/`renderWithUser`(`@/test/utils/test-utils`). 토스트는 `toastOpenSpy`.
- Table·Select·SearchInput 실제 동작: 실제 `@innogrid/ui` 렌더 + `installDomMeasurementStubs()`. 목록 페이지는 `@/test/utils/list-page` 헬퍼.
- `useNavigate` 검증은 `vi.mock('react-router', ...)` 부분 목(`delete-service-button.test.tsx`).
- 접근성 스모크는 `vitest-axe`, 실제 렌더로만(`color-contrast` 제외).
- 순수 함수는 컴포넌트 파일에서 `export`해 테스트한다. 테스트 목적으로 파일을 쪼개지 않는다. 부산물 `react-refresh/only-export-components` 경고는 용인된다.

## 체크리스트

- [ ] `@innogrid/ui`에 있는 것을 직접 만들지 않았다
- [ ] 사용처 1곳인 코드는 인라인, `src/types`에 런타임 값 없음
- [ ] 서버 상태는 훅, 토스트는 로컬, 실패 본문 `getServerErrorMessage`
- [ ] 숫자 `Input`에 `step`·`min`
- [ ] 테스트 동반, 경량 목 import 누락 없음
- [ ] `infra-management` 영역은 건드리지 않았다
- [ ] `pnpm typecheck` → `pnpm lint` → 관련 테스트 통과
