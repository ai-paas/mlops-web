import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BreadCrumb, Button, Select, type SelectSingleValue } from '@innogrid/ui';
import { EditClusterButton } from '@/components/features/infra-management/cluster-management/edit-cluster-button';
import { DeleteClusterButton } from '@/components/features/infra-management/cluster-management/delete-cluster-button';
import {
  useGetCluster,
  useGetKubernetesNamespaces,
  useFetchClusterBootstrap,
} from '@/hooks/service/clusters';
import { formatDateTime } from '@/util/date';
import { ClusterBootstrapModal } from '@/components/features/infra-management/cluster-management/cluster-bootstrap-modal';
import { KubeconfigDownloadModal } from '@/components/features/infra-management/cluster-management/kubeconfig-download-modal';
import type { BootstrapInfo } from '@/types/cluster';

type NamespaceOption = { label: string; value: string };
const ALL_NAMESPACES: NamespaceOption = { label: '전체 네임스페이스', value: '' };

// 쿠버네티스 리소스 탭 컴포넌트들
import { NodesTab } from '@/components/features/infra-management/cluster-management/tabs/nodes-tab';
import { NamespacesTab } from '@/components/features/infra-management/cluster-management/tabs/namespaces-tab';
import { DeploymentsTab } from '@/components/features/infra-management/cluster-management/tabs/deployments-tab';
import { ReplicaSetsTab } from '@/components/features/infra-management/cluster-management/tabs/replica-sets-tab';
import { PodsTab } from '@/components/features/infra-management/cluster-management/tabs/pods-tab';
import { ServicesTab } from '@/components/features/infra-management/cluster-management/tabs/services-tab';
import { DaemonSetsTab } from '@/components/features/infra-management/cluster-management/tabs/daemon-sets-tab';
import { GpuSchedulingTab } from '@/components/features/infra-management/cluster-management/tabs/gpu-scheduling-tab';
import { ServiceAccountsTab } from '@/components/features/infra-management/cluster-management/tabs/service-accounts-tab';
import { ConfigMapsTab } from '@/components/features/infra-management/cluster-management/tabs/config-maps-tab';
import { SecretsTab } from '@/components/features/infra-management/cluster-management/tabs/secrets-tab';
import { OperationsTab } from '@/components/features/infra-management/cluster-management/tabs/operations-tab';
import { ClusterHealthPill } from '@/components/features/infra-management/cluster-health-pill';
import { LiveProgress } from '@/components/features/infra-management/provisioning/live-progress';
import { YamlResourceEditor } from '@/components/features/infra-management/yaml-resource-editor';
import { ResourceNavigationRail } from '@/components/features/infra-management/cluster-management/resource-navigation-rail';
import {
  RESOURCE_BY_ID,
  DEFAULT_RESOURCE,
  type ResourceId,
} from '@/components/features/infra-management/cluster-management/resource-meta';
import { buildResourceSkeleton } from '@/components/features/infra-management/cluster-management/resource-skeletons';
import { DetailValue } from '@/components/ui/detail-value';

export default function ClusterDetailPage() {
  const { id } = useParams();
  const { cluster, isPending } = useGetCluster(id);
  const navigate = useNavigate();

  // path 의 id 가 클러스터 이름 (RFC 1123 label) — 모든 K8s 호출에 사용
  const clusterName = cluster?.clusterName ?? id;

  // 네임스페이스 selector — namespaced 리소스 탭의 필터
  const { namespaces } = useGetKubernetesNamespaces(clusterName);
  const namespaceOptions = useMemo<NamespaceOption[]>(() => {
    const items = namespaces
      .map((ns) => ({ label: ns.metadata.name, value: ns.metadata.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [ALL_NAMESPACES, ...items];
  }, [namespaces]);
  const [selectedNamespace, setSelectedNamespace] = useState<NamespaceOption>(ALL_NAMESPACES);
  const namespace = selectedNamespace.value || undefined;
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceId>(DEFAULT_RESOURCE);
  const currentResourceMeta = RESOURCE_BY_ID.get(selectedResource);
  const isNamespaced = currentResourceMeta?.namespaced ?? true;
  const createSkeleton = buildResourceSkeleton(selectedResource, namespace);
  const canCreate = createSkeleton !== undefined;

  // Agent 설치 명령 modal — "재발급" 버튼 클릭 시 fetch + open
  const [bootstrapModalOpen, setBootstrapModalOpen] = useState(false);
  const [bootstrapInfo, setBootstrapInfo] = useState<BootstrapInfo | undefined>();
  const [kubeconfigModalOpen, setKubeconfigModalOpen] = useState(false);
  // VM provisioned 여부 — backend 가 admin SA 자동 발급 가능한지. cluster.source 가 'registered' 면 사용자 입력 필수.
  const isVmProvisioned = cluster?.source !== 'registered';
  const { fetchBootstrap, isPending: isFetchingBootstrap } = useFetchClusterBootstrap({
    onSuccess: (info) => {
      setBootstrapInfo(info);
      setBootstrapModalOpen(true);
    },
  });

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '인프라 관리' },
            { label: '클러스터 관리', path: '/infra-management/cluster-management' },
            { label: '클러스터 상세' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">클러스터 상세</h2>
        <div className="page-toolBox">
          <div className="page-toolBox-btns" style={{ alignItems: 'center', gap: 8 }}>
            <ClusterHealthPill clusterName={clusterName} />
            <Button
              color="secondary"
              onClick={() => setKubeconfigModalOpen(true)}
              disabled={!clusterName}
            >
              kubeconfig 다운로드
            </Button>
            {cluster?.source === 'registered' && (
              <Button
                color="secondary"
                onClick={() => clusterName && fetchBootstrap(clusterName)}
                disabled={!clusterName || isFetchingBootstrap}
              >
                {isFetchingBootstrap ? '발급 중...' : '설치 명령 다시 보기'}
              </Button>
            )}
            {cluster?.linkedVmName && (
              <Button
                color="secondary"
                onClick={() =>
                  navigate(
                    `/infra-management/provisioning/${encodeURIComponent(cluster.linkedVmName!)}`
                  )
                }
                title="이 cluster 를 만든 VM 인프라 상세로 이동"
              >
                연결된 VM 보기
              </Button>
            )}
            <Button
              color="secondary"
              onClick={() => navigate(`/infra-management/cluster-management/${id}/addons`)}
            >
              애드온 관리
            </Button>
            <EditClusterButton
              clusterId={id}
              returnTo={`/infra-management/cluster-management/${id}`}
            />
            <DeleteClusterButton
              clusterId={id}
              onDeleteSuccess={() => navigate('/infra-management/cluster-management')}
            />
          </div>
        </div>
      </div>
      <div className="page-content page-pb-40">
        {cluster?.source === 'vm' && (
          <LiveProgress
            clusterName={clusterName}
            fallbackPercent={cluster?.workflowProgress?.percent}
            fallbackStep={
              cluster?.workflowProgress?.currentStep ?? cluster?.workflowProgress?.lastSuccessfulStep
            }
          />
        )}
        <div style={{ display: 'flex', gap: '24px' }}>
          {/* 왼쪽: 기본 정보 */}
          <div style={{ flex: 1 }}>
            <h3 className="page-detail-title">기본 정보</h3>
            <div className="page-detail-list-box">
              <ul className="page-detail-list">
                <li>
                  <div className="page-detail_item-name">이름</div>
                  <div className="page-detail_item-data">
                    <DetailValue isLoading={isPending} width={160}>
                      {cluster?.clusterName ?? id ?? '-'}
                    </DetailValue>
                  </div>
                </li>
                <li>
                  <div className="page-detail_item-name">소스</div>
                  <div className="page-detail_item-data">
                    <DetailValue isLoading={isPending} width={100}>
                      {cluster?.source ?? '-'}
                    </DetailValue>
                  </div>
                </li>
                {cluster?.linkedVmName && (
                  <li>
                    <div className="page-detail_item-name">연결된 VM</div>
                    <div className="page-detail_item-data">
                      <Link
                        to={`/infra-management/provisioning/${encodeURIComponent(cluster.linkedVmName)}`}
                        className="table-td-link"
                      >
                        {cluster.linkedVmName}
                      </Link>
                    </div>
                  </li>
                )}
                <li>
                  <div className="page-detail_item-name">상태</div>
                  <div className="page-detail_item-data">
                    <DetailValue isLoading={isPending} width={100}>
                      {cluster?.status ?? '-'}
                    </DetailValue>
                  </div>
                </li>
                <li>
                  <div className="page-detail_item-name">프로바이더</div>
                  <div className="page-detail_item-data">
                    <DetailValue isLoading={isPending} width={120}>
                      {cluster?.provider ?? '-'}
                    </DetailValue>
                  </div>
                </li>
                {cluster?.region && (
                  <li>
                    <div className="page-detail_item-name">리전</div>
                    <div className="page-detail_item-data">{cluster.region}</div>
                  </li>
                )}
                {cluster?.environment && (
                  <li>
                    <div className="page-detail_item-name">환경</div>
                    <div className="page-detail_item-data">{cluster.environment}</div>
                  </li>
                )}
                <li>
                  <div className="page-detail_item-name">GPU 노드</div>
                  <div className="page-detail_item-data">
                    <DetailValue isLoading={isPending} width={100}>
                      {cluster?.hasGpuNodes ? '포함' : '미포함'}
                    </DetailValue>
                  </div>
                </li>
                <li>
                  <div className="page-detail_item-name">생성일시</div>
                  <div className="page-detail_item-data">
                    <DetailValue isLoading={isPending} width={140}>
                      {formatDateTime(cluster?.createdAt)}
                    </DetailValue>
                  </div>
                </li>
                {cluster?.readyAt && (
                  <li>
                    <div className="page-detail_item-name">준비완료</div>
                    <div className="page-detail_item-data">{formatDateTime(cluster.readyAt)}</div>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* 오른쪽: 에이전트 / 워크플로우 상태 */}
          <div style={{ flex: 1 }}>
            <h3 className="page-detail-title">연동 정보</h3>
            <div className="page-detail-list-box">
              <ul className="page-detail-list">
                {cluster?.source === 'registered' && (
                  <>
                    <li>
                      <div className="page-detail_item-name">에이전트 연결</div>
                      <div className="page-detail_item-data">
                        <span
                          className={`table-td-state table-td-state-${
                            cluster?.agentConnectivity === 'CONNECTED' ? 'run' : 'negative'
                          }`}
                        >
                          {cluster?.agentConnectivity ?? '-'}
                        </span>
                      </div>
                    </li>
                    {cluster?.agentHeartbeatSecondsAgo !== undefined && (
                      <li>
                        <div className="page-detail_item-name">마지막 heartbeat</div>
                        <div className="page-detail_item-data">
                          {cluster.agentHeartbeatSecondsAgo}초 전
                        </div>
                      </li>
                    )}
                    {cluster?.agentHealthSummary && (
                      <li>
                        <div className="page-detail_item-name">상태 요약</div>
                        <div className="page-detail_item-data">{cluster.agentHealthSummary}</div>
                      </li>
                    )}
                  </>
                )}
                {cluster?.source === 'vm' && (
                  <>
                    <li>
                      <div className="page-detail_item-name">워커 노드 수</div>
                      <div className="page-detail_item-data">{cluster?.workerCount ?? '-'}</div>
                    </li>
                    {cluster?.workflowProgress && (
                      <>
                        <li>
                          <div className="page-detail_item-name">진행 단계</div>
                          <div className="page-detail_item-data">
                            {cluster.workflowProgress.currentStep ??
                              cluster.workflowProgress.lastSuccessfulStep ??
                              '-'}
                          </div>
                        </li>
                        <li>
                          <div className="page-detail_item-name">진행률</div>
                          <div className="page-detail_item-data">
                            {cluster.workflowProgress.percent ?? 0}%
                          </div>
                        </li>
                        {cluster.workflowProgress.retryCount !== undefined && (
                          <li>
                            <div className="page-detail_item-name">재시도 횟수</div>
                            <div className="page-detail_item-data">
                              {cluster.workflowProgress.retryCount}
                            </div>
                          </li>
                        )}
                      </>
                    )}
                  </>
                )}
                {cluster?.lastError && (
                  <li>
                    <div className="page-detail_item-name">마지막 에러</div>
                    <div className="page-detail_item-data">{cluster.lastError}</div>
                  </li>
                )}
                {cluster?.description && (
                  <li>
                    <div className="page-detail_item-name">설명</div>
                    <div className="page-detail_item-data">{cluster.description}</div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

      </div>
      <div className="page-content page-content-detail">
        <div className="flex min-h-[480px] items-stretch border-t border-[#e5e7eb]">
          <ResourceNavigationRail
            value={selectedResource}
            onChange={(id) => {
              setSelectedResource(id);
              setShowYamlEditor(false);
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-[#e5e7eb] px-4 py-2">
              <span className="text-[13px] font-medium text-[#374151]">
                {currentResourceMeta?.label ?? '-'}
              </span>
              <span className="h-4 w-px bg-[#e5e7eb]" aria-hidden />
              <span className="text-[12px] text-[#6b7280]">네임스페이스</span>
              <div className="min-w-[220px]">
                <Select
                  options={namespaceOptions}
                  value={selectedNamespace}
                  onChange={(opt: SelectSingleValue<NamespaceOption>) =>
                    setSelectedNamespace(opt ?? ALL_NAMESPACES)
                  }
                  placeholder="네임스페이스를 선택해주세요."
                  isDisabled={!isNamespaced}
                />
              </div>
              {!isNamespaced && (
                <span
                  className="text-[11px] text-[#9ca3af]"
                  title="cluster-scoped 리소스는 namespace 필터 영향을 받지 않습니다."
                >
                  cluster-scoped — 필터 미적용
                </span>
              )}
              {canCreate && (
                <Button
                  color="primary"
                  onClick={() => setShowYamlEditor((v) => !v)}
                  style={{ marginLeft: 'auto' }}
                >
                  {showYamlEditor
                    ? '생성 닫기'
                    : `+ 새 ${currentResourceMeta?.label ?? '리소스'}`}
                </Button>
              )}
            </div>
            {showYamlEditor && canCreate && (
              <div className="border-b border-[#e5e7eb] p-3">
                <YamlResourceEditor
                  key={`${selectedResource}-${namespace ?? ''}`}
                  clusterName={clusterName}
                  defaultNamespace={namespace}
                  initialYaml={createSkeleton}
                  onSuccess={() => setShowYamlEditor(false)}
                  onCancel={() => setShowYamlEditor(false)}
                />
              </div>
            )}
            <div className="min-w-0 flex-1 p-3">
              {selectedResource === 'pods' && (
                <PodsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'deployments' && (
                <DeploymentsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'replicasets' && (
                <ReplicaSetsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'daemonsets' && (
                <DaemonSetsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'services' && (
                <ServicesTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'configmaps' && (
                <ConfigMapsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'secrets' && (
                <SecretsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'service-accounts' && (
                <ServiceAccountsTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'nodes' && <NodesTab clusterName={clusterName} />}
              {selectedResource === 'namespaces' && <NamespacesTab clusterName={clusterName} />}
              {selectedResource === 'gpu-scheduling' && (
                <GpuSchedulingTab clusterName={clusterName} namespace={namespace} />
              )}
              {selectedResource === 'operations' && <OperationsTab clusterName={clusterName} />}
            </div>
          </div>
        </div>
      </div>

      <ClusterBootstrapModal
        isOpen={bootstrapModalOpen}
        clusterName={clusterName ?? ''}
        bootstrap={bootstrapInfo}
        onClose={() => setBootstrapModalOpen(false)}
        onGoToList={() => {
          setBootstrapModalOpen(false);
          navigate('/infra-management/cluster-management');
        }}
      />

      <KubeconfigDownloadModal
        isOpen={kubeconfigModalOpen}
        clusterName={clusterName ?? undefined}
        vmProvisioned={isVmProvisioned}
        onClose={() => setKubeconfigModalOpen(false)}
      />
    </main>
  );
}