import type { ResourceId } from './resource-meta';

// YamlResourceEditor 는 입력값을 JSON.parse 로 파싱 — backend 가 JSON body 만 받음.
// 사용자가 YAML 로 변환해 다루든 그대로 두든 자유롭게 두되, 초기 시드는 backend 가 즉시 적용 가능한 JSON 으로 제공.

const ns = (namespace?: string) => namespace ?? 'default';

const pretty = (obj: unknown): string => JSON.stringify(obj, null, 2);

export const buildResourceSkeleton = (
  id: ResourceId,
  defaultNamespace?: string
): string | undefined => {
  const namespace = ns(defaultNamespace);
  switch (id) {
    case 'pods':
      return pretty({
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: { name: 'example-pod', namespace },
        spec: {
          containers: [
            {
              name: 'app',
              image: 'nginx:latest',
              ports: [{ containerPort: 80 }],
            },
          ],
        },
      });
    case 'deployments':
      return pretty({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: 'example-deployment', namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: 'example' } },
          template: {
            metadata: { labels: { app: 'example' } },
            spec: {
              containers: [
                { name: 'app', image: 'nginx:latest', ports: [{ containerPort: 80 }] },
              ],
            },
          },
        },
      });
    case 'replicasets':
      return pretty({
        apiVersion: 'apps/v1',
        kind: 'ReplicaSet',
        metadata: { name: 'example-replicaset', namespace },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: 'example' } },
          template: {
            metadata: { labels: { app: 'example' } },
            spec: {
              containers: [{ name: 'app', image: 'nginx:latest' }],
            },
          },
        },
      });
    case 'daemonsets':
      return pretty({
        apiVersion: 'apps/v1',
        kind: 'DaemonSet',
        metadata: { name: 'example-daemonset', namespace },
        spec: {
          selector: { matchLabels: { app: 'example' } },
          template: {
            metadata: { labels: { app: 'example' } },
            spec: {
              containers: [{ name: 'app', image: 'nginx:latest' }],
            },
          },
        },
      });
    case 'services':
      return pretty({
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: 'example-service', namespace },
        spec: {
          selector: { app: 'example' },
          ports: [{ port: 80, targetPort: 80, protocol: 'TCP' }],
          type: 'ClusterIP',
        },
      });
    case 'configmaps':
      return pretty({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'example-config', namespace },
        data: { key: 'value' },
      });
    case 'secrets':
      // stringData 사용 — base64 인코딩 불필요. backend 가 직접 받음
      return pretty({
        apiVersion: 'v1',
        kind: 'Secret',
        metadata: { name: 'example-secret', namespace },
        type: 'Opaque',
        stringData: { key: 'value' },
      });
    case 'service-accounts':
      return pretty({
        apiVersion: 'v1',
        kind: 'ServiceAccount',
        metadata: { name: 'example-sa', namespace },
      });
    case 'namespaces':
      return pretty({
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: { name: 'example-namespace' },
      });
    case 'gpu-scheduling':
      // gpu-scheduling 은 보통 PriorityClass / ResourceQuota / Custom CRD 형태 — 가장 흔한 PriorityClass 시드
      return pretty({
        apiVersion: 'scheduling.k8s.io/v1',
        kind: 'PriorityClass',
        metadata: { name: 'gpu-high-priority' },
        value: 1000,
        globalDefault: false,
        description: 'GPU workload high priority',
      });
    case 'nodes':
    case 'operations':
    default:
      // node 는 cloud-provider 가 생성 — 수동 생성 사용 사례 없음. operations 는 read-only.
      return undefined;
  }
};