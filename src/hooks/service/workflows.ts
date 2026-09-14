import { api } from '@/lib/api';
import { queryKeys, type WorkflowListParams } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  CloneWorkflowTemplateRequest,
  ClonedWorkflow,
  CleanupWorkflowResponse,
  ComponentDeployStatusBody,
  CreateWorkflowTemplateRequest,
  CreateWorkflowRequest,
  DeleteWorkflowResponse,
  ExecuteWorkflowResponse,
  FinalizeWorkflowCleanupResponse,
  FinalizeWorkflowDeletionResponse,
  GetWorkflowComponentTypes,
  UpdateWorkflowRequest,
  UpdateWorkflowTemplateRequest,
  ValidateWorkflowRequest,
  ValidateWorkflowResponse,
  Workflow,
  WorkflowRead,
  WorkflowModelsResponse,
  WorkflowMlTestResponse,
  WorkflowFillMaskTestRequest,
  WorkflowFillMaskTestResponse,
  WorkflowProteinClassificationTestRequest,
  WorkflowProteinClassificationTestResponse,
  WorkflowProteinStructurePredictionTestRequest,
  WorkflowProteinStructurePredictionTestResponse,
  WorkflowRagTestResponse,
  WorkflowStatusResponse,
  WorkflowTemplate,
  WorkflowTemplateListParams,
  WorkflowTemplateListResponse,
} from '@/types/workflow';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HTTPError, TimeoutError } from 'ky';
import { useEffect, useState } from 'react';

export const useGetWorkflows = (params: WorkflowListParams) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.workflows.list(params),
    queryFn: () => api.get<Page<Workflow>>('workflows/', { searchParams: { ...params } }).json(),
  });

  return {
    workflows: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      total: data?.total ?? 1,
      size: data?.size ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetWorkflowComponentTypes = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.workflows.componentTypes(),
    queryFn: () => api.get<GetWorkflowComponentTypes>('workflows/component-types').json(),
  });

  return {
    workflowComponentTypes: data?.data ?? [],
    isPending,
    isError,
    error,
  };
};

export const useGetTemplates = (params: WorkflowTemplateListParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.workflows.templates.list(params),
    queryFn: () =>
      api
        .get<WorkflowTemplateListResponse>('workflows/templates', { searchParams: { ...params } })
        .json(),
  });

  const workflowTemplates = data?.items ?? [];

  return {
    workflowTemplates,
    page: {
      number: params.page ?? 1,
      total: data?.total ?? 0,
      size: params.size ?? workflowTemplates.length,
    },
    isPending,
    isError,
    error,
  };
};

export const useValidateWorkflow = () => {
  const { mutate, isPending, isError, error, isSuccess, data, reset } = useMutation({
    mutationFn: (data: ValidateWorkflowRequest) =>
      api.post('workflows/validate', { json: data }).json<ValidateWorkflowResponse>(),
  });

  return {
    validateWorkflow: mutate,
    validation: data,
    isPending,
    isError,
    error,
    isSuccess,
    reset,
  };
};

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: CreateWorkflowRequest) =>
      api.post('workflows/', { json: data }).json<Workflow>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    createWorkflow: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useCreateWorkflowViaTemplate = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: CreateWorkflowRequest) =>
      api.post('workflows/', { json: data }).json<Workflow>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    createWorkflowViaTemplate: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetWorkflow = (workflowId?: number | string, enabled: boolean = true) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId),
    queryFn: () => api.get(`workflows/${workflowId}`).json<WorkflowRead>(),
    enabled: enabled && !!workflowId,
  });

  return {
    workflow: data,
    isPending,
    isError,
    error,
  };
};

export const useGetWorkflowTemplate = (templateId?: string) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.workflows.templates.detail(templateId),
    queryFn: () => api.get(`workflows/templates/${templateId}`).json<WorkflowTemplate>(),
    enabled: !!templateId,
  });

  return {
    workflowTemplate: data,
    isPending,
    isError,
    error,
  };
};

export const useCreateWorkflowTemplate = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: CreateWorkflowTemplateRequest) =>
      api.post('workflows/templates', { json: data }).json<string>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    createWorkflowTemplate: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useCloneWorkflowTemplate = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ templateId, workflow_name, service_id }: CloneWorkflowTemplateRequest) => {
      const searchParams: Record<string, string | number> = { workflow_name };

      if (service_id !== undefined) {
        searchParams.service_id = service_id;
      }

      return api
        .post(`workflows/templates/${templateId}/clone`, { searchParams })
        .json<ClonedWorkflow>();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    cloneWorkflowTemplate: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ workflowId, ...data }: UpdateWorkflowRequest) =>
      api.put(`workflows/${workflowId}`, { json: data }).json<Workflow>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    updateWorkflow: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useUpdateWorkflowTemplate = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ templateId, ...data }: UpdateWorkflowTemplateRequest) =>
      api.put(`workflows/templates/${templateId}`, { json: data }).json<WorkflowTemplate>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    updateWorkflowTemplate: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (workflowId: string) =>
      api.delete(`workflows/${workflowId}`).json<DeleteWorkflowResponse>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    deleteWorkflow: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteWorkflowTemplate = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`workflows/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    deleteWorkflowTemplate: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

const isWorkflowDeploying = (data?: WorkflowStatusResponse) => {
  const models = data?.deployed_models ?? [];

  return models.some((model) => model.status === 'PENDING' || model.status === 'DEPLOYING');
};

export const useGetWorkflowStatus = (
  surroWorkflowId?: string,
  { enabled = true, polling = false }: { enabled?: boolean; polling?: boolean } = {}
) => {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.workflows.status(surroWorkflowId),
    queryFn: () => api.get(`workflows/${surroWorkflowId}/status`).json<WorkflowStatusResponse>(),
    enabled: enabled && !!surroWorkflowId,
    refetchInterval: polling
      ? (query) => (isWorkflowDeploying(query.state.data) ? 7000 : false)
      : false,
  });

  return {
    workflowStatus: data,
    isDeploying: isWorkflowDeploying(data),
    isPending,
    isError,
    error,
    refetch,
  };
};

export const useGetWorkflowModels = (surroWorkflowId?: string) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.workflows.models(surroWorkflowId),
    queryFn: () => api.get<WorkflowModelsResponse>(`workflows/${surroWorkflowId}/models`).json(),
    enabled: !!surroWorkflowId,
  });

  return {
    workflowModels: data?.deployed_models ?? [],
    backendApiUrl: data?.backend_api_url ?? null,
    workflowId: data?.workflow_id,
    page: {
      number: 1,
      total: data?.total ?? 0,
      size: data?.deployed_models.length ?? 0,
    },
    isPending,
    isError,
    error,
  };
};

// ── finalize-* 폴링 공용 파라미터 ──
// finalize-deletion / finalize-cleanup은 "1회 호출 = 1회 상태 확인"인 probe API다.
// 주기를 줄이면 MLOps가 매 호출마다 k8s를 조회해 부하가 된다.
const FINALIZE_POLL_INTERVAL = 5000; // 5초 고정
const FINALIZE_POLL_TIMEOUT = 10 * 60 * 1000; // 최대 10분

// 502/504는 MLOps 일시 장애라 몇 번은 참는다. 403(권한)·404(이미 삭제)·그 밖의 응답은
// 재시도해도 결과가 달라지지 않는다. 전역 재시도 정책(react-query-provider)의 예외를 여기
// 두는 이유: POST를 폴링하는 쿼리라 GET 전제의 provider 기본값을 그대로 쓸 수 없다.
// failureCount는 0부터 시작하므로 < 2면 재시도 2회, 즉 총 3회 시도다.
const FINALIZE_TRANSIENT_STATUSES = [502, 504];
const FINALIZE_MAX_RETRY = 2;
const retryFinalizePoll = (failureCount: number, error: Error) => {
  const status = (error as HTTPError)?.response?.status;
  return (
    status !== undefined &&
    FINALIZE_TRANSIENT_STATUSES.includes(status) &&
    failureCount < FINALIZE_MAX_RETRY
  );
};

// finalize-deletion 종결 상태 — 이 값만 "삭제가 실제로 끝났다"로 판정한다.
// status는 in_progress / completed / failed 3개이고, 백엔드가 라벨을 늘리면 이 배열만 고친다.
const FINALIZE_DELETION_SUCCESS_STATUSES = ['completed'];
const FINALIZE_DELETION_IN_PROGRESS_STATUSES = ['in_progress'];

export const isFinalizeDeletionSucceeded = (status?: string) =>
  !!status && FINALIZE_DELETION_SUCCESS_STATUSES.includes(status);

/**
 * DELETE 요청이 시작되면 finalize-deletion을 폴링한다.
 * DELETE는 202(cleanup_in_progress)로 "정리 시작"만 알리므로,
 * 실제 완료는 이 응답의 status로만 판정한다. in_progress인 동안 5초 간격으로
 * 재호출하고, 종결값 / 404 / 10분 상한 중 하나에 걸리면 멈춘다.
 */
export const useFinalizeWorkflowDeletion = (params: {
  surro_workflow_id?: string;
  enabled?: boolean;
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const queryClient = useQueryClient();
  const enabled = Boolean(params.enabled && params.surro_workflow_id);

  // 최대 10분. 초과하면 폴링만 끊는다 — 실패로 단정하지 않는다(서버 정리는 계속 진행된다).
  useEffect(() => {
    if (!enabled) {
      setIsTimedOut(false);
      // 이전 시도의 결과가 남아 있으면 재시도할 때 그 값으로 즉시 오판한다(실패 후 재시도 경로).
      queryClient.removeQueries({
        queryKey: queryKeys.workflows.finalizeDeletion(params.surro_workflow_id),
      });
      return;
    }

    const timer = setTimeout(() => setIsTimedOut(true), FINALIZE_POLL_TIMEOUT);
    return () => clearTimeout(timer);
  }, [enabled, queryClient, params.surro_workflow_id]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: queryKeys.workflows.finalizeDeletion(params.surro_workflow_id),
    queryFn: async (): Promise<FinalizeWorkflowDeletionResponse> => {
      try {
        return await api
          .post(`workflows/${params.surro_workflow_id}/finalize-deletion`)
          .json<FinalizeWorkflowDeletionResponse>();
      } catch (caught) {
        // 404 = 게이트웨이 매핑에 없는 ID → 이미 삭제된 것으로 본다.
        // 게이트웨이가 "이미 삭제됨"에 쓰는 정규화와 같은 모양으로 맞춰 성공 경로로 흘린다.
        // (정상 완료 흐름은 게이트웨이 멱등성 덕에 404가 나지 않는다. 30분 정합화나
        //  다른 세션의 삭제로 매핑이 먼저 정리된 경우에만 온다.)
        if (caught instanceof HTTPError && caught.response.status === 404) {
          return {
            workflow_id: params.surro_workflow_id,
            status: 'completed',
            deleted_from_db: true,
            message: '이미 삭제된 워크플로우입니다.',
          };
        }
        throw caught;
      }
    },
    enabled: enabled && !isTimedOut,
    refetchInterval: (query) =>
      FINALIZE_DELETION_IN_PROGRESS_STATUSES.includes(query.state.data?.status ?? '')
        ? FINALIZE_POLL_INTERVAL
        : false,
    // POST를 폴링하는 쿼리 — 포커스·재접속 refetch로 확인 요청이 임의로 반복되지 않게 한다.
    // 재확인은 refetchInterval(in_progress)과 502/504 재시도로만 일어난다.
    retry: retryFinalizePoll,
    retryDelay: FINALIZE_POLL_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    staleTime: 0,
  });

  const status = data?.status;

  return {
    status,
    result: data,
    isSucceeded: isFinalizeDeletionSucceeded(status),
    isFailed: status === 'failed',
    isPolling:
      !isTimedOut && (isFetching || FINALIZE_DELETION_IN_PROGRESS_STATUSES.includes(status ?? '')),
    isTimedOut,
    isError,
    error,
  };
};

export const isExecuteTimeoutError = async (error: unknown) => {
  // 클라이언트 타임아웃(lib/api 기본 30s) — 배포는 서버에서 계속 진행되므로 상태 확인으로 전환한다
  if (error instanceof TimeoutError) return true;

  const httpError = error as HTTPError;

  if (httpError?.response?.status !== 500) return false;

  try {
    const body = (await httpError.response.clone().json()) as { detail?: unknown };
    return body.detail === '' || body.detail === null || body.detail === undefined;
  } catch {
    return false;
  }
};

export const useExecuteWorkflow = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (params: { surro_workflow_id: string }) =>
      api.post(`workflows/${params.surro_workflow_id}/execute`).json<ExecuteWorkflowResponse>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    executeWorkflow: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useUpdateComponentDeployStatus = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({
      surro_workflow_id,
      component_id,
      ...body
    }: { surro_workflow_id: string; component_id: string } & ComponentDeployStatusBody) =>
      api
        .post(`workflows/${surro_workflow_id}/components/${component_id}/deployment-status`, {
          json: body,
        })
        .json<Record<string, unknown>>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    updateComponentDeployStatus: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

// 워크플로우 테스트 요청 타임아웃. 백엔드가 150초 상한으로 판정하고 그 결과를 응답 본문
// (results[].error)에 담아 주므로, 프론트가 먼저 끊으면 실패 원인을 잃는다. 여유를 둬
// 서버 판정이 항상 먼저 도착하게 하고, 이 값은 서버 무응답에 대한 안전망으로만 쓴다.
// (ky 기본 30초로는 KB 검색 + 생성이 걸리는 워크플로우에서 응답을 받지 못한다)
const TEST_REQUEST_TIMEOUT = 180_000;

export const useTestRagWorkflow = () => {
  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: (params: { surro_workflow_id: string; text: string }) => {
      const body = new URLSearchParams({ text: params.text });

      return api
        .post(`workflows/${params.surro_workflow_id}/test/rag`, {
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: TEST_REQUEST_TIMEOUT,
        })
        .json<WorkflowRagTestResponse>();
    },
  });

  return {
    testRagWorkflow: mutate,
    testResult: data,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useTestMLWorkflow = () => {
  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: (params: { surro_workflow_id: string; image: File }) => {
      const formData = new FormData();
      formData.append('image', params.image);

      // 이미지 업로드 + 추론 — 기본 타임아웃(30s)을 넘길 수 있어 개별 해제
      return api
        .post(`workflows/${params.surro_workflow_id}/test/ml`, { body: formData, timeout: false })
        .json<WorkflowMlTestResponse>();
    },
  });

  return {
    testMLWorkflow: mutate,
    testResult: data,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useTestProteinClassificationWorkflow = () => {
  const mutation = useMutation({
    mutationFn: ({
      surro_workflow_id,
      ...json
    }: { surro_workflow_id: string } & WorkflowProteinClassificationTestRequest) =>
      api
        .post(`workflows/${surro_workflow_id}/test/protein-classification`, {
          json,
          timeout: TEST_REQUEST_TIMEOUT,
        })
        .json<WorkflowProteinClassificationTestResponse>(),
  });
  return {
    testProteinClassificationWorkflow: mutation.mutate,
    testResult: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
};

export const useTestFillMaskWorkflow = () => {
  const mutation = useMutation({
    mutationFn: ({
      surro_workflow_id,
      ...json
    }: { surro_workflow_id: string } & WorkflowFillMaskTestRequest) =>
      api
        .post(`workflows/${surro_workflow_id}/test/fill-mask`, {
          json,
          timeout: TEST_REQUEST_TIMEOUT,
        })
        .json<WorkflowFillMaskTestResponse>(),
  });
  return {
    testFillMaskWorkflow: mutation.mutate,
    testResult: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
};

export const useTestProteinStructurePredictionWorkflow = () => {
  const mutation = useMutation({
    mutationFn: ({
      surro_workflow_id,
      ...json
    }: { surro_workflow_id: string } & WorkflowProteinStructurePredictionTestRequest) =>
      api
        .post(`workflows/${surro_workflow_id}/test/protein-structure-prediction`, {
          json,
          timeout: TEST_REQUEST_TIMEOUT,
        })
        .json<WorkflowProteinStructurePredictionTestResponse>(),
  });
  return {
    testProteinStructurePredictionWorkflow: mutation.mutate,
    testResult: mutation.data,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    isSuccess: mutation.isSuccess,
  };
};

export const useCleanupWorkflow = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (params: { surro_workflow_id: string }) =>
      api.post(`workflows/${params.surro_workflow_id}/cleanup`).json<CleanupWorkflowResponse>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    cleanupWorkflow: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

/**
 * cleanup 요청이 시작되면 finalize-cleanup을 폴링한다.
 * finalize-deletion과 같은 probe API라 파라미터·예외 처리를 공유한다(위 공용 상수 참고).
 * status가 'in_progress'인 동안 5초 간격으로 재호출하고,
 * 종결값('completed'/'failed') / 404 / 10분 상한 중 하나에 걸리면 멈춘다.
 */
export const useFinalizeWorkflowCleanup = (params: {
  surro_workflow_id?: string;
  enabled?: boolean;
}) => {
  const [isTimedOut, setIsTimedOut] = useState(false);
  const queryClient = useQueryClient();
  const enabled = Boolean(params.enabled && params.surro_workflow_id);

  useEffect(() => {
    if (!enabled) {
      setIsTimedOut(false);
      // 이전 시도의 결과가 남아 있으면 재시도할 때 그 값으로 즉시 오판한다(실패 후 재시도 경로).
      queryClient.removeQueries({
        queryKey: queryKeys.workflows.finalizeCleanup(params.surro_workflow_id),
      });
      return;
    }

    const timer = setTimeout(() => setIsTimedOut(true), FINALIZE_POLL_TIMEOUT);
    return () => clearTimeout(timer);
  }, [enabled, queryClient, params.surro_workflow_id]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: queryKeys.workflows.finalizeCleanup(params.surro_workflow_id),
    queryFn: async (): Promise<FinalizeWorkflowCleanupResponse> => {
      try {
        return await api
          .post(`workflows/${params.surro_workflow_id}/finalize-cleanup`)
          .json<FinalizeWorkflowCleanupResponse>();
      } catch (caught) {
        // 404 = 게이트웨이 매핑에 없는 ID → 정리가 이미 끝난 것으로 본다.
        if (caught instanceof HTTPError && caught.response.status === 404) {
          return {
            workflow_id: params.surro_workflow_id,
            status: 'completed',
            message: '이미 정리된 워크플로우입니다.',
          };
        }
        throw caught;
      }
    },
    enabled: enabled && !isTimedOut,
    refetchInterval: (query) =>
      query.state.data?.status === 'in_progress' ? FINALIZE_POLL_INTERVAL : false,
    // POST를 폴링하는 쿼리 — 포커스·재접속 refetch로 확인 요청이 임의로 반복되지 않게 한다.
    // 재확인은 refetchInterval(in_progress)과 502/504 재시도로만 일어난다.
    retry: retryFinalizePoll,
    retryDelay: FINALIZE_POLL_INTERVAL,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    staleTime: 0,
  });

  return {
    status: data?.status,
    result: data,
    isPolling: !isTimedOut && (isFetching || data?.status === 'in_progress'),
    isTimedOut,
    isError,
    error,
  };
};
