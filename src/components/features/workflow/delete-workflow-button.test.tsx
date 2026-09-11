import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { act, fireEvent, render, renderWithUser, screen, waitFor } from '@/test/utils/test-utils';
import { queryKeys } from '@/lib/query-keys';
import { toastOpenSpy } from '@/test/mocks/innogrid-ui';
import { DeleteWorkflowButton } from './delete-workflow-button';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => ({
  ...(await vi.importActual<typeof import('react-router')>('react-router')),
  useNavigate: () => mockNavigate,
}));

// #3 워크플로우 삭제 미반영: DELETE(정리 시작) → finalize-deletion 폴링 → 종결 상태에서만
// 성공 토스트 + workflows.all 무효화로 이어지는 전이를 검증한다.
// 404 성공 / 403 즉시 실패 / 10분 상한 안내도 함께 고정한다.

const QUESTION = '워크플로우를 삭제하시겠습니까?';

// render()의 QueryClient는 gcTime 0이라 시드 캐시가 즉시 GC된다 —
// 무효화는 캐시 상태 대신 invalidateQueries 호출 스파이로 검증한다.
const spyInvalidate = (queryClient: ReturnType<typeof render>['queryClient']) =>
  vi.spyOn(queryClient, 'invalidateQueries');

describe('DeleteWorkflowButton', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    toastOpenSpy.mockClear();
  });

  describe('렌더링', () => {
    it('workflowId가 없으면 버튼이 비활성화된다', () => {
      render(<DeleteWorkflowButton />);

      expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
    });

    it('workflowName이 있으면 확인 문구에 이름이 들어간다', async () => {
      const { user } = renderWithUser(
        <DeleteWorkflowButton workflowId="wf-001" workflowName="문서 요약" />
      );

      await user.click(screen.getByRole('button', { name: '삭제' }));

      expect(screen.getByText('문서 요약 워크플로우를 삭제하시겠습니까?')).toBeInTheDocument();
    });
  });

  describe('삭제 성공 전이', () => {
    it('확인 클릭 시 DELETE 후 finalize가 completed면 무효화하고 리다이렉트한다', async () => {
      const deleteSpy = vi.fn();
      server.use(
        http.delete(`${BASE_URL}/workflows/:id`, ({ params }) => {
          deleteSpy(params.id);
          return HttpResponse.json(
            {
              message: 'deletion started',
              workflow_id: params.id as string,
              cleanup_run_id: 'run-001',
              status: 'cleanup_in_progress',
              next_step: 'finalize-deletion',
            },
            { status: 202 }
          );
        })
      );

      const onDeleted = vi.fn();
      const { user, queryClient } = renderWithUser(
        <DeleteWorkflowButton
          workflowId="wf-001"
          redirect="/workflow/workflow"
          onDeleted={onDeleted}
        />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      // 기본 finalize 핸들러가 즉시 completed를 반환 → 무효화 + 성공 토스트 + 모달 닫힘
      await waitFor(() => {
        expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
      });

      expect(deleteSpy).toHaveBeenCalledWith('wf-001');
      expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: queryKeys.workflows.all });
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '워크플로우 삭제 성공' })
      );
      expect(onDeleted).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/workflow/workflow');
    });

    // 404는 이미 삭제된 것이므로 성공으로 처리한다
    it('finalize가 404면 이미 삭제된 것으로 보고 성공 처리한다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () =>
          HttpResponse.json({ detail: 'Workflow not found' }, { status: 404 })
        )
      );

      const onDeleted = vi.fn();
      const { user, queryClient } = renderWithUser(
        <DeleteWorkflowButton
          workflowId="wf-001"
          redirect="/workflow/workflow"
          onDeleted={onDeleted}
        />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'positive', title: '워크플로우 삭제 성공' })
        );
      });

      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '워크플로우 삭제 실패' })
      );
      expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: queryKeys.workflows.all });
      expect(onDeleted).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/workflow/workflow');
    });

    it('redirect가 없으면 이동하지 않는다', async () => {
      const { user } = renderWithUser(<DeleteWorkflowButton workflowId="wf-001" />);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'positive', title: '워크플로우 삭제 성공' })
        );
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('폴링 전이', () => {
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

    it('in_progress 동안 버튼이 비활성화되고 성공 토스트를 띄우지 않는다', async () => {
      let finalizeCallCount = 0;
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          finalizeCallCount += 1;
          return HttpResponse.json({
            workflow_id: 'wf-001',
            status: finalizeCallCount < 2 ? 'in_progress' : 'completed',
          });
        })
      );

      const { queryClient } = render(<DeleteWorkflowButton workflowId="wf-001" />);
      const invalidateSpy = spyInvalidate(queryClient);

      fireEvent.click(screen.getByRole('button', { name: '삭제' }));
      fireEvent.click(screen.getByRole('button', { name: '확인' }));

      // DELETE 응답 → finalize 1회차(in_progress) — 작업 중이라 버튼 비활성, 모달 유지.
      // 무효화 1회는 useDeleteWorkflow의 onSuccess 몫 — 완료 무효화는 아직이다.
      await advance(0);
      expect(finalizeCallCount).toBe(1);
      expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
      expect(screen.getByText(QUESTION)).toBeInTheDocument();
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '워크플로우 삭제 성공' })
      );

      // 5초 주기 뒤 2회차(completed) → 완료 무효화(2회째) + 성공 토스트 + 모달 닫힘
      await advance(6000);
      expect(finalizeCallCount).toBeGreaterThanOrEqual(2);
      expect(invalidateSpy).toHaveBeenCalledTimes(2);
      expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: queryKeys.workflows.all });
      expect(screen.queryByText(QUESTION)).not.toBeInTheDocument();
      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'positive', title: '워크플로우 삭제 성공' })
      );
    });

    // 10분을 넘겨도 하드 실패로 처리하지 않는다 — 안내 + 목록 갱신
    it('in_progress가 10분을 넘기면 실패가 아니라 진행 중 안내로 끝내고 잠금을 푼다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () =>
          HttpResponse.json({ workflow_id: 'wf-001', status: 'in_progress' })
        )
      );

      const onDeleted = vi.fn();
      const { queryClient } = render(
        <DeleteWorkflowButton
          workflowId="wf-001"
          redirect="/workflow/workflow"
          onDeleted={onDeleted}
        />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      fireEvent.click(screen.getByRole('button', { name: '삭제' }));
      fireEvent.click(screen.getByRole('button', { name: '확인' }));

      await advance(0);
      expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();

      // 응답을 흘리지 않고 시계만 10분 넘긴다. 진행 중인 확인 요청이 있으면 재확인은 합쳐지므로
      // 5초 × 120회를 실제로 왕복하지 않고도 상한 타이머를 만료시킬 수 있다.
      await act(async () => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });
      await advance(0);

      expect(toastOpenSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'issue', title: '워크플로우 삭제 진행 중' })
      );
      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '워크플로우 삭제 성공' })
      );
      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '워크플로우 삭제 실패' })
      );
      // 목록은 갱신하고, 성공 부수효과(리다이렉트·onDeleted)는 일으키지 않는다
      expect(invalidateSpy).toHaveBeenLastCalledWith({ queryKey: queryKeys.workflows.all });
      expect(onDeleted).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      // 무한 잠금이 아니다 — 상한을 넘기면 버튼이 다시 눌린다
      expect(screen.getByRole('button', { name: '삭제' })).toBeEnabled();
    });
  });

  describe('실패 경로', () => {
    it('DELETE가 실패하면 에러 토스트를 띄우고 finalize를 호출하지 않는다', async () => {
      const finalizeSpy = vi.fn();
      server.use(
        http.delete(`${BASE_URL}/workflows/:id`, () =>
          HttpResponse.json({ detail: '삭제 권한이 없습니다.' }, { status: 403 })
        ),
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () => {
          finalizeSpy();
          return HttpResponse.json({ workflow_id: 'wf-001', status: 'completed' });
        })
      );

      const { user, queryClient } = renderWithUser(<DeleteWorkflowButton workflowId="wf-001" />);
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'negative',
            title: '워크플로우 삭제 실패',
            children: '삭제 권한이 없습니다.',
          })
        );
      });

      expect(finalizeSpy).not.toHaveBeenCalled();
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(screen.getByText(QUESTION)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    // 회귀 테스트: 이 이슈의 증상 — failed인데 삭제된 것처럼 보였다
    it('finalize가 failed면 성공 토스트·리다이렉트 없이 error_message를 띄운다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () =>
          HttpResponse.json({
            workflow_id: 'wf-001',
            status: 'failed',
            error_message: '네임스페이스 삭제 실패',
          })
        )
      );

      const onDeleted = vi.fn();
      const { user, queryClient } = renderWithUser(
        <DeleteWorkflowButton
          workflowId="wf-001"
          redirect="/workflow/workflow"
          onDeleted={onDeleted}
        />
      );
      const invalidateSpy = spyInvalidate(queryClient);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'negative',
            title: '워크플로우 삭제 실패',
            children: '네임스페이스 삭제 실패',
          })
        );
      });

      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '워크플로우 삭제 성공' })
      );
      // 무효화는 useDeleteWorkflow onSuccess의 1회뿐 — 완료 무효화는 발생하지 않는다
      expect(invalidateSpy).toHaveBeenCalledTimes(1);
      expect(onDeleted).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByText(QUESTION)).toBeInTheDocument();
    });

    // 403은 권한 오류 — 서버 detail이 사라지지 않아야 한다
    // (HTTP 에러 응답에는 본문(result)이 없어 getServerErrorMessage로 떨어뜨려야 한다)
    it('finalize가 403이면 서버가 준 권한 오류 문구를 그대로 띄운다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () =>
          HttpResponse.json({ detail: '본인 소유 워크플로우가 아닙니다.' }, { status: 403 })
        )
      );

      const { user } = renderWithUser(<DeleteWorkflowButton workflowId="wf-001" redirect="/x" />);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'negative',
            title: '워크플로우 삭제 실패',
            children: '본인 소유 워크플로우가 아닙니다.',
          })
        );
      });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('알 수 없는 status면 결과를 단정하지 않고 재확인을 안내한다', async () => {
      server.use(
        http.post(`${BASE_URL}/workflows/:id/finalize-deletion`, () =>
          HttpResponse.json({ workflow_id: 'wf-001', status: 'something_new' })
        )
      );

      const { user } = renderWithUser(<DeleteWorkflowButton workflowId="wf-001" redirect="/x" />);

      await user.click(screen.getByRole('button', { name: '삭제' }));
      await user.click(screen.getByRole('button', { name: '확인' }));

      await waitFor(() => {
        expect(toastOpenSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'issue', title: '워크플로우 삭제 확인 필요' })
        );
      });

      expect(toastOpenSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ title: '워크플로우 삭제 성공' })
      );
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
