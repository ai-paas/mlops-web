import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  AddFileRequest,
  ChunkType,
  GetKnowledgeBasesParams,
  KnowledgeBase,
  KnowledgeBaseBrief,
  Language,
  SearchKnowledgeBaseRequest,
  SearchKnowledgeBaseResponse,
  SearchMethod,
  SearchRecord,
  UpdateKnowledgeBaseRequest,
} from '@/types/knowledgebase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const useGetChunkTypes = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.knowledgeBaseMeta.chunkTypes,
    queryFn: () => api.get('knowledge-bases/chunk-types').json<Page<ChunkType>>(),
  });

  return {
    chunkTypes: data?.data ?? [],
    isPending,
    isError,
    error,
  };
};

export const useGetLanguages = () => {
  const { data, isPending, isError, error, isFetched } = useQuery({
    queryKey: queryKeys.knowledgeBaseMeta.languages,
    queryFn: () => api.get('knowledge-bases/languages').json<Page<Language>>(),
  });

  return {
    languages: data?.data ?? [],
    isPending,
    isError,
    error,
    isFetched,
  };
};

export const useGetSearchMethods = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.knowledgeBaseMeta.searchMethods,
    queryFn: () => api.get('knowledge-bases/search-methods').json<Page<SearchMethod>>(),
  });

  return {
    searchMethods: data?.data ?? [],
    isPending,
    isError,
    error,
  };
};

export const useCreateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  const { mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: FormData) =>
      api.post('knowledge-bases', { body: data, timeout: false }).json<KnowledgeBaseBrief>(),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBases.all });
    },
  });

  return {
    createKnowledgeBase: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetKnowledgeBases = (params: GetKnowledgeBasesParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.knowledgeBases.list(params),
    queryFn: () =>
      api.get('knowledge-bases', { searchParams: { ...params } }).json<Page<KnowledgeBaseBrief>>(),
  });

  return {
    knowledgeBases: data?.data ?? [],
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

export const useGetKnowledgeBase = (surro_knowledge_id?: number) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.knowledgeBases.detail(surro_knowledge_id),
    queryFn: () => api.get(`knowledge-bases/${surro_knowledge_id}`).json<KnowledgeBase>(),
    enabled: !!surro_knowledge_id,
  });

  return {
    knowledgeBase: data,
    isPending,
    isError,
    error,
  };
};

export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ surro_knowledge_id, ...data }: UpdateKnowledgeBaseRequest) =>
      api.put(`knowledge-bases/${surro_knowledge_id}`, { json: data }).json<KnowledgeBaseBrief>(),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBases.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeBases.detail(variables.surro_knowledge_id),
      });
    },
  });

  return {
    updateKnowledgeBase: mutate,
    updateKnowledgeBaseAsync: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteKnowledgeBase = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: async (surro_knowledge_id: number) => {
      await api.delete(`knowledge-bases/${surro_knowledge_id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeBases.all });
    },
  });

  return {
    deleteKnowledgeBase: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useAddFileToKnowledgeBase = (surro_knowledge_id: number) => {
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: AddFileRequest) => {
      const formData = new FormData();
      formData.append('file', data.file);
      return api
        .post(`knowledge-bases/${surro_knowledge_id}/files`, {
          body: formData,
          timeout: false,
        })
        .json<KnowledgeBase>();
    },
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeBases.files(surro_knowledge_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeBases.detail(surro_knowledge_id),
      });
    },
  });

  return {
    addFile: mutate,
    addFileAsync: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteFileFromKnowledgeBase = (surro_knowledge_id: number) => {
  const queryClient = useQueryClient();

  const { mutate, mutateAsync, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (file_id: number) =>
      api.delete(`knowledge-bases/${surro_knowledge_id}/files/${file_id}`).json<KnowledgeBase>(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeBases.files(surro_knowledge_id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledgeBases.detail(surro_knowledge_id),
      });
    },
  });

  return {
    deleteFile: mutate,
    deleteFileAsync: mutateAsync,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useSearchKnowledgeBase = (surro_knowledge_id: number) => {
  const { mutate, mutateAsync, data, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (searchParams: SearchKnowledgeBaseRequest) =>
      api
        .post(`knowledge-bases/${surro_knowledge_id}/search`, { json: searchParams })
        .json<SearchKnowledgeBaseResponse>(),
  });

  return {
    search: mutate,
    searchAsync: mutateAsync,
    searchResults: data,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetSearchRecords = (surro_knowledge_id: number) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.knowledgeBases.searchRecords(surro_knowledge_id),
    queryFn: () =>
      api.get(`knowledge-bases/${surro_knowledge_id}/search-records`).json<SearchRecord[]>(),
    enabled: !!surro_knowledge_id,
  });

  return {
    searchRecords: data ?? [],
    isPending,
    isError,
    error,
  };
};
