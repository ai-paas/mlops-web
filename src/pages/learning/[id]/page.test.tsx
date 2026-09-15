import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import '@/test/mocks/innogrid-ui';

// react-lottie는 import 시점에 lottie-web이 canvas를 건드려 jsdom에서 즉시 깨진다
// (학습 진행중 상태에서만 렌더되는 애니메이션이라 목으로 대체해도 검증에 영향 없다)
vi.mock('react-lottie', () => ({ default: () => null }));
import { server } from '@/test/mocks/server';
import { BASE_URL } from '@/test/mocks/handlers';
import { render, screen } from '@/test/utils/test-utils';
import LearningDetailPage from './page';

// 지표마다 값을 다르게 둬 어느 타일의 값인지 단언이 흐려지지 않게 한다.
// loss_history는 비워 recharts 렌더를 피한다(차트는 조건부 렌더).
const learningDetail = {
  id: 7,
  name: '학습 07',
  status: 'COMPLETED',
  accuracy: 1,
  precision: 0.8566666,
  recall: 0.92,
  average_precision: 0.7734,
  loss: 0.0342,
  loss_history: [],
};

const mockDetail = (body: Record<string, unknown>) =>
  server.use(http.get(`${BASE_URL}/learning/:experimentId`, () => HttpResponse.json(body)));

const renderDetail = () => render(<LearningDetailPage />, { route: '/learning/7', path: '/learning/:id' });

/**
 * 지표 타일의 라벨로 찾아 그 타일이 표시하는 값을 돌려준다.
 * 'Loss'는 수치 타일(0)과 차트 타일(1) 두 곳에 있어 index로 가른다.
 */
const metricValue = (label: string, index = 0) =>
  screen.getAllByText(label)[index]?.parentElement?.querySelector('em')?.textContent;

/** 지표는 데이터 도착 전에도 '-'로 렌더되므로, 응답이 반영된 뒤에 단언해야 한다 */
const waitForDetailLoaded = () => screen.findByText('학습이 정상적으로 완료되었습니다.');

describe('LearningDetailPage — 학습 결과 지표', () => {
  // 회귀 방지: accuracy·precision·recall에 '%'를 붙여 0.85가 0.85%로 읽히던 문제.
  // 서버가 0~1 소수를 주므로 값도 표기도 변환 없이 그대로 보여준다.
  it('비율 지표에 퍼센트 기호를 붙이지 않고 원본 소수를 그대로 보여준다', async () => {
    mockDetail(learningDetail);
    renderDetail();
    await waitForDetailLoaded();

    expect(metricValue('Accuracy')).toBe('1');
    expect(metricValue('Precision')).toBe('0.8566666');
    expect(metricValue('Recall')).toBe('0.92');
  });

  it('Average Precision과 Loss도 원본 소수를 그대로 보여준다', async () => {
    mockDetail(learningDetail);
    renderDetail();
    await waitForDetailLoaded();

    expect(metricValue('Average Precision')).toBe('0.7734');
    expect(metricValue('Loss')).toBe('0.0342');
  });

  it('loss_history가 비어 있으면 차트 자리에 하이픈을 보여준다', async () => {
    mockDetail(learningDetail);
    renderDetail();
    await waitForDetailLoaded();

    expect(metricValue('Loss', 1)).toBe('-');
  });

  it('지표 값이 없으면 하이픈으로 표시한다', async () => {
    mockDetail({ id: 7, name: '학습 07', status: 'COMPLETED' });
    renderDetail();
    await waitForDetailLoaded();

    expect(metricValue('Accuracy')).toBe('-');
    expect(metricValue('Precision')).toBe('-');
    expect(metricValue('Recall')).toBe('-');
    expect(metricValue('Average Precision')).toBe('-');
    expect(metricValue('Loss')).toBe('-');
  });
});
