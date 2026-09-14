import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { BreadCrumb, Button, useToast } from '@innogrid/ui';
import {
  useGetVm,
  useGetVmNodes,
  useGetVmStateHistory,
  useDeleteVm,
  useIssueVmSshKey,
  downloadVmKubeconfig,
  useRetryVmOperation,
} from '@/hooks/service/vms';
import { formatDateTime } from '@/util/date';
import type { VmNode } from '@/types/vm';
import { WorkflowStepper } from '@/components/features/infra-management/provisioning/workflow-stepper';
import { LiveProgress } from '@/components/features/infra-management/provisioning/live-progress';
import { DetailValue } from '@/components/ui/detail-value';

const stateColor = (status?: string): 'run' | 'negative' | 'wait' => {
  if (!status) return 'wait';
  if (status === 'READY') return 'run';
  if (status === 'FAILED' || status === 'BLOCKED' || status === 'DELETED') return 'negative';
  return 'wait';
};

const workflowStepLabel = (step?: string): string => {
  switch (step) {
    case 'PROVISION':
      return 'VM 프로비저닝';
    case 'BOOTSTRAP':
      return 'Kubernetes 부트스트랩';
    case 'VERIFY':
      return '연결 확인';
    case 'DESTROY':
      return '제거';
    default:
      return step ?? '-';
  }
};

export default function VmDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { open } = useToast();
  const vmName = id;

  const { vm, isPending, refetch } = useGetVm(vmName);
  const { nodes: nodeList } = useGetVmNodes(vmName);
  const { history } = useGetVmStateHistory(vmName, 30);

  const { issueSshKey, isPending: isIssuingKey } = useIssueVmSshKey({
    onSuccess: (data) => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${vmName ?? 'ssh-key'}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      open({ title: 'SSH 키가 다운로드되었습니다.' });
    },
    onError: () => open({ title: 'SSH 키 발급 실패', status: 'negative' }),
  });

  const { deleteVm, isPending: isDeleting } = useDeleteVm({
    onSuccess: () => {
      open({ title: 'VM 삭제 요청 수락됨.' });
      navigate('/infra-management/provisioning');
    },
    onError: () => open({ title: 'VM 삭제 실패', status: 'negative' }),
  });

  const { retryOperation, isPending: isRetrying } = useRetryVmOperation({
    onSuccess: () => {
      open({ title: 'Retry 요청 수락됨.' });
      refetch();
    },
    onError: () => open({ title: 'Retry 실패', status: 'negative' }),
  });

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDownloadKubeconfig = async () => {
    if (!vmName) return;
    try {
      await downloadVmKubeconfig(vmName);
      open({ title: 'kubeconfig 다운로드 완료' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'kubeconfig 다운로드 실패';
      open({ title: msg, status: 'negative' });
    }
  };

  const handleDelete = () => {
    if (!vmName) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      open({ title: '한 번 더 클릭하여 삭제를 확정합니다.' });
      return;
    }
    deleteVm(vmName);
  };

  const handleRetryWorkflow = () => {
    if (!vmName) return;
    retryOperation({ vmName, type: 'retryWorkflow' });
  };

  const nodes: VmNode[] = useMemo(() => nodeList?.nodes ?? [], [nodeList]);
  const sshUserDefault = nodeList?.sshUser ?? 'ubuntu';

  const handleCopySshCommand = (node: VmNode) => {
    const user = node.sshUser ?? sshUserDefault;
    const ip = node.publicIp ?? node.privateIp ?? '';
    if (!ip) return;
    const cmd = `ssh -i ~/.ssh/${vmName}.pem ${user}@${ip}`;
    void navigator.clipboard.writeText(cmd);
    open({ title: 'SSH 명령이 클립보드에 복사되었습니다.' });
  };

  const roleColor = (role?: string): 'run' | 'wait' | 'negative' => {
    if (!role) return 'wait';
    if (/master|control/i.test(role)) return 'run';
    return 'wait';
  };

  const historyItems = useMemo<unknown[]>(() => {
    if (!history) return [];
    const raw = (history as { data?: unknown }).data ?? history;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && 'items' in raw) {
      return (raw as { items?: unknown[] }).items ?? [];
    }
    return [];
  }, [history]);

  const isFailed = vm?.status === 'FAILED' || vm?.status === 'BLOCKED';

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '인프라 관리' },
            { label: '프로비저닝', path: '/infra-management/provisioning' },
            { label: vmName ?? 'VM 상세' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">VM 프로비저닝 상세</h2>
        <div className="page-toolBox">
          <div className="page-toolBox-btns" style={{ display: 'flex', gap: 8 }}>
            <Button color="secondary" onClick={handleDownloadKubeconfig} disabled={!vmName}>
              kubeconfig 다운로드
            </Button>
            <Button
              color="secondary"
              onClick={() => vmName && issueSshKey(vmName)}
              disabled={!vmName || isIssuingKey}
            >
              {isIssuingKey ? 'SSH 키 발급 중...' : 'SSH 키 발급'}
            </Button>
            {isFailed && (
              <Button color="secondary" onClick={handleRetryWorkflow} disabled={isRetrying}>
                {isRetrying ? '재시도 중...' : 'Workflow 재시도'}
              </Button>
            )}
            {vm?.clusterId && (
              <Button
                color="secondary"
                onClick={() =>
                  navigate(
                    `/infra-management/cluster-management/${encodeURIComponent(vm.clusterId!)}`
                  )
                }
              >
                연결된 클러스터 보기
              </Button>
            )}
            <Button color="negative" onClick={handleDelete} disabled={isDeleting || !vmName}>
              {isDeleting ? '삭제 중...' : confirmingDelete ? '삭제 확정' : 'VM 삭제'}
            </Button>
          </div>
        </div>
      </div>

      <div className="page-content page-pb-40">
        {!isPending && !vm && (
          <div style={{ padding: 16, color: '#a33' }}>VM 을 찾을 수 없습니다.</div>
        )}

        {(isPending || vm) && (
          <>
            <WorkflowStepper vm={vm} />
            <LiveProgress
              clusterName={vmName}
              fallbackStep={vm?.currentSubStep ?? workflowStepLabel(vm?.currentWorkflowStep)}
            />
            <div style={{ display: 'flex', gap: 24 }}>
              {/* 기본 정보 */}
              <div style={{ flex: 1 }}>
                <h3 className="page-detail-title">기본 정보</h3>
                <div className="page-detail-list-box">
                  <ul className="page-detail-list">
                    <li>
                      <div className="page-detail_item-name">이름</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={160}>
                          {vm?.clusterName}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">상태</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={100}>
                          <span className={`table-td-state table-td-state-${stateColor(vm?.status)}`}>
                            {vm?.status ?? '-'}
                          </span>
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">프로바이더</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={120}>
                          {vm?.clusterProvider ?? '-'}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">리전</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={100}>
                          {vm?.region ?? '-'}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">환경</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={100}>
                          {vm?.environment ?? '-'}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">자격증명</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={140}>
                          {vm?.credentialName ?? '-'}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">생성일시</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={140}>
                          {formatDateTime(vm?.createdAt)}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">최종 변경</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={140}>
                          {formatDateTime(vm?.updatedAt)}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">연결 K8s cluster</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={160}>
                          {vm?.clusterId ? (
                            <Link
                              to={`/infra-management/cluster-management/${encodeURIComponent(vm.clusterId)}`}
                              className="table-td-link"
                            >
                              {vm.clusterId}
                            </Link>
                          ) : (
                            <span style={{ color: '#999' }}>대기 (agent 등록 전)</span>
                          )}
                        </DetailValue>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Workflow / VM spec */}
              <div style={{ flex: 1 }}>
                <h3 className="page-detail-title">Workflow 진행</h3>
                <div className="page-detail-list-box">
                  <ul className="page-detail-list">
                    <li>
                      <div className="page-detail_item-name">현재 단계</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={140}>
                          {workflowStepLabel(vm?.currentWorkflowStep ?? undefined)}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">마지막 완료</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={140}>
                          {workflowStepLabel(vm?.lastSuccessfulStep ?? undefined)}
                        </DetailValue>
                      </div>
                    </li>
                    {vm?.currentSubStep && (
                      <li>
                        <div className="page-detail_item-name">세부 단계</div>
                        <div className="page-detail_item-data">{vm.currentSubStep}</div>
                      </li>
                    )}
                    <li>
                      <div className="page-detail_item-name">단계 시작</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={140}>
                          {formatDateTime(vm?.stepStartedAt)}
                        </DetailValue>
                      </div>
                    </li>
                    <li>
                      <div className="page-detail_item-name">재시도 횟수</div>
                      <div className="page-detail_item-data">
                        <DetailValue isLoading={isPending} width={100}>
                          {vm?.workflowRetryCount ?? 0}
                        </DetailValue>
                      </div>
                    </li>
                    {vm?.lastFailedStep && (
                      <li>
                        <div className="page-detail_item-name">마지막 실패</div>
                        <div className="page-detail_item-data">
                          {workflowStepLabel(vm.lastFailedStep)}{' '}
                          {vm.lastErrorCode && <span>({vm.lastErrorCode})</span>}
                        </div>
                      </li>
                    )}
                    {vm?.lastError && (
                      <li>
                        <div className="page-detail_item-name">에러 메시지</div>
                        <div className="page-detail_item-data" style={{ color: '#a33' }}>
                          {vm.lastError}
                        </div>
                      </li>
                    )}
                    {vm?.masterVmSpec && (
                      <li>
                        <div className="page-detail_item-name">Master 스펙</div>
                        <div className="page-detail_item-data">{vm.masterVmSpec}</div>
                      </li>
                    )}
                    {vm?.workerVmSpec && (
                      <li>
                        <div className="page-detail_item-name">Worker 스펙</div>
                        <div className="page-detail_item-data">{vm.workerVmSpec}</div>
                      </li>
                    )}
                    {vm?.osImage && (
                      <li>
                        <div className="page-detail_item-name">OS 이미지</div>
                        <div className="page-detail_item-data">{vm.osImage}</div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* 개별 VM 인스턴스 카드 그리드 — master + worker 인스턴스 직접 노출 (데이터 로드 후에만 표시) */}
            {vm && (
              <>
                <div style={{ marginTop: 24 }}>
                  <h3 className="page-detail-title">VM 인스턴스 ({nodes.length})</h3>
                  {nodes.length === 0 ? (
                    <div
                      style={{
                        padding: 16,
                        color: '#888',
                        fontSize: 13,
                        border: '1px dashed #d1d5db',
                        borderRadius: 6,
                      }}
                    >
                      노드 정보 없음 — PROVISION 단계 완료 후 표시됩니다.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: 12,
                      }}
                    >
                      {nodes.map((n, i) => {
                        const ip = n.publicIp ?? n.privateIp ?? '-';
                        return (
                          <div
                            key={`${n.hostname ?? n.role}-${i}`}
                            style={{
                              border: '1px solid #e5e7eb',
                              borderRadius: 8,
                              padding: 14,
                              background: '#fafafa',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginBottom: 10,
                              }}
                            >
                              <span
                                className={`table-td-state table-td-state-${roleColor(n.role)}`}
                                style={{ fontSize: 11 }}
                              >
                                {n.role ?? 'node'}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: 13 }}>
                                {n.hostname ?? `instance-${i}`}
                              </span>
                            </div>
                            <div style={{ display: 'grid', rowGap: 4, fontSize: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#666' }}>공인 IP</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                  {n.publicIp ?? '-'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#666' }}>사설 IP</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                  {n.privateIp ?? '-'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#666' }}>SSH user</span>
                                <span style={{ fontFamily: 'monospace' }}>
                                  {n.sshUser ?? sshUserDefault}
                                </span>
                              </div>
                            </div>
                            <Button
                              color="secondary"
                              size="small"
                              onClick={() => handleCopySshCommand(n)}
                              disabled={ip === '-'}
                              style={{ marginTop: 10, width: '100%' }}
                              title={`ssh -i ~/.ssh/${vmName}.pem ${n.sshUser ?? sshUserDefault}@${ip}`}
                            >
                              SSH 명령 복사
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* state history 압축 */}
                <div style={{ marginTop: 24 }}>
                  <h3 className="page-detail-title">상태 이력 (최근 30)</h3>
                  <div
                    style={{
                      maxHeight: 240,
                      overflow: 'auto',
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding: 8,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    }}
                  >
                    {historyItems.length === 0 && <div style={{ color: '#666' }}>이력 없음</div>}
                    {historyItems.map((row, idx) => {
                      const r = row as Record<string, unknown>;
                      return (
                        <div key={idx} style={{ padding: '2px 0' }}>
                          <span style={{ color: '#666' }}>
                            {formatDateTime(r.createdAt as string | undefined)}
                          </span>{' '}
                          <span>{String(r.fromStatus ?? '-')}</span>
                          {' → '}
                          <span style={{ fontWeight: 600 }}>{String(r.toStatus ?? '-')}</span>{' '}
                          <span style={{ color: '#888' }}>({String(r.reason ?? '')})</span>
                          {r.valid === false && (
                            <span style={{ color: '#a33', marginLeft: 6 }}>[invalid]</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}