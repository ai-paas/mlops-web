---
name: workflow-canvas
description: XyFlow(@xyflow/react v12) 기반 워크플로우 캔버스를 개발합니다. 노드 타입 추가·수정, 노드 설정 패널, 엣지·배치·단축키·undo/redo, zustand 스토어, 백엔드 저장 정의와의 변환, 캔버스 테스트(jsdom 스텁·Playwright)가 필요할 때 사용하세요.
---

# 워크플로우 캔버스

## 파일 지도

| 역할 | 파일 |
|---|---|
| 캔버스 본체(노드 컴포넌트, `nodeTypes`, 배치·단축키·엣지 메뉴) | `src/components/ui/flow-chart.tsx` (+ `flow-chart.css`, `flow-chart.test.tsx`) |
| 상태 스토어(zustand) | `src/store/useWorkflowStore.ts` (+ `.test.ts`) |
| 에디터 셸(팔레트 + 캔버스 + 저장 버튼 + 설정 패널) | `src/components/features/workflow/workflow-editor/index.tsx` |
| 팔레트(컴포넌트 목록, 이름 입력, 배치 대기) | `workflow-editor/workflow-component-panel.tsx` |
| 배치 고스트 / 컨트롤 바(포인터·핸드, 줌, undo/redo) | `workflow-placement-ghost.tsx` / `workflow-canvas-controls.tsx` |
| 노드 카드·액션 메뉴 | `workflow-node-card.tsx`, `workflow-node-action-menu.tsx` |
| 노드 기본값·ID | `workflow-node-defaults.ts` (`DEFAULT_LABEL`, `createNodeId`, `createWorkflowNodeData`) |
| 설정 패널 라우팅 + 타입별 패널 | `workflow-setting-panel.tsx` → `start-setting.tsx`, `model-setting.tsx`, `knowledge-setting.tsx`, `end-setting.tsx` |
| 캔버스 → 저장 정의 | `build-workflow-definition.ts` (`buildWorkflowDefinition(nodes, edges)`) |
| 저장 정의 → 캔버스 | `workflow-to-flow.ts` (`workflowToFlow(workflow)`) |
| 검증·저장·수정·템플릿 버튼 | `checklist-workflow-button.tsx`, `submit-workflow-button.tsx`, `update-workflow-button.tsx`, `create/update-workflow-template-button.tsx` |
| 서버 오류 파싱 | `parse-workflow-error.ts` |
| API 훅 | `src/hooks/service/workflows.ts` (`useCreateWorkflow`, `useUpdateWorkflow`, `useValidateWorkflow`, `useGetWorkflowStatus`(폴링), 템플릿·테스트 실행 훅) |
| 타입 | `src/types/workflow.ts` (`WorkflowComponentType`, `WorkflowDefinition`, `WorkflowComponentDefinition` …) |
| 페이지 | `src/pages/workflow/workflow/{create,[id],[id]/edit}/page.tsx`, `src/pages/workflow/templates/**`, 스타일 `workflow.module.scss` |
| 테스트 헬퍼 | `src/test/utils/xyflow-stubs.ts`, `reset-workflow-store.ts`, E2E `e2e/smoke.spec.ts` |

## 데이터 흐름

1. 페이지가 서버 데이터(`useGetWorkflow`/`useGetWorkflowTemplate`)를 `workflowToFlow`로 `{ nodes, edges }`로 바꿔 `WorkflowEditor`에 넘긴다(`useMemo`).
2. `FlowChart`가 `useEffect`에서 `setInitialData(nodes, edges)`로 스토어를 채운다. 이후 모든 변경은 스토어 액션.
3. 저장 버튼은 스토어의 `nodes, edges`를 `buildWorkflowDefinition`으로 `WorkflowDefinition`으로 바꿔 `useCreateWorkflow`/`useUpdateWorkflow`에 넘긴다. 검증(`ChecklistWorkflowButton`)도 같은 정의로 `useValidateWorkflow`.
4. 백엔드는 노드 위치를 **정수**로 저장한다. 변환기가 반올림한다. 숫자 설정값은 `toNumberOrUndefined`로 정리한다.

변환은 이 두 파일에서만 한다. 다른 곳에서 정의 형태를 조립하지 않는다.

## 스토어 (`useWorkflowStore`)

- 상태: `name`, `nodes: WorkflowNode[]`, `edges`, `selectedNodeId`, `past`/`future`(undo 스냅샷, 최대 50), `isDragging`, `pendingNodeType`, `clipboard`.
- 액션: `setInitialData`, `onNodesChange`/`onEdgesChange`/`onConnect`(xyflow 헬퍼 적용), `updateNodeData(nodeId, partial)`, `selectNode`, `copyNode`/`pasteClipboard`/`duplicateNode`(`CLONE_OFFSET` 40으로 비껴 배치), `deleteNode`/`deleteEdge`, `takeSnapshot`, `undo`/`redo`.
- 사용자 조작 단위마다 `pushHistory`가 스냅샷을 남긴다. 새 액션을 추가하면 undo 대상인지 판단해 같은 규칙을 따른다.
- 노드 데이터 타입은 `StartNodeData | KnowledgebaseNodeData | ModelNodeData | EndNodeData | NoteNodeData`(`[key: string]: unknown` 포함). 읽을 때는 좁혀서 쓴다.
- 컴포넌트에서는 선택적 구독 `useWorkflowStore((s) => s.x)`. 이벤트 핸들러 안에서는 `useWorkflowStore.getState()`.
- 스토어를 쓰는 테스트는 `beforeEach(() => resetWorkflowStore())`.

## 캔버스 동작 (`flow-chart.tsx`)

- `nodeTypes = { START, MODEL, KNOWLEDGE_BASE, END, NOTE }`. `NOTE`는 프론트 전용 메모 노드다(`WorkflowComponentType`에 없음). 저장 정의 변환 시 취급은 `build-workflow-definition.ts`를 따른다.
- **배치는 클릭 방식**이다. 팔레트 버튼 클릭 → `setPendingNodeType(type)` → 캔버스 클릭 → `screenToFlowPosition` → `addNodes`. 같은 버튼을 다시 누르면 해제. `WorkflowPlacementGhost`가 커서를 따라간다. 드래그앤드롭 팔레트로 바꾸지 않는다.
- 팬 모드 `PaneMode = 'pointer' | 'hand'`(컨트롤 바). 삭제는 `deleteKeyCode={['Backspace', 'Delete']}`, 읽기 전용이면 `null`.
- 단축키 Ctrl/Cmd + C/D/V는 `input, textarea, [contenteditable]` 안에서는 무시한다. 새 단축키도 같은 가드를 쓴다.
- 엣지 우클릭 컨텍스트 메뉴로 삭제. 노드 핸들은 `className="workflow-handle"`, 시작은 source만, 끝은 target만.
- `fitView`는 초기 노드가 있을 때만 켠다. 빈 캔버스에서 켜면 요청이 큐에 남는다.
- `readOnly` prop은 오버뷰(상세 페이지) 용도. 컨트롤 바를 숨기고 편집을 막는다.

## 노드 설정 패널

`WorkflowSettingPanel`이 `selectedNodeId`의 타입으로 `<Type>Setting`을 고른다. 각 패널은 `updateNodeData(nodeId, { ... })`로만 값을 바꾼다. 모델·지식베이스 선택은 `useGetCustomModels`/`useGetModelCatalogs`/`useGetKnowledgeBases` 훅(캔버스에서도 API는 훅으로). 숫자 필드(`temperature`, `top_p`, `max_tokens`, `top_k`)는 `type="number"` + `step` + `min`.

## 노드 타입 추가 체크리스트

1. `src/types/workflow.ts`: `WorkflowComponentType` 유니온(백엔드 타입과 일치), 정의 인터페이스에 config 필드.
2. `useWorkflowStore.ts`: `XxxNodeData` 인터페이스 + `NodeData` 유니온.
3. `workflow-node-defaults.ts`: `DEFAULT_LABEL`, `createWorkflowNodeData` 분기.
4. `flow-chart.tsx`: 노드 컴포넌트(`memo`, `WorkflowNodeActionMenu`, `WorkflowNodeCard`, `Handle`) + `nodeTypes` 등록.
5. `workflow-node-card.tsx`: 타입별 아이콘·색(`workflow/icons`).
6. `workflow-setting-panel.tsx` + `xxx-setting.tsx`.
7. `build-workflow-definition.ts`(`buildComponentConfig` 분기) / `workflow-to-flow.ts`(역변환).
8. 팔레트는 `useGetWorkflowComponentTypes`가 서버에서 받으므로 프론트 등록은 라벨만.
9. 테스트: `workflow-node-defaults.test.ts`, `build-workflow-definition.test.ts`, `workflow-to-flow.test.ts`, `useWorkflowStore.test.ts`, 설정 패널 테스트(`model-setting.test.tsx` 참고).

## 테스트

- 캔버스를 jsdom에 마운트하는 파일 최상단에서 `installXyflowStubs()`(ResizeObserver를 즉시 콜백하는 스텁으로 교체해 노드가 측정된 상태가 된다).
- **드래그·엣지 연결·팬·줌은 jsdom으로 재현 불가.** 순수 함수(변환·기본값·스토어 액션)와 설정 패널은 vitest, 실브라우저 좌표가 필요한 여정은 `e2e/smoke.spec.ts`를 복제해 Playwright(`pnpm test:e2e`, 허메틱 `api-mocks.ts`에 엔드포인트 추가).
- 팔레트 배치 버튼은 `sr-only '생성'` + `aria-pressed`로 접근한다. E2E 셀렉터는 `.react-flow__pane`, `.react-flow__node`, `.react-flow__handle.source/.target`.

## 체크리스트

- [ ] 상태 변경은 스토어 액션으로만, undo 스냅샷 규칙 유지
- [ ] 정의 변환은 `build-workflow-definition.ts`/`workflow-to-flow.ts`에서만, 위치는 정수
- [ ] 노드 타입 추가 시 위 9단계 모두 갱신
- [ ] 토스트는 로컬 `useToast`, 서버 오류는 `parseWorkflowError`/`getServerErrorMessage`
- [ ] 스토어 테스트에 `resetWorkflowStore`, 캔버스 마운트에 `installXyflowStubs`
- [ ] 조작 여정을 바꿨으면 `pnpm test:e2e`
- [ ] `pnpm typecheck` → `pnpm lint` → 관련 테스트 통과
