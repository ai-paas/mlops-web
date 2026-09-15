import type { GetClustersParams } from '@/types/cluster';
import type {
  GetApiMetricsParams,
  GetEventsParams,
  GetInfraNodesParams,
  GetInfraResourcesParams,
  GetMeActivitiesParams,
  GetMeMonitoringParams,
  GetProvidersHealthParams,
  GetTopUsersParams,
  GetTrendsParams,
} from '@/types/dashboard';
import type { GetDatasetsParams } from '@/types/dataset';
import type { GetKnowledgeBasesParams } from '@/types/knowledgebase';
import type { GetLearningParams } from '@/types/learning';
import type { GetMembersParams } from '@/types/member';
import type {
  GetCustomModelsParams,
  GetHubModelsParams,
  GetImprovementTaskTypesParams,
  GetModelCatalogsParams,
  GetModelFilesParams,
  GetModelFormatsParams,
  GetModelProvidersParams,
  GetModelsParams,
  GetModelTypesParams,
} from '@/types/model';
import type { GetPromptsParams } from '@/types/prompt';
import type { GetServicesParams } from '@/types/service';
import type { WorkflowTemplateListParams } from '@/types/workflow';

export type HubModelTagParams = {
  group: 'region' | 'library' | 'task' | 'framework' | 'language';
  market: string;
};

export type ProviderSpecsKeyParams = {
  provider?: string;
  credentialId?: string;
  region?: string;
  gpuOnly?: boolean;
  keyword?: string;
  limit?: number;
};

export type ProviderImagesKeyParams = {
  provider?: string;
  credentialId?: string;
  region?: string;
  keyword?: string;
  architecture?: string;
  owner?: string;
  limit?: number;
};

// K8s 리소스 kind 별 키 — `all`이 무효화 prefix, `list`가 실제 쿼리 키
const kubernetesKind = (kind: string) => ({
  all: ['kubernetes', kind] as const,
  list: (clusterName?: string, namespace?: string) =>
    ['kubernetes', kind, clusterName, namespace] as const,
});

export type WorkflowListParams = {
  page?: number;
  size?: number;
  search?: string;
  creator_id?: string;
  service_id?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'ERROR';
  /** 정렬 기준. `,`로 다중 키, `-` 접두사는 DESC. 기본 -created_at. 허용: id, name, created_at, updated_at, created_by, status */
  sort?: string;
};

export const queryKeys = {
  dashboard: {
    all: ['dashboard'] as const,
    summary: () => [...queryKeys.dashboard.all, 'summary'] as const,
    meSummary: () => [...queryKeys.dashboard.all, 'me', 'summary'] as const,
    meServices: () => [...queryKeys.dashboard.all, 'me', 'services'] as const,
    meMonitoring: (params: GetMeMonitoringParams = {}) =>
      [...queryKeys.dashboard.all, 'me', 'monitoring', params] as const,
    meActivities: (params: GetMeActivitiesParams = {}) =>
      [...queryKeys.dashboard.all, 'me', 'activities', params] as const,
    topUsers: (params: GetTopUsersParams) =>
      [...queryKeys.dashboard.all, 'users', 'top', params] as const,
    infraStatus: () => [...queryKeys.dashboard.all, 'infra', 'status'] as const,
    infraNodes: (params: GetInfraNodesParams) =>
      [...queryKeys.dashboard.all, 'infra', 'nodes', params] as const,
    infraResources: (params: GetInfraResourcesParams) =>
      [...queryKeys.dashboard.all, 'infra', 'resources', params] as const,
    events: (params: GetEventsParams = {}) =>
      [...queryKeys.dashboard.all, 'events', params] as const,
    trends: (params: GetTrendsParams = {}) =>
      [...queryKeys.dashboard.all, 'trends', params] as const,
    apiMetrics: (params: GetApiMetricsParams = {}) =>
      [...queryKeys.dashboard.all, 'api-metrics', params] as const,
    providersHealth: (params: GetProvidersHealthParams = {}) =>
      [...queryKeys.dashboard.all, 'providers', 'health', params] as const,
  },
  datasets: {
    all: ['datasets'] as const,
    list: (params: GetDatasetsParams = {}) => [...queryKeys.datasets.all, params] as const,
    detail: (datasetId?: number) => [...queryKeys.datasets.all, datasetId] as const,
    kinds: () => [...queryKeys.datasets.all, 'kinds'] as const,
  },
  knowledgeBases: {
    all: ['knowledge-bases'] as const,
    list: (params: GetKnowledgeBasesParams = {}) =>
      [...queryKeys.knowledgeBases.all, params] as const,
    detail: (knowledgeBaseId?: number) =>
      [...queryKeys.knowledgeBases.all, knowledgeBaseId] as const,
    files: (knowledgeBaseId: number) =>
      [...queryKeys.knowledgeBases.detail(knowledgeBaseId), 'files'] as const,
    searchRecords: (knowledgeBaseId: number) =>
      [...queryKeys.knowledgeBases.detail(knowledgeBaseId), 'search-records'] as const,
  },
  knowledgeBaseMeta: {
    chunkTypes: ['chunk-types'] as const,
    languages: ['languages'] as const,
    searchMethods: ['search-methods'] as const,
  },
  members: {
    all: ['members'] as const,
    list: (params: GetMembersParams = {}) => [...queryKeys.members.all, params] as const,
    detail: (memberId?: string) => [...queryKeys.members.all, memberId] as const,
  },
  models: {
    all: ['models'] as const,
    list: (params: GetModelsParams = {}) => [...queryKeys.models.all, params] as const,
    detail: (modelId: number) => [...queryKeys.models.all, 'detail', modelId] as const,
    // detail 하위 계층 — 모델 삭제 시 detail 제거·무효화가 파일 캐시까지 함께 덮는다
    files: (modelId: number, params: GetModelFilesParams = {}) =>
      [...queryKeys.models.detail(modelId), 'files', params] as const,
  },
  customModels: {
    all: ['custom-models'] as const,
    list: (params: GetCustomModelsParams = {}) => [...queryKeys.customModels.all, params] as const,
  },
  modelCatalogs: {
    all: ['model-catalogs'] as const,
    list: (params: GetModelCatalogsParams = {}) =>
      [...queryKeys.modelCatalogs.all, params] as const,
  },
  modelProviders: {
    all: ['providers'] as const,
    list: (params: GetModelProvidersParams = {}) =>
      [...queryKeys.modelProviders.all, params] as const,
  },
  modelTypes: {
    all: ['model-types'] as const,
    list: (params: GetModelTypesParams = {}) => [...queryKeys.modelTypes.all, params] as const,
  },
  modelFormats: {
    all: ['model-formats'] as const,
    list: (params: GetModelFormatsParams = {}) => [...queryKeys.modelFormats.all, params] as const,
  },
  hubModels: {
    all: ['hub-connect'] as const,
    list: (params: GetHubModelsParams) => [...queryKeys.hubModels.all, params] as const,
  },
  hubModelTags: {
    all: ['hub-connect-tags'] as const,
    list: (params: HubModelTagParams) => [...queryKeys.hubModelTags.all, params] as const,
  },
  modelImprovements: {
    all: ['model-improvements'] as const,
    taskTypes: (params: GetImprovementTaskTypesParams = {}) =>
      [...queryKeys.modelImprovements.all, 'task-types', params] as const,
    status: (taskId?: string) => [...queryKeys.modelImprovements.all, 'status', taskId] as const,
  },
  prompts: {
    all: ['prompts'] as const,
    list: (params: GetPromptsParams = {}) => [...queryKeys.prompts.all, params] as const,
    detail: (promptId: number) => [...queryKeys.prompts.all, 'detail', promptId] as const,
    variableTypes: () => [...queryKeys.prompts.all, 'variable-types'] as const,
  },
  services: {
    all: ['services'] as const,
    list: (params: GetServicesParams = {}) => [...queryKeys.services.all, params] as const,
    detail: (serviceId?: string) => [...queryKeys.services.all, serviceId] as const,
  },
  learning: {
    all: ['learning'] as const,
    list: (params: GetLearningParams = {}) => [...queryKeys.learning.all, params] as const,
    detail: (experimentId?: number) => [...queryKeys.learning.all, experimentId] as const,
    status: (experimentId?: number) => [...queryKeys.learning.all, 'status', experimentId] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    list: (params: WorkflowListParams) => [...queryKeys.workflows.all, params] as const,
    detail: (workflowId?: number | string) => [...queryKeys.workflows.all, workflowId] as const,
    componentTypes: () => [...queryKeys.workflows.all, 'component-types'] as const,
    templates: {
      all: ['workflows', 'templates'] as const,
      list: (params: WorkflowTemplateListParams = {}) =>
        [...queryKeys.workflows.templates.all, params] as const,
      detail: (templateId?: string) =>
        [...queryKeys.workflows.templates.all, 'detail', templateId] as const,
    },
    status: (workflowId?: string) => [...queryKeys.workflows.all, 'status', workflowId] as const,
    models: (workflowId?: string) => [...queryKeys.workflows.all, 'models', workflowId] as const,
    finalizeCleanup: (workflowId?: string) =>
      [...queryKeys.workflows.all, 'finalize-cleanup', workflowId] as const,
    finalizeDeletion: (workflowId?: string) =>
      [...queryKeys.workflows.all, 'finalize-deletion', workflowId] as const,
  },
  // ============= 인프라(any-cloud) 도메인 =============
  clusters: {
    all: ['clusters'] as const,
    list: (params: GetClustersParams = {}) => [...queryKeys.clusters.all, params] as const,
    // useGetCluster 는 clusterId, 무효화 지점은 clusterName 을 쓰는 곳도 있어 둘 다 수용
    detail: (clusterIdOrName?: string) =>
      [...queryKeys.clusters.all, 'detail', clusterIdOrName] as const,
    health: (clusterName?: string) => [...queryKeys.clusters.all, 'health', clusterName] as const,
    operations: (clusterName?: string, params?: Record<string, string>) =>
      [...queryKeys.clusters.all, 'operations', clusterName, params] as const,
    stateHistory: (clusterName?: string) =>
      [...queryKeys.clusters.all, 'state-history', clusterName] as const,
    resourceKinds: (clusterName?: string) =>
      [...queryKeys.clusters.all, 'resource-kinds', clusterName] as const,
  },
  kubernetes: {
    all: ['kubernetes'] as const,
    nodes: kubernetesKind('nodes'),
    namespaces: kubernetesKind('namespaces'),
    deployments: kubernetesKind('deployments'),
    replicaSets: kubernetesKind('replicasets'),
    pods: kubernetesKind('pods'),
    services: kubernetesKind('services'),
    daemonSets: kubernetesKind('daemonsets'),
    gpuSchedulings: kubernetesKind('gpu-schedulings'),
    serviceAccounts: kubernetesKind('service-accounts'),
    configMaps: kubernetesKind('config-maps'),
    secrets: kubernetesKind('secrets'),
    // 'pods' prefix 무효화에 휩쓸리지 않도록 별도 세그먼트 유지
    podsBySelector: (clusterName?: string, namespace?: string, labelSelector?: string) =>
      [...queryKeys.kubernetes.all, 'pods-by-selector', clusterName, namespace, labelSelector] as const,
    resource: {
      all: ['kubernetes', 'resource'] as const,
      detail: (
        resourceType?: string,
        resourceName?: string,
        clusterName?: string,
        namespace?: string
      ) =>
        [...queryKeys.kubernetes.resource.all, resourceType, resourceName, clusterName, namespace] as const,
    },
    events: {
      all: ['kubernetes', 'events'] as const,
      list: (
        resourceType?: string,
        resourceName?: string,
        clusterName?: string,
        namespace?: string
      ) =>
        [...queryKeys.kubernetes.events.all, resourceType, resourceName, clusterName, namespace] as const,
    },
    podLogs: (
      clusterName?: string,
      namespace?: string,
      podName?: string,
      options?: { tailLines?: number; container?: string; enabled?: boolean }
    ) => [...queryKeys.kubernetes.all, 'pod-logs', clusterName, namespace, podName, options] as const,
  },
  vms: {
    all: ['vms'] as const,
    list: (params: Record<string, string> = {}) => [...queryKeys.vms.all, params] as const,
    detail: (vmName?: string) => [...queryKeys.vms.all, 'detail', vmName] as const,
    // detail(vmName) 하위 prefix — detail 무효화가 operations/stateHistory/nodes 를 함께 커버
    operations: (vmName?: string, pageSize?: number) =>
      [...queryKeys.vms.detail(vmName), 'operations', pageSize] as const,
    stateHistory: (vmName?: string, pageSize?: number) =>
      [...queryKeys.vms.detail(vmName), 'state-history', pageSize] as const,
    nodes: (vmName?: string) => [...queryKeys.vms.detail(vmName), 'nodes'] as const,
  },
  credentials: {
    all: ['credentials'] as const,
    list: (params?: { provider?: string }) => [...queryKeys.credentials.all, params] as const,
    detail: (credentialId?: string) =>
      [...queryKeys.credentials.all, 'detail', credentialId] as const,
  },
  operations: {
    all: ['operations'] as const,
    list: (params: Record<string, unknown> = {}) => [...queryKeys.operations.all, params] as const,
    detail: (operationId?: string) => [...queryKeys.operations.all, 'detail', operationId] as const,
  },
  // model 도메인의 modelProviders.all(['providers'])와 prefix 충돌하지 않도록 'infra-providers' 사용
  infraProviders: {
    all: ['infra-providers'] as const,
    regions: (provider?: string, credentialId?: string) =>
      [...queryKeys.infraProviders.all, 'regions', provider, credentialId] as const,
    specs: (params: ProviderSpecsKeyParams = {}) =>
      [...queryKeys.infraProviders.all, 'specs', params] as const,
    images: (params: ProviderImagesKeyParams = {}) =>
      [...queryKeys.infraProviders.all, 'images', params] as const,
    configSchema: (provider?: string) =>
      [...queryKeys.infraProviders.all, 'config-schema', provider] as const,
  },
  addons: {
    catalog: ['addon-catalog'] as const,
    all: ['cluster-addons'] as const,
    byCluster: (clusterName?: string) => [...queryKeys.addons.all, clusterName] as const,
    // byCluster(clusterName) 하위 prefix — 클러스터 단위 무효화가 detail 을 함께 커버
    detail: (clusterName?: string, addonId?: string) =>
      [...queryKeys.addons.byCluster(clusterName), 'detail', addonId] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    list: (repoName?: string) => [...queryKeys.catalog.all, repoName] as const,
    detail: (repoName?: string, chartName?: string, version?: string) =>
      [...queryKeys.catalog.all, 'detail', repoName, chartName, version] as const,
    readme: (repoName?: string, chartName?: string, version?: string) =>
      [...queryKeys.catalog.all, 'readme', repoName, chartName, version] as const,
    values: (repoName?: string, chartName?: string, version?: string) =>
      [...queryKeys.catalog.all, 'values', repoName, chartName, version] as const,
  },
  helmReleases: {
    all: ['helm-releases'] as const,
    list: (params: Record<string, string | number> = {}) =>
      [...queryKeys.helmReleases.all, params] as const,
    resources: (releaseName?: string, clusterId?: string, namespace?: string) =>
      [...queryKeys.helmReleases.all, 'resources', releaseName, clusterId, namespace] as const,
    values: (releaseName?: string) =>
      [...queryKeys.helmReleases.all, 'values', releaseName] as const,
  },
  helmRepositories: {
    all: ['helm-repositories'] as const,
    list: (params: Record<string, string | number> = {}) =>
      [...queryKeys.helmRepositories.all, 'list', params] as const,
    detail: (name?: string) => [...queryKeys.helmRepositories.all, 'detail', name] as const,
    exists: (name?: string) => [...queryKeys.helmRepositories.all, 'exists', name] as const,
  },
  monitoring: {
    all: ['monitoring'] as const,
    instant: (query?: string, clusterName?: string) =>
      [...queryKeys.monitoring.all, 'instant', query, clusterName] as const,
    range: (clusterName?: string, query?: string, start?: number, end?: number, step?: number) =>
      [...queryKeys.monitoring.all, 'range', clusterName, query, start, end, step] as const,
    multi: (clusterName?: string, signature?: string) =>
      [...queryKeys.monitoring.all, 'multi', clusterName, signature] as const,
    podsResource: (clusterName?: string, namespace?: string) =>
      [...queryKeys.monitoring.all, 'pods-resource', clusterName, namespace] as const,
  },
  observability: {
    all: ['observability'] as const,
    targets: (clusterName?: string) =>
      [...queryKeys.observability.all, 'targets', clusterName] as const,
    alerts: (clusterName?: string) =>
      [...queryKeys.observability.all, 'alerts', clusterName] as const,
    alertSilences: (clusterName?: string) =>
      [...queryKeys.observability.all, 'alert-silences', clusterName] as const,
    alertRules: () => [...queryKeys.observability.all, 'alert-rules'] as const,
    dashboard: (clusterName?: string) =>
      [...queryKeys.observability.all, 'dashboard', clusterName] as const,
    standardMetric: (clusterName?: string, metric?: string, params?: Record<string, string>) =>
      [...queryKeys.observability.all, 'standard-metric', clusterName, metric, params] as const,
  },
  adminAgents: {
    all: ['admin-agents'] as const,
  },
  auditLogs: {
    all: ['audit-logs'] as const,
    list: (params: Record<string, string | number> = {}) =>
      [...queryKeys.auditLogs.all, params] as const,
  },
};
