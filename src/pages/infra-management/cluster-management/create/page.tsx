import { useCallback, useState } from 'react';
import { BreadCrumb, Button, Input, useToast } from '@innogrid/ui';
import { useNavigate } from 'react-router';
import { useCreateCluster } from '@/hooks/service/clusters';
import { ClusterBootstrapModal } from '@/components/features/infra-management/cluster-management/cluster-bootstrap-modal';
import type { BootstrapInfo, ClusterRegistrationResponse } from '@/types/cluster';

// Manual register 는 "본인이 운영하는 K8s cluster" — provider / clusterType 정보는 운영상 무의미.
// addon (dcgm-exporter 등) 은 registration 시점에는 cluster 가 아직 ACTIVE 가 아니므로 선택 의미 없음.
// agent 가 backfill 로 GPU 노드 자동 감지. addon 관리는 /cluster-management/[id]/addons 페이지에서.
const PROVIDER_SELF = 'SELF';
const CLUSTER_TYPE_REGISTERED = 'Self-managed';

type ValidationErrors = {
  clusterName?: string;
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
};

export default function ClusterCreatePage() {
  const navigate = useNavigate();
  const { open } = useToast();

  const [clusterName, setClusterName] = useState('');
  const [description, setDescription] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});

  // 등록 완료 직후 modal 표시용 state
  const [bootstrapModalOpen, setBootstrapModalOpen] = useState(false);
  const [bootstrapInfo, setBootstrapInfo] = useState<BootstrapInfo | undefined>();
  const [registeredName, setRegisteredName] = useState<string>('');

  const handleSuccess = useCallback(
    (data: ClusterRegistrationResponse) => {
      // bootstrap 정보가 응답에 포함되어 있으면 modal 로 노출. 없으면 그냥 list 로 이동.
      if (data?.bootstrap) {
        setBootstrapInfo(data.bootstrap);
        setRegisteredName(clusterName);
        setBootstrapModalOpen(true);
      } else {
        open({ title: '클러스터가 등록되었습니다.' });
        navigate('/infra-management/cluster-management');
      }
    },
    [clusterName, open, navigate]
  );

  const handleError = useCallback(
    (error: unknown) => {
      const message = extractErrorMessage(error, '클러스터 등록 중 오류가 발생했습니다.');
      open({ title: message, status: 'negative' });
    },
    [open]
  );

  const { createCluster, isPending } = useCreateCluster({
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const onClusterNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClusterName(e.target.value);
    if (e.target.value) {
      setValidationErrors((prev) => ({ ...prev, clusterName: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: ValidationErrors = {};
    if (!clusterName) errors.clusterName = '클러스터 이름을 입력해주세요.';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    createCluster({
      source: 'registered',
      clusterName,
      spec: {
        provider: PROVIDER_SELF,
        clusterType: CLUSTER_TYPE_REGISTERED,
        description: description || undefined,
      },
    });
  };

  const closeBootstrapModal = () => {
    setBootstrapModalOpen(false);
    // 모달 닫으면 자연스럽게 list 로 이동 — 사용자 의도가 "등록 끝" 명확
    navigate('/infra-management/cluster-management');
  };

  const goToList = () => {
    setBootstrapModalOpen(false);
    navigate('/infra-management/cluster-management');
  };

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '인프라 관리' },
            { label: '클러스터 관리', path: '/infra-management/cluster-management' },
            { label: '클러스터 등록' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">클러스터 등록</h2>
      </div>
      <div className="page-content page-p-40">
        <div className="page-input-box">
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">클러스터 이름</div>
            <div className="page-input_item-data">
              <Input
                name="clusterName"
                placeholder="클러스터 이름을 입력해주세요. (RFC 1123 label: a-z, 0-9, -)"
                value={clusterName}
                onChange={onClusterNameChange}
                variant={validationErrors.clusterName ? 'err' : 'default'}
              />
              <p className="page-input_item-input-desc">
                K8s cluster 식별자. 등록 후 변경할 수 없습니다.
              </p>
              {validationErrors.clusterName && (
                <p className="page-input_item-input-error">{validationErrors.clusterName}</p>
              )}
            </div>
          </div>

          <div className="page-input_item-box">
            <div className="page-input_item-name">설명</div>
            <div className="page-input_item-data">
              <Input
                name="description"
                placeholder="예: AWS EKS in ap-northeast-2 / 사내 OpenStack kubeadm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="page-input_item-input-desc">
                부가 메타데이터 — 자유 기술. addon (모니터링 / GPU exporter 등) 은 cluster 등록
                후 <strong>애드온 관리</strong> 메뉴에서 설치합니다.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="page-footer">
        <div className="page-footer_btn-box">
          <div />
          <div>
            <Button
              size="large"
              color="secondary"
              onClick={() => navigate('/infra-management/cluster-management')}
            >
              취소
            </Button>
            <Button size="large" color="primary" onClick={handleSubmit} disabled={isPending}>
              {isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>
      </div>

      <ClusterBootstrapModal
        isOpen={bootstrapModalOpen}
        clusterName={registeredName}
        bootstrap={bootstrapInfo}
        onClose={closeBootstrapModal}
        onGoToList={goToList}
      />
    </main>
  );
}