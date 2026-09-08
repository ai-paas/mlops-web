import type { ReactNode } from 'react';

// 좌측 navigation rail 의 카테고리 + 리소스 메타.
// component 는 page.tsx 에서 직접 매핑 (props 시그니처 다양해 generic 함수형 매핑 어려움).

export type ResourceCategoryId = 'workload' | 'network' | 'config' | 'cluster' | 'operations';

export type ResourceId =
  | 'pods'
  | 'deployments'
  | 'replicasets'
  | 'daemonsets'
  | 'services'
  | 'configmaps'
  | 'secrets'
  | 'service-accounts'
  | 'nodes'
  | 'namespaces'
  | 'gpu-scheduling'
  | 'operations';

export interface ResourceItem {
  id: ResourceId;
  label: string;
  /** namespace selector 가 영향을 주는지 — false 면 cluster-scoped (selector disable) */
  namespaced: boolean;
}

export interface ResourceCategory {
  id: ResourceCategoryId;
  label: string;
  items: ResourceItem[];
}

export const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: 'workload',
    label: '워크로드',
    items: [
      { id: 'pods', label: '파드', namespaced: true },
      { id: 'deployments', label: '디플로이먼트', namespaced: true },
      { id: 'replicasets', label: '레플리카셋', namespaced: true },
      { id: 'daemonsets', label: '데몬셋', namespaced: true },
    ],
  },
  {
    id: 'network',
    label: '네트워크',
    items: [{ id: 'services', label: '서비스', namespaced: true }],
  },
  {
    id: 'config',
    label: '구성',
    items: [
      { id: 'configmaps', label: '컨픽맵', namespaced: true },
      { id: 'secrets', label: '시크릿', namespaced: true },
      { id: 'service-accounts', label: '서비스 계정', namespaced: true },
    ],
  },
  {
    id: 'cluster',
    label: '클러스터',
    items: [
      { id: 'nodes', label: '노드', namespaced: false },
      { id: 'namespaces', label: '네임스페이스', namespaced: false },
      { id: 'gpu-scheduling', label: 'GPU 스케줄링', namespaced: true },
    ],
  },
  {
    id: 'operations',
    label: '운영',
    items: [{ id: 'operations', label: '작업 이력', namespaced: false }],
  },
];

export const RESOURCE_BY_ID = new Map<ResourceId, ResourceItem>(
  RESOURCE_CATEGORIES.flatMap((c) => c.items.map((it) => [it.id, it] as const))
);

export const DEFAULT_RESOURCE: ResourceId = 'pods';

// rail 에서 react 컴포넌트는 직접 import 해서 매핑 — generic 함수형 매핑은 props 형 다양해 어려움.
// 이 타입은 page 가 dictionary 만들 때 활용.
export type ResourceComponentMap = Partial<Record<ResourceId, ReactNode>>;
