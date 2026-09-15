import { Table, useTablePagination, useToast, type ColDef, type SortValue } from '@innogrid/ui';
import { useMemo, useState } from 'react';
import { IconDownload } from '@/assets/img/icon';
import { useDownloadModelFile, useGetModelFiles } from '@/hooks/service/models';
import { getServerErrorMessage } from '@/lib/api';
import type { ModelFile } from '@/types/model';
import { formatDateTime } from '@/util/date';
import { formatFileSize } from '@/util/file-size';
import styles from '@/pages/model/model.module.scss';

/**
 * 행 단위 다운로드 버튼. 서명 URL 발급이 행마다 독립이라 뮤테이션도 행마다 둔다
 * (진행 중 표시가 누른 행에만 걸린다).
 */
const DownloadButton = ({ file }: { file: ModelFile }) => {
  const { downloadModelFile, isPending } = useDownloadModelFile();
  const toast = useToast();

  const handleClick = () => {
    downloadModelFile(file.download_url, {
      onError: (error) => {
        toast.open({
          status: 'negative',
          title: '모델 파일 다운로드 실패',
          children: getServerErrorMessage(error, '파일 다운로드 중 오류가 발생했습니다.'),
        });
      },
    });
  };

  return (
    <button
      type="button"
      className={styles.btnDownload}
      onClick={handleClick}
      disabled={isPending}
      aria-label={`${file.name} 다운로드`}
    >
      <IconDownload />
    </button>
  );
};

// 컬럼 id는 API의 sort 필드명과 같아야 한다 — sorting 상태를 그대로 sort 파라미터로 만든다
const columns: ColDef<ModelFile>[] = [
  {
    id: 'name',
    header: '이름',
    accessorFn: (row: ModelFile) => row.name,
    size: 500,
  },
  {
    id: 'size_bytes',
    header: '파일 크기',
    // 정렬이 원본값 기준이 되도록 accessorFn은 숫자 그대로 두고 표시만 포맷한다
    accessorFn: (row: ModelFile) => row.size_bytes,
    cell: ({ row }: { row: { original: ModelFile } }) => formatFileSize(row.original.size_bytes),
    size: 500,
  },
  {
    id: 'last_modified',
    header: '업데이트 일시',
    accessorFn: (row: ModelFile) => row.last_modified,
    cell: ({ row }: { row: { original: ModelFile } }) => formatDateTime(row.original.last_modified),
    size: 500,
  },
  {
    id: 'download',
    header: '다운로드',
    size: 123,
    cell: ({ row }: { row: { original: ModelFile } }) => <DownloadButton file={row.original} />,
    enableSorting: false,
  },
];

/** 모델 상세의 파일 탭. 커스텀 모델·모델 카탈로그 상세가 함께 쓴다. */
export const ModelFileTable = ({ modelId }: { modelId?: number }) => {
  const { pagination, setPagination } = useTablePagination();
  const [sorting, setSorting] = useState<SortValue[]>([{ id: 'name', desc: false }]);

  const sort = useMemo(
    () => sorting.map((s) => `${s.desc ? '-' : ''}${s.id}`).join(',') || undefined,
    [sorting]
  );

  const { modelFiles, page, isPending, isError } = useGetModelFiles(modelId ?? 0, {
    page: pagination.pageIndex + 1,
    size: pagination.pageSize,
    sort,
  });

  return (
    // 높이는 필수다. Table의 빈 상태 메시지가 컨테이너 높이의 50% 지점에 절대 위치로
    // 놓이는데, 부모에 높이가 없으면 height:100%가 풀리지 않아 헤더·페이지네이션에
    // 겹치고 잘린다. h-120.25(481px)는 기본 페이지 크기 10건 기준으로 목록 페이지들이 쓰는 값.
    <div className="tabs-Content h-120.25">
      <Table
        columns={columns}
        data={modelFiles}
        isLoading={isPending}
        // OLLAMA·NONE 모델은 오류가 아니라 200에 빈 목록이 온다 — 에러 문구를 띄우면 안 된다
        emptyMessage={isError ? '파일 목록을 불러오지 못했습니다.' : '파일이 없습니다.'}
        totalCount={page.total}
        pagination={pagination}
        setPagination={setPagination}
        sorting={sorting}
        setSorting={setSorting}
      />
    </div>
  );
};
