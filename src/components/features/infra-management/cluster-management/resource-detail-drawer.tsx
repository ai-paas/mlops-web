import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Button, useToast } from '@innogrid/ui';
import {
  useGetKubernetesResource,
  useRestartKubernetesResource,
  useScaleKubernetesResource,
} from '@/hooks/service/clusters';
import { PodLogsViewer } from '@/components/features/infra-management/pod-logs-viewer';
import { WorkloadLogsViewer } from '@/components/features/infra-management/workload-logs-viewer';
import { YamlResourceEditor } from '@/components/features/infra-management/yaml-resource-editor';
import { EventsTab } from './drawer/events-tab';
import { ScaleModal } from './scale-modal';
import { stripVolatile } from './strip-volatile';

// xterm 의존성을 초기 번들에서 분리 — Shell 탭 진입 시점에만 fetch.
const ShellTab = lazy(() =>
  import('./drawer/shell-tab').then((m) => ({ default: m.ShellTab }))
);

export type DrawerTab = 'overview' | 'yaml' | 'events' | 'logs' | 'shell';

const DRAWER_RESTARTABLE = new Set(['pods', 'deployments', 'statefulsets', 'daemonsets']);
const DRAWER_SCALABLE = new Set(['deployments', 'replicasets', 'statefulsets']);
// 집계 로그 지원 workload — selector.matchLabels 기반으로 N pod 로그 머지.
const DRAWER_WORKLOAD_LOGS = new Set(['deployments', 'replicasets', 'statefulsets', 'daemonsets']);

interface ResourceDetailDrawerProps {
  isOpen: boolean;
  clusterName?: string;
  resourceType: string;
  /** 사용자에게 보일 리소스 종류 — "파드", "디플로이먼트" 등 */
  resourceLabel: string;
  resourceName?: string;
  namespace?: string;
  /** 초기 활성 탭. 행 로그 아이콘 클릭 시 'logs' 등으로 진입할 때 사용. */
  initialTab?: DrawerTab;
  /** 노출 탭. 미지정 시 ['overview', 'yaml']. */
  availableTabs?: DrawerTab[];
  onClose: () => void;
}

const formatValue = (v: unknown): string => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const labelDict = (obj: unknown): Array<[string, string]> => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, formatValue(v)]);
};

// Pod 의 spec.containers 에서 이름만 추출 — Shell 탭의 컨테이너 selector 채우는 용.
const extractContainers = (resource: Record<string, unknown> | undefined): Array<{ name: string }> => {
  if (!resource || typeof resource !== 'object') return [];
  const spec = (resource as { spec?: unknown }).spec;
  if (!spec || typeof spec !== 'object') return [];
  const containers = (spec as { containers?: unknown }).containers;
  if (!Array.isArray(containers)) return [];
  return containers
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const name = (c as { name?: unknown }).name;
      return typeof name === 'string' && name.length > 0 ? { name } : null;
    })
    .filter((x): x is { name: string } => x !== null);
};

const TAB_LABEL: Record<DrawerTab, string> = {
  overview: '개요',
  yaml: 'YAML',
  events: '이벤트',
  logs: '로그',
  shell: 'Shell',
};

const DEFAULT_TABS: DrawerTab[] = ['overview', 'yaml', 'events'];

export const ResourceDetailDrawer = ({
  isOpen,
  clusterName,
  resourceType,
  resourceLabel,
  resourceName,
  namespace,
  initialTab,
  availableTabs,
  onClose,
}: ResourceDetailDrawerProps) => {
  const tabs = useMemo(() => availableTabs ?? DEFAULT_TABS, [availableTabs]);
  const [tab, setTab] = useState<DrawerTab>(initialTab ?? tabs[0] ?? 'overview');
  const [isEditing, setIsEditing] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const toast = useToast();

  const { resource, isPending, isError, isFetching, refetch } = useGetKubernetesResource(
    resourceType,
    resourceName,
    clusterName,
    namespace,
    isOpen
  );

  const { restartResource, isPending: isRestarting } = useRestartKubernetesResource({
    onSuccess: () => {
      toast.open({ status: 'positive', title: `${resourceLabel} 재시작 요청 완료` });
      refetch();
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      toast.open({ status: 'negative', title: msg || `${resourceLabel} 재시작 실패` });
    },
  });

  const { scaleResource, isPending: isScaling } = useScaleKubernetesResource({
    onSuccess: () => {
      toast.open({ status: 'positive', title: `${resourceLabel} 스케일 변경 완료` });
      setScaleOpen(false);
      refetch();
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      toast.open({ status: 'negative', title: msg || `${resourceLabel} 스케일 실패` });
    },
  });

  const handleDrawerRestart = () => {
    if (!clusterName || !resourceName) return;
    restartResource({ resourceType, resourceName, clusterName, namespace });
  };

  const handleDrawerScaleConfirm = (replicas: number) => {
    if (!clusterName || !resourceName) return;
    scaleResource({ resourceType, resourceName, clusterName, namespace, replicas });
  };

  const currentReplicas = useMemo<number | undefined>(() => {
    if (!resource || typeof resource !== 'object') return undefined;
    const spec = (resource as { spec?: unknown }).spec;
    if (!spec || typeof spec !== 'object') return undefined;
    const r = (spec as { replicas?: unknown }).replicas;
    return typeof r === 'number' ? r : undefined;
  }, [resource]);

  const canRestart = DRAWER_RESTARTABLE.has(resourceType);
  const canScale = DRAWER_SCALABLE.has(resourceType);

  // open / 리소스 변경 시 탭 reset
  useEffect(() => {
    if (isOpen) {
      const next = initialTab && tabs.includes(initialTab) ? initialTab : tabs[0] ?? 'overview';
      setTab(next);
      setIsEditing(false);
    }
  }, [isOpen, resourceName, initialTab, tabs]);

  // YAML 외 탭 이동 시 자동으로 edit mode 종료 (저장 안 한 변경은 폐기)
  useEffect(() => {
    if (tab !== 'yaml') setIsEditing(false);
  }, [tab]);

  // 편집 중에는 Esc / 배경 클릭이 drawer 를 닫지 않게 — YamlResourceEditor 의 cancel 버튼이 명시 경로.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditing) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isEditing, onClose]);

  const editorInitialYaml = useMemo<string | undefined>(() => {
    if (!resource) return undefined;
    return JSON.stringify(stripVolatile(resource), null, 2);
  }, [resource]);

  if (!isOpen) return null;

  const metadata = (resource?.metadata as Record<string, unknown> | undefined) ?? {};
  const labels = metadata.labels;
  const annotations = metadata.annotations;
  const ownerRefs = metadata.ownerReferences as Array<Record<string, unknown>> | undefined;
  const status = resource?.status as Record<string, unknown> | undefined;

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/30"
        onClick={() => !isEditing && onClose()}
        aria-hidden
      />

      <aside
        role="dialog"
        aria-label={`${resourceLabel} 상세`}
        className="fixed bottom-0 right-0 top-0 z-40 flex w-[720px] max-w-[90vw] flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-[#e5e7eb] px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-[#9ca3af]">
              {resourceLabel}
              {isEditing && (
                <span className="ml-2 rounded bg-[#fff5e0] px-1.5 py-0.5 text-[10px] font-semibold text-[#b45309]">
                  편집 중
                </span>
              )}
            </div>
            <div className="truncate text-[15px] font-semibold text-[#1f2937]">
              {resourceName ?? '-'}
              {namespace && (
                <span className="ml-2 text-[12px] font-normal text-[#6b7280]">
                  / {namespace}
                </span>
              )}
            </div>
          </div>
          <Button
            size="small"
            color="secondary"
            onClick={() => refetch()}
            disabled={isFetching || isEditing}
          >
            {isFetching ? '조회 중...' : '새로고침'}
          </Button>
          <button
            type="button"
            onClick={() => !isEditing && onClose()}
            disabled={isEditing}
            aria-label="닫기"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[#6b7280] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <nav className="flex gap-1 border-b border-[#e5e7eb] bg-[#fafafa] px-3 pt-2">
          {tabs.map((t) => {
            const selected = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={selected ? 'page' : undefined}
                className={[
                  'cursor-pointer border-0 px-3 py-2 text-[13px] transition-colors',
                  selected
                    ? 'border-b-2 border-[#2563eb] bg-white font-semibold text-[#1d4ed8]'
                    : 'border-b-2 border-transparent bg-transparent text-[#6b7280] hover:text-[#1f2937]',
                ].join(' ')}
              >
                {TAB_LABEL[t]}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isPending && (
            <div className="py-6 text-center text-[13px] text-[#6b7280]">
              정보를 불러오는 중입니다...
            </div>
          )}
          {isError && (
            <div className="py-6 text-center text-[13px] text-[#b91c1c]">
              리소스 정보를 불러올 수 없습니다.
            </div>
          )}
          {!isPending && !isError && resource && (
            <>
              {tab === 'overview' && (
                <div className="flex flex-col gap-4">
                  {(canRestart || canScale) && (
                    <div className="flex items-center justify-end gap-2">
                      {canRestart && (
                        <Button
                          size="small"
                          color="secondary"
                          onClick={handleDrawerRestart}
                          disabled={isRestarting}
                        >
                          {isRestarting ? '재시작 중...' : '재시작'}
                        </Button>
                      )}
                      {canScale && (
                        <Button
                          size="small"
                          color="primary"
                          onClick={() => setScaleOpen(true)}
                          disabled={isScaling}
                        >
                          스케일
                        </Button>
                      )}
                    </div>
                  )}
                  <Section title="기본 정보">
                    <Row label="이름" value={String(metadata.name ?? '-')} />
                    {namespace && <Row label="네임스페이스" value={namespace} />}
                    <Row label="종류" value={String(resource.kind ?? '-')} />
                    {metadata.uid !== undefined && (
                      <Row label="UID" value={String(metadata.uid)} mono />
                    )}
                    {metadata.creationTimestamp !== undefined && (
                      <Row label="생성 시각" value={String(metadata.creationTimestamp)} />
                    )}
                    {metadata.resourceVersion !== undefined && (
                      <Row label="리소스 버전" value={String(metadata.resourceVersion)} mono />
                    )}
                  </Section>

                  {status && Object.keys(status).length > 0 && (
                    <Section title="상태">
                      {Object.entries(status)
                        .filter(([, v]) => v !== null && v !== undefined)
                        .slice(0, 8)
                        .map(([k, v]) => (
                          <Row key={k} label={k} value={formatValue(v)} />
                        ))}
                    </Section>
                  )}

                  {labelDict(labels).length > 0 && (
                    <Section title="레이블">
                      <KeyValueBadges items={labelDict(labels)} />
                    </Section>
                  )}

                  {labelDict(annotations).length > 0 && (
                    <Section title="어노테이션">
                      <KeyValueBadges items={labelDict(annotations)} truncate />
                    </Section>
                  )}

                  {ownerRefs && ownerRefs.length > 0 && (
                    <Section title="소유자">
                      {ownerRefs.map((o, i) => (
                        <Row
                          key={i}
                          label={String(o.kind ?? '-')}
                          value={String(o.name ?? '-')}
                        />
                      ))}
                    </Section>
                  )}
                </div>
              )}

              {tab === 'yaml' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditing((v) => !v)}
                      aria-pressed={isEditing}
                      className={[
                        'flex h-7 cursor-pointer items-center gap-1 rounded border px-2 text-[12px] transition-colors',
                        isEditing
                          ? 'border-[#f5ab00] bg-[#fff5e0] text-[#b45309]'
                          : 'border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f3f4f6]',
                      ].join(' ')}
                    >
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
                        <path
                          d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {isEditing ? '편집 종료' : '편집'}
                    </button>
                  </div>
                  {isEditing && editorInitialYaml ? (
                    <YamlResourceEditor
                      key={`editor-${resourceName}-${editorInitialYaml.length}`}
                      clusterName={clusterName}
                      defaultNamespace={namespace}
                      initialYaml={editorInitialYaml}
                      onSuccess={() => {
                        setIsEditing(false);
                        refetch();
                      }}
                      onCancel={() => setIsEditing(false)}
                    />
                  ) : (
                    <pre className="m-0 min-h-[480px] overflow-auto rounded-md bg-[#1f2937] p-4 font-mono text-[12px] leading-relaxed text-[#e5e7eb]">
                      {JSON.stringify(resource, null, 2)}
                    </pre>
                  )}
                </div>
              )}

              {tab === 'events' && (
                <EventsTab
                  clusterName={clusterName}
                  resourceType={resourceType}
                  resourceName={resourceName}
                  namespace={namespace}
                  enabled={tab === 'events'}
                />
              )}

              {tab === 'logs' && (
                resourceType === 'pods' ? (
                  <PodLogsViewer
                    clusterName={clusterName}
                    namespace={namespace}
                    podName={resourceName}
                    containers={extractContainers(resource)}
                  />
                ) : DRAWER_WORKLOAD_LOGS.has(resourceType) ? (
                  <WorkloadLogsViewer
                    clusterName={clusterName}
                    namespace={namespace}
                    workload={resource}
                    resourceLabel={resourceLabel}
                  />
                ) : (
                  <div className="py-6 text-center text-[13px] text-[#6b7280]">
                    이 리소스 종류는 로그 조회를 지원하지 않습니다.
                  </div>
                )
              )}

              {tab === 'shell' && resourceType === 'pods' && (
                <Suspense
                  fallback={
                    <div className="py-6 text-center text-[13px] text-[#6b7280]">
                      터미널을 불러오는 중...
                    </div>
                  }
                >
                  <ShellTab
                    clusterName={clusterName}
                    namespace={namespace}
                    podName={resourceName}
                    containers={extractContainers(resource)}
                    enabled={tab === 'shell'}
                  />
                </Suspense>
              )}
            </>
          )}
        </div>
      </aside>

      {canScale && resourceName && (
        <ScaleModal
          isOpen={scaleOpen}
          resourceLabel={resourceLabel}
          resourceName={resourceName}
          namespace={namespace}
          currentReplicas={currentReplicas}
          isProcessing={isScaling}
          onConfirm={handleDrawerScaleConfirm}
          onClose={() => setScaleOpen(false)}
        />
      )}
    </>
  );
};

interface SectionProps {
  title: string;
  children: React.ReactNode;
}
const Section = ({ title, children }: SectionProps) => (
  <section>
    <h4 className="m-0 mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#9ca3af]">
      {title}
    </h4>
    <div className="rounded-md border border-[#e5e7eb] bg-[#fafafa]">{children}</div>
  </section>
);

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
}
const Row = ({ label, value, mono }: RowProps) => (
  <div className="grid grid-cols-[140px_1fr] items-start gap-3 border-b border-[#f0f0f0] px-3 py-2 last:border-b-0">
    <span className="text-[12px] text-[#6b7280]">{label}</span>
    <span
      className={[
        'min-w-0 break-all text-[12px] text-[#1f2937]',
        mono ? 'font-mono' : '',
      ].join(' ')}
    >
      {value}
    </span>
  </div>
);

interface KeyValueBadgesProps {
  items: Array<[string, string]>;
  truncate?: boolean;
}
const KeyValueBadges = ({ items, truncate }: KeyValueBadgesProps) => (
  <div className="flex flex-wrap gap-1.5 p-3">
    {items.map(([k, v]) => (
      <span
        key={k}
        className={[
          'inline-flex max-w-full items-center gap-1 rounded border border-[#e5e7eb] bg-white px-2 py-0.5 font-mono text-[11px]',
          truncate ? 'overflow-hidden text-ellipsis whitespace-nowrap' : 'break-all',
        ].join(' ')}
        title={`${k}=${v}`}
      >
        <span className="text-[#6b7280]">{k}</span>
        <span className="text-[#374151]">=</span>
        <span className="text-[#1f2937]">{v}</span>
      </span>
    ))}
  </div>
);