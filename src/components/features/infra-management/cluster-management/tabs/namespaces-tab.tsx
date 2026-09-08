import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesNamespaces } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesNamespace } from '@/types/cluster';

interface NamespacesTabProps {
  clusterName?: string | null;
}

export const NamespacesTab = ({ clusterName }: NamespacesTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { namespaces, isPending, isError } = useGetKubernetesNamespaces(clusterName || undefined);

  const selectedItems = useMemo<KubernetesNamespace[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => namespaces[parseInt(k, 10)])
      .filter((n): n is KubernetesNamespace => Boolean(n));
  }, [namespaces, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<KubernetesNamespace | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: KubernetesNamespace, tab: DrawerTab = 'overview') => {
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
      accessorFn: (row: KubernetesNamespace) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesNamespace } }) => (
        <span
          onClick={() => openDrawer(row.original, 'overview')}
          style={{ color: '#0066cc', textDecoration: 'underline', cursor: 'pointer' }}
        >
          {row.original.metadata.name}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      accessorFn: (row: KubernetesNamespace) => {
        const status = row.status.phase;
        return status === 'Active' ? 'Active' : status;
      },
      size: 120,
      cell: ({ row }: { row: { original: KubernetesNamespace } }) => {
        const status = row.original.status.phase;
        const isActive = status === 'Active';
        return (
          <span className={`table-td-state table-td-state-${isActive ? 'run' : 'negative'}`}>
            {isActive ? 'Active' : status}
          </span>
        );
      },
    },
    {
      id: 'workspace',
      header: '작업공간',
      accessorFn: (row: KubernetesNamespace) => {
        const labels = row.metadata.labels || {};
        return labels['workspace'] || 'False';
      },
      size: 150,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesNamespace) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: KubernetesNamespace } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="namespaces"
          resourceLabel="네임스페이스"
          resourceName={row.original.metadata.name}
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
        resourceType="namespaces"
        resourceLabel="네임스페이스"
        clusterName={clusterName ?? undefined}
        getName={(n) => n.metadata.name}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={namespaces}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '네임스페이스 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>네임스페이스가 없습니다.</div>
                <div>클러스터에 네임스페이스가 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={namespaces.length}
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
        resourceType="namespaces"
        resourceLabel="네임스페이스"
        resourceName={drawerItem?.metadata.name}
        initialTab={drawerTab}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};