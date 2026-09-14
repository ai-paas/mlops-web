import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BreadCrumb, Button, Input, Select, type SelectSingleValue, useToast } from '@innogrid/ui';
import { useCreateVm } from '@/hooks/service/vms';
import {
  useGetProviderImages,
  useGetProviderSpecs,
  type ProviderSpec,
} from '@/hooks/service/providers';
import {
  CSP_OPTIONS,
  CspSelector,
} from '@/components/features/infra-management/credentials/csp-selector';
import { CredentialSelect } from '@/components/features/infra-management/provisioning/credential-select';
import { CredentialCreateModal } from '@/components/features/infra-management/credentials/credential-create-modal';
import { RegionSelect } from '@/components/features/infra-management/provisioning/region-select';
import { SpecPicker } from '@/components/features/infra-management/provisioning/spec-picker';
import { NodeComposition } from '@/components/features/infra-management/provisioning/node-composition';
import { isGpuSpec } from '@/util/gpuInstance';
import styles from '../../cluster-management/create/page.module.scss';

type OptionType = { text: string; value: string };

const environmentOptions: OptionType[] = [
  { text: 'dev', value: 'dev' },
  { text: 'stage', value: 'stage' },
  { text: 'prod', value: 'prod' },
];

const DEFAULT_REGION_BY_PROVIDER: Record<string, string> = {
  aws: 'us-east-1',
  gcp: 'us-central1',
  azure: 'eastus',
  ncp: 'KR',
};

type ValidationErrors = {
  vmGroupName?: string;
  provider?: string;
  region?: string;
  credentialId?: string;
  masterSpec?: string;
  workerSpec?: string;
};

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
};

export default function ProvisioningCreatePage() {
  const navigate = useNavigate();
  const { open } = useToast();

  const [vmGroupName, setVmGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState<string>('');
  const [credentialId, setCredentialId] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [environment, setEnvironment] = useState<OptionType>(environmentOptions[0]);
  const [masterCount, setMasterCount] = useState<1 | 3>(1);
  const [workerCount, setWorkerCount] = useState<number>(3);
  const [masterSpecId, setMasterSpecId] = useState<string>('');
  const [workerSpecId, setWorkerSpecId] = useState<string>('');
  const [osImageId, setOsImageId] = useState<string>('');
  // hasGpuNodes 는 master/worker spec 의 gpuCount + instance type prefix 로 자동 derive.
  // 사용자 manual toggle 제거 — UI 우회 방지를 위해 server 측도 같은 derive 적용 권장 (별 PR).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // master / worker 의 선택된 spec 풀 details — node-composition 시각화용
  const { specs: allSpecs } = useGetProviderSpecs(
    { provider, credentialId, region, limit: 100 },
    !!provider
  );
  const masterSpecDetail = useMemo<ProviderSpec | undefined>(
    () => allSpecs.find((s) => s.id === masterSpecId),
    [allSpecs, masterSpecId]
  );
  const workerSpecDetail = useMemo<ProviderSpec | undefined>(
    () => allSpecs.find((s) => s.id === workerSpecId),
    [allSpecs, workerSpecId]
  );

  const [imageKeyword, setImageKeyword] = useState('');
  const imagesEnabled = !!provider && !!credentialId && !!region;
  const {
    images,
    isPending: isImagesPending,
    isError: isImagesError,
  } = useGetProviderImages(
    { provider, credentialId, region, keyword: imageKeyword || undefined, limit: 50 },
    imagesEnabled
  );
  const imageOptions = useMemo<OptionType[]>(
    () => images.map((i) => ({ text: i.name ?? i.id, value: i.id })),
    [images]
  );
  const selectedImage = useMemo(
    () => imageOptions.find((o) => o.value === osImageId) ?? null,
    [imageOptions, osImageId]
  );
  const imagePlaceholder = !provider
    ? '프로바이더 선택 필요'
    : !credentialId
      ? '자격증명 선택 필요'
      : !region
        ? '리전 선택 필요'
        : isImagesPending
          ? '이미지 조회 중...'
          : isImagesError
            ? '이미지 조회 실패 — 권한/리전 확인'
            : imageOptions.length === 0
              ? '검색어로 이미지를 찾아보세요.'
              : '이미지 선택 (미선택 시 CSP 기본)';

  const handleSuccess = useCallback(() => {
    open({ title: 'VM 프로비저닝 요청이 수락되었습니다.' });
    navigate('/infra-management/provisioning');
  }, [open, navigate]);

  const handleError = useCallback(
    (error: unknown) => {
      open({ title: extractErrorMessage(error, '요청 실패'), status: 'negative' });
    },
    [open]
  );

  const { createVm, isPending } = useCreateVm({
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const onProviderChange = (v: string) => {
    setProvider(v);
    // CSP 변경 → 하위 선택 reset (다른 CSP 의 region/spec 은 호환 안 됨)
    setCredentialId('');
    setRegion('');
    setMasterSpecId('');
    setWorkerSpecId('');
    setOsImageId('');
    setErrors((p) => ({ ...p, provider: undefined }));
  };

  const onCredentialChange = (v: string) => {
    setCredentialId(v);
    setRegion('');
    setMasterSpecId('');
    setWorkerSpecId('');
    setOsImageId('');
    setErrors((p) => ({ ...p, credentialId: undefined }));
  };

  const onRegionChange = (v: string) => {
    setRegion(v);
    setMasterSpecId('');
    setWorkerSpecId('');
    setOsImageId('');
    setErrors((p) => ({ ...p, region: undefined }));
  };

  const validate = (): boolean => {
    const next: ValidationErrors = {};
    if (!vmGroupName) next.vmGroupName = 'VM 그룹 이름을 입력해주세요.';
    if (!provider) next.provider = 'CSP 를 선택해주세요.';
    if (!credentialId) next.credentialId = '자격증명을 선택해주세요.';
    if (!region) next.region = '리전을 선택해주세요.';
    if (!masterSpecId) next.masterSpec = 'master 인스턴스 타입을 선택해주세요.';
    if (!workerSpecId) next.workerSpec = 'worker 인스턴스 타입을 선택해주세요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const masterSpecDetailFull = useMemo(
    () => allSpecs.find((s) => s.id === masterSpecId),
    [allSpecs, masterSpecId]
  );
  const workerSpecDetailFull = useMemo(
    () => allSpecs.find((s) => s.id === workerSpecId),
    [allSpecs, workerSpecId]
  );
  const hasGpuNodes = useMemo(
    () => isGpuSpec(provider, masterSpecDetailFull) || isGpuSpec(provider, workerSpecDetailFull),
    [provider, masterSpecDetailFull, workerSpecDetailFull]
  );

  const handleSubmit = () => {
    if (!validate()) return;

    const config: Record<string, string> = {
      'anycloud-k8s:masterCount': String(masterCount),
      'anycloud-k8s:workerCount': String(workerCount),
      'anycloud-k8s:masterInstanceType': masterSpecId,
      'anycloud-k8s:workerInstanceType': workerSpecId,
    };
    if (osImageId) config['anycloud-k8s:osImage'] = osImageId;

    createVm({
      vmGroupName,
      provider: provider.toLowerCase(),
      region,
      environment: environment.value || undefined,
      credentialId,
      description: description || undefined,
      config,
      hasGpuNodes,
    });
  };

  const providerLabel = CSP_OPTIONS.find((o) => o.value === provider)?.label;

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '인프라 관리' },
            { label: '프로비저닝', path: '/infra-management/provisioning' },
            { label: 'VM 프로비저닝 생성' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">VM 프로비저닝 생성</h2>
      </div>

      <div className="page-content page-pb-40">

        <div className="page-input-box">
          {/* 1. VM 그룹 이름 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">VM 그룹 이름</div>
            <div className="page-input_item-data">
              <Input
                placeholder="master + worker 인스턴스 집합 식별자 (RFC 1123 label). K8s cluster 도 동일 이름."
                value={vmGroupName}
                onChange={(e) => {
                  setVmGroupName(e.target.value);
                  if (e.target.value) setErrors((p) => ({ ...p, vmGroupName: undefined }));
                }}
                variant={errors.vmGroupName ? 'err' : 'default'}
              />
              {errors.vmGroupName && (
                <p className="page-input_item-input-error">{errors.vmGroupName}</p>
              )}
            </div>
          </div>

          {/* 2. 설명 (이름 직하) */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">설명</div>
            <div className="page-input_item-data">
              <Input
                placeholder="VM 그룹 / 클러스터 용도 설명 (선택)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* 3. CSP 선택 (카드) */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">CSP</div>
            <div className="page-input_item-data">
              <CspSelector value={provider} onChange={onProviderChange} />
              {errors.provider && <p className="page-input_item-input-error">{errors.provider}</p>}
            </div>
          </div>

          {/* 4. 자격증명 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">자격증명</div>
            <div className="page-input_item-data">
              <CredentialSelect
                provider={provider}
                value={credentialId}
                onChange={onCredentialChange}
                onRequestRegister={() => setCredentialModalOpen(true)}
                errorText={errors.credentialId}
              />
            </div>
          </div>

          {/* 5. 리전 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">리전</div>
            <div className="page-input_item-data">
              <RegionSelect
                provider={provider}
                credentialId={credentialId || undefined}
                value={region}
                onChange={onRegionChange}
                defaultRegionId={DEFAULT_REGION_BY_PROVIDER[provider ?? '']}
                errorText={errors.region}
              />
            </div>
          </div>

          {/* 6. 환경 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">환경</div>
            <div className="page-input_item-data">
              <div className={styles.selectContainer} style={{ width: '100%' }}>
                <Select
                  options={environmentOptions}
                  getOptionLabel={(o) => o.text}
                  getOptionValue={(o) => o.value}
                  value={environment ?? null}
                  onChange={(opt: SelectSingleValue<OptionType>) =>
                    setEnvironment(opt ?? environmentOptions[0])
                  }
                  styles={{
                    control: (base) => ({ ...base, width: '100%', minHeight: '40px' }),
                    container: (base) => ({ ...base, width: '100%' }),
                  }}
                />
              </div>
            </div>
          </div>

          {/* 7. 노드 구성 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">노드 구성</div>
            <div className="page-input_item-data">
              <NodeComposition
                masterCount={masterCount}
                workerCount={workerCount}
                onMasterCountChange={setMasterCount}
                onWorkerCountChange={setWorkerCount}
                masterSpec={masterSpecDetail}
                workerSpec={workerSpecDetail}
              />
            </div>
          </div>

          {/* 8. Master 인스턴스 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">Master 인스턴스</div>
            <div className="page-input_item-data">
              <SpecPicker
                provider={provider}
                credentialId={credentialId || undefined}
                region={region || undefined}
                value={masterSpecId}
                onChange={(v) => {
                  setMasterSpecId(v);
                  setErrors((p) => ({ ...p, masterSpec: undefined }));
                }}
                showGpuToggle={false}
                errorText={errors.masterSpec}
              />
            </div>
          </div>

          {/* 9. Worker 인스턴스 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">Worker 인스턴스</div>
            <div className="page-input_item-data">
              <SpecPicker
                provider={provider}
                credentialId={credentialId || undefined}
                region={region || undefined}
                value={workerSpecId}
                onChange={(v) => {
                  setWorkerSpecId(v);
                  setErrors((p) => ({ ...p, workerSpec: undefined }));
                }}
                showGpuToggle={true}
                errorText={errors.workerSpec}
              />
            </div>
          </div>

          {/* 10. 고급 옵션 */}
          <div className="page-input_item-box">
            <div className="page-input_item-name">고급 옵션</div>
            <div className="page-input_item-data">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                style={{
                  background: 'none',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {advancedOpen ? '▼ 접기' : '▶ 펼치기'}
              </button>
              {advancedOpen && (
                <div style={{ marginTop: 12, display: 'grid', rowGap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
                      OS 이미지 {providerLabel && `(${providerLabel} 기준)`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Input
                        placeholder={
                          imagesEnabled
                            ? '이미지 검색 (예: ubuntu, amzn2, rhel)'
                            : '프로바이더 / 자격증명 / 리전 선택 후 검색 가능'
                        }
                        value={imageKeyword}
                        onChange={(e) => setImageKeyword(e.target.value)}
                        disabled={!imagesEnabled}
                      />
                      <div className={styles.selectContainer} style={{ width: '100%' }}>
                        <Select
                          options={imageOptions}
                          getOptionLabel={(o) => o.text}
                          getOptionValue={(o) => o.value}
                          value={selectedImage ?? null}
                          onChange={(opt: SelectSingleValue<OptionType>) =>
                            setOsImageId(opt?.value ?? '')
                          }
                          placeholder={imagePlaceholder}
                          isClearable
                          isDisabled={!imagesEnabled || isImagesPending}
                          isLoading={isImagesPending}
                          styles={{
                            control: (base) => ({ ...base, width: '100%', minHeight: '40px' }),
                            container: (base) => ({ ...base, width: '100%' }),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: hasGpuNodes ? '#1a1a1a' : '#6b6b6b',
                      display: 'inline-flex',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <input type="checkbox" checked={hasGpuNodes} disabled readOnly />
                    GPU 노드 — {hasGpuNodes ? '자동 감지됨' : '없음'} (master/worker spec 의 gpuCount + instance type 기반)
                  </div>
                </div>
              )}
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
              onClick={() => navigate('/infra-management/provisioning')}
            >
              취소
            </Button>
            <Button size="large" color="primary" onClick={handleSubmit} disabled={isPending}>
              {isPending ? '요청 중...' : 'VM 프로비저닝 시작'}
            </Button>
          </div>
        </div>
      </div>
      <CredentialCreateModal
        isOpen={credentialModalOpen}
        defaultProvider={provider}
        onClose={() => setCredentialModalOpen(false)}
        onCreated={(cred) => {
          if (cred.id) onCredentialChange(cred.id);
        }}
      />
    </main>
  );
}