import { useEffect, useMemo } from 'react';
import { Select, type SelectSingleValue } from '@innogrid/ui';
import { useGetProviderRegions } from '@/hooks/service/providers';

interface RegionSelectProps {
  provider?: string;
  credentialId?: string;
  value?: string;
  onChange: (regionId: string) => void;
  defaultRegionId?: string;
  errorText?: string;
}

type Option = { text: string; value: string };

export const RegionSelect = ({
  provider,
  credentialId,
  value,
  onChange,
  defaultRegionId,
  errorText,
}: RegionSelectProps) => {
  // credentialId 가 없으면 ENV fallback 가능성 있으나 fail-safe 하게 enabled = !!provider 만 적용.
  const { regions, isPending, isError } = useGetProviderRegions(provider, credentialId, !!provider);

  const options = useMemo<Option[]>(
    () =>
      regions.map((r) => ({
        text: r.name !== r.id ? `${r.id} — ${r.name}` : r.id,
        value: r.id,
      })),
    [regions]
  );

  useEffect(() => {
    if (value || !defaultRegionId || options.length === 0) return;
    if (options.some((o) => o.value === defaultRegionId)) {
      onChange(defaultRegionId);
    }
  }, [value, defaultRegionId, options, onChange]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  const disabled = !provider;
  const isEmpty = !isPending && options.length === 0;

  return (
    <div>
      <Select
        options={options}
        getOptionLabel={(o) => o.text}
        getOptionValue={(o) => o.value}
        value={selected ?? null}
        onChange={(opt: SelectSingleValue<Option>) => onChange(opt?.value ?? '')}
        placeholder={
          disabled
            ? '프로바이더를 먼저 선택해주세요.'
            : isPending
              ? '리전 조회 중... (CSP API 호출)'
              : isEmpty
                ? '사용 가능한 리전이 없습니다.'
                : '리전을 선택해주세요.'
        }
        isDisabled={disabled || isPending}
        styles={{
          control: (base) => ({ ...base, width: '100%', minHeight: '40px' }),
          container: (base) => ({ ...base, width: '100%' }),
        }}
      />
      {isError && (
        <p className="page-input_item-input-error">
          리전 조회 실패 — 자격증명 권한 또는 CSP 응답을 확인해주세요.
        </p>
      )}
      {errorText && <p className="page-input_item-input-error">{errorText}</p>}
    </div>
  );
};