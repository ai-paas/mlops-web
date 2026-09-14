import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { api } from '../../lib/api';
import type { Page } from '../../types/api';
import type {
  CreateServiceRequest,
  GetServicesParams,
  Service,
  ServiceDetail,
  UpdateServiceRequest,
} from '../../types/service';

export const useGetServices = (params: GetServicesParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.services.list(params),
    queryFn: () => api.get<Page<Service>>('services/', { searchParams: { ...params } }).json(),
  });

  return {
    services: data?.data ?? [],
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

export const useCreateService = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: CreateServiceRequest) =>
      api.post('services/', { json: data }).json<Service>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });

  return {
    createService: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetService = (surro_service_id?: string, enabled: boolean = true) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.services.detail(surro_service_id),
    queryFn: () => api.get(`services/${surro_service_id}`).json<ServiceDetail>(),
    enabled: enabled && !!surro_service_id,
  });

  return {
    service: data,
    isPending,
    isError,
    error,
  };
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ surro_service_id, ...data }: UpdateServiceRequest) =>
      api.put(`services/${surro_service_id}`, { json: data }).json<Service>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });

  return {
    updateService: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: async (surro_service_id: string) => {
      await api.delete(`services/${surro_service_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all });
    },
  });

  return {
    deleteService: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};
