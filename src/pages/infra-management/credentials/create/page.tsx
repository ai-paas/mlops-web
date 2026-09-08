import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BreadCrumb, Button, Input, Textarea, useToast } from '@innogrid/ui';
import { useCreateCredential } from '@/hooks/service/credentials';
import {
  CSP_OPTIONS,
  CSP_PLACEHOLDERS,
  CspSelector,
} from '@/components/features/infra-management/credentials/csp-selector';

const extractErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string' && msg) return msg;
  }
  return fallback;
};

const parseCredentialsInput = (raw: string): Record<string, string> | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        obj[k] = String(v);
      }
      return obj;
    }
  } catch {
    // KEY=VALUE 한 줄씩 — JSON 파싱 실패 시 fallback
  }
  const result: Record<string, string> = {};
  trimmed.split(/\r?\n/).forEach((line) => {
    const eq = line.indexOf('=');
    if (eq > 0) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim();
      if (k) result[k] = v;
    }
  });
  return Object.keys(result).length > 0 ? result : undefined;
};

type ValidationErrors = {
  provider?: string;
  name?: string;
};

export default function CredentialsCreatePage() {
  const navigate = useNavigate();
  const { open } = useToast();

  const [provider, setProvider] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [credentialsInput, setCredentialsInput] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  const providerLabel = CSP_OPTIONS.find((o) => o.value === provider)?.label;
  const placeholderForProvider = provider ? CSP_PLACEHOLDERS[provider] : '';

  const { createCredential, isPending } = useCreateCredential({
    onSuccess: () => {
      open({ title: '자격증명이 등록되었습니다.' });
      navigate('/infra-management/credentials');
    },
    onError: (e) => open({ title: extractErrorMessage(e, '등록 실패'), status: 'negative' }),
  });

  const validate = (): boolean => {
    const next: ValidationErrors = {};
    if (!provider) next.provider = '프로바이더를 선택해주세요.';
    if (!name) next.name = '자격증명 이름을 입력해주세요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createCredential({
      provider,
      name,
      description: description || undefined,
      credentials: parseCredentialsInput(credentialsInput),
    });
  };

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[
            { label: '인프라 관리' },
            { label: '시스템 설정' },
            { label: '자격증명 관리', path: '/infra-management/credentials' },
            { label: '자격증명 등록' },
          ]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">자격증명 등록</h2>
      </div>

      <div className="page-content page-pb-40">

        <div className="page-input-box">
          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">프로바이더</div>
            <div className="page-input_item-data">
              <CspSelector
                value={provider}
                onChange={(v) => {
                  setProvider(v);
                  setErrors((p) => ({ ...p, provider: undefined }));
                }}
              />
              {errors.provider && <p className="page-input_item-input-error">{errors.provider}</p>}
            </div>
          </div>

          <div className="page-input_item-box">
            <div className="page-input_item-name page-icon-requisite">자격증명 이름</div>
            <div className="page-input_item-data">
              <Input
                placeholder="aws-dev-credential"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (e.target.value) setErrors((p) => ({ ...p, name: undefined }));
                }}
                variant={errors.name ? 'err' : 'default'}
              />
              {errors.name && <p className="page-input_item-input-error">{errors.name}</p>}
            </div>
          </div>

          <div className="page-input_item-box">
            <div className="page-input_item-name">설명</div>
            <div className="page-input_item-data">
              <Input
                placeholder="설명을 입력해주세요."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="page-input_item-box">
            <div className="page-input_item-name">
              credentials (KEY=VALUE 또는 JSON)
              {providerLabel && (
                <span style={{ marginLeft: 8, fontSize: 11, color: '#666', fontWeight: 400 }}>
                  — {providerLabel} 형식
                </span>
              )}
            </div>
            <div className="page-input_item-data">
              <Textarea
                placeholder={
                  placeholderForProvider ||
                  '프로바이더를 먼저 선택하면 각 CSP 의 입력 예시가 표시됩니다.'
                }
                value={credentialsInput}
                onChange={(e) => setCredentialsInput(e.target.value)}
                rows={10}
              />
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
              onClick={() => navigate('/infra-management/credentials')}
            >
              취소
            </Button>
            <Button size="large" color="primary" onClick={handleSubmit} disabled={isPending}>
              {isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}