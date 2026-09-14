import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesNodes } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesNode } from '@/types/cluster';

interface NodesTabProps {
  clusterName?: string | null;
}

export const NodesTab = ({ clusterName }: NodesTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { nodes, isPending, isError } = useGetKubernetesNodes(clusterName || undefined);

  const selectedItems = useMemo<KubernetesNode[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => nodes[parseInt(k, 10)])
      .filter((n): n is KubernetesNode => Boolean(n));
  }, [nodes, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<KubernetesNode | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: KubernetesNode, tab: DrawerTab = 'overview') => {
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
      accessorFn: (row: KubernetesNode) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesNode } }) => (
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
      accessorFn: (row: KubernetesNode) => {
        const conditions = row.status.conditions || [];
        const readyCondition = conditions.find((c) => c.type === 'Ready');
        return readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
      },
      size: 120,
      cell: ({ row }: { row: { original: KubernetesNode } }) => {
        const conditions = row.original.status.conditions || [];
        const readyCondition = conditions.find((c) => c.type === 'Ready');
        const status = readyCondition?.status === 'True' ? 'Ready' : 'NotReady';
        return (
          <span
            className={`table-td-state table-td-state-${status === 'Ready' ? 'run' : 'negative'}`}
          >
            {status}
          </span>
        );
      },
    },
    {
      id: 'roles',
      header: '권한',
      accessorFn: (row: KubernetesNode) => {
        const labels = row.metadata.labels || {};
        const roles = [];
        if (
          labels['node-role.kubernetes.io/control-plane'] ||
          labels['node-role.kubernetes.io/master']
        ) {
          roles.push('control-plane');
        }
        if (labels['node-role.kubernetes.io/worker']) {
          roles.push('worker');
        }
        return roles.length > 0 ? roles.join(',') : 'worker';
      },
      size: 200,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesNode) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: KubernetesNode } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="nodes"
          resourceLabel="노드"
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
        resourceType="nodes"
        resourceLabel="노드"
        clusterName={clusterName ?? undefined}
        getName={(n) => n.metadata.name}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={nodes}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '노드 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>노드가 없습니다.</div>
                <div>클러스터에 노드가 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={nodes.length}
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
        resourceType="nodes"
        resourceLabel="노드"
        resourceName={drawerItem?.metadata.name}
        initialTab={drawerTab}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};