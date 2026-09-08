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
import { TimeoutError, type HTTPError } from 'ky';

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

export const useFinalizeWorkflowDeletion = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (params: { surro_workflow_id: string }) =>
      api
        .post(`workflows/${params.surro_workflow_id}/finalize-deletion`)
        .json<FinalizeWorkflowDeletionResponse>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });

  return {
    finalizeWorkflowDeletion: mutate,
    isPending,
    isError,
    error,
    isSuccess,
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

export const useTestRagWorkflow = () => {
  const { mutate, isPending, isError, error, isSuccess, data } = useMutation({
    mutationFn: (params: { surro_workflow_id: string; text: string }) => {
      const body = new URLSearchParams({ text: params.text });

      return api
        .post(`workflows/${params.surro_workflow_id}/test/rag`, {
          body,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        .post(`workflows/${surro_workflow_id}/test/protein-classification`, { json })
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
        .post(`workflows/${surro_workflow_id}/test/fill-mask`, { json })
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
        .post(`workflows/${surro_workflow_id}/test/protein-structure-prediction`, { json })
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

const FINALIZE_CLEANUP_POLL_INTERVAL = 3000;

/**
 * cleanup 요청이 시작되면 finalize-cleanup을 폴링한다.
 * status가 'in_progress'인 동안 refetchInterval로 재호출하고,
 * 'completed' 또는 'failed'가 되면 멈춘다.
 */
export const useFinalizeWorkflowCleanup = (params: {
  surro_workflow_id?: string;
  enabled?: boolean;
}) => {
  const enabled = Boolean(params.enabled && params.surro_workflow_id);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: queryKeys.workflows.finalizeCleanup(params.surro_workflow_id),
    queryFn: () =>
      api
        .post(`workflows/${params.surro_workflow_id}/finalize-cleanup`)
        .json<FinalizeWorkflowCleanupResponse>(),
    enabled,
    refetchInterval: (query) =>
      query.state.data?.status === 'in_progress' ? FINALIZE_CLEANUP_POLL_INTERVAL : false,
    // POST를 폴링하는 쿼리 — 실패 시 자동 재시도나 포커스·재접속 refetch로 확인 요청이 임의로 반복되지 않게 한다.
    // 재확인은 오직 refetchInterval(in_progress)로만 일어난다. [백엔드] 상태 조회용 GET 전환은 협의 항목(TODO 14).
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    gcTime: 0,
    staleTime: 0,
  });

  return {
    status: data?.status,
    result: data,
    isPolling: isFetching || data?.status === 'in_progress',
    isError,
    error,
  };
};
