import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  ValidateDatasetResponse,
  Dataset,
  DatasetKindInfo,
  GetDatasetsParams,
  UpdateDatasetRequest,
} from '@/types/dataset';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useGetDatasets = (params: GetDatasetsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.datasets.list(params),
    queryFn: () => api.get<Page<Dataset>>('datasets', { searchParams: { ...params } }).json(),
  });

  return {
    datasets: data?.data ?? [],
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

export const useGetDatasetKinds = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.datasets.kinds(),
    queryFn: () => api.get<DatasetKindInfo[]>('datasets/kinds').json(),
  });

  return {
    kinds: data ?? [],
    isPending,
    isError,
    error,
  };
};

export const useValidateDataset = () => {
  const { mutateAsync } = useMutation({
    // 대용량 파일(최대 1GB) 업로드 — 기본 타임아웃(30s) 해제
    mutationFn: (data: FormData) =>
      api.post('datasets/validate', { body: data, timeout: false }).json<ValidateDatasetResponse>(),
  });

  return {
    validateDataset: mutateAsync,
  };
};

export const useCreateDataset = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    // 대용량 파일 업로드 — 기본 타임아웃(30s) 해제
    mutationFn: (data: FormData) =>
      api.post('datasets', { body: data, timeout: false }).json<Dataset>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets.all });
    },
  });

  return {
    createDataset: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetDataset = (dataset_id?: number) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.datasets.detail(dataset_id),
    queryFn: () => api.get<Dataset>(`datasets/${dataset_id}`).json(),
    enabled: !!dataset_id,
  });

  return {
    dataset: data,
    isPending,
    isError,
    error,
  };
};

export const useUpdateDataset = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ datasetId, ...data }: UpdateDatasetRequest) =>
      api.put(`datasets/${datasetId}`, { json: data }).json<Dataset>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets.all });
    },
  });

  return {
    updateDataset: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteDataset = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (datasetId: number) =>
      api.delete(`datasets/${datasetId}`).json<Record<string, unknown>>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.datasets.all });
    },
  });

  return {
    deleteDataset: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};
