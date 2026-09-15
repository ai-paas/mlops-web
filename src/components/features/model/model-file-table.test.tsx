import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { screen, waitFor } from '@/test/utils/test-utils';
import { installDomMeasurementStubs } from '@/test/utils/dom-measure-stubs';
import { createPagedListHandler, renderListPage } from '@/test/utils/list-page';
import type { ModelFile } from '@/types/model';
import { ModelFileTable } from './model-file-table';

installDomMeasurementStubs();

const files: ModelFile[] = [
  {
    name: 'config.json',
    size_bytes: 5771,
    last_modified: '2026-09-14T03:31:31.242000Z',
    download_url: '/api/v1/models/11/files/download-url?name=config.json',
  },
  {
    name: 'model.safetensors',
    size_bytes: 135795376,
    last_modified: '2026-09-14T03:33:22.252000Z',
    download_url: '/api/v1/models/11/files/download-url?name=model.safetensors',
  },
];

const setupFiles = (items: ModelFile[] = files) => {
  const paged = createPagedListHandler<ModelFile>('models/:modelId/files', items);
  server.use(paged.handler);
  return paged;
};

/** 앵커 클릭을 가로채 이동할 URL만 기록한다 (jsdom은 실제 내비게이션을 못 한다) */
const spyAnchorClick = () => {
  const hrefs: string[] = [];
  const spy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      hrefs.push(this.href);
    });
  return { hrefs, spy };
};

describe('ModelFileTable', () => {
  it('파일 크기와 업데이트 일시를 사람이 읽는 형식으로 렌더한다', async () => {
    setupFiles();
    renderListPage(<ModelFileTable modelId={11} />);

    expect(await screen.findByText('config.json')).toBeInTheDocument();
    // size_bytes(숫자) → 1024 단위 문자열, last_modified(ISO) → 로컬 표기
    expect(screen.getByText('5.64 KB')).toBeInTheDocument();
    expect(screen.getByText('129.50 MB')).toBeInTheDocument();
    expect(screen.getByText('2026-09-14 12:31')).toBeInTheDocument();
  });

  it('기본 정렬(name 오름차순)을 sort 파라미터로 보낸다', async () => {
    const { lastParams } = setupFiles();
    renderListPage(<ModelFileTable modelId={11} />);

    await screen.findByText('config.json');

    expect(lastParams()?.get('sort')).toBe('name');
    expect(lastParams()?.get('page')).toBe('1');
  });

  it('컬럼 헤더를 클릭하면 내림차순(- 접두사)으로 재요청한다', async () => {
    const { lastParams } = setupFiles();
    const { user } = renderListPage(<ModelFileTable modelId={11} />);
    await screen.findByText('config.json');

    await user.click(screen.getByText('파일 크기'));

    await waitFor(() => expect(lastParams()?.get('sort')).toBe('-size_bytes'));
  });

  it('modelId가 없으면 요청하지 않는다', async () => {
    const requestSpy = vi.fn();
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files`, () => {
        requestSpy();
        return HttpResponse.json({ data: [], total: 0, page: 1, size: 10 });
      })
    );

    renderListPage(<ModelFileTable modelId={undefined} />);

    await waitFor(() => expect(requestSpy).not.toHaveBeenCalled());
  });

  it('빈 목록(OLLAMA·NONE 모델)은 에러가 아니라 안내 문구로 표시한다', async () => {
    setupFiles([]);
    renderListPage(<ModelFileTable modelId={11} />);

    expect(await screen.findByText('파일이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('파일 목록을 불러오지 못했습니다.')).not.toBeInTheDocument();
  });

  // 회귀 방지: 래퍼에 높이가 없으면 Table의 height:100%가 풀리지 않아, 절대 위치로
  // 중앙 정렬되는 빈 상태 메시지가 헤더·페이지네이션에 겹치고 잘린다.
  // jsdom은 레이아웃을 계산하지 않으므로 높이 자체가 아니라 높이 클래스 유무를 고정한다.
  it('테이블을 높이가 지정된 래퍼로 감싼다', async () => {
    setupFiles([]);
    renderListPage(<ModelFileTable modelId={11} />);
    await screen.findByText('파일이 없습니다.');

    const wrapper = screen.getByTestId('page-size-select').closest('.tabs-Content');

    expect(wrapper).toHaveClass('h-120.25');
  });

  it('조회 실패 시 테이블 안에 에러 문구를 보여준다', async () => {
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files`, () =>
        HttpResponse.json({ detail: '스토리지를 사용할 수 없습니다.' }, { status: 502 })
      )
    );
    renderListPage(<ModelFileTable modelId={11} />);

    expect(await screen.findByText('파일 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('다운로드 버튼을 누르면 발급받은 서명 URL로 이동한다', async () => {
    setupFiles();
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files/download-url`, ({ request }) => {
        const name = new URL(request.url).searchParams.get('name') ?? '';
        return HttpResponse.json({
          model_id: 11,
          name,
          size_bytes: 5771,
          download_url: `http://storage.test/signed/${name}`,
          expires_at: '2026-09-15T00:32:03.291043Z',
        });
      })
    );
    const { hrefs, spy } = spyAnchorClick();

    try {
      const { user } = renderListPage(<ModelFileTable modelId={11} />);
      await screen.findByText('config.json');

      await user.click(screen.getByRole('button', { name: 'config.json 다운로드' }));

      await waitFor(() => expect(hrefs).toEqual(['http://storage.test/signed/config.json']));
    } finally {
      spy.mockRestore();
    }
  });

  it('다운로드 실패 시 서버 메시지로 토스트를 띄운다', async () => {
    setupFiles();
    server.use(
      http.get(`${BASE_URL}/models/:modelId/files/download-url`, () =>
        HttpResponse.json({ detail: '파일을 찾을 수 없습니다.' }, { status: 404 })
      )
    );
    const { hrefs, spy } = spyAnchorClick();

    try {
      const { user } = renderListPage(<ModelFileTable modelId={11} />);
      await screen.findByText('config.json');

      await user.click(screen.getByRole('button', { name: 'config.json 다운로드' }));

      expect(await screen.findByText('모델 파일 다운로드 실패')).toBeInTheDocument();
      expect(screen.getByText('파일을 찾을 수 없습니다.')).toBeInTheDocument();
      expect(hrefs).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
