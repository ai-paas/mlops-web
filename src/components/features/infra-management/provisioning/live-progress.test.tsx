import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderWithUser } from '@/test/utils/test-utils';
import type { Operation, ProvisionEvent } from '@/types/cluster';
import { LiveProgress } from './live-progress';

vi.mock('@/hooks/service/operations', () => ({
  useActiveClusterOperation: vi.fn(),
}));
vi.mock('@/hooks/service/operation-events', () => ({
  useOperationEvents: vi.fn(),
}));

const { useActiveClusterOperation } = await import('@/hooks/service/operations');
const { useOperationEvents } = await import('@/hooks/service/operation-events');

const setup = (args: {
  operationId?: string;
  operation?: Operation;
  events?: ProvisionEvent[];
  connected?: boolean;
}) => {
  vi.mocked(useActiveClusterOperation).mockReturnValue({
    operation: args.operation,
    operationId: args.operationId,
    isPending: false,
  });
  vi.mocked(useOperationEvents).mockReturnValue({
    operation: args.operation,
    events: args.events ?? [],
    connected: args.connected ?? true,
    error: undefined,
  });
};

beforeEach(() => vi.clearAllMocks());

describe('LiveProgress', () => {
  it('진행 중 작업도 fallback 도 없으면 아무것도 그리지 않는다', () => {
    setup({});

    const { container } = render(<LiveProgress clusterName="c1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('진행 중 작업이 없어도 fallback 진행률이 있으면 마지막 값을 보여준다', () => {
    setup({});

    render(<LiveProgress clusterName="c1" fallbackPercent={64} fallbackStep="BOOTSTRAP_ADDONS" />);

    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('BOOTSTRAP_ADDONS')).toBeInTheDocument();
  });

  it('SSE 스냅샷이 fallback 보다 우선한다', () => {
    setup({
      operationId: 'op-1',
      operation: {
        id: 'op-1',
        state: 'RUNNING',
        progress: { percent: 42, currentStep: 'BOOTSTRAP_MASTER_INIT' },
      },
    });

    render(<LiveProgress clusterName="c1" fallbackPercent={5} fallbackStep="PROVISION" />);

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('BOOTSTRAP_MASTER_INIT')).toBeInTheDocument();
    expect(screen.queryByText('5%')).not.toBeInTheDocument();
  });

  it('연결 상태를 표시한다', () => {
    setup({ operationId: 'op-1', operation: { id: 'op-1' }, connected: false });

    render(<LiveProgress clusterName="c1" />);

    expect(screen.getByText('연결 대기')).toBeInTheDocument();
  });

  it('엔진 로그는 기본으로 접혀 있고 펼치면 보인다', async () => {
    setup({
      operationId: 'op-1',
      operation: { id: 'op-1', progress: { percent: 10 } },
      events: [{ type: 'diagnostic', message: 'Creating Instance master-1', severity: 'info' }],
    });

    const { user } = renderWithUser(<LiveProgress clusterName="c1" />);

    expect(screen.queryByText('Creating Instance master-1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /엔진 로그 1건/ }));

    expect(screen.getByText('Creating Instance master-1')).toBeInTheDocument();
  });

  it('내용 없는 엔진 이벤트는 로그 건수에서 제외한다', () => {
    setup({
      operationId: 'op-1',
      operation: { id: 'op-1', progress: { percent: 10 } },
      events: [{ type: '', message: '   ' }],
    });

    render(<LiveProgress clusterName="c1" />);

    expect(screen.queryByRole('button', { name: /엔진 로그/ })).not.toBeInTheDocument();
  });
});