import { useState } from 'react';
import { Button, Input, useToast } from '@innogrid/ui';
import Editor, { type BeforeMount } from '@monaco-editor/react';
import { configureMonacoYaml } from 'monaco-yaml';
import { useCreateKubernetesResource } from '@/hooks/service/clusters';

interface YamlResourceEditorProps {
  clusterName?: string;
  defaultNamespace?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  /**
   * 에디터 초기 표시 텍스트. 미지정 시 기본 ConfigMap skeleton.
   * per-resource 생성 진입에서 해당 kind 의 starter template 을 주입할 때 사용.
   */
  initialYaml?: string;
}

const DEFAULT_YAML = `apiVersion: v1
kind: ConfigMap
metadata:
  name: example-config
  namespace: default
data:
  key: value
`;

// 간단한 YAML 파서 — Helm-release create 의 패턴 재사용 (yaml 라이브러리 미설치)
// kind / metadata.name / metadata.namespace 만 추출하여 호출용 path 구성
const parseHeader = (yaml: string): { kind?: string; name?: string; namespace?: string } => {
  const result: { kind?: string; name?: string; namespace?: string } = {};
  const lines = yaml.split(/\r?\n/);
  let inMetadata = false;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (line.startsWith('kind:')) {
      result.kind = trimmed.replace(/^kind:\s*/, '').trim();
    }
    if (line.startsWith('metadata:')) {
      inMetadata = true;
      continue;
    }
    // metadata 하위는 들여쓰기
    if (inMetadata) {
      // 새 최상위 키가 오면 종료
      if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
        inMetadata = false;
        continue;
      }
      if (trimmed.startsWith('name:')) {
        result.name = trimmed.replace(/^name:\s*/, '').trim();
      }
      if (trimmed.startsWith('namespace:')) {
        result.namespace = trimmed.replace(/^namespace:\s*/, '').trim();
      }
    }
  }
  return result;
};

const kindToResourceType = (kind?: string): string | undefined => {
  if (!kind) return undefined;
  const map: Record<string, string> = {
    Pod: 'pods',
    Service: 'services',
    Deployment: 'deployments',
    ReplicaSet: 'replicasets',
    DaemonSet: 'daemonsets',
    ConfigMap: 'config-maps',
    Secret: 'secrets',
    ServiceAccount: 'service-accounts',
    Namespace: 'namespaces',
    Node: 'nodes',
    Job: 'jobs',
    CronJob: 'cronjobs',
    Ingress: 'ingresses',
    StatefulSet: 'statefulsets',
    PersistentVolume: 'persistentvolumes',
    PersistentVolumeClaim: 'persistentvolumeclaims',
  };
  return map[kind] ?? `${kind.toLowerCase()}s`;
};

// JSON 으로 파싱 — backend 가 JSON body 받음. YAML → JS object 변환은 monaco-yaml 의 parse 기능 없으므로
// 사용자가 JSON 으로 직접 입력하거나 외부 라이브러리 필요. 여기는 YAML 을 JSON 으로 1:1 변환을 시도하지 않고,
// 백엔드가 JSON 만 받는다는 점을 명시한 뒤 JSON object 형태로 입력하도록 안내.
const tryParseAsJson = (text: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
};

export const YamlResourceEditor = ({
  clusterName,
  defaultNamespace,
  onSuccess,
  onCancel,
  initialYaml,
}: YamlResourceEditorProps) => {
  const { open } = useToast();
  const [yaml, setYaml] = useState<string>(initialYaml ?? DEFAULT_YAML);
  const [overrideKind, setOverrideKind] = useState<string>('');
  const [overrideNamespace, setOverrideNamespace] = useState<string>(defaultNamespace ?? '');

  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    try {
      configureMonacoYaml(monaco, {
        enableSchemaRequest: false,
        schemas: [],
        format: { enable: true },
        validate: false,
        completion: false,
        hover: false,
      });
    } catch {
      // monaco-yaml 미지원이어도 기본 YAML 동작
    }
  };

  const { createResource, isPending } = useCreateKubernetesResource({
    onSuccess: () => {
      open({ title: '리소스가 적용되었습니다.' });
      onSuccess?.();
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      open({ title: msg || '리소스 적용에 실패했습니다.', status: 'negative' });
    },
  });

  const handleApply = () => {
    if (!clusterName) {
      open({ title: '클러스터가 선택되지 않았습니다.', status: 'negative' });
      return;
    }
    const parsedJson = tryParseAsJson(yaml);
    if (!parsedJson) {
      open({
        title:
          '입력값이 유효한 JSON 객체여야 합니다. 백엔드가 JSON body 만 받으므로 JSON 형식으로 입력해주세요.',
        status: 'negative',
      });
      return;
    }
    const header = parseHeader(yaml);
    const kind = overrideKind || header.kind;
    const resourceType = kindToResourceType(kind);
    if (!resourceType) {
      open({ title: 'kind 필드를 입력해주세요.', status: 'negative' });
      return;
    }
    const namespace =
      overrideNamespace || header.namespace || defaultNamespace || undefined;
    createResource({
      resourceType,
      clusterName,
      namespace,
      body: parsedJson,
    });
  };

  return (
    <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <strong>K8s 리소스 적용</strong>
        <span style={{ fontSize: 12, color: '#666' }}>
          (JSON 객체 형식, kind 와 metadata.name 필수)
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>kind (override)</div>
          <Input
            placeholder="비우면 YAML 의 kind 필드 사용"
            value={overrideKind}
            onChange={(e) => setOverrideKind(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>namespace (override)</div>
          <Input
            placeholder="비우면 metadata.namespace 또는 기본값"
            value={overrideNamespace}
            onChange={(e) => setOverrideNamespace(e.target.value)}
          />
        </div>
      </div>

      <div style={{ height: 360, border: '1px solid #d1d5db', borderRadius: 4, overflow: 'hidden' }}>
        <Editor
          language="yaml"
          value={yaml}
          onChange={(value) => setYaml(value ?? '')}
          beforeMount={handleEditorBeforeMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            tabSize: 2,
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
        {onCancel && (
          <Button color="secondary" onClick={onCancel}>
            취소
          </Button>
        )}
        <Button color="primary" onClick={handleApply} disabled={isPending || !clusterName}>
          {isPending ? '적용 중...' : '적용'}
        </Button>
      </div>
    </div>
  );
};