import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesServices } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesService } from '@/types/cluster';

interface ServicesTabProps {
  namespace?: string;
  clusterName?: string | null;
}

export const ServicesTab = ({ clusterName, namespace }: ServicesTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { services, isPending, isError } = useGetKubernetesServices(
    clusterName || undefined,
    namespace
  );

  const selectedItems = useMemo<KubernetesService[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => services[parseInt(k, 10)])
      .filter((s): s is KubernetesService => Boolean(s));
  }, [services, rowSelection]);

  const [drawerItem, setDrawerItem] = useState<KubernetesService | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (item: KubernetesService, tab: DrawerTab = 'overview') => {
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
      accessorFn: (row: KubernetesService) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesService } }) => (
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
      accessorFn: (row: KubernetesService) => row.metadata.namespace,
      size: 150,
    },
    {
      id: 'address',
      header: '주소',
      accessorFn: (row: KubernetesService) => {
        const clusterIP = row.spec.clusterIP;
        const loadBalancerIP = row.status.loadBalancer?.ingress?.[0]?.ip;
        return loadBalancerIP || clusterIP || '-';
      },
      size: 150,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesService) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 90,
      cell: ({ row }: { row: { original: KubernetesService } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="services"
          resourceLabel="서비스"
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
        resourceType="services"
        resourceLabel="서비스"
        clusterName={clusterName ?? undefined}
        getName={(s) => s.metadata.name}
        getNamespace={(s) => s.metadata.namespace}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={services}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '서비스 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>서비스가 없습니다.</div>
                <div>클러스터에 서비스가 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={services.length}
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
        resourceType="services"
        resourceLabel="서비스"
        resourceName={drawerItem?.metadata.name}
        namespace={drawerItem?.metadata.namespace}
        initialTab={drawerTab}
        onClose={() => setDrawerItem(undefined)}
      />
    </div>
  );
};