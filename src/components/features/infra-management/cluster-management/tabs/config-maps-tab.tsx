import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesConfigMaps } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesConfigMap } from '@/types/cluster';

interface ConfigMapsTabProps {
  namespace?: string;
  clusterName?: string | null;
}

export const ConfigMapsTab = ({ clusterName, namespace }: ConfigMapsTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { configMaps, isPending, isError } = useGetKubernetesConfigMaps(
    clusterName || undefined,
    namespace
  );

  const selectedItems = useMemo<KubernetesConfigMap[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => configMaps[parseInt(k, 10)])
      .filter((c): c is KubernetesConfigMap => Boolean(c));
  }, [configMaps, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<KubernetesConfigMap | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: KubernetesConfigMap, tab: DrawerTab = 'overview') => {
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
      accessorFn: (row: KubernetesConfigMap) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesConfigMap } }) => (
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
      accessorFn: (row: KubernetesConfigMap) => row.metadata.namespace,
      size: 150,
    },
    {
      id: 'configCount',
      header: '컨피그 수',
      accessorFn: (row: KubernetesConfigMap) => {
        const data = row.data || {};
        return Object.keys(data).length;
      },
      size: 120,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesConfigMap) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: KubernetesConfigMap } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="config-maps"
          resourceLabel="컨피그맵"
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
        resourceType="config-maps"
        resourceLabel="컨피그맵"
        clusterName={clusterName ?? undefined}
        getName={(c) => c.metadata.name}
        getNamespace={(c) => c.metadata.namespace}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={configMaps}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '컨피그맵 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>컨피그맵이 없습니다.</div>
                <div>클러스터에 컨피그맵이 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={configMaps.length}
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
        resourceType="config-maps"
        resourceLabel="컨피그맵"
        resourceName={drawerItem?.metadata.name}
        namespace={drawerItem?.metadata.namespace}
        initialTab={drawerTab}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};