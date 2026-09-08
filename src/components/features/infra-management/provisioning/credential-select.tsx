import { useMemo } from 'react';
import { Select, type SelectSingleValue } from '@innogrid/ui';
import { useGetCredentials, type Credential } from '@/hooks/service/credentials';

interface CredentialSelectProps {
  provider?: string;
  value?: string;
  onChange: (credentialId: string) => void;
  onRequestRegister?: () => void;
  errorText?: string;
}

type Option = { text: string; value: string; credentialName: string };

export const CredentialSelect = ({
  provider,
  value,
  onChange,
  onRequestRegister,
  errorText,
}: CredentialSelectProps) => {
  const { credentials, isPending, isError } = useGetCredentials(
    provider ? { provider } : undefined
  );

  const options = useMemo<Option[]>(
    () =>
      credentials
        .filter((c: Credential) => !provider || (c.provider ?? '').toUpperCase() === provider.toUpperCase())
        .filter((c): c is Credential & { id: string } => !!c.id)
        .map((c) => ({
          text: `${c.name ?? c.id} (${c.credentialKeys?.length ?? 0} keys)`,
          value: c.id,
          credentialName: c.name ?? c.id,
        })),
    [credentials, provider]
  );

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const isProviderMissing = !provider;
  const isEmpty = !isPending && options.length === 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <Select
            options={options}
            getOptionLabel={(o) => o.text}
            getOptionValue={(o) => o.value}
            value={selected ?? null}
            onChange={(opt: SelectSingleValue<Option>) => onChange(opt?.value ?? '')}
            placeholder={
              isProviderMissing
                ? '프로바이더를 먼저 선택해주세요.'
                : isPending
                  ? '자격증명 조회 중...'
                  : isEmpty
                    ? `등록된 ${provider} 자격증명이 없습니다.`
                    : '자격증명을 선택해주세요.'
            }
            isDisabled={isProviderMissing || isPending}
            styles={{
              control: (base) => ({ ...base, width: '100%', minHeight: '40px' }),
              container: (base) => ({ ...base, width: '100%' }),
            }}
          />
        </div>
        {onRequestRegister && (
          <button
            type="button"
            onClick={onRequestRegister}
            disabled={isProviderMissing}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              background: '#fff',
              fontSize: 12,
              cursor: isProviderMissing ? 'not-allowed' : 'pointer',
              color: isProviderMissing ? '#999' : '#1a1a1a',
              whiteSpace: 'nowrap',
            }}
            title={isProviderMissing ? '프로바이더 선택 필요' : '새 자격증명 등록'}
          >
            + 새 자격증명
          </button>
        )}
      </div>
      {isError && (
        <p className="page-input_item-input-error">자격증명 목록을 불러오는 데 실패했습니다.</p>
      )}
      {errorText && <p className="page-input_item-input-error">{errorText}</p>}
      {!isProviderMissing && isEmpty && (
        <p style={{ marginTop: 4, fontSize: 11, color: '#a3712d' }}>
          "+ 새 자격증명" 버튼을 클릭해 {provider} 자격증명을 먼저 등록해주세요.
        </p>
      )}
    </div>
  );
};