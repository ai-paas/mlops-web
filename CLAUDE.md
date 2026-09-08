# AI-PaaS Frontend

React 18 + Vite 7 + TypeScript(strict) + pnpm. 응답과 코드 주석은 한국어로 작성한다.
이 저장소는 프론트엔드 전용이다. `/api/v1` 요청은 vite proxy가 `VITE_SERVER_URL`로 넘긴다.

## 명령

| 명령 | 용도 |
|---|---|
| `pnpm dev` | 개발 서버 |
| `pnpm typecheck` | `tsc -b`. **vitest는 타입체크를 하지 않는다** |
| `pnpm lint` | ESLint (CI 게이트) |
| `pnpm test` / `pnpm test:coverage` | Vitest / 커버리지 임계값 게이트 (CI 게이트) |
| `pnpm test:e2e` | Playwright 허메틱 스모크 ([e2e/](e2e/)) |
| `pnpm build` | `tsc -b && vite build` |

**완료 보고 전 검증**: 마지막 코드 변경 **이후에** `pnpm typecheck` → `pnpm lint` → `pnpm test:coverage`를 돌린다. 중간에 돌린 결과는 이후 수정으로 무효가 된다. 캔버스 등 E2E 여정을 건드렸으면 `pnpm test:e2e`도 실행한다.
Edit/Write 직후에는 훅이 그 파일에 ESLint를 자동 실행한다([.claude/settings.json](.claude/settings.json)). 훅이 보고한 오류는 바로 고친다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/pages/<domain>/` | 라우트 페이지. `page.tsx`(목록), `[id]/page.tsx`(상세), `create/page.tsx`. 라우터는 [src/router/router.tsx](src/router/router.tsx), 전부 `lazy` |
| `src/components/features/<domain>/` | 도메인 컴포넌트. CRUD 버튼(`create/edit/delete-*-button.tsx`), 탭, 폼 |
| `src/components/ui/` | 도메인 무관 UI (accordion, flow-chart, detail-value 등) |
| `src/components/layout/`, `src/components/provider/` | 헤더·사이드바·메뉴·ErrorBoundary / QueryClient 전역 정책 |
| `src/hooks/service/<domain>.ts` | API 훅(`use*`). 전부 React Query |
| `src/hooks/useAuth.tsx` | 인증 컨텍스트(토큰 미러, `isAdmin`, `logout` 오케스트레이션) |
| `src/lib/` | `api.ts`(ky 인스턴스·토큰 갱신·`getServerErrorMessage`), `query-keys.ts`, `sse.ts`, `utils.ts`(`cn`) |
| `src/store/` | zustand. 워크플로우 캔버스 스토어만 |
| `src/types/<domain>.ts` | **타입만** |
| `src/util/` | 순수 유틸(date, jwt, phone …) |
| `src/test/` | MSW 서버·핸들러, 렌더 헬퍼, 경량 목. [src/test/README.md](src/test/README.md) |

## 코드 컨벤션

상세 패턴과 기준 파일은 스킬에 있다: `ai-paas-feature`(CRUD 전체 흐름), `api-integration`(훅·키·에러), `react-component`, `typescript-refactor`, `workflow-canvas`. 아래는 위반이 잦았던 규칙만 적는다.

- **API는 `hooks/service`의 `use*` 훅으로만.** 뮤테이션 상태를 안 써도 일반 `requestX` 함수로 만들지 않는다. 쿼리 키는 [src/lib/query-keys.ts](src/lib/query-keys.ts) 팩토리(`queryKeys.<domain>.list(params)` / `.detail(id)`, 무효화는 `.all`)로만 만든다. 인라인 배열 금지.
- **재시도는 [react-query-provider.tsx](src/components/provider/react-query-provider.tsx) 한 곳.** ky는 `retry: 0`, 뮤테이션은 `retry: false`. 훅에 개별 retry를 넣지 않는다.
- **전역 토스트 금지.** 쿼리 실패는 페이지 인라인 상태(Table `emptyMessage` 등)로, 뮤테이션 결과는 호출부(버튼)의 로컬 토스트로 보인다. `title`은 "<대상> <동작> 성공/실패", 실패 본문은 `getServerErrorMessage(error, '기본 문구')`.
- **여러 단계의 도메인 흐름**(로그아웃 = 서버 무효화 → 토큰 제거 → `queryClient.clear()`)은 컨텍스트 훅(`useAuth`)이 서비스 훅을 소비해 메서드 하나로 묶는다. 컴포넌트가 직접 조합하지 않는다.
- **UI는 `@innogrid/ui` 먼저.** 드롭다운·모달·테이블·토스트를 직접 만들기 전에 `node_modules/@innogrid/ui/dist/main.d.ts`의 export와 기존 사용처를 확인한다. fixed 헤더 위에 뜨는 콘텐츠는 `zIndex`(관례 1000)를 넘긴다.
- **가볍게.** 사용처가 1곳이면 그 파일 안에 인라인한다. 별도 파일·공용 컴포넌트·util 분리는 두 번째 사용처가 생길 때 한다. 테스트하기 위해 파일을 쪼개지도 않는다(컴포넌트 파일에서 `export`하고 경량 목으로 테스트).
- **`src/types/`엔 타입만.** enum→라벨 매핑 같은 런타임 값은 사용처 파일 상단에 `const XXX_LABELS: Record<string, string>` 로컬 상수로 두고, 2~3곳이면 그냥 반복한다.
- **숫자 입력**은 `type="number"`에 필드 단위에 맞는 `step`(소수 필드는 필수)과 `min`을 함께 지정한다.
- **사내 패키지(`@innogrid/ui`) 결함**은 `pnpm patch`로 막지 않는다. 이 앱에서 실제로 그 경로를 쓰는지 먼저 확인하고, 영향이 있으면 업스트림에 제보한다.
- 파일명은 kebab-case. 컴포넌트는 named export(`export const XxxButton`), 페이지만 `export default`.

## 테스트 규칙

- **신규 훅·CRUD 버튼/폼 컴포넌트·순수 함수는 테스트를 동반한다.** 버그 수정에는 회귀 테스트를 추가한다.
- 작성법·헬퍼·MSW·목킹 컨벤션: [src/test/README.md](src/test/README.md). 기준 예시는 `src/hooks/service/services.test.ts`, `src/components/features/service/*.test.tsx`, `src/pages/service/page.test.tsx`.
- 커버리지 임계값(vitest.config.ts thresholds)은 **래칫**이다. 올리기만 하고 내리지 않는다.
- `describe/it/expect`는 `vitest`에서 명시 import한다. tsconfig에 globals 타입이 없어 런타임은 통과해도 tsc가 깨진다.
- 테스트에서 Node 전역(`process` 등)에 기대지 않는다. IDE의 TS 서버가 node 타입을 못 읽는다. 필요하면 `src/lib/api.test.ts`의 `globalThis` 패턴을 쓴다.

## 작업 범위·진행 규칙

- **infra-management 영역은 보류**(2026-09-03 지시, 별도 담당): `src/pages/infra-management/`, `src/components/features/infra-managememt/`(디렉터리명 오타 그대로), 인프라 훅(`clusters·vms·helm·catalog·addons·observability·operations·providers·credentials·audit-logs·agents`). 작업 대상에 섞여 있으면 그 부분만 **[보류]**로 표시하고 나머지를 진행한다. 이 영역만으로 이뤄진 요청은 착수 전에 확인한다.
- **커밋·푸시는 명시적으로 요청받았을 때만.** "진행해줘"는 수정과 검증까지다.
- 요청 범위를 넘는 리팩토링·재포맷은 하지 않는다.

## 환경 주의 (Windows 체크아웃)

- `core.autocrlf=true`이고 워킹트리는 CRLF/LF 혼재다. `prettier --check`는 `--end-of-line auto`로 확인하고, EOL만을 위해 무관한 파일을 재포맷하지 않는다. prettier는 CI 게이트가 아니다.
- `@innogrid/ui`는 사내 레지스트리다. CI(`.github/workflows/ci.yml`)는 self-hosted 러너에서 돈다.

## 하네스 유지

`.claude/agents/`, `.claude/skills/`, 이 문서는 코드 패턴이 바뀌면 같은 PR에서 갱신한다(전면 최신화 2026-09-07). 스킬은 코드를 복제하지 않고 기준 파일을 가리키므로, 기준 파일이 이동하면 링크를 고친다.
