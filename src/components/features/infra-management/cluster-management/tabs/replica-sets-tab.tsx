import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesReplicaSets } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';

const WORKLOAD_DRAWER_TABS: DrawerTab[] = ['overview', 'yaml', 'events', 'logs'];
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesReplicaSet } from '@/types/cluster';

interface ReplicaSetsTabProps {
  namespace?: string;
  clusterName?: string | null;
}

export const ReplicaSetsTab = ({ clusterName, namespace }: ReplicaSetsTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { replicaSets, isPending, isError } = useGetKubernetesReplicaSets(
    clusterName || undefined,
    namespace
  );

  const selectedItems = useMemo<KubernetesReplicaSet[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => replicaSets[parseInt(k, 10)])
      .filter((r): r is KubernetesReplicaSet => Boolean(r));
  }, [replicaSets, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<KubernetesReplicaSet | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: KubernetesReplicaSet, tab: DrawerTab = 'overview') => {
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
      accessorFn: (row: KubernetesReplicaSet) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesReplicaSet } }) => (
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
      accessorFn: (row: KubernetesReplicaSet) => row.metadata.namespace,
      size: 200,
    },
    {
      id: 'pods',
      header: '파드',
      accessorFn: (row: KubernetesReplicaSet) => {
        const readyReplicas = row.status.readyReplicas || 0;
        const replicas = row.spec.replicas || 0;
        return `${readyReplicas}/${replicas}`;
      },
      size: 120,
    },
    {
      id: 'owner',
      header: '소유자',
      accessorFn: (row: KubernetesReplicaSet) => {
        const ownerReferences = row.metadata.ownerReferences || [];
        if (ownerReferences.length > 0) {
          const owner = ownerReferences[0];
          return `${owner.kind}/${owner.name}`;
        }
        return '-';
      },
      size: 200,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesReplicaSet) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: KubernetesReplicaSet } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="replicasets"
          resourceLabel="레플리카셋"
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
        resourceType="replicasets"
        resourceLabel="레플리카셋"
        clusterName={clusterName ?? undefined}
        getName={(r) => r.metadata.name}
        getNamespace={(r) => r.metadata.namespace}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={replicaSets}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '레플리카셋 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>레플리카셋이 없습니다.</div>
                <div>클러스터에 레플리카셋이 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={replicaSets.length}
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
        resourceType="replicasets"
        resourceLabel="레플리카셋"
        resourceName={drawerItem?.metadata.name}
        namespace={drawerItem?.metadata.namespace}
        initialTab={drawerTab}
        availableTabs={WORKLOAD_DRAWER_TABS}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};