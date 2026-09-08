import { api } from '@/lib/api';
import { queryKeys, type HubModelTagParams } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  CreateImprovementRequest,
  CreateImprovementResponse,
  CustomModel,
  GetCustomModelsParams,
  GetHubModelsParams,
  GetImprovementTaskTypesParams,
  GetModelCatalogsParams,
  GetModelFormatsParams,
  GetModelProvidersParams,
  GetModelsParams,
  GetModelTypesParams,
  HubModelsResponse,
  HubModelTag,
  ImprovementStatusResponse,
  Model,
  ModelCatalog,
  ModelFormat,
  ModelImprovementTaskType,
  ModelProvider,
  ModelType,
} from '@/types/model';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useGetModels = (
  params: GetModelsParams = {},
  { enabled = true }: { enabled?: boolean }
) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.models.list(params),
    queryFn: () => api.get<Page<Model>>('models', { searchParams: { ...params } }).json(),
    enabled,
  });

  return {
    models: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 1,
      total: data?.total ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetCustomModels = (params: GetCustomModelsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.customModels.list(params),
    queryFn: () =>
      api
        .get<Page<CustomModel>>('models/custom-models', {
          searchParams: { ...params },
        })
        .json(),
  });

  return {
    customModels: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 1,
      total: data?.total ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetModelCatalogs = (params: GetModelCatalogsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.modelCatalogs.list(params),
    queryFn: () =>
      api
        .get<Page<ModelCatalog>>('models/model-catalog', {
          searchParams: { ...params },
        })
        .json(),
  });

  return {
    modelCatalogs: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 1,
      total: data?.total ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetModelProviders = (params: GetModelProvidersParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.modelProviders.list(params),
    queryFn: () =>
      api.get<Page<ModelProvider>>('models/providers', { searchParams: { ...params } }).json(),
  });

  return {
    modelProviders: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 1,
      total: data?.total ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetModelTypes = (params: GetModelTypesParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.modelTypes.list(params),
    queryFn: () => api.get<Page<ModelType>>('models/types', { searchParams: { ...params } }).json(),
  });

  return {
    modelTypes: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 1,
      total: data?.total ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetModelFormats = (params: GetModelFormatsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.modelFormats.list(params),
    queryFn: () =>
      api.get<Page<ModelFormat>>('models/formats', { searchParams: { ...params } }).json(),
  });

  return {
    modelFormats: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 1,
      total: data?.total ?? 1,
    },
    isPending,
    isError,
    error,
  };
};

export const useGetModel = <T = Model>(model_id: number) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.models.detail(model_id),
    queryFn: () => api.get(`models/${model_id}`).json<T>(),
  });

  return {
    model: data,
    isPending,
    isError,
    error,
  };
};

export const useDeleteModel = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (modelId: number) =>
      api.delete(`models/${modelId}`).json<Record<string, unknown>>(),
    onSuccess: (_, modelId) => {
      queryClient.removeQueries({ queryKey: queryKeys.models.detail(modelId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.models.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.modelCatalogs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customModels.all });
    },
  });

  return {
    deleteModel: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useCreateModel = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    // 모델 파일 업로드 — 기본 타임아웃(30s) 해제
    mutationFn: (data: FormData) =>
      api.post('models', { body: data, timeout: false }).json<Model>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.models.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.modelCatalogs.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customModels.all });
    },
  });

  return {
    createModel: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetHubModels = (params: GetHubModelsParams) => {
  const { data, isPending, isFetching, isError, error } = useQuery({
    queryKey: queryKeys.hubModels.list(params),
    // searchParams는 params에서만 파생 — queryFn 내부에서 만들어 쿼리키(params)와의
    // 정합성을 lint(@tanstack/query/exhaustive-deps)가 보증할 수 있게 한다.
    queryFn: () => {
      // 다중 필터(library/language/apps/inference_provider/other)는 키를 반복해 전달
      // (FastAPI array<string> 규약). 빈 값/빈 배열은 제외.
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined) return;
        if (Array.isArray(value)) {
          value.forEach((item) => searchParams.append(key, String(item)));
        } else {
          searchParams.append(key, String(value));
        }
      });
      return api.get<HubModelsResponse>('hub-connect/models', { searchParams }).json();
    },
    placeholderData: keepPreviousData,
  });

  return {
    hubModels: data?.data ?? [],
    page: {
      number: data?.pagination?.page ?? params.page ?? 1,
      size: data?.pagination?.limit ?? params.limit ?? data?.data.length ?? 0,
      total: data?.pagination?.total ?? data?.data.length ?? 0,
    },
    // Kaggle 등 total 이 하한값인 마켓에서 다음 페이지 이동 판단용
    hasMore: data?.pagination?.has_more ?? false,
    totalIsExact: data?.pagination?.total_is_exact ?? true,
    isPending,
    // 페이지/필터/검색 변경 등 모든 요청 진행 중에 true (스켈레톤 표시용)
    isFetching,
    isError,
    error,
  };
};

export const useGetHubModelTagsByGroup = (params: HubModelTagParams) => {
  const { data, isFetching, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.hubModelTags.list(params),
    queryFn: () =>
      api
        .get<HubModelTag>(`hub-connect/tags/${encodeURIComponent(params.group)}`, {
          searchParams: { market: params.market },
        })
        .json(),
  });

  return {
    hubModelTags: data?.data,
    remaining_count: data?.remaining_count,
    isFetching,
    isPending,
    isError,
    error,
    refetch,
  };
};

/**
 * 모델 최적화/경량화에 사용 가능한 task_type 목록 조회.
 * source_model_id 지정 시 해당 모델 repo_id에 맞는 허용 기법만 반환.
 */
export const useGetImprovementTaskTypes = (
  params: GetImprovementTaskTypesParams = {},
  { enabled = true }: { enabled?: boolean } = {}
) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.modelImprovements.taskTypes(params),
    queryFn: () => {
      const searchParams = new URLSearchParams(
        Object.entries(params)
          .filter(([, value]) => value !== '' && value !== null && value !== undefined)
          .map(([key, value]) => [key, String(value)])
      );
      return api
        .get<ModelImprovementTaskType[]>('model-improvements/task-types', { searchParams })
        .json();
    },
    enabled,
  });

  return {
    taskTypes: data ?? [],
    isPending,
    isError,
    error,
  };
};

/** 모델 최적화/경량화 task 생성. 비동기 처리이며, 반환된 task_id로 상태를 조회한다. */
export const useSubmitImprovement = () => {
  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (body: CreateImprovementRequest) =>
      api.post('model-improvements', { json: body }).json<CreateImprovementResponse>(),
  });

  return {
    submitImprovement: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

/**
 * 모델 최적화/경량화 task 상태 조회.
 * task_id가 있고 task가 종료(SUCCEEDED/FAILED)되기 전까지 주기적으로 폴링한다.
 */
export const useGetImprovementStatus = (
  taskId?: string,
  { enabled = true }: { enabled?: boolean } = {}
) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.modelImprovements.status(taskId),
    queryFn: () =>
      api
        .get<ImprovementStatusResponse>('model-improvements/status', {
          searchParams: { task_id: taskId ?? '' },
        })
        .json(),
    enabled: !!taskId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'SUCCEEDED' || status === 'FAILED' ? false : 3000;
    },
  });

  return {
    improvementStatus: data,
    isPending,
    isError,
    error,
  };
};
