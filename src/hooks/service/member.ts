import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  CreateMemberRequest,
  GetMembersParams,
  Member,
  UpdateMemberPayload,
} from '@/types/member';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type UpdateMemberStatusPayload = { member_id: string; is_active: boolean };

export const useCreateMember = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (data: CreateMemberRequest) => api.post('members/', { json: data }).json<Member>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
    },
  });

  return {
    createMember: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useGetMembers = (params: GetMembersParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.members.list(params),
    queryFn: () => api.get<Page<Member>>('members/', { searchParams: { ...params } }).json(),
  });

  return {
    members: data?.data ?? [],
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

export const useGetMember = (memberId?: string, enabled: boolean = true) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.members.detail(memberId),
    queryFn: () => api.get(`members/${memberId}`).json<Member>(),
    enabled,
  });

  return {
    member: data,
    isPending,
    isError,
    error,
  };
};

export const useUpdateMember = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ member_id, ...data }: UpdateMemberPayload) =>
      // 필요 시 api.patch 로 변경
      api.put(`members/${member_id}`, { json: data }).json<Member>(),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      if (vars?.member_id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(vars.member_id) });
      }
    },
  });

  return {
    updateMember: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useUpdateMemberStatus = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: ({ member_id, is_active }: UpdateMemberStatusPayload) =>
      api.patch(`members/${member_id}/status`, { searchParams: { is_active } }).json<Member>(),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.members.detail(vars.member_id) });
    },
  });

  return {
    updateMemberStatus: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

export const useDeleteMember = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: (memberId: string) =>
      api.delete(`members/${memberId}`).json<Record<string, unknown>>(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members.all });
    },
  });

  return {
    deleteMember: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};
