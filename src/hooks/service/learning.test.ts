import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { createHookWrapper, createTestQueryClient } from '@/test/utils/test-utils';
import { queryKeys } from '@/lib/query-keys';
import { api } from '@/lib/api';
import {
  useDeleteLearning,
  useGetLearningStatus,
  useRegisterModel,
  useSubmitTraining,
  useUpdateLearning,
  useUpdateLearningInternalAccess,
} from './learning';

// 학습 mutation은 모두 learning.all 프리픽스 무효화 계약이다.
// list/detail/status가 전부 ['learning'] 하위 계층이므로 한 번의 무효화로 모두 stale 처리된다.

const seedCaches = (queryClient: ReturnType<typeof createTestQueryClient>) => {
  queryClient.setQueryData(queryKeys.learning.list({ page: 1 }), { data: [], total: 0 });
  queryClient.setQueryData(queryKeys.learning.detail(31), { id: 31, name: '분류 학습 A' });
  queryClient.setQueryData(queryKeys.learning.status(31), { status: 'RUNNING' });
  // 무관 도메인 — 무효화가 번지지 않아야 한다
  queryClient.setQueryData(queryKeys.datasets.list(), { data: [], total: 0 });
};

const expectLearningInvalidated = (
  queryClient: ReturnType<typeof createTestQueryClient>,
  invalidated: boolean
) => {
  expect(queryClient.getQueryState(queryKeys.learning.list({ page: 1 }))?.isInvalidated).toBe(
    invalidated
  );
  expect(queryClient.getQueryState(queryKeys.learning.detail(31))?.isInvalidated).toBe(invalidated);
  expect(queryClient.getQueryState(queryKeys.learning.status(31))?.isInvalidated).toBe(invalidated);
  expect(queryClient.getQueryState(queryKeys.datasets.list())?.isInvalidated).toBe(false);
};

describe('learning hooks', () => {
  // ============================================
  // useSubmitTraining — FormData 직렬화 계약
  // ============================================
  describe('useSubmitTraining', () => {
    // MSW 핸들러의 request.formData() 파싱은 jsdom File과 만나면 행이 걸린다
    // (knowledgebase.test.ts와 동일한 이유로 api.post 스파이로 직렬화를 검증)
    it('undefined/null 필드는 빼고, File은 그대로, 나머지는 문자열로 직렬화해 전송한다', async () => {
      const postSpy = vi.spyOn(api, 'post').mockImplementation(
        () =>
          ({
            json: () => Promise.resolve({ experiment_id: 99 }),
          }) as ReturnType<typeof api.post>
      );
      const { result } = renderHook(() => useSubmitTraining(), {
        wrapper: createHookWrapper(),
      });

      const datasetFile = new File(['{}'], 'train.jsonl', { type: 'application/jsonl' });
      await result.current.submitTraining({
        model_id: 11,
        train_name: '분류 학습',
        description: '설명',
        dataset_id: undefined, // dataset_file과 XOR — 빠져야 한다
        dataset_file: datasetFile,
        gpus: '1',
        batch_size: '8',
        epochs: '3',
        save_period: '1',
        weight_decay: '0.01',
        learning_rate: '0.0001',
      });

      expect(postSpy).toHaveBeenCalledWith('learning/training', {
        body: expect.any(FormData),
        timeout: false,
      });
      const formData = postSpy.mock.calls[0][1]!.body as FormData;
      expect(formData.has('dataset_id')).toBe(false);
      expect(formData.get('model_id')).toBe('11'); // 숫자 → 문자열
      expect(formData.get('train_name')).toBe('분류 학습');
      const uploaded = formData.get('dataset_file');
      expect(uploaded).toBeInstanceOf(File);
      expect((uploaded as File).name).toBe('train.jsonl');

      postSpy.mockRestore();
    });

    it('제출 성공 시 learning 계층(list/detail/status)을 무효화한다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useSubmitTraining(), {
        wrapper: createHookWrapper(queryClient),
      });

      await result.current.submitTraining({
        model_id: 11,
        train_name: '분류 학습',
        description: '',
        dataset_id: 1,
        gpus: '1',
        batch_size: '8',
        epochs: '3',
        save_period: '1',
        weight_decay: '0.01',
        learning_rate: '0.0001',
      });

      expectLearningInvalidated(queryClient, true);
    });

    it('제출 실패 시 무효화하지 않는다', async () => {
      server.use(
        http.post(`${BASE_URL}/learning/training`, () =>
          HttpResponse.json({ detail: 'Bad Request' }, { status: 400 })
        )
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useSubmitTraining(), {
        wrapper: createHookWrapper(queryClient),
      });

      await expect(
        result.current.submitTraining({
          model_id: 11,
          train_name: '분류 학습',
          description: '',
          gpus: '1',
          batch_size: '8',
          epochs: '3',
          save_period: '1',
          weight_decay: '0.01',
          learning_rate: '0.0001',
        })
      ).rejects.toThrow();

      expectLearningInvalidated(queryClient, false);
    });
  });

  // ============================================
  // useRegisterModel — JSON body + learning.all 무효화
  // ============================================
  describe('useRegisterModel', () => {
    it('등록 요청을 JSON으로 보내고 성공 시 learning 계층을 무효화한다', async () => {
      let capturedBody: unknown;
      server.use(
        http.post(`${BASE_URL}/learning/model/registration`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({ accepted: true, experiment_id: 31, message: 'ok' });
        })
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useRegisterModel(), {
        wrapper: createHookWrapper(queryClient),
      });

      await result.current.registerModel({
        model_name: '분류 모델 v2',
        description: '학습 결과 등록',
        experiment_id: 31,
      });

      expect(capturedBody).toEqual({
        model_name: '분류 모델 v2',
        description: '학습 결과 등록',
        experiment_id: 31,
      });
      expectLearningInvalidated(queryClient, true);
    });
  });

  // ============================================
  // useUpdateLearning / useUpdateLearningInternalAccess / useDeleteLearning
  // ============================================
  describe('useUpdateLearning', () => {
    it('experimentId는 URL 경로로만 쓰고 PATCH 본문에는 나머지 필드만 담는다', async () => {
      let capturedBody: unknown;
      let capturedId: string | undefined;
      server.use(
        http.patch(`${BASE_URL}/learning/:experimentId`, async ({ request, params }) => {
          capturedBody = await request.json();
          capturedId = params.experimentId as string;
          return HttpResponse.json({ id: 31, name: '이름 변경' });
        })
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useUpdateLearning(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.updateLearning({ experimentId: 31, name: '이름 변경' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(capturedId).toBe('31');
      expect(capturedBody).toEqual({ name: '이름 변경' });
      expectLearningInvalidated(queryClient, true);
    });
  });

  describe('useUpdateLearningInternalAccess', () => {
    it('internal-access 경로로 PATCH하고 성공 시 learning 계층을 무효화한다', async () => {
      let capturedPath: string | undefined;
      server.use(
        http.patch(`${BASE_URL}/learning/:experimentId/internal-access`, ({ request }) => {
          capturedPath = new URL(request.url).pathname;
          return HttpResponse.json({ id: 31 });
        })
      );
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useUpdateLearningInternalAccess(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.updateLearningInternalAccess({ experimentId: 31, status: 'REGISTERED' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(capturedPath).toBe('/api/v1/learning/31/internal-access');
      expectLearningInvalidated(queryClient, true);
    });
  });

  describe('useDeleteLearning', () => {
    it('삭제 성공 시 learning 계층을 무효화한다', async () => {
      const queryClient = createTestQueryClient({ gcTime: Infinity });
      seedCaches(queryClient);
      const { result } = renderHook(() => useDeleteLearning(), {
        wrapper: createHookWrapper(queryClient),
      });

      result.current.deleteLearning(31);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expectLearningInvalidated(queryClient, true);
    });
  });

  // ============================================
  // useGetLearningStatus — enabled 게이트
  // ============================================
  describe('useGetLearningStatus', () => {
    it('experiment_id가 없으면 요청하지 않는다', async () => {
      const requestSpy = vi.fn();
      server.use(
        http.get(`${BASE_URL}/learning/:experimentId/status`, () => {
          requestSpy();
          return HttpResponse.json({ status: 'RUNNING' });
        })
      );

      renderHook(() => useGetLearningStatus(undefined), { wrapper: createHookWrapper() });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requestSpy).not.toHaveBeenCalled();
    });
  });
});
