import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import type { Page } from '@/types/api';
import type {
  ApiMetrics,
  ApiMetricsFlushResult,
  AuditLog,
  DashboardSummary,
  DashboardTopUsers,
  DashboardTrends,
  GetApiMetricsParams,
  GetEventsParams,
  GetInfraNodesParams,
  GetInfraResourcesParams,
  GetMeActivitiesParams,
  GetMeMonitoringParams,
  GetProvidersHealthParams,
  GetTopUsersParams,
  GetTrendsParams,
  InfraNodes,
  InfraResources,
  InfraStatus,
  MeActivity,
  MeDashboardMonitoring,
  MeDashboardServices,
  MeDashboardSummary,
  ProvidersHealth,
  TrendsRefreshResult,
} from '@/types/dashboard';

const BASE = 'admin/dashboard';
const ME_BASE = 'me/dashboard';

/** null/undefined/'' 값을 제거해 ky searchParams 에 'undefined' 문자열이 들어가지 않도록 정리 */
const toSearchParams = (params: object) =>
  Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as Record<string, string | number | boolean>;

// ────────────────────────────────────────────────────────────
// GET /summary — 대시보드 KPI 요약
// ────────────────────────────────────────────────────────────

export const useGetDashboardSummary = (enabled: boolean = true) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: () => api.get<DashboardSummary>(`${BASE}/summary`).json(),
    enabled,
  });

  return {
    summary: data,
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /me/dashboard/summary — 본인 자산만 집계한 KPI 요약
// ────────────────────────────────────────────────────────────

export const useGetMeDashboardSummary = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.meSummary(),
    queryFn: () => api.get<MeDashboardSummary>(`${ME_BASE}/summary`).json(),
  });

  return {
    summary: data,
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /me/dashboard/services — 내 서비스 현황 카드
// ────────────────────────────────────────────────────────────

export const useGetMeDashboardServices = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.meServices(),
    queryFn: () => api.get<MeDashboardServices>(`${ME_BASE}/services`).json(),
  });

  return {
    services: data?.services ?? [],
    source: data?.source,
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /me/dashboard/monitoring — 내 서비스 기간별 메트릭 + Top N
// ────────────────────────────────────────────────────────────

export const useGetMeDashboardMonitoring = (params: GetMeMonitoringParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.meMonitoring(params),
    queryFn: () =>
      api
        .get<MeDashboardMonitoring>(`${ME_BASE}/monitoring`, {
          searchParams: toSearchParams(params),
        })
        .json(),
  });

  return {
    services: data?.services ?? [],
    top: data?.top ?? {},
    source: data?.source,
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /me/dashboard/activities — 내 작업 이력
// ────────────────────────────────────────────────────────────

export const useGetMeDashboardActivities = (params: GetMeActivitiesParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.meActivities(params),
    queryFn: () =>
      api
        .get<Page<MeActivity>>(`${ME_BASE}/activities`, { searchParams: toSearchParams(params) })
        .json(),
  });

  return {
    activities: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 20,
      total: data?.total ?? 0,
    },
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /users/top — 도메인별 자산 보유 상위 사용자
// ────────────────────────────────────────────────────────────

export const useGetDashboardTopUsers = (params: GetTopUsersParams, enabled: boolean = true) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.topUsers(params),
    queryFn: () =>
      api
        .get<DashboardTopUsers>(`${BASE}/users/top`, { searchParams: toSearchParams(params) })
        .json(),
    enabled: enabled && !!params.domain,
  });

  return {
    domain: data?.domain,
    items: data?.items ?? [],
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /infra/status — 클러스터 연결 상태 (MOCK)
// ────────────────────────────────────────────────────────────

export const useGetInfraStatus = () => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.infraStatus(),
    queryFn: () => api.get<InfraStatus>(`${BASE}/infra/status`).json(),
  });

  return {
    clusters: data?.clusters ?? [],
    hasData: data?.has_data ?? false,
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /infra/nodes — 클러스터 내 노드 + 리소스 (MOCK)
// ────────────────────────────────────────────────────────────

export const useGetInfraNodes = (params: GetInfraNodesParams, enabled: boolean = true) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.infraNodes(params),
    queryFn: () =>
      api.get<InfraNodes>(`${BASE}/infra/nodes`, { searchParams: toSearchParams(params) }).json(),
    enabled: enabled && !!params.cluster,
  });

  return {
    cluster: data?.cluster,
    nodes: data?.nodes ?? [],
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /infra/resources — 노드별 단일 리소스 종류 추출 (MOCK)
// ────────────────────────────────────────────────────────────

export const useGetInfraResources = (
  params: GetInfraResourcesParams,
  enabled: boolean = true
) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.infraResources(params),
    queryFn: () =>
      api
        .get<InfraResources>(`${BASE}/infra/resources`, { searchParams: toSearchParams(params) })
        .json(),
    enabled: enabled && !!params.cluster && !!params.resource_type,
  });

  return {
    cluster: data?.cluster,
    resourceType: data?.resource_type,
    nodes: data?.nodes ?? [],
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /events — 활동 로그(audit_logs) 조회
// ────────────────────────────────────────────────────────────

export const useGetDashboardEvents = (params: GetEventsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.events(params),
    queryFn: () =>
      api.get<Page<AuditLog>>(`${BASE}/events`, { searchParams: toSearchParams(params) }).json(),
  });

  return {
    events: data?.data ?? [],
    page: {
      number: data?.page ?? 1,
      size: data?.size ?? 20,
      total: data?.total ?? 0,
    },
    isPending,
    isError,
    error,
  };
};

// ────────────────────────────────────────────────────────────
// GET /trends — 자산 일별 생성/삭제 + 가입자 추이
// ────────────────────────────────────────────────────────────

export const useGetDashboardTrends = (params: GetTrendsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.trends(params),
    queryFn: () =>
      api.get<DashboardTrends>(`${BASE}/trends`, { searchParams: toSearchParams(params) }).json(),
  });

  return {
    trends: data,
    series: data?.series ?? [],
    isPending,
    isError,
    error,
  };
};

// POST /trends/refresh — 트렌드 수동 재계산
export const useRefreshDashboardTrends = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: () => api.post<TrendsRefreshResult>(`${BASE}/trends/refresh`).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });

  return {
    refreshTrends: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

// ────────────────────────────────────────────────────────────
// GET /api-metrics — API 응답시간 히스토그램 + p95
// ────────────────────────────────────────────────────────────

export const useGetApiMetrics = (params: GetApiMetricsParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.apiMetrics(params),
    queryFn: () =>
      api.get<ApiMetrics>(`${BASE}/api-metrics`, { searchParams: toSearchParams(params) }).json(),
  });

  return {
    metrics: data,
    paths: data?.paths ?? [],
    bucketsMs: data?.buckets_ms ?? [],
    isPending,
    isError,
    error,
  };
};

// POST /api-metrics/flush — in-memory buffer 즉시 flush
export const useFlushApiMetrics = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: () => api.post<ApiMetricsFlushResult>(`${BASE}/api-metrics/flush`).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.apiMetrics() });
    },
  });

  return {
    flushApiMetrics: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};

// ────────────────────────────────────────────────────────────
// GET /providers/health — 외부 provider 헬스 상태 + 시계열
// ────────────────────────────────────────────────────────────

export const useGetProvidersHealth = (params: GetProvidersHealthParams = {}) => {
  const { data, isPending, isError, error } = useQuery({
    queryKey: queryKeys.dashboard.providersHealth(params),
    queryFn: () =>
      api
        .get<ProvidersHealth>(`${BASE}/providers/health`, { searchParams: toSearchParams(params) })
        .json(),
  });

  return {
    providers: data?.providers ?? [],
    history: data?.history ?? {},
    isPending,
    isError,
    error,
  };
};

// POST /providers/health/probe — 외부 provider 즉시 probe + 기록
export const useProbeProvidersHealth = () => {
  const queryClient = useQueryClient();

  const { mutate, isPending, isError, error, isSuccess } = useMutation({
    mutationFn: () => api.post<ProvidersHealth>(`${BASE}/providers/health/probe`).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.providersHealth() });
    },
  });

  return {
    probeProviders: mutate,
    isPending,
    isError,
    error,
    isSuccess,
  };
};
