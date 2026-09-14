import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetGpuSchedulings } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { GpuScheduling } from '@/types/cluster';

interface GpuSchedulingTabProps {
  namespace?: string;
  clusterName?: string | null;
}

export const GpuSchedulingTab = ({ clusterName, namespace }: GpuSchedulingTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { gpuSchedulings, isPending, isError } = useGetGpuSchedulings(
    clusterName || undefined,
    namespace
  );

  const selectedItems = useMemo<GpuScheduling[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => gpuSchedulings[parseInt(k, 10)])
      .filter((g): g is GpuScheduling => Boolean(g));
  }, [gpuSchedulings, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<GpuScheduling | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: GpuScheduling, tab: DrawerTab = 'overview') => {
    setDrawerItem(item);
    setDrawerTab(tab);
  };

  const columns = [
    {
      id: 'select',
      size: 50,
      header: (props: { table: unknown }) => <HeaderCheckbox table={props.table} />,
      cell: (props: { row: unknown }) => <CellCheckbox row={props.row} />,
      enableSorting: false,
    },
    {
      id: 'name',
      header: '이름',
      accessorFn: (row: GpuScheduling) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: GpuScheduling } }) => (
        <span
          onClick={() => openDrawer(row.original, 'overview')}
          style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {row.original.metadata.name}
        </span>
      ),
    },
    {
      id: 'namespace',
      header: '네임스페이스',
      accessorFn: (row: GpuScheduling) => row.metadata.namespace,
      size: 150,
    },
    {
      id: 'pods',
      header: '파드',
      accessorFn: (row: GpuScheduling) => {
        const readyReplicas = row.status.readyReplicas || 0;
        const replicas = row.spec.replicas || 0;
        return `${readyReplicas}/${replicas}`;
      },
      size: 120,
    },
    {
      id: 'type',
      header: '유형',
      accessorFn: (row: GpuScheduling) => row.spec.type || 'Unknown',
      size: 150,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: GpuScheduling) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: GpuScheduling } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="gpu-schedulings"
          resourceLabel="GPU 스케줄링"
          resourceName={row.original.metadata.name}
          namespace={row.original.metadata.namespace}
          rowData={row.original}
          onOpenDrawer={(tab) => openDrawer(row.original, tab)}
        />
      ),
    },
  ];

  return (
    <div>
      <BulkActionToolbar
        selected={selectedItems}
        resourceType="gpu-schedulings"
        resourceLabel="GPU 스케줄링"
        clusterName={clusterName ?? undefined}
        getName={(g) => g.metadata.name}
        getNamespace={(g) => g.metadata.namespace}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={gpuSchedulings}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              'GPU 스케줄링 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>GPU 스케줄링이 없습니다.</div>
                <div>클러스터에 GPU 스케줄링이 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={gpuSchedulings.length}
          pagination={pagination}
          setPagination={setPagination}
          useSelect
          useMultiSelect
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </div>

      <ResourceDetailDrawer
        isOpen={!!drawerItem}
        clusterName={clusterName ?? undefined}
        resourceType="gpu-schedulings"
        resourceLabel="GPU 스케줄링"
        resourceName={drawerItem?.metadata.name}
        namespace={drawerItem?.metadata.namespace}
        initialTab={drawerTab}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};