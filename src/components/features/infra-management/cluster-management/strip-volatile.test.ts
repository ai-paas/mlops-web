import { describe, it, expect } from 'vitest';
import { stripVolatile } from './strip-volatile';

// kubectl get -o yaml 결과와 유사한 현실적인 입력 픽스처
const makeDeployment = (): Record<string, unknown> => ({
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'nginx',
    namespace: 'default',
    labels: { app: 'nginx' },
    annotations: {
      'kubectl.kubernetes.io/last-applied-configuration': '{"apiVersion":"apps/v1"}',
      'deployment.kubernetes.io/revision': '3',
    },
    uid: 'abc-123',
    resourceVersion: '12345',
    selfLink: '/apis/apps/v1/namespaces/default/deployments/nginx',
    creationTimestamp: '2026-01-01T00:00:00Z',
    generation: 4,
    managedFields: [{ manager: 'kubectl', operation: 'Apply' }],
    ownerReferences: [{ kind: 'ReplicaSet', name: 'nginx-abc' }],
    finalizers: ['kubernetes.io/pv-protection'],
  },
  spec: {
    replicas: 2,
    template: { metadata: { name: 'nginx-pod' } },
  },
  status: { readyReplicas: 2, conditions: [] },
});

describe('stripVolatile', () => {
  // ============================================
  // 최상위 필드 제거
  // ============================================
  describe('최상위 필드 제거', () => {
    it('최상위 status 필드를 제거한다', () => {
      const result = stripVolatile(makeDeployment());

      expect(result).not.toHaveProperty('status');
    });

    it('status 외의 최상위 필드(apiVersion, kind, spec)는 보존한다', () => {
      const result = stripVolatile(makeDeployment());

      expect(result.apiVersion).toBe('apps/v1');
      expect(result.kind).toBe('Deployment');
      expect(result.spec).toEqual({
        replicas: 2,
        template: { metadata: { name: 'nginx-pod' } },
      });
    });

    it('spec 내부에 중첩된 status는 제거하지 않는다', () => {
      const result = stripVolatile({
        kind: 'Custom',
        spec: { status: 'Active', nested: { status: { phase: 'Running' } } },
      });

      expect(result.spec).toEqual({
        status: 'Active',
        nested: { status: { phase: 'Running' } },
      });
    });
  });

  // ============================================
  // metadata server-managed 필드 제거
  // ============================================
  describe('metadata server-managed 필드 제거', () => {
    it.each([
      'uid',
      'resourceVersion',
      'selfLink',
      'creationTimestamp',
      'generation',
      'managedFields',
      'ownerReferences',
      'finalizers',
    ])('metadata.%s 필드를 제거한다', (field) => {
      const result = stripVolatile(makeDeployment());
      const meta = result.metadata as Record<string, unknown>;

      expect(meta).not.toHaveProperty(field);
    });

    it('metadata의 name, namespace, labels, annotations는 보존한다', () => {
      const result = stripVolatile(makeDeployment());
      const meta = result.metadata as Record<string, unknown>;

      expect(meta.name).toBe('nginx');
      expect(meta.namespace).toBe('default');
      expect(meta.labels).toEqual({ app: 'nginx' });
      expect(meta.annotations).toEqual({
        'kubectl.kubernetes.io/last-applied-configuration': '{"apiVersion":"apps/v1"}',
        'deployment.kubernetes.io/revision': '3',
      });
    });

    it('annotations 내부의 kubectl last-applied 키는 제거하지 않는다 (annotations 전체 보존)', () => {
      const result = stripVolatile(makeDeployment());
      const meta = result.metadata as Record<string, unknown>;
      const annotations = meta.annotations as Record<string, unknown>;

      expect(annotations['kubectl.kubernetes.io/last-applied-configuration']).toBe(
        '{"apiVersion":"apps/v1"}'
      );
    });

    it('제거 대상과 이름이 같아도 최상위 필드면 보존한다 (metadata 내부만 제거)', () => {
      const result = stripVolatile({
        kind: 'Custom',
        uid: 'top-level-uid',
        resourceVersion: 'top-level-rv',
        metadata: { name: 'x', uid: 'meta-uid' },
      });

      expect(result.uid).toBe('top-level-uid');
      expect(result.resourceVersion).toBe('top-level-rv');
      expect(result.metadata).toEqual({ name: 'x' });
    });

    it('spec.template.metadata 등 중첩된 metadata는 건드리지 않는다 (최상위 metadata만 처리)', () => {
      const result = stripVolatile({
        kind: 'Deployment',
        spec: {
          template: {
            metadata: { name: 'pod', uid: 'nested-uid', creationTimestamp: '2026-01-01' },
          },
        },
      });

      expect(result.spec).toEqual({
        template: {
          metadata: { name: 'pod', uid: 'nested-uid', creationTimestamp: '2026-01-01' },
        },
      });
    });
  });

  // ============================================
  // 경계 입력
  // ============================================
  describe('경계 입력', () => {
    it('빈 객체 입력은 빈 객체를 반환한다', () => {
      expect(stripVolatile({})).toEqual({});
    });

    it('status만 있는 입력은 빈 객체를 반환한다', () => {
      expect(stripVolatile({ status: { phase: 'Running' } })).toEqual({});
    });

    it('metadata가 null이면 그대로 통과시킨다', () => {
      const result = stripVolatile({ kind: 'Pod', metadata: null });

      expect(result).toEqual({ kind: 'Pod', metadata: null });
    });

    it.each([
      ['문자열', 'not-an-object'],
      ['숫자', 42],
      ['불리언', true],
      ['undefined', undefined],
    ])('metadata가 객체가 아니면(%s) 그대로 통과시킨다', (_label, value) => {
      const result = stripVolatile({ kind: 'Pod', metadata: value });

      expect(result).toEqual({ kind: 'Pod', metadata: value });
    });

    it('metadata가 빈 객체면 빈 객체로 유지한다', () => {
      const result = stripVolatile({ kind: 'Pod', metadata: {} });

      expect(result).toEqual({ kind: 'Pod', metadata: {} });
    });

    it('제거 대상이 전혀 없는 입력은 모든 필드를 그대로 보존한다', () => {
      const input = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: { name: 'cm', labels: { a: 'b' } },
        data: { key: 'value' },
      };

      expect(stripVolatile(input)).toEqual(input);
    });

    // 버그 의심 — 팀 확인 필요: Array.isArray 가드가 없어 배열도 typeof 'object'로 통과,
    // Object.entries를 거치며 배열이 인덱스 키 객체({ '0': ... })로 형태가 바뀐다.
    // 현재 동작을 고정하는 특성화 테스트.
    it('metadata가 배열이면 인덱스 키 객체로 변환된다 (현재 동작 고정)', () => {
      const result = stripVolatile({ kind: 'Pod', metadata: ['a', 'b'] });

      expect(Array.isArray(result.metadata)).toBe(false);
      expect(result.metadata).toEqual({ 0: 'a', 1: 'b' });
    });
  });

  // ============================================
  // 불변성
  // ============================================
  describe('불변성', () => {
    it('입력 원본 객체를 변형하지 않는다', () => {
      const input = makeDeployment();
      const snapshot = structuredClone(input);

      stripVolatile(input);

      expect(input).toEqual(snapshot);
    });

    it('새 객체를 반환하며 metadata도 새 객체다', () => {
      const input = makeDeployment();
      const result = stripVolatile(input);

      expect(result).not.toBe(input);
      expect(result.metadata).not.toBe(input.metadata);
    });

    it('metadata 외 최상위 값은 참조를 공유한다 (얕은 복사)', () => {
      const input = makeDeployment();
      const result = stripVolatile(input);

      expect(result.spec).toBe(input.spec);
    });

    it('metadata 내부에 남는 값(labels 등)은 참조를 공유한다 (얕은 복사)', () => {
      const input = makeDeployment();
      const inputMeta = input.metadata as Record<string, unknown>;
      const result = stripVolatile(input);
      const resultMeta = result.metadata as Record<string, unknown>;

      expect(resultMeta.labels).toBe(inputMeta.labels);
    });
  });
});