import type { ProviderSpec } from '@/hooks/service/providers';

interface NodeCompositionProps {
  masterCount: 1 | 3;
  workerCount: number;
  onMasterCountChange: (value: 1 | 3) => void;
  onWorkerCountChange: (value: number) => void;
  masterSpec?: ProviderSpec;
  workerSpec?: ProviderSpec;
}

export const NodeComposition = ({
  masterCount,
  workerCount,
  onMasterCountChange,
  onWorkerCountChange,
  masterSpec,
  workerSpec,
}: NodeCompositionProps) => {
  const totalNodes = masterCount + workerCount;
  const totalVcpu =
    masterCount * (masterSpec?.vcpu ?? 0) + workerCount * (workerSpec?.vcpu ?? 0);
  const totalMemory =
    masterCount * (masterSpec?.memoryGb ?? 0) + workerCount * (workerSpec?.memoryGb ?? 0);
  const totalGpu =
    masterCount * (masterSpec?.gpuCount ?? 0) + workerCount * (workerSpec?.gpuCount ?? 0);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Master 노드</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 3].map((n) => {
              const selected = masterCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onMasterCountChange(n as 1 | 3)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
                    background: selected ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    lineHeight: 1.4,
                  }}
                  aria-pressed={selected}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#1a1a1a' }}>
                    {n} 대 {n === 3 && <span style={{ fontSize: 10, color: '#2563eb' }}>HA</span>}
                  </div>
                  <div style={{ fontSize: 10, color: '#666' }}>
                    {n === 1 ? '개발 / 단일 노드' : 'etcd quorum / 운영'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Worker 노드 수</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={50}
              value={workerCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (!Number.isNaN(v)) onWorkerCountChange(Math.max(1, Math.min(50, v)));
              }}
              style={{
                width: 80,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 13,
              }}
            />
            <input
              type="range"
              min={1}
              max={20}
              value={Math.min(workerCount, 20)}
              onChange={(e) => onWorkerCountChange(parseInt(e.target.value, 10))}
              style={{ flex: 1 }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>1 ~ 50 (slider 1~20)</div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 14,
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>구성 요약</div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            총 {totalNodes} 노드
            <span style={{ color: '#666', marginLeft: 8, fontWeight: 400 }}>
              (master {masterCount}, worker {workerCount})
            </span>
          </div>
          <div style={{ color: '#666' }}>·</div>
          <div>
            <span style={{ color: '#666' }}>vCPU</span>{' '}
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{totalVcpu || '-'}</span>
          </div>
          <div>
            <span style={{ color: '#666' }}>RAM</span>{' '}
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {totalMemory ? `${totalMemory} GB` : '-'}
            </span>
          </div>
          {totalGpu > 0 && (
            <div>
              <span style={{ color: '#666' }}>GPU</span>{' '}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  background: '#fbbf24',
                  color: '#92400e',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {totalGpu}
              </span>
            </div>
          )}
        </div>
        {(!masterSpec || !workerSpec) && (
          <div style={{ fontSize: 11, color: '#a3712d', marginTop: 8 }}>
            master / worker 인스턴스 타입을 선택하면 리소스 합계가 계산됩니다.
          </div>
        )}
      </div>
    </div>
  );
};