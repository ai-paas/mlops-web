import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  CreatePromptRequest,
  GetPromptsParams,
  Prompt,
  PromptVariableTypeList,
  UpdatePromptRequest,
} from '@/types/prompt';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useGetPrompts = (params: GetPromptsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.prompts.list(params),
    queryFn: () => api.get('prompts/', { searchParams: { ...params } }).json<Page<Prompt>>(),
  });

  return {
    prompts: data?.data ?? [],
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

export const useGetPromptVariableTypes = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.prompts.variableTypes(),
    queryFn: () => api.get('prompts/variable-types').json<PromptVariableTypeList>(),
  });

  return {
    availableTypes: data?.available_types ?? [],
    isPending,
    isError,
    error,
  };
};

export const useCreatePrompt = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: CreatePromptRequest) => api.post('prompts/', { json: data }).json<Prompt>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    },
  });

  return {
    createPrompt: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetPrompt = (surro_prompt_id?: number) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey:
      surro_prompt_id !== undefined
        ? queryKeys.prompts.detail(surro_prompt_id)
        : ['prompts', 'detail', 'undefined'],
    queryFn: () => api.get(`prompts/${surro_prompt_id}`).json<Prompt>(),
    enabled: surro_prompt_id !== undefined,
  });

  return {
    prompt: data,
    isPending,
    isError,
    error,
  };
};

export const useUpdatePrompt = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ surro_prompt_id, ...data }: UpdatePromptRequest) =>
      api.put(`prompts/${surro_prompt_id}`, { json: data }).json<Prompt>(),
    onSuccess: () => {
      // detail 키가 prompts.all 하위 계층이라 아래 한 번으로 목록·상세 모두 무효화된다
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    },
  });

  return {
    updatePrompt: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeletePrompt = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: async (surro_prompt_id: number) => {
      await api.delete(`prompts/${surro_prompt_id}`);
    },
    onSuccess: (_, surro_prompt_id) => {
      queryClient.removeQueries({ queryKey: queryKeys.prompts.detail(surro_prompt_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    },
  });

  return {
    deletePrompt: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};
