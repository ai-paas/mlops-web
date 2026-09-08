import { useMemo, useState } from 'react';
import {
  Table,
  HeaderCheckbox,
  CellCheckbox,
  useTableSelection,
  useTablePagination,
} from '@innogrid/ui';
import { useGetKubernetesPods } from '@/hooks/service/clusters';
import { ResourceDetailDrawer, type DrawerTab } from '../resource-detail-drawer';
import { ResourceRowActions } from '../resource-row-actions';
import { BulkActionToolbar } from '../bulk-action-toolbar';
import type { KubernetesPod } from '@/types/cluster';

interface PodsTabProps {
  namespace?: string;
  clusterName?: string | null;
}

const POD_DRAWER_TABS: DrawerTab[] = ['overview', 'yaml', 'events', 'logs', 'shell'];

export const PodsTab = ({ clusterName, namespace }: PodsTabProps) => {
  const { rowSelection, setRowSelection } = useTableSelection();
  const { pagination, setPagination } = useTablePagination();

  const { pods, isPending, isError } = useGetKubernetesPods(clusterName || undefined, namespace);

  // 선택된 행 → bulk toolbar 가 사용할 raw 객체 배열
  const selectedPods = useMemo<KubernetesPod[]>(() => {
    return Object.keys(rowSelection)
      .map((k) => pods[parseInt(k, 10)])
      .filter((p): p is KubernetesPod => Boolean(p));
  }, [pods, rowSelection]);

  // drawer state — 단일 pod + 진입 탭
  const [drawerPod, setDrawerPod] = useState<KubernetesPod | undefined>();
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  const openDrawer = (pod: KubernetesPod, tab: DrawerTab = 'overview') => {
    setDrawerPod(pod);
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
      accessorFn: (row: KubernetesPod) => row.metadata.name,
      size: 200,
      cell: ({ row }: { row: { original: KubernetesPod } }) => (
        <span
          onClick={() => openDrawer(row.original, 'overview')}
          style={{
            color: '#0066cc',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          {row.original.metadata.name}
        </span>
      ),
    },
    {
      id: 'status',
      header: '상태',
      accessorFn: (row: KubernetesPod) => row.status.phase,
      size: 120,
      cell: ({ row }: { row: { original: KubernetesPod } }) => {
        const status = row.original.status.phase;
        const statusClass = status === 'Running' ? 'table-td-state-run' : 'table-td-state-negative';
        return <span className={`table-td-state ${statusClass}`}>{status}</span>;
      },
    },
    {
      id: 'namespace',
      header: '네임스페이스',
      accessorFn: (row: KubernetesPod) => row.metadata.namespace,
      size: 150,
    },
    {
      id: 'containers',
      header: '컨테이너',
      accessorFn: (row: KubernetesPod) => {
        const containerStatuses = row.status.containerStatuses || [];
        const readyCount = containerStatuses.filter((cs) => cs.ready).length;
        const totalCount = containerStatuses.length;
        return `${readyCount}/${totalCount}`;
      },
      size: 120,
    },
    {
      id: 'restartCount',
      header: '재시작 횟수',
      accessorFn: (row: KubernetesPod) => {
        const containerStatuses = row.status.containerStatuses || [];
        const totalRestarts = containerStatuses.reduce(
          (sum, cs) => sum + (cs.restartCount || 0),
          0
        );
        return totalRestarts.toString();
      },
      size: 120,
    },
    {
      id: 'owner',
      header: '소유자',
      accessorFn: (row: KubernetesPod) => {
        const ownerReferences = row.metadata.ownerReferences || [];
        if (ownerReferences.length > 0) {
          const owner = ownerReferences[0];
          return `${owner.kind} / ${owner.name}`;
        }
        return '-';
      },
      size: 200,
    },
    {
      id: 'createdAt',
      header: '생성 일시',
      accessorFn: (row: KubernetesPod) => row.metadata.creationTimestamp,
      size: 200,
    },
    {
      id: 'actions',
      header: '작업',
      enableSorting: false,
      size: 110,
      cell: ({ row }: { row: { original: KubernetesPod } }) => (
        <ResourceRowActions
          clusterName={clusterName ?? undefined}
          resourceType="pods"
          resourceLabel="파드"
          resourceName={row.original.metadata.name}
          namespace={row.original.metadata.namespace}
          showLogs
          rowData={row.original}
          onOpenDrawer={(tab) => openDrawer(row.original, tab)}
        />
      ),
    },
  ];

  return (
    <div>
      <BulkActionToolbar
        selected={selectedPods}
        resourceType="pods"
        resourceLabel="파드"
        clusterName={clusterName ?? undefined}
        getName={(p) => p.metadata.name}
        getNamespace={(p) => p.metadata.namespace}
        onClear={() => setRowSelection({})}
      />

      <div className="h-[481px]">
        <Table
          columns={columns}
          data={pods}
          isLoading={isPending}
          emptyMessage={
            isError ? (
              '파드 정보를 불러오는 데 실패했습니다.'
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div>파드가 없습니다.</div>
                <div>클러스터에 파드가 생성되지 않았습니다.</div>
              </div>
            )
          }
          totalCount={pods.length}
          pagination={pagination}
          setPagination={setPagination}
          useSelect
          useMultiSelect
          rowSelection={rowSelection}
          setRowSelection={setRowSelection}
        />
      </div>

      <ResourceDetailDrawer
        isOpen={!!drawerPod}
        clusterName={clusterName ?? undefined}
        resourceType="pods"
        resourceLabel="파드"
        resourceName={drawerPod?.metadata.name}
        namespace={drawerPod?.metadata.namespace}
        initialTab={drawerTab}
        availableTabs={POD_DRAWER_TABS}
        onClose={() => setDrawerPod(undefined)}
      />
    </div>
  );
};