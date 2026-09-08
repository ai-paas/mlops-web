---
name: typescript-refactor
description: TypeScript 코드를 리팩토링하고 타입 안정성을 높입니다. tsc 에러 수정, any·non-null assertion 제거, 유니온·제네릭 정리, 타입 파일 정돈, 훅·컴포넌트 시그니처 정리 등 동작을 바꾸지 않는 구조 개선이 필요할 때 사용하세요.
---

# TypeScript 리팩토링

TypeScript 5.8, strict. 설정은 `tsconfig.app.json`(앱), `tsconfig.node.json`(vite 설정), `tsconfig.e2e.json`(Playwright). `pnpm typecheck`는 `tsc -b`로 셋을 모두 검사한다.

## 원칙

- **동작을 바꾸지 않는다.** 리팩토링 중 발견한 버그는 고치지 말고 보고한다. 수정은 별도 작업이고 회귀 테스트가 따라야 한다.
- 범위 밖 파일을 건드리지 않는다. 워킹트리가 CRLF/LF 혼재라 포맷만 바뀌는 diff는 리뷰를 망친다.
- 사용처 1곳인 코드를 파일로 분리하지 않는다. 테스트하기 위해 분리하지도 않는다(파일 안에서 `export`).
- 테스트가 없는 순수 함수를 리팩토링할 때는 먼저 특성화 테스트를 만든다.

## 타입 배치 규칙

- `src/types/<domain>.ts`에는 타입·인터페이스만. 상수·라벨맵·헬퍼가 있으면 사용처 파일로 옮긴다.
- 타입은 상수에서 `typeof X[number]`로 유도하지 말고 순수 유니온으로 적는다(`WorkflowStatus = 'DRAFT' | 'ACTIVE' | 'ERROR'`).
- 백엔드 필드명은 snake_case 그대로. 프론트 전용 필드는 주석으로 표시한다(`ModelNodeData.type` 참고).
- 폼 값 타입은 zod 스키마에서 `z.infer`. 초기값은 `as const satisfies FormValues`(`member-form.ts`).
- 서버 응답 유니온은 판별 필드로 좁힌다(`WorkflowTestResult = Success | Error`).

## 자주 하는 리팩토링

- `any` → `unknown` + 좁히기. JSON 파싱은 `parse<T>(data): T | null` 같은 안전 래퍼(`operation-events.ts`).
- non-null `!` → 가드. 훅에서는 `enabled: !!id`, 핸들러에서는 `if (!id) return`.
- 타입 전용 import는 `import type { ... }`. 값과 섞이면 `import { x, type Y }`.
- 반복되는 키 형태는 팩토리로(`kubernetesKind(kind)`가 `queryKeys.kubernetes.*`를 만드는 방식).
- 훅 반환 형태는 이름 붙은 필드 유지(`{ services, page, isPending, isError, error }`). 리팩토링으로 `data`를 그대로 노출하지 않는다.
- 제네릭 응답은 `api.get(...).json<T>()`. `Page<T>`는 `src/types/api.ts`.

## 검증 순서

마지막 수정 **이후에** 이 순서로 실행한다.

```bash
pnpm typecheck                      # vitest는 타입체크를 하지 않는다
pnpm lint
pnpm exec vitest run <영향받는 테스트 파일들>
```

## tsc·lint에서 자주 나는 함정

- 테스트에서 `describe/it/expect/vi`는 `import { ... } from 'vitest'`로 명시한다. tsconfig에 vitest globals 타입이 없어 런타임은 통과해도 tsc가 실패한다.
- MSW `HttpResponse.json()` 인자에 `unknown`을 넘기면 실패한다. `Record<string, unknown>` 등 JSON 호환 타입으로.
- `src` 아래 테스트에서 Node 전역(`process`)이나 `node:*` import를 쓰지 않는다. IDE TS 서버가 node 타입을 못 읽어 에러로 표시된다. 필요하면 최소 시그니처를 선언하고 `globalThis`에서 꺼낸다(`src/lib/api.test.ts`의 `nodeProcess`).
- ESLint: `react-refresh/only-export-components`는 warn이며 상수·훅을 컴포넌트와 같은 파일에서 export하는 기존 코드에 용인된다. `@tanstack/eslint-plugin-query`가 쿼리 키·의존성 오용을 잡는다. 테스트 파일에는 testing-library·jest-dom 규칙이 추가로 걸린다(`container.querySelector` 대신 `screen.getByRole`).
- `@xyflow/react`의 `Node<Data>`를 쓰는 곳은 `WorkflowNode`(`src/store/useWorkflowStore.ts`) 타입을 재사용한다. 노드 데이터 필드는 `[key: string]: unknown` 인덱스 시그니처가 있어 읽을 때 좁혀야 한다.

## 보류 영역

`src/pages/infra-management/`, `src/components/features/infra-managememt/`, 인프라 훅(`clusters·vms·helm·catalog·addons·observability·operations·providers·credentials·audit-logs·agents`)은 수정하지 않는다. 타입 정리 대상에 섞여 있으면 그 부분만 [보류]로 보고한다.

## 체크리스트

- [ ] 동작 변경 없음. 관련 테스트 그대로 통과
- [ ] `src/types`에 런타임 값 없음, 유니온은 순수 리터럴
- [ ] `any`·`!` 제거 시 가드가 실제 경계(옵셔널 id 등)를 지킴
- [ ] `import type` 적용
- [ ] `pnpm typecheck` → `pnpm lint` → 테스트, 마지막 수정 이후 실행
- [ ] 발견한 버그는 보고만
