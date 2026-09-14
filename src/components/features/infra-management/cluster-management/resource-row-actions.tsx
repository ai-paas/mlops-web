import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertDialog, Tooltip, useToast } from '@innogrid/ui';
import {
  useDeleteKubernetesResource,
  useRestartKubernetesResource,
  useScaleKubernetesResource,
} from '@/hooks/service/clusters';
import type { DrawerTab } from './resource-detail-drawer';
import { ScaleModal } from './scale-modal';
import { stripVolatile } from './strip-volatile';

const RESTARTABLE = new Set(['pods', 'deployments', 'statefulsets', 'daemonsets']);
const SCALABLE = new Set(['deployments', 'replicasets', 'statefulsets']);

// rowData 에서 spec.replicas 를 안전하게 추출 — Deployments/RS/StatefulSets 만 있음.
const extractReplicas = (rowData: unknown): number | undefined => {
  if (!rowData || typeof rowData !== 'object') return undefined;
  const spec = (rowData as { spec?: unknown }).spec;
  if (!spec || typeof spec !== 'object') return undefined;
  const r = (spec as { replicas?: unknown }).replicas;
  return typeof r === 'number' ? r : undefined;
};

interface ResourceRowActionsProps {
  clusterName?: string;
  resourceType: string;
  resourceLabel: string;
  resourceName: string;
  namespace?: string;
  /** 로그 아이콘 노출. Pods 만 true. */
  showLogs?: boolean;
  /** drawer 를 특정 탭으로 여는 콜백. tab 미지정 시 'overview'. */
  onOpenDrawer?: (tab: DrawerTab) => void;
  /** 행의 raw 리소스 객체. 'YAML 복사' 에서 사용. 미지정 시 메뉴에서 숨김. */
  rowData?: unknown;
}

interface MenuPos {
  top: number;
  left: number;
}

export const ResourceRowActions = ({
  clusterName,
  resourceType,
  resourceLabel,
  resourceName,
  namespace,
  showLogs,
  onOpenDrawer,
  rowData,
}: ResourceRowActionsProps) => {
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 메뉴 열릴 때 버튼 rect 기준으로 위치 계산 — Table cell 의 overflow 영향 없이 portal 렌더링.
  useLayoutEffect(() => {
    if (!menuOpen || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = buttonRef.current.getBoundingClientRect();
    const MENU_WIDTH = 160;
    const left = Math.max(8, rect.right - MENU_WIDTH);
    setMenuPos({ top: rect.bottom + 4, left });
  }, [menuOpen]);

  // 외부 클릭/Esc 로 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const { deleteResource, isPending: isDeleting } = useDeleteKubernetesResource({
    onSuccess: () => {
      toast.open({ status: 'positive', title: `${resourceLabel} 삭제 요청 완료` });
      setDeleteConfirm(false);
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      toast.open({
        status: 'negative',
        title: msg || `${resourceLabel} 삭제에 실패했습니다.`,
      });
    },
  });

  const { restartResource } = useRestartKubernetesResource({
    onSuccess: () => toast.open({ status: 'positive', title: `${resourceLabel} 재시작 요청 완료` }),
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      toast.open({ status: 'negative', title: msg || `${resourceLabel} 재시작 실패` });
    },
  });

  const { scaleResource, isPending: isScaling } = useScaleKubernetesResource({
    onSuccess: () => {
      toast.open({ status: 'positive', title: `${resourceLabel} 스케일 변경 완료` });
      setScaleOpen(false);
    },
    onError: (err) => {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      toast.open({ status: 'negative', title: msg || `${resourceLabel} 스케일 실패` });
    },
  });

  const handleRestart = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!clusterName) return;
    restartResource({ resourceType, resourceName, clusterName, namespace });
    setMenuOpen(false);
  };

  const handleOpenScale = () => {
    setScaleOpen(true);
    setMenuOpen(false);
  };

  const handleScaleConfirm = (replicas: number) => {
    if (!clusterName) return;
    scaleResource({ resourceType, resourceName, clusterName, namespace, replicas });
  };

  const handleDelete = () => {
    if (!clusterName) return;
    deleteResource({ resourceType, resourceName, clusterName, namespace });
  };

  const handleCopyYaml = async () => {
    if (!rowData || typeof rowData !== 'object') {
      toast.open({ status: 'negative', title: '복사할 데이터가 없습니다.' });
      return;
    }
    try {
      const text = JSON.stringify(stripVolatile(rowData as Record<string, unknown>), null, 2);
      await navigator.clipboard.writeText(text);
      toast.open({ status: 'positive', title: 'YAML(JSON) 이 클립보드에 복사되었습니다.' });
    } catch {
      toast.open({ status: 'negative', title: 'YAML 복사에 실패했습니다.' });
    }
    setMenuOpen(false);
  };

  const handleEdit = () => {
    onOpenDrawer?.('yaml');
    setMenuOpen(false);
  };

  const handleOpenDelete = () => {
    setDeleteConfirm(true);
    setMenuOpen(false);
  };

  const handleLogsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenDrawer?.('logs');
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {showLogs && (
        <Tooltip content="로그 보기" side="top" delayDuration={150}>
          <button
            type="button"
            onClick={handleLogsClick}
            aria-label="로그 보기"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[#6b7280] hover:bg-[#eef2ff] hover:text-[#1d4ed8]"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M3.5 2.5H12.5V13.5H3.5V2.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 5.5H10.5M5.5 8H10.5M5.5 10.5H8.5"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </Tooltip>
      )}

      {RESTARTABLE.has(resourceType) && (
        <Tooltip content="재시작" side="top" delayDuration={150}>
          <button
            type="button"
            onClick={handleRestart}
            aria-label="재시작"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[#6b7280] hover:bg-[#fef3c7] hover:text-[#b45309]"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M13 3v3.5h-3.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12.5 6.5A5 5 0 1 0 11 11"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </Tooltip>
      )}

      <Tooltip content="더보기" side="top" delayDuration={150}>
        <button
          ref={buttonRef}
          type="button"
          onClick={handleMenuClick}
          aria-label="더보기"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#1f2937]"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
            <circle cx="3" cy="8" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="13" cy="8" r="1.2" />
          </svg>
        </button>
      </Tooltip>

      {menuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              zIndex: 1000,
              width: 160,
            }}
            className="overflow-hidden rounded-md border border-[#e5e7eb] bg-white shadow-lg"
          >
            <MenuItem onClick={handleEdit}>편집</MenuItem>
            {Boolean(rowData) && <MenuItem onClick={handleCopyYaml}>YAML 복사</MenuItem>}
            {RESTARTABLE.has(resourceType) && (
              <MenuItem onClick={() => handleRestart()}>재시작</MenuItem>
            )}
            {SCALABLE.has(resourceType) && <MenuItem onClick={handleOpenScale}>스케일</MenuItem>}
            <MenuItem onClick={handleOpenDelete} destructive>
              삭제
            </MenuItem>
          </div>,
          document.body
        )}

      <ScaleModal
        isOpen={scaleOpen}
        resourceLabel={resourceLabel}
        resourceName={resourceName}
        namespace={namespace}
        currentReplicas={extractReplicas(rowData)}
        isProcessing={isScaling}
        onConfirm={handleScaleConfirm}
        onClose={() => setScaleOpen(false)}
      />

      <AlertDialog
        isOpen={deleteConfirm}
        title={`${resourceLabel} 삭제`}
        confirmButtonText={isDeleting ? '삭제 중...' : '삭제'}
        cancelButtonText="취소"
        onClickConfirm={handleDelete}
        onClickClose={() => !isDeleting && setDeleteConfirm(false)}
      >
        <span className="text-[13px] leading-relaxed text-[#1f2937]">
          <strong>{resourceName}</strong>
          {namespace && <span className="text-[#6b7280]"> ({namespace})</span>}
          {' '}
          {resourceLabel} 를 삭제합니다. 이 작업은 되돌릴 수 없으며, 종속 리소스가 함께 정리될 수 있습니다.
        </span>
      </AlertDialog>
    </div>
  );
};

interface MenuItemProps {
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}
const MenuItem = ({ onClick, destructive, children }: MenuItemProps) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={[
      'block w-full cursor-pointer border-0 bg-transparent px-3 py-2 text-left text-[13px] hover:bg-[#f3f4f6]',
      destructive ? 'text-[#b91c1c] hover:bg-[#fef2f2]' : 'text-[#1f2937]',
    ].join(' ')}
  >
    {children}
  </button>
);