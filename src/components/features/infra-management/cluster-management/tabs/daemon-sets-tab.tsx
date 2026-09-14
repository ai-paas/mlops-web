import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesDaemonSets } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';

const WORKLOAD_DRAWER_TABS: DrawerTab[] = ['overview', 'yaml', 'events', 'logs'];
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesDaemonSet } from '@/types/cluster';

interface DaemonSetsTabProps {
  namespace?: string;
  clusterName?: string | null;
}

export const DaemonSetsTab = ({ clusterName, namespace }: DaemonSetsTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { daemonSets, isPending, isError } = useGetKubernetesDaemonSets(
    clusterName || undefined,
    namespace
  );

  const selectedItems = useMemo<KubernetesDaemonSet[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => daemonSets[parseInt(k, 10)])
      .filter((d): d is KubernetesDaemonSet => Boolean(d));
  }, [daemonSets, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<KubernetesDaemonSet | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: KubernetesDaemonSet, tab: DrawerTab = 'overview') => {
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
      accessorFn: (row: KubernetesDaemonSet) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesDaemonSet } }) => (
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
      accessorFn: (row: KubernetesDaemonSet) => row.metadata.namespace,
      size: 150,
    },
    {
      id: 'pods',
      header: '파드',
      accessorFn: (row: KubernetesDaemonSet) => {
        const readyReplicas = row.status.readyReplicas || 0;
        const replicas = row.spec.replicas || 0;
        return `${readyReplicas}/${replicas}`;
      },
      size: 120,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesDaemonSet) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: KubernetesDaemonSet } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="daemonsets"
          resourceLabel="데몬셋"
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
        resourceType="daemonsets"
        resourceLabel="데몬셋"
        clusterName={clusterName ?? undefined}
        getName={(d) => d.metadata.name}
        getNamespace={(d) => d.metadata.namespace}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={daemonSets}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '데몬셋 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>데몬셋이 없습니다.</div>
                <div>클러스터에 데몬셋이 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={daemonSets.length}
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
        resourceType="daemonsets"
        resourceLabel="데몬셋"
        resourceName={drawerItem?.metadata.name}
        namespace={drawerItem?.metadata.namespace}
        initialTab={drawerTab}
        availableTabs={WORKLOAD_DRAWER_TABS}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};