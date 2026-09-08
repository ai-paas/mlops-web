import { useEffect, useState } from 'react';
import { Button, Input, Modal, Textarea, useToast } from '@innogrid/ui';
import { useCreateCredential, type Credential } from '@/hooks/service/credentials';
import { CSP_OPTIONS, CSP_PLACEHOLDERS, CspSelector } from './csp-selector';

interface CredentialCreateModalProps {
  isOpen: boolean;
  defaultProvider?: string;
  onClose: () => void;
  onCreated?: (credential: Credential) => void;
}

type ValidationErrors = {
  provider?: string;
  name?: string;
};

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
    // KEY=VALUE 라인 fallback
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

export const CredentialCreateModal = ({
  isOpen,
  defaultProvider,
  onClose,
  onCreated,
}: CredentialCreateModalProps) => {
  const { open } = useToast();
  const [provider, setProvider] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [credentialsInput, setCredentialsInput] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    if (isOpen) {
      setProvider(defaultProvider ?? '');
      setName('');
      setDescription('');
      setCredentialsInput('');
      setErrors({});
    }
  }, [isOpen, defaultProvider]);

  const providerLabel = CSP_OPTIONS.find((o) => o.value === provider)?.label;
  const placeholderForProvider = provider ? CSP_PLACEHOLDERS[provider] : '';

  const { createCredential, isPending } = useCreateCredential({
    onSuccess: (data) => {
      open({ title: '자격증명이 등록되었습니다.' });
      onCreated?.(data);
      onClose();
    },
    onError: (e) => open({ title: extractErrorMessage(e, '등록 실패'), status: 'negative' }),
  });

  const handleConfirm = () => {
    const next: ValidationErrors = {};
    if (!provider) next.provider = '프로바이더를 선택해주세요.';
    if (!name) next.name = '자격증명 이름을 입력해주세요.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    createCredential({
      provider,
      name,
      description: description || undefined,
      credentials: parseCredentialsInput(credentialsInput),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      size="medium"
      title="자격증명 등록"
      buttonTitle={isPending ? '등록 중...' : '등록'}
      action={handleConfirm}
      onRequestClose={() => !isPending && onClose()}
      buttonDisabled={isPending}
      isButtonLoading={isPending}
      subButton={
        <Button size="large" color="secondary" onClick={onClose} disabled={isPending}>
          취소
        </Button>
      }
    >
      <div className="flex flex-col gap-4 text-[13px] text-[#1f2937]">
        <div>
          <div className="mb-1 text-[12px] text-[#6b7280]">프로바이더 *</div>
          <CspSelector
            value={provider}
            onChange={(v) => {
              setProvider(v);
              setErrors((p) => ({ ...p, provider: undefined }));
            }}
          />
          {errors.provider && (
            <p className="mt-1 text-[12px] text-[#b91c1c]">{errors.provider}</p>
          )}
        </div>
        <div>
          <div className="mb-1 text-[12px] text-[#6b7280]">자격증명 이름 *</div>
          <Input
            placeholder="aws-dev-credential"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value) setErrors((p) => ({ ...p, name: undefined }));
            }}
            variant={errors.name ? 'err' : 'default'}
          />
          {errors.name && <p className="mt-1 text-[12px] text-[#b91c1c]">{errors.name}</p>}
        </div>
        <div>
          <div className="mb-1 text-[12px] text-[#6b7280]">설명</div>
          <Input
            placeholder="설명을 입력해주세요."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <div className="mb-1 text-[12px] text-[#6b7280]">
            credentials (KEY=VALUE 또는 JSON)
            {providerLabel && (
              <span className="ml-1 text-[#888]">— {providerLabel} 형식</span>
            )}
          </div>
          <Textarea
            placeholder={
              placeholderForProvider ||
              '프로바이더를 먼저 선택하면 각 CSP 의 입력 예시가 표시됩니다.'
            }
            value={credentialsInput}
            onChange={(e) => setCredentialsInput(e.target.value)}
            rows={8}
          />
        </div>
      </div>
    </Modal>
  );
};