import { useMemo, useState } from 'react';
import {
  BreadCrumb,
  Input,
  Select,
  type SelectSingleValue,
  Table,
  useTablePagination,
  useTableSelection,
} from '@innogrid/ui';
import { useGetOperations } from '@/hooks/service/operations';
import { OperationProgress } from '@/components/features/infra-management/operation-progress';
import { formatDateTime } from '@/util/date';
import type { Operation, OperationState } from '@/types/cluster';

type OptionType = { text: string; value: string };

const stateOptions: OptionType[] = [
  { text: '전체', value: '' },
  { text: 'PENDING', value: 'PENDING' },
  { text: 'RUNNING', value: 'RUNNING' },
  { text: 'SUCCEEDED', value: 'SUCCEEDED' },
  { text: 'FAILED', value: 'FAILED' },
  { text: 'CANCELLED', value: 'CANCELLED' },
];

const stateColor = (state?: OperationState): 'run' | 'negative' | 'wait' => {
  if (!state) return 'wait';
  if (state === 'SUCCEEDED') return 'run';
  if (state === 'FAILED' || state === 'CANCELLED') return 'negative';
  return 'wait';
};

export default function OperationsPage() {
  const { pagination, setPagination } = useTablePagination();
  const { rowSelection, setRowSelection } = useTableSelection();
  const [stateFilter, setStateFilter] = useState<OptionType>(stateOptions[0]);
  const [resourceId, setResourceId] = useState('');

  const { operations, isPending, isError } = useGetOperations({
    state: (stateFilter.value || undefined) as OperationState | undefined,
    resourceId: resourceId || undefined,
    pageSize: 100,
  });

  const selectedRowKeys = Object.keys(rowSelection);
  const selectedOperation = useMemo<Operation | undefined>(() => {
    if (selectedRowKeys.length !== 1) return undefined;
    return operations[parseInt(selectedRowKeys[0], 10)];
  }, [operations, selectedRowKeys]);

  const columns = [
    {
      id: 'id',
      header: '작업 ID',
      accessorFn: (row: Operation) => row.id ?? '-',
      size: 200,
    },
    {
      id: 'type',
      header: '종류',
      accessorFn: (row: Operation) => row.type ?? '-',
      size: 180,
    },
    {
      id: 'resource',
      header: '대상',
      accessorFn: (row: Operation) =>
        row.resourceType && row.resourceId ? `${row.resourceType} / ${row.resourceId}` : '-',
      size: 240,
    },
    {
      id: 'state',
      header: '상태',
      accessorFn: (row: Operation) => row.state ?? '-',
      size: 130,
      cell: ({ row }: { row: { original: Operation } }) => {
        const s = row.original.state;
        return <span className={`table-td-state table-td-state-${stateColor(s)}`}>{s ?? '-'}</span>;
      },
    },
    {
      id: 'percent',
      header: '진행률',
      accessorFn: (row: Operation) =>
        row.progress?.percent !== undefined ? `${row.progress.percent}%` : '-',
      size: 100,
    },
    {
      id: 'startedAt',
      header: '시작 시각',
      accessorFn: (row: Operation) => formatDateTime(row.startedAt),
      size: 180,
    },
    {
      id: 'endedAt',
      header: '종료 시각',
      accessorFn: (row: Operation) => formatDateTime(row.endedAt),
      size: 180,
    },
  ];

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[{ label: '인프라 관리' }, { label: '시스템 설정' }, { label: '작업 이력' }]}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">작업 이력</h2>
      </div>

      <div className="page-content">
        <div className="page-toolBox">
          <div
            className="page-toolBox-btns"
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
            <span style={{ fontSize: 13, color: '#666' }}>상태</span>
            <div style={{ minWidth: 160 }}>
              <Select
                options={stateOptions}
                getOptionLabel={(o) => o.text}
                getOptionValue={(o) => o.value}
                value={stateFilter}
                onChange={(opt: SelectSingleValue<OptionType>) =>
                  setStateFilter(opt ?? stateOptions[0])
                }
              />
            </div>
            <span style={{ fontSize: 13, color: '#666', marginLeft: 12 }}>리소스 ID</span>
            <Input
              placeholder="cluster 이름 등"
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              style={{ width: 240 }}
            />
          </div>
        </div>

        {selectedOperation && (
          <div style={{ marginBottom: 16 }}>
            <OperationProgress operationId={selectedOperation.id ?? null} cancellable />
            {selectedOperation.errorMessage && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>
                {selectedOperation.errorMessage}
              </div>
            )}
          </div>
        )}

        <div className="h-[520px]">
          <Table
            columns={columns}
            data={operations}
            isLoading={isPending}
            emptyMessage={
              isError ? '작업 이력을 불러오는 데 실패했습니다.' : '작업 이력이 없습니다.'
            }
            totalCount={operations.length}
            pagination={pagination}
            setPagination={setPagination}
            rowSelection={rowSelection}
            setRowSelection={setRowSelection}
          />
        </div>
      </div>
    </main>
  );
}