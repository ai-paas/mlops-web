import { useMemo, useState } from 'react';
import { Input } from '@innogrid/ui';
import { useGetProviderSpecs, type ProviderSpec } from '@/hooks/service/providers';

interface SpecPickerProps {
  provider?: string;
  credentialId?: string;
  region?: string;
  value?: string;
  onChange: (specId: string) => void;
  label?: string;
  showGpuToggle?: boolean;
  errorText?: string;
}

const formatMemory = (gb?: number): string => {
  if (gb === undefined || gb === null) return '-';
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} TB`;
  return `${gb} GB`;
};

type SpecCategory = 'gpu' | 'compute' | 'memory' | 'storage' | 'general' | 'other';

// family prefix(첫 글자) 기반 휴리스틱. AWS/GCP/Azure family naming 의 합집합.
// gpuCount > 0 은 family 와 무관하게 GPU 로 우선 분류.
const categorize = (spec: ProviderSpec): SpecCategory => {
  if ((spec.gpuCount ?? 0) > 0) return 'gpu';
  const f = (spec.family ?? '').toLowerCase();
  if (!f) return 'other';
  const head = f.charAt(0);
  if (head === 'c' || head === 'f') return 'compute';
  if (head === 'r' || head === 'x' || head === 'u' || head === 'z' || head === 'e') return 'memory';
  if (head === 'i' || head === 'd' || head === 'h') return 'storage';
  if (head === 'g' || head === 'p') return 'gpu';
  return 'general';
};

const CATEGORY_ORDER: SpecCategory[] = ['general', 'compute', 'memory', 'storage', 'gpu', 'other'];
const CATEGORY_LABEL: Record<SpecCategory, string> = {
  general: 'General',
  compute: 'Compute Optimized',
  memory: 'Memory Optimized',
  storage: 'Storage Optimized',
  gpu: 'GPU / Accelerated',
  other: '기타',
};

const compareSpec = (a: ProviderSpec, b: ProviderSpec): number =>
  (a.vcpu ?? 0) - (b.vcpu ?? 0) ||
  (a.memoryGb ?? 0) - (b.memoryGb ?? 0) ||
  (a.gpuCount ?? 0) - (b.gpuCount ?? 0);

export const SpecPicker = ({
  provider,
  credentialId,
  region,
  value,
  onChange,
  label,
  showGpuToggle = true,
  errorText,
}: SpecPickerProps) => {
  const [keyword, setKeyword] = useState('');
  const [gpuOnly, setGpuOnly] = useState(false);

  const { specs, isPending, isError } = useGetProviderSpecs(
    {
      provider,
      credentialId,
      region,
      keyword: keyword || undefined,
      gpuOnly: gpuOnly || undefined,
      limit: 50,
    },
    !!provider
  );

  const grouped = useMemo(() => {
    const buckets: Record<SpecCategory, ProviderSpec[]> = {
      general: [],
      compute: [],
      memory: [],
      storage: [],
      gpu: [],
      other: [],
    };
    for (const spec of specs) buckets[categorize(spec)].push(spec);
    for (const cat of CATEGORY_ORDER) buckets[cat].sort(compareSpec);
    return CATEGORY_ORDER.filter((c) => buckets[c].length > 0).map((c) => ({
      category: c,
      items: buckets[c],
    }));
  }, [specs]);

  const disabled = !provider;
  const isEmpty = !isPending && grouped.length === 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        {label && (
          <span style={{ fontSize: 12, color: '#666', minWidth: 100 }}>
            {label}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 160 }}>
          <Input
            placeholder={disabled ? '프로바이더 선택 필요' : '인스턴스 타입 검색...'}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            disabled={disabled}
          />
        </div>
        {showGpuToggle && (
          <label
            style={{
              fontSize: 12,
              color: '#666',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={gpuOnly}
              onChange={(e) => setGpuOnly(e.target.checked)}
              disabled={disabled}
            />
            GPU만
          </label>
        )}
      </div>

      <div
        style={{
          maxHeight: 280,
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background: disabled ? '#f9f9f9' : '#fff',
        }}
      >
        {disabled && (
          <div style={{ padding: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
            프로바이더 / 리전 선택 후 사용 가능한 인스턴스 타입이 표시됩니다.
          </div>
        )}
        {!disabled && isPending && (
          <div style={{ padding: 16, fontSize: 12, color: '#666', textAlign: 'center' }}>
            CSP 에서 인스턴스 타입을 조회 중입니다...
          </div>
        )}
        {!disabled && isError && (
          <div style={{ padding: 16, fontSize: 12, color: '#dc2626', textAlign: 'center' }}>
            조회 실패 — 자격증명 권한 또는 리전을 확인해주세요.
          </div>
        )}
        {!disabled && isEmpty && (
          <div style={{ padding: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
            검색 결과가 없습니다.
          </div>
        )}
        {!disabled && !isPending && !isEmpty && (
          <div>
            {grouped.map(({ category, items }) => (
              <details
                key={category}
                open
                style={{ borderBottom: '1px solid #e5e7eb' }}
              >
                <summary
                  style={{
                    cursor: 'pointer',
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#374151',
                    background: '#f9fafb',
                    userSelect: 'none',
                  }}
                >
                  {CATEGORY_LABEL[category]}{' '}
                  <span style={{ fontWeight: 400, color: '#888' }}>({items.length})</span>
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
                  {items.map((spec) => {
                    const selected = spec.id === value;
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => onChange(spec.id)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto auto auto',
                          gap: 12,
                          padding: '10px 12px',
                          border: 'none',
                          borderBottom: '1px solid #f0f0f0',
                          background: selected ? '#eff6ff' : '#fff',
                          cursor: 'pointer',
                          fontSize: 12,
                          alignItems: 'center',
                          textAlign: 'left',
                          color: '#1a1a1a',
                        }}
                        aria-pressed={selected}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            minWidth: 0,
                          }}
                        >
                          <span style={{ fontWeight: 600, lineHeight: 1.3 }}>
                            {selected && (
                              <span style={{ color: '#2563eb', marginRight: 6 }}>✓</span>
                            )}
                            {spec.name ?? spec.id}
                          </span>
                          {spec.description && (
                            <span
                              style={{
                                fontSize: 10,
                                color: '#888',
                                lineHeight: 1.3,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {spec.description}
                            </span>
                          )}
                        </div>
                        {spec.family && (
                          <span
                            style={{
                              fontSize: 10,
                              background: '#f3f4f6',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: '#666',
                            }}
                          >
                            {spec.family}
                          </span>
                        )}
                        <span
                          style={{ fontFamily: 'monospace', minWidth: 70, textAlign: 'right' }}
                        >
                          vCPU {spec.vcpu ?? '-'}
                        </span>
                        <span
                          style={{ fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}
                        >
                          {formatMemory(spec.memoryGb)}
                        </span>
                        {(spec.gpuCount ?? 0) > 0 ? (
                          <span
                            style={{
                              fontSize: 10,
                              background: '#fbbf24',
                              padding: '2px 6px',
                              borderRadius: 4,
                              color: '#92400e',
                              fontWeight: 600,
                            }}
                          >
                            GPU x{spec.gpuCount}
                          </span>
                        ) : (
                          <span style={{ width: 60 }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
      {errorText && <p className="page-input_item-input-error">{errorText}</p>}
    </div>
  );
};