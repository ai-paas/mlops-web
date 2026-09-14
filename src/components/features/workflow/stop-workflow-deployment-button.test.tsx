import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { render, renderWithUser } from '@/test/utils/test-utils';
import { queryKeys } from '@/lib/query-keys';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { StopWorkflowDeploymentButton } from './stop-workflow-deployment-button';

// a3dd1d4 직접 연관 컴포넌트: cleanup 시작 → finalize-cleanup 폴링 → 완료 시
// workflows.all 무효화로 이어지는 전이를 검증한다.

const CONFIRM_MESSAGE = '워크플로우 배포를 중지하시겠습니까?';

// render()의 QueryClient는 gcTime 0이라 시드 캐시가 즉시 GC된다 —
// 무효화는 캐시 상태 대신 invalidateQueries 호출 스파이로 검증한다.
// (workflows.all 프리픽스 무효화의 계층 의미는 workflows.test.ts가 별도 보증)
const spyInvalidate = (queryClient: ReturnType<typeof render>['queryClient']) =>
  vi.spyOn(queryClient, 'invalidateQueries');

describe('StopWorkflowDeploymentButton', () => {
  // ============================================
  // 렌더링
  // ============================================
  describe('렌더링', () => {
    it('workflowId가 없으면 버튼이 비활성화된다', () => {
      render(<StopWorkflowDeploymentButton />);

      expect(screen.getByRole('button', { name: '배포 중지' })).toBeDisabled();
    });

    it('workflowId가 있으면 버튼이 활성화된다', () => {
      render(<StopWorkflowDeploymentButton workflowId="wf-001" />);

      expect(screen.getByRole('button', { name: '배포 중지' })).toBeEnabled();
    });
  });

  // ============================================
  // 모달 인터랙션
  // ============================================
  describe('모달 인터랙션', () => {
    it('버튼 클릭 시 확인 모달이 열린다', async () => {
      const { user } = renderWithUser(<StopWorkflowDeploymentButton workflowId="wf-001" />);

      await user.click(screen.getByRole('button', { name: '배포 중지' }));

      expect(screen.getByText(CONFIRM_MESSAGE)).toBeInTheDocument();
    });

    it('취소 버튼 클릭 시 모달이 닫힌다', async () => {
      const { user } = renderWithUser(<StopWorkflowDeploymentButton workflowId="wf-001" />);

      await user.click(screen.getByRole('button', { name: '배포 중지' }));
      await user.click(screen.getByRole('button', { name: '취소' }));

      await waitFor(() => {
        expect(screen.queryByText(CONFIRM_MESSAGE)).not.toBeInTheDocument();
      });
    });
  });

  // ============================================
  // cleanup → finalize(즉시 completed) → invalidate 전이
  // ============================================
  describe('배포 중지 성공 전이', () => {
    it('확인 클릭 시 cleanup 후 finalize가 완료되면 workflows 캐시를 무효화하고 모달을 닫는다', async () => {
      const cleanupSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/workflows/:id/cleanup`, ({ params }) => {
          cleanupSpy(params.id);
          return HttpResponse.json({
            message: 'cleanup started',
            workflow_id: params.id as string,
            cleanup_run_id: 'run-001',
            status: 'cleanup_in_progress',
            next_step: 'finalize-cleanup',
          });
        })
      );

      const { user, queryClient } = renderWithUser(
        <StopWorkflowDeploymentButton workflowId="wf-001" />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '배포 중지' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      // 기본 finalize 핸들러가 즉시 completed를 반환 → 무효화 + 성공 토스트 + 모달 닫힘
      await waitFor(() => {
        expect(screen.queryByText(CONFIRM_MESSAGE)).not.toBeInTheDocument();
      });

      expect(cleanupSpy).toHaveBeenCalledWith('wf-001');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.workflows.all });
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '배포 중지 성공' })
      );
    });
  });

  // ============================================
  // in_progress 폴링 전이 (fake timers)
  // ============================================
  describe('finalize 폴링 전이', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    // fake timers 아래에서 ms만큼 진행 + 응답 반영까지 1ms flush로 소진한다
    // (0ms가 아닌 이유: 응답 체인의 setTimeout(cb, 0)이 fake clock에서 1ms로
    //  클램프되어 0ms 진행으로는 실행되지 않는다 — workflows.test.ts 참고)
    const advance = async (ms: number) => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1);
        });
      }
    };

    it('in_progress 동안 버튼이 비활성화되고, 5초 후 completed가 되면 무효화하고 모달을 닫는다', async () => {
      let finalizeCallCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          finalizeCallCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-001',
            status: finalizeCallCount < 2 ? 'in_progress' : 'completed',
          });
        })
      );

      const { queryClient } = render(<StopWorkflowDeploymentButton workflowId="wf-001" />);
      const invalidateSpy = spyInvalidate(queryClient);

      fireEvent.click(screen.getByRole('button', { name: '배포 중지' }));
      fireEvent.click(screen.getByRole('button', { name: '확인' }));

      // cleanup 응답 → finalize 1회차(in_progress) — 작업 중이라 버튼 비활성.
      // 무효화 1회는 useCleanupWorkflow의 onSuccess 몫 — 완료 무효화는 아직이다.
      await advance(0);
      expect(finalizeCallCount).toBe(1);
      expect(screen.getByRole('button', { name: '배포 중지' })).toBeDisabled();
      expect(screen.getByText(CONFIRM_MESSAGE)).toBeInTheDocument();
      expect(invalidateSpy).toHaveBeenCalledTimes(1);

      // 5초 주기 뒤 finalize 2회차(completed) → 완료 무효화(2회째) + 모달 닫힘 + 버튼 복구
      await advance(6000);
      expect(finalizeCallCount).toBeGreaterThanOrEqual(2);
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: queryKeys.workflows.all });
      expect(screen.queryByText(CONFIRM_MESSAGE)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '배포 중지' })).toBeEnabled();
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '배포 중지 성공' })
      );
    });

    // 10분을 넘겨도 하드 실패로 처리하지 않는다 — 안내 + 목록 갱신
    it('in_progress가 10분을 넘기면 실패가 아니라 진행 중 안내로 끝내고 잠금을 푼다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () =>
          HttpResponse.json({ workflow_id: 'wf-001', status: 'in_progress' })
        )
      );

      const { queryClient } = render(<StopWorkflowDeploymentButton workflowId="wf-001" />);
      const invalidateSpy = spyInvalidate(queryClient);

      fireEvent.click(screen.getByRole('button', { name: '배포 중지' }));
      fireEvent.click(screen.getByRole('button', { name: '확인' }));

      await advance(0);
      expect(screen.getByRole('button', { name: '배포 중지' })).toBeDisabled();

      // 응답을 흘리지 않고 시계만 10분 넘긴다(삭제 버튼 상한 테스트와 같은 방식)
      await act(async () => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });
      await advance(0);

      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'issue', title: '배포 중지 진행 중' })
      );
      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '배포 중지 성공' })
      );
      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '배포 중지 실패' })
      );
      expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: queryKeys.workflows.all });
      expect(screen.getByRole('button', { name: '배포 중지' })).toBeEnabled();
    });
  });

  // ============================================
  // 실패 경로
  // ============================================
  describe('실패 경로', () => {
    it('cleanup 요청이 실패하면 에러 토스트를 띄우고 finalize를 호출하지 않는다', async () => {
      const finalizeSpy = vi.fn();
      server.use(
        http.post(`${BASE_URL}/workflows/:id/cleanup`, () =>
          HttpResponse.json({ message: 'error' }, { status: 500 })
        ),
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () => {
          finalizeSpy();
          return HttpResponse.json({ workflow_id: 'wf-001', status: 'completed' });
        })
      );

      const { user, queryClient } = renderWithUser(
        <StopWorkflowDeploymentButton workflowId="wf-001" />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '배포 중지' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'negative', title: '배포 중지 실패' })
        );
      });

      expect(finalizeSpy).not.toHaveBeenCalled();
      // 실패 시 캐시를 무효화하지 않고 모달도 닫지 않는다
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(screen.getByText(CONFIRM_MESSAGE)).toBeInTheDocument();
    });

    it('finalize가 failed를 반환하면 응답 message로 에러 토스트를 띄우고 무효화하지 않는다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-cleanup`, () =>
          HttpResponse.json({
            workflow_id: 'wf-001',
            status: 'failed',
            message: '네임스페이스 정리 실패',
          })
        )
      );

      const { user, queryClient } = renderWithUser(
        <StopWorkflowDeploymentButton workflowId="wf-001" />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '배포 중지' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'negative',
            title: '배포 중지 실패',
            children: '네임스페이스 정리 실패',
          })
        );
      });

      // 무효화는 useCleanupWorkflow onSuccess의 1회뿐 — 완료 무효화는 발생하지 않는다
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      // 모달은 열린 채 유지된다 (completed 시에만 닫힘)
      expect(screen.getByText(CONFIRM_MESSAGE)).toBeInTheDocument();
    });
  });
});
