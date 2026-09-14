import {
  Table,
  useTablePagination,
  useTableSelection,
} from '@innogrid/ui';
import { useGetClusterOperations } from '@/hooks/service/clusters';
import { formatDateTime } from '@/util/date';
import type { Operation, OperationState } from '@/types/cluster';

const stateColor = (state?: OperationState): 'run' | 'negative' | 'wait' => {
  if (!state) return 'wait';
  if (state === 'SUCCEEDED') return 'run';
  if (state === 'FAILED' || state === 'CANCELLED') return 'negative';
  return 'wait';
};

interface OperationsTabProps {
  clusterName?: string | null;
}

export const OperationsTab = ({ clusterName }: OperationsTabProps) => {
  const { pagination, setPagination } = useTablePagination();
  const { rowSelection, setRowSelection } = useTableSelection();
  const { operations, isPending, isError } = useGetClusterOperations(
    clusterName ?? undefined,
    { pageSize: 100 }
  );

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
      size: 200,
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
      id: 'progress',
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
    {
      id: 'errorMessage',
      header: '에러',
      accessorFn: (row: Operation) => row.errorMessage ?? '-',
      size: 280,
    },
  ];

  return (
    <div className="h-[481px]">
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
  );
};