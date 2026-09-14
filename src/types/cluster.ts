export type ClusterSource = 'vm' | 'registered';

export type ClusterStatus =
  | 'PROVISIONING'
  | 'READY'
  | 'FAILED'
  | 'BLOCKED'
  | 'DELETING'
  | 'DELETED'
  | 'IMPORTED'
  | 'AGENT_PENDING'
  | string;

export type ClusterAgentConnectivity =
  | 'CONNECTED'
  | 'DEGRADED'
  | 'DISCONNECTED'
  | 'NOT_REGISTERED'
  | string;

export interface ClusterWorkflowProgress {
  currentStep?: string;
  lastSuccessfulStep?: string;
  percent?: number;
  stepStartedAt?: string;
  retryCount?: number;
}

export interface Cluster {
  source?: ClusterSource;
  clusterName?: string;
  // 백엔드 1:1 link — VmClusterEntity 가 같은 이름으로 존재하면 채워짐 (자체로는 clusterName 과 동일).
  // UI 가 cluster 상세 → VM 메뉴 cross-link 시 사용.
  linkedVmName?: string;
  provider?: string;
  region?: string;
  environment?: string;
  status?: ClusterStatus;
  workerCount?: number;
  createdAt?: string;
  readyAt?: string;
  lastError?: string;
  hasGpuNodes?: boolean;
  agentConnectivity?: ClusterAgentConnectivity;
  agentHeartbeatSecondsAgo?: number;
  agentHealthSummary?: string;
  workflowProgress?: ClusterWorkflowProgress;
  // 옛 폼 호환 (deprecated — 새 API 응답에는 없음, UI 폼 재설계 시 제거)
  id?: string;
  description?: string;
  clusterType?: string;
  clusterProvider?: string;
  apiServerUrl?: string;
  apiServerIp?: string;
  monitServerUrl?: string | null;
  updatedAt?: string;
  version?: string;
  serverCa?: string;
  clientCa?: string;
  clientKey?: string;
  clientToken?: string | null;
}

export interface GetClustersParams {
  page?: number;
  size?: number;
  search?: string;
}

export interface VmClusterSpec {
  provider: string;
  region: string;
  environment?: string;
  credentialId?: string;
  config?: Record<string, string>;
  hasGpuNodes?: boolean;
  useSpot?: boolean;
  image?: string;
}

export interface RegisteredClusterSpec {
  provider: string;
  clusterType?: string;
  description?: string;
  hasGpuNodes?: boolean;
  addons?: Array<Record<string, unknown>>;
}

export type CreateClusterRequest =
  | { source: 'vm'; clusterName: string; spec: VmClusterSpec }
  | { source: 'registered'; clusterName: string; spec: RegisteredClusterSpec };

// PATCH 는 spec.workerCount 만 (VM source scale 변경)
export interface UpdateClusterRequest {
  clusterName: string;
  clusterId?: string; // 옛 호출자 호환
  spec: {
    workerCount?: number;
  };
}

export interface OperationProgress {
  currentStep?: string;
  stepIndex?: number;
  totalSteps?: number;
  percent?: number;
}

export type OperationState = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | string;

/**
 * 백엔드 ProvisionEvent 와 1:1. SSE `pulumi` 이벤트로만 오고 저장은 없다 —
 * 스트림을 놓치면 다시 못 받는다.
 */
export interface ProvisionEvent {
  operationId?: string;
  /** pulumi event kind — 'diagnostic' | 'resOutputs' | 'summary' 등. */
  type?: string;
  timestamp?: string;
  resourceUrn?: string;
  message?: string;
  severity?: 'info' | 'warning' | 'error' | string;
  raw?: Record<string, unknown>;
}

export interface Operation {
  id?: string;
  type?: string;
  resourceType?: string;
  resourceId?: string;
  state?: OperationState;
  progress?: OperationProgress;
  errorMessage?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
}

// Cluster 등록 직후 한 번만 노출되는 agent-led bootstrap 정보. token 은 short-lived (default 30분).
export interface BootstrapInfo {
  token?: string;
  expiresAt?: string;
  backendEndpoint?: string;
  manifestUrl?: string;
  helmInstallCommand?: string;
  kubectlApplyCommand?: string;
}

// POST /v1/clusters 응답 — Operation envelope + Bootstrap
export interface ClusterRegistrationResponse {
  operation?: Operation;
  bootstrap?: BootstrapInfo;
}

type KubernetesMetadata<TNamespaced extends boolean = true> = {
  name: string;
  creationTimestamp: string;
  deletionTimestamp?: string;
  labels?: {
    [key: string]: string;
  };
  ownerReferences?: Array<{
    kind: string;
    name: string;
    uid: string;
  }>;
  uid?: string;
} & (TNamespaced extends true ? { namespace: string } : { namespace?: never });

interface KubernetesResource<TKind extends string, TNamespaced extends boolean = true> {
  apiVersion: string;
  kind: TKind;
  metadata: KubernetesMetadata<TNamespaced>;
}

// 쿠버네티스 노드 타입
export interface KubernetesNode extends KubernetesResource<'Node', false> {
  spec: {
    taints?: Array<{
      key?: string;
      effect?: string;
    }>;
  };
  status: {
    conditions?: Array<{
      type: string;
      status: string;
    }>;
    capacity?: {
      [key: string]: string;
    };
    allocatable?: {
      [key: string]: string;
    };
    nodeInfo?: {
      osImage?: string;
      kubeletVersion?: string;
    };
  };
  roles?: string;
  version?: string;
  internalIP?: string;
  externalIP?: string;
}

// 쿠버네티스 네임스페이스 타입
export interface KubernetesNamespace extends KubernetesResource<'Namespace', false> {
  status: {
    phase: string;
  };
  workspace?: string;
}

export interface KubernetesDeployment extends KubernetesResource<'Deployment'> {
  spec: {
    replicas?: number;
  };
  status: {
    readyReplicas?: number;
    replicas?: number;
    availableReplicas?: number;
  };
}

export interface KubernetesReplicaSet extends KubernetesResource<'ReplicaSet'> {
  spec: {
    replicas?: number;
  };
  status: {
    readyReplicas?: number;
    replicas?: number;
    availableReplicas?: number;
  };
}

export interface KubernetesPod extends KubernetesResource<'Pod'> {
  spec: {
    nodeName?: string;
    schedulerName?: string;
    containers?: Array<{
    name: string;
      image: string;
      resources?: {
        requests?: {
          [key: string]: string;
        };
        limits?: {
          [key: string]: string;
        };
      };
    }>;
  };
  status: {
    phase: string;
    reason?: string;
    startTime?: string;
    podIP?: string;
    hostIP?: string;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state?: {
        waiting?: {
          reason?: string;
          message?: string;
        };
        running?: {
          startedAt?: string;
        };
        terminated?: {
          reason?: string;
          exitCode?: number;
          signal?: number;
          finishedAt?: string;
        };
      };
    }>;
    initContainerStatuses?: Array<{
      name: string;
      ready?: boolean;
      restartCount?: number;
      state?: {
        waiting?: {
          reason?: string;
          message?: string;
        };
        running?: {
          startedAt?: string;
        };
        terminated?: {
          reason?: string;
          exitCode?: number;
          signal?: number;
          finishedAt?: string;
        };
      };
    }>;
    conditions?: Array<{
      type?: string;
      status?: string;
    }>;
  };
}

export interface KubernetesService extends KubernetesResource<'Service'> {
  spec: {
    type: string;
    clusterIP: string;
    ports?: Array<{
      port: number;
      targetPort: number;
      protocol: string;
    }>;
  };
  status: {
    loadBalancer?: {
      ingress?: Array<{
        ip: string;
      }>;
    };
  };
}

export interface KubernetesDaemonSet extends KubernetesResource<'DaemonSet'> {
  spec: {
    replicas?: number;
  };
  status: {
    readyReplicas?: number;
    replicas?: number;
    availableReplicas?: number;
  };
}

export interface GpuScheduling extends KubernetesResource<string> {
  spec: {
    type?: string;
    replicas?: number;
  };
  status: {
    readyReplicas?: number;
    replicas?: number;
    availableReplicas?: number;
  };
}

export type KubernetesServiceAccount = KubernetesResource<'ServiceAccount'>;

export interface KubernetesConfigMap extends KubernetesResource<'ConfigMap'> {
  data?: {
    [key: string]: string;
  };
}

export interface KubernetesSecret extends KubernetesResource<'Secret'> {
  type?: string;
  data?: {
    [key: string]: string;
  };
}
