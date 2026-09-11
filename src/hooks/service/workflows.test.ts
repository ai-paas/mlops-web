import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { HTTPError, TimeoutError, type NormalizedOptions } from 'ky';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createHookWrapper, createTestQueryClient } from '@/test/utils/test-utils';
import { queryKeys } from '@/lib/query-keys';
import {
  isExecuteTimeoutError,
  isFinalizeDeletionSucceeded,
  useFinalizeWorkflowCleanup,
  useFinalizeWorkflowDeletion,
  useGetTemplates,
  useGetWorkflow,
  useGetWorkflowStatus,
  useGetWorkflowTemplate,
  useUpdateComponentDeployStatus,
} from './workflows';

// fake timers 아래에서 ms만큼 진행한 뒤, 응답 반영까지 1ms flush로 소진한다.
// - RTL waitFor는 내부적으로 실제 setTimeout에 의존해 fake timers와 함께 쓸 수 없다.
// - flush가 0ms가 아니라 1ms인 이유: 응답 체인의 setTimeout(cb, 0)이 fake clock에서
//   1ms로 클램프되어, 0ms 진행으로는 만료 시각에 영원히 도달하지 못한다.
// finalize-* 폴링의 최대 대기(훅의 FINALIZE_POLL_TIMEOUT과 같은 값)
const FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;

const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
  }
};

describe('workflows hooks', () => {
  describe('OpenAPI 요청 계약', () => {
    it('템플릿 목록 요청은 명세의 page, size, category만 전송한다', async () => {
      let requestUrl: URL | undefined;
      server.use(
        http.get(`${BASE_URL}/workflows/templates`, ({ request }) => {
          requestUrl = new URL(request.url);
          return HttpResponse.json({ items: [], total: 0 });
        })
      );

      const { result } = renderHook(() => useGetTemplates({ page: 2, size: 20, category: 'rag' }), {
        wrapper: createHookWrapper(createTestQueryClient()),
      });

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(requestUrl?.searchParams.get('page')).toBe('2');
      expect(requestUrl?.searchParams.get('size')).toBe('20');
      expect(requestUrl?.searchParams.get('category')).toBe('rag');
      expect(requestUrl?.searchParams.has('sort')).toBe(false);
    });

    it('컴포넌트 배포 상태 요청 본문에서 경로 식별자를 제외한다', async () => {
      let requestBody: unknown;
      server.use(
        http.post(
          `${BASE_URL}/workflows/:workflowId/components/:componentId/deployment-status`,
          async ({ request }) => {
            requestBody = await request.json();
            return HttpResponse.json({ message: 'updated' });
          }
        )
      );

      const { result } = renderHook(() => useUpdateComponentDeployStatus(), {
        wrapper: createHookWrapper(createTestQueryClient()),
      });

      act(() => {
        result.current.updateComponentDeployStatus({
          surro_workflow_id: 'workflow-1',
          component_id: 'component-1',
          service_name: 'model-service',
          service_hostname: 'model-service.default.svc',
          model_name: 'model-a',
          status: 'ready',
          internal_url: 'http://model-service.default.svc',
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(requestBody).toEqual({
        service_name: 'model-service',
        service_hostname: 'model-service.default.svc',
        model_name: 'model-a',
        status: 'ready',
        internal_url: 'http://model-service.default.svc',
      });
    });
  });

  // ============================================
  // a3dd1d4 회귀 방지 — 템플릿/워크플로우 detail 캐시 비충돌
  // ============================================
  describe('템플릿/워크플로우 detail 캐시 비충돌', () => {
    it('같은 id로 조회해도 워크플로우 상세와 템플릿 상세가 서로 캐시를 덮어쓰지 않는다', async () => {
      // a3dd1d4 이전에는 useGetWorkflowTemplate이 workflows.detail(id) 키를 공유해
      // 같은 id의 워크플로우 상세 캐시를 템플릿 응답으로 덮어썼다.
      const queryClient = createTestQueryClient();
      const { result } = renderHook(
        () => ({
          workflow: useGetWorkflow('shared-id'),
          template: useGetWorkflowTemplate('shared-id'),
        }),
        { wrapper: createHookWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.workflow.isPending).toBe(false);
        expect(result.current.template.isPending).toBe(false);
      });

      expect(result.current.workflow.workflow?.name).toBe('테스트 워크플로우');
      expect(result.current.template.workflowTemplate?.name).toBe('테스트 템플릿');

      // 캐시에도 서로 다른 두 엔트리로 존재한다
      expect(queryClient.getQueryData(queryKeys.workflows.detail('shared-id'))).toBeDefined();
      expect(
        queryClient.getQueryData(queryKeys.workflows.templates.detail('shared-id'))
      ).toBeDefined();
    });

    it('템플릿 네임스페이스 무효화가 워크플로우 detail을 건드리지 않는다', async () => {
      const queryClient = createTestQueryClient();
      const { result } = renderHook(
        () => ({
          workflow: useGetWorkflow('shared-id'),
          template: useGetWorkflowTemplate('shared-id'),
        }),
        { wrapper: createHookWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(result.current.workflow.isPending).toBe(false);
        expect(result.current.template.isPending).toBe(false);
      });

      await act(async () => {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.workflows.templates.all,
          refetchType: 'none',
        });
      });

      expect(
        queryClient.getQueryState(queryKeys.workflows.templates.detail('shared-id'))?.isInvalidated
      ).toBe(true);
      expect(
        queryClient.getQueryState(queryKeys.workflows.detail('shared-id'))?.isInvalidated
      ).toBe(false);
    });
  });

  // ============================================
  // useGetWorkflowStatus — 7초 폴링 (fake timers)
  // ============================================
  describe('useGetWorkflowStatus 폴링', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const deployingResponse = (deploying: boolean) => ({
      workflow_id: 'wf-1',
      status: deploying ? 'DRAFT' : 'ACTIVE',
      deployed_models: [
        {
          component_id: 'comp-1',
          service_name: 'svc-1',
          model_name: '모델 A',
          sanitized_model_name: 'model-a',
          deployment_type: 'KSERVE',
          status: deploying ? 'DEPLOYING' : 'DEPLOYED',
        },
      ],
    });

    it('배포 중이면 7초 간격으로 재조회하고 배포가 끝나면 폴링을 멈춘다', async () => {
      let callCount = 0;
      server.use(
        http.get(`${BASE_URL}/workflows/:id/status`, () => {
          callCount += 1;
          return HttpResponse.json(deployingResponse(callCount < 3));
        })
      );

      const { result } = renderHook(() => useGetWorkflowStatus('wf-1', { polling: true }), {
        wrapper: createHookWrapper(createTestQueryClient()),
      });

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.isDeploying).toBe(true);

      await advance(7000);
      expect(callCount).toBe(2);
      expect(result.current.isDeploying).toBe(true);

      await advance(7000);
      expect(callCount).toBe(3);
      expect(result.current.isDeploying).toBe(false);

      // 배포 완료 후에는 7초가 여러 번 지나도 재조회하지 않는다
      await advance(21000);
      expect(callCount).toBe(3);
    });

    it('PENDING 상태의 모델도 배포 중으로 판정해 폴링을 계속한다', async () => {
      let callCount = 0;
      server.use(
        http.get(`${BASE_URL}/workflows/:id/status`, () => {
          callCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-1',
            status: 'DRAFT',
            deployed_models: [
              {
                component_id: 'comp-1',
                service_name: 'svc-1',
                model_name: '모델 A',
                sanitized_model_name: 'model-a',
                deployment_type: 'KSERVE',
                status: 'PENDING',
              },
            ],
          });
        })
      );

      const { result } = renderHook(() => useGetWorkflowStatus('wf-1', { polling: true }), {
        wrapper: createHookWrapper(createTestQueryClient()),
      });

      await advance(0);
      expect(result.current.isDeploying).toBe(true);

      await advance(7000);
      expect(callCount).toBe(2);
    });

    it('polling 옵션이 없으면 배포 중이어도 재조회하지 않는다', async () => {
      let callCount = 0;
      server.use(
        http.get(`${BASE_URL}/workflows/:id/status`, () => {
          callCount += 1;
          return HttpResponse.json(deployingResponse(true));
        })
      );

      const { result } = renderHook(() => useGetWorkflowStatus('wf-1'), {
        wrapper: createHookWrapper(createTestQueryClient()),
      });

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.isDeploying).toBe(true);

      await advance(30000);
      expect(callCount).toBe(1);
    });
  });

  // ============================================
  // useFinalizeWorkflowCleanup — 5초 폴링 (fake timers)
  // ============================================
  describe('useFinalizeWorkflowCleanup 폴링', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('in_progress인 동안 5초 간격으로 재확인하고 completed가 되면 멈춘다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-1',
            status: callCount < 3 ? 'in_progress' : 'completed',
            workflow_updated: callCount >= 3,
          });
        })
      );

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.status).toBe('in_progress');
      expect(result.current.isPolling).toBe(true);

      // 권장 주기는 5초 — 3초 시점에는 아직 재확인하지 않는다
      await advance(3000);
      expect(callCount).toBe(1);

      await advance(3000);
      expect(callCount).toBe(2);
      expect(result.current.isPolling).toBe(true);

      await advance(6000);
      expect(callCount).toBe(3);
      expect(result.current.status).toBe('completed');
      expect(result.current.isPolling).toBe(false);

      // 완료 후에는 폴링하지 않는다
      await advance(15000);
      expect(callCount).toBe(3);
    });

    // 404 = 게이트웨이 매핑에 없는 ID → 정리가 이미 끝난 것으로 본다
    it('404면 정리가 끝난 것으로 보고 completed로 끝낸다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: 'Workflow not found' }, { status: 404 });
        })
      );

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(0);
      expect(result.current.status).toBe('completed');
      expect(result.current.isError).toBe(false);
      expect(result.current.isPolling).toBe(false);

      await advance(15000);
      expect(callCount).toBe(1);
    });

    // 502/504는 MLOps 일시 장애 — 2회까지 참고 계속한다
    it('502면 5초 간격으로 2회 재시도한 뒤 에러로 끝낸다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: 'Bad Gateway' }, { status: 502 });
        })
      );

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(0);
      expect(callCount).toBe(1);

      await advance(6000);
      expect(callCount).toBe(2);

      await advance(6000);
      expect(callCount).toBe(3);

      // 3회 시도로 끝 — 더 두들기지 않고 에러로 남는다
      await advance(15000);
      expect(callCount).toBe(3);
      expect(result.current.isError).toBe(true);
    });

    // 최대 대기 10분. 넘으면 폴링만 끊고, 판정은 소비 컴포넌트가 "진행 중" 안내로 한다.
    it('in_progress가 10분을 넘기면 폴링을 멈추고 isTimedOut을 켠다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({ workflow_id: 'wf-1', status: 'in_progress' });
        })
      );

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.isTimedOut).toBe(false);
      expect(result.current.isPolling).toBe(true);

      // 응답을 흘리지 않고 시계만 10분 넘긴다(삭제 쪽 상한 테스트와 같은 방식)
      await act(async () => {
        vi.advanceTimersByTime(FINALIZE_TIMEOUT_MS);
      });
      await advance(0);

      const callsAtTimeout = callCount;
      expect(result.current.isTimedOut).toBe(true);
      expect(result.current.isPolling).toBe(false);

      await advance(60 * 1000);
      expect(callCount).toBe(callsAtTimeout);
    });

    it('failed가 되면 폴링을 멈춘다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-1',
            status: 'failed',
            message: '리소스 정리 실패',
          });
        })
      );

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(0);
      expect(result.current.status).toBe('failed');
      expect(result.current.result?.message).toBe('리소스 정리 실패');
      expect(result.current.isPolling).toBe(false);

      await advance(15000);
      expect(callCount).toBe(1);
    });

    it('enabled가 false거나 workflowId가 없으면 요청하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          requestSpy();
          return HttpResponse.json({ workflow_id: 'wf-1', status: 'completed' });
        })
      );

      renderHook(
        () => ({
          disabled: useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: false }),
          noId: useFinalizeWorkflowCleanup({ surro_workflow_id: undefined, enabled: true }),
        }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(1000);
      expect(requestSpy).not.toHaveBeenCalled();
    });

    it('500은 클라이언트 재시도 정책과 무관하게 재시도하지 않는다 (관용 대상은 502·504뿐)', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: 'boom' }, { status: 500 });
        })
      );
      // 테스트 기본 클라이언트는 retry:false라 훅 자체 옵션을 구분할 수 없다 — 재시도하는 클라이언트로 검증
      const retryingClient = new QueryClient({
        defaultOptions: { queries: { retry: 3, retryDelay: 0 } },
      });

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(retryingClient) }
      );

      await advance(1000);
      expect(result.current.isError).toBe(true);
      expect(callCount).toBe(1);
    });

    it('재접속(offline → online) 시 확인 요청을 다시 보내지 않는다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          callCount += 1;
          return HttpResponse.json({ workflow_id: 'wf-1', status: 'completed' });
        })
      );

      const { result } = renderHook(
        () => useFinalizeWorkflowCleanup({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );
      await advance(0);
      expect(result.current.status).toBe('completed');
      expect(callCount).toBe(1);

      // 전역 기본값(refetchOnReconnect: true)이었다면 stale 쿼리가 재요청된다
      act(() => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      });
      await advance(1000);
      expect(callCount).toBe(1);
    });
  });

  // ============================================
  // useFinalizeWorkflowDeletion — 5초 폴링 + 종결 상태 판정 (fake timers)
  // 게이트웨이 가이드의 응답 처리 표를 그대로 옮긴 테스트다.
  // ============================================
  describe('useFinalizeWorkflowDeletion 폴링', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const renderDeletionPolling = () =>
      renderHook(
        () => useFinalizeWorkflowDeletion({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

    it('in_progress인 동안 5초 간격으로 재확인하고 completed가 되면 멈춘다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-1',
            status: callCount < 3 ? 'in_progress' : 'completed',
            deleted_from_db: callCount >= 3,
          });
        })
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.isPolling).toBe(true);
      expect(result.current.isSucceeded).toBe(false);

      // 권장 주기는 5초 — 3초 시점에는 아직 재확인하지 않는다
      // (주기를 3초로 되돌리면 이 단정이 깨진다)
      await advance(3000);
      expect(callCount).toBe(1);

      await advance(3000);
      expect(callCount).toBe(2);
      expect(result.current.isPolling).toBe(true);

      await advance(6000);
      expect(callCount).toBe(3);
      expect(result.current.status).toBe('completed');
      expect(result.current.isSucceeded).toBe(true);
      expect(result.current.isPolling).toBe(false);

      // 종결 후에는 폴링하지 않는다
      await advance(15000);
      expect(callCount).toBe(3);
    });

    // 404 = 게이트웨이 매핑에 없는 ID → 이미 삭제된 것으로 보고 성공 처리한다.
    // 정합화(30분)나 다른 세션의 삭제로 매핑이 먼저 정리될 수 있다.
    it('404면 이미 삭제된 것으로 보고 성공 판정하고 재시도하지 않는다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: 'Workflow not found' }, { status: 404 });
        })
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(result.current.isSucceeded).toBe(true);
      expect(result.current.isError).toBe(false);
      expect(result.current.isPolling).toBe(false);
      expect(result.current.result?.deleted_from_db).toBe(true);

      await advance(15000);
      expect(callCount).toBe(1);
    });

    // 403 = 본인 소유 아님 & admin 아님 → 재시도 무의미
    it('403이면 재시도 없이 에러로 끝낸다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: '삭제 권한이 없습니다.' }, { status: 403 });
        })
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(result.current.isError).toBe(true);
      expect(result.current.isSucceeded).toBe(false);
      expect(result.current.isPolling).toBe(false);

      await advance(15000);
      expect(callCount).toBe(1);
    });

    // 502/504는 MLOps 일시 장애 — 2회까지 참고 계속한다
    it('502면 5초 간격으로 2회 재시도한 뒤 에러로 끝낸다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: 'Bad Gateway' }, { status: 502 });
        })
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.isError).toBe(false); // 아직 재시도 여유가 있다

      await advance(6000);
      expect(callCount).toBe(2);

      await advance(6000);
      expect(callCount).toBe(3);

      // 3회 시도로 끝 — 더 두들기지 않고 에러로 남는다
      await advance(15000);
      expect(callCount).toBe(3);
      expect(result.current.isError).toBe(true);
      expect(result.current.isSucceeded).toBe(false);
    });

    it('500은 클라이언트 재시도 정책과 무관하게 재시도하지 않는다 (관용 대상은 502·504뿐)', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({ detail: 'boom' }, { status: 500 });
        })
      );
      // 테스트 기본 클라이언트는 retry:false라 훅 옵션을 구분할 수 없다 — 재시도하는 클라이언트로 검증
      const retryingClient = new QueryClient({
        defaultOptions: { queries: { retry: 3, retryDelay: 0 } },
      });

      const { result } = renderHook(
        () => useFinalizeWorkflowDeletion({ surro_workflow_id: 'wf-1', enabled: true }),
        { wrapper: createHookWrapper(retryingClient) }
      );

      await advance(1000);
      expect(result.current.isError).toBe(true);
      expect(result.current.isSucceeded).toBe(false);
      expect(callCount).toBe(1);
    });

    // 회귀 테스트: 이 이슈의 핵심 — failed를 성공으로 판정하면 안 된다
    it('status가 failed면 성공으로 판정하지 않고 폴링을 멈춘다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-1',
            status: 'failed',
            error_message: '네임스페이스 삭제 실패',
          });
        })
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(result.current.isSucceeded).toBe(false);
      expect(result.current.isFailed).toBe(true);
      expect(result.current.result?.error_message).toBe('네임스페이스 삭제 실패');
      expect(result.current.isPolling).toBe(false);

      await advance(15000);
      expect(callCount).toBe(1);
    });

    it('알 수 없는 status면 성공·실패 어느 쪽으로도 판정하지 않고 폴링을 멈춘다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () =>
          HttpResponse.json({ workflow_id: 'wf-1', status: 'something_new' })
        )
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(result.current.isSucceeded).toBe(false);
      expect(result.current.isFailed).toBe(false);
      expect(result.current.isPolling).toBe(false);
    });

    it('enabled가 false거나 workflowId가 없으면 요청하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          requestSpy();
          return HttpResponse.json({ workflow_id: 'wf-1', status: 'completed' });
        })
      );

      renderHook(
        () => ({
          disabled: useFinalizeWorkflowDeletion({ surro_workflow_id: 'wf-1', enabled: false }),
          noId: useFinalizeWorkflowDeletion({ surro_workflow_id: undefined, enabled: true }),
        }),
        { wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(1000);
      expect(requestSpy).not.toHaveBeenCalled();
    });

    // 실패 후 재시도: 이전 시도의 결과가 캐시에 남아 있으면 재시도 시작 즉시 그 값으로 오판한다
    it('폴링을 멈춘 뒤 다시 시작하면 이전 시도의 결과를 재사용하지 않는다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-1',
            status: callCount === 1 ? 'failed' : 'completed',
          });
        })
      );

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useFinalizeWorkflowDeletion({ surro_workflow_id: 'wf-1', enabled }),
        { initialProps: { enabled: true }, wrapper: createHookWrapper(createTestQueryClient()) }
      );

      await advance(0);
      expect(result.current.isFailed).toBe(true);

      rerender({ enabled: false });
      await advance(0);
      expect(result.current.status).toBeUndefined();

      rerender({ enabled: true });
      await advance(0);
      expect(callCount).toBe(2);
      expect(result.current.isSucceeded).toBe(true);
      expect(result.current.isFailed).toBe(false);
    });

    // 최대 대기 10분. 넘으면 폴링만 끊고, 판정은 소비 컴포넌트가 "진행 중" 안내로 한다.
    it('in_progress가 10분을 넘기면 폴링을 멈추고 isTimedOut을 켠다', async () => {
      let callCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          callCount += 1;
          return HttpResponse.json({ workflow_id: 'wf-1', status: 'in_progress' });
        })
      );

      const { result } = renderDeletionPolling();

      await advance(0);
      expect(callCount).toBe(1);
      expect(result.current.isTimedOut).toBe(false);
      expect(result.current.isPolling).toBe(true);

      // 응답을 흘리지 않고 시계만 10분 넘긴다. 진행 중인 확인 요청이 있으면 재확인은 합쳐지므로
      // 5초 × 120회를 실제로 왕복하지 않고도 상한 타이머를 만료시킬 수 있다.
      await act(async () => {
        vi.advanceTimersByTime(FINALIZE_TIMEOUT_MS);
      });
      await advance(0);

      const callsAtTimeout = callCount;
      expect(result.current.isTimedOut).toBe(true);
      expect(result.current.isPolling).toBe(false);
      expect(result.current.isSucceeded).toBe(false);
      expect(result.current.isFailed).toBe(false);

      // 상한을 넘긴 뒤에는 더 호출하지 않는다
      await advance(60 * 1000);
      expect(callCount).toBe(callsAtTimeout);
    });
  });

  describe('isFinalizeDeletionSucceeded', () => {
    it.each([
      ['completed', true],
      ['in_progress', false],
      ['failed', false],
      // status는 in_progress/completed/failed 3개뿐 — 예전에 가정했던 라벨은 성공으로 보지 않는다
      ['deleted', false],
      ['already_deleted', false],
      ['', false],
      [undefined, false],
    ])('status %s → %s', (status, expected) => {
      expect(isFinalizeDeletionSucceeded(status as string | undefined)).toBe(expected);
    });
  });

  // ============================================
  // isExecuteTimeoutError — 실제 ky HTTPError로 검증 (목킹 시 instanceof가 깨진다)
  // ============================================
  describe('isExecuteTimeoutError', () => {
    const createHttpError = (body: string | null, status = 500) =>
      new HTTPError(
        new Response(body, { status }),
        new Request('http://localhost/x'),
        {} as NormalizedOptions
      );

    it.each([
      ['빈 문자열 detail', JSON.stringify({ detail: '' })],
      ['null detail', JSON.stringify({ detail: null })],
      ['detail 없는 본문', JSON.stringify({})],
    ])('500 응답이고 detail이 비어 있으면(%s) 타임아웃으로 판정한다', async (_label, body) => {
      await expect(isExecuteTimeoutError(createHttpError(body))).resolves.toBe(true);
    });

    it('500 응답이라도 detail에 내용이 있으면 타임아웃이 아니다', async () => {
      const error = createHttpError(JSON.stringify({ detail: 'DB connection lost' }));

      await expect(isExecuteTimeoutError(error)).resolves.toBe(false);
    });

    it('500이 아닌 상태 코드는 타임아웃이 아니다', async () => {
      const error = createHttpError(JSON.stringify({ detail: '' }), 422);

      await expect(isExecuteTimeoutError(error)).resolves.toBe(false);
    });

    it('본문이 JSON이 아니면 타임아웃이 아니다', async () => {
      const error = createHttpError('Internal Server Error');

      await expect(isExecuteTimeoutError(error)).resolves.toBe(false);
    });

    it('ky TimeoutError(클라이언트 기본 타임아웃)도 타임아웃으로 판정한다 — 배포는 서버에서 계속 진행된다', async () => {
      const error = new TimeoutError(new Request('http://localhost/x'));

      await expect(isExecuteTimeoutError(error)).resolves.toBe(true);
    });

    it.each([
      ['일반 Error', new Error('network')],
      ['null', null],
      ['undefined', undefined],
    ])('HTTPError가 아닌 값(%s)은 타임아웃이 아니다', async (_label, value) => {
      await expect(isExecuteTimeoutError(value)).resolves.toBe(false);
    });
  });
});
