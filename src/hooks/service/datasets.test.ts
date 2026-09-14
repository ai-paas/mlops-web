import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createHookWrapper, createTestQueryClient } from '@/test/utils/test-utils';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api';
import {
  useCreateDataset,
  useDeleteDataset,
  useGetDataset,
  useGetDatasets,
  useUpdateDataset,
  useValidateDataset,
} from './datasets';

// 데이터셋 mutation 3종(생성/수정/삭제)은 모두 datasets.all 프리픽스 무효화 계약이다.
// list/detail/kinds가 전부 ['datasets'] 하위 계층이므로 한 번의 무효화로 모두 stale 처리된다.

const seedCaches = (queryClient: ReturnType<typeof createTestQueryClient>) => {
  queryClient.setQueryData(queryKeys.datasets.list({ page: 1 }), { data: [], total: 0 });
  queryClient.setQueryData(queryKeys.datasets.detail(1), { id: 1, name: '분류 데이터셋' });
  queryClient.setQueryData(queryKeys.datasets.kinds(), []);
  // 무관 도메인 — 무효화가 번지지 않아야 한다
  queryClient.setQueryData(queryKeys.members.list(), { data: [], total: 0 });
};

describe('datasets hooks', () => {
  // ============================================
  // mutation — datasets.all 무효화 계약
  // ============================================
  describe('useCreateDataset', () => {
    it('생성 성공 시 datasets 계층(list/detail/kinds)을 무효화하고 무관 도메인은 건드리지 않는다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useCreateDataset(), {
        wrapper: createHookWrapper(queryClient),
      });

      await result.current.createDataset(new FormData());

      expect(queryClient.getQueryState(queryKeys.datasets.list({ page: 1 }))?.isInvalidated).toBe(
        true
      );
      expect(queryClient.getQueryState(queryKeys.datasets.detail(1))?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(queryKeys.datasets.kinds())?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(queryKeys.members.list())?.isInvalidated).toBe(false);
    });

    it('생성 실패 시 목록을 무효화하지 않는다', async () => {
      server.use(
        http.post(`${BASE_URL}/datasets`, () =>
          HttpResponse.json({ message: 'Bad Request' }, { status: 400 })
        )
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useCreateDataset(), {
        wrapper: createHookWrapper(queryClient),
      });

      await expect(result.current.createDataset(new FormData())).rejects.toThrow();

      expect(queryClient.getQueryState(queryKeys.datasets.list({ page: 1 }))?.isInvalidated).toBe(
        false
      );
    });
  });

  describe('useUpdateDataset', () => {
    it('datasetId는 URL 경로로만 쓰고 요청 본문에는 나머지 필드만 담는다', async () => {
      let capturedBody: unknown;
      let capturedId: string | undefined;
      server.use(
        http.put(`${BASE_URL}/datasets/:datasetId`, async ({ request, params }) => {
          capturedBody = await request.json();
          capturedId = params.datasetId as string;
          return HttpResponse.json({ id: 1, name: '수정됨' });
        })
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useUpdateDataset(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.updateDataset({ datasetId: 1, name: '수정됨', description: '설명' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(capturedId).toBe('1');
      expect(capturedBody).toEqual({ name: '수정됨', description: '설명' });
      expect(queryClient.getQueryState(queryKeys.datasets.detail(1))?.isInvalidated).toBe(true);
    });
  });

  describe('useDeleteDataset', () => {
    it('삭제 성공 시 datasets 계층을 무효화한다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteDataset(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteDataset(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(queryClient.getQueryState(queryKeys.datasets.list({ page: 1 }))?.isInvalidated).toBe(
        true
      );
      expect(queryClient.getQueryState(queryKeys.members.list())?.isInvalidated).toBe(false);
    });

    it('삭제 실패 시 무효화하지 않는다', async () => {
      server.use(
        http.delete(`${BASE_URL}/datasets/:datasetId`, () =>
          HttpResponse.json({ message: 'Forbidden' }, { status: 403 })
        )
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteDataset(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteDataset(1);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(queryClient.getQueryState(queryKeys.datasets.list({ page: 1 }))?.isInvalidated).toBe(
        false
      );
    });
  });

  // ============================================
  // query — envelope 매핑과 enabled 게이트
  // ============================================
  describe('useGetDatasets', () => {
    it('페이지 envelope를 datasets/page로 매핑한다', async () => {
      const { result } = renderHook(() => useGetDatasets({ page: 1 }), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.datasets).toHaveLength(2);
      expect(result.current.page).toEqual({ number: 1, size: 10, total: 2 });
    });

    it('envelope 필드가 빠진 응답에는 기본값(datasets [], page 1/1/1)을 쓴다', async () => {
      server.use(http.get(`${BASE_URL}/datasets`, () => HttpResponse.json({})));
      const { result } = renderHook(() => useGetDatasets(), {
        wrapper: createHookWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });
      expect(result.current.datasets).toEqual([]);
      expect(result.current.page).toEqual({ number: 1, size: 1, total: 1 });
    });
  });

  describe('useGetDataset', () => {
    it('dataset_id가 없으면 요청하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.get(`${BASE_URL}/datasets/:datasetId`, () => {
          requestSpy();
          return HttpResponse.json({ id: 1 });
        })
      );

      renderHook(() => useGetDataset(undefined), { wrapper: createHookWrapper() });

      // enabled: false는 요청 자체를 만들지 않는다 — 짧게 대기 후 미호출 확인
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });

  describe('useValidateDataset', () => {
    // MSW 핸들러의 request.formData() 파싱은 jsdom File과 만나면 행이 걸린다
    // (knowledgebase.test.ts와 동일한 이유로 api.post 스파이로 검증)
    it('FormData를 datasets/validate로 보내고 검증 결과를 반환한다', async () => {
      const validationResult = { is_valid: false, message: '컬럼 누락', details: { errors: ['text'] } };
      const postSpy = vi.spyOn(api, 'post').mockImplementation(
        () =>
          ({
            json: () => Promise.resolve(validationResult),
          }) as ReturnType<typeof api.post>
      );
      const { result } = renderHook(() => useValidateDataset(), {
        wrapper: createHookWrapper(),
      });

      const formData = new FormData();
      formData.append('file', new File(['a,b'], 'data.csv', { type: 'text/csv' }));
      const response = await result.current.validateDataset(formData);

      expect(postSpy).toHaveBeenCalledWith('datasets/validate', { body: formData, timeout: false });
      expect(response).toEqual(validationResult);

      postSpy.mockRestore();
    });
  });
});
