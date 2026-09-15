import Lottie from 'react-lottie';
import { BreadCrumb } from '@innogrid/ui';
import { IconChkGreen, IconErrRed } from '../../../assets/img/icon';
import LoadingWhite from '../../../assets/lottie/loding_white.json';
import styles from '../learning.module.scss';
import { useNavigate, useParams } from 'react-router';
import { EditLearningButton } from '../../../components/features/learning/edit-learning-button';
import { DeleteLearningButton } from '../../../components/features/learning/delete-learning-button';
import { ModelRegisterButton } from '../../../components/features/learning/model-register-button';
import { useGetLearning } from '@/hooks/service/learning';
import { formatDateTime, formatElapsed } from '@/util/date';
import { DetailValue } from '@/components/ui/detail-value';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// 지표는 서버가 주는 값을 그대로 보여준다. accuracy·precision·recall은 0~1 소수라
// '%'를 붙이면 0.85가 0.85%로 읽혀 100배 작은 값처럼 보인다.
function formatMetric(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return `${value}`;
}

function isLearningFailed(status?: string | null): boolean {
  return !!status && /fail|error/i.test(status);
}

function isLearningFinished(status?: string | null): boolean {
  return !!status && /complete|success|finish|done/i.test(status);
}

export default function LearningDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { learning, isPending } = useGetLearning(Number(id));

  const failed = isLearningFailed(learning?.status);
  const finished = isLearningFinished(learning?.status);
  const inProgress = !!learning?.status && !failed && !finished;

  return (
    <main>
      <div className="breadcrumbBox">
        <BreadCrumb
          items={[{ label: '학습', path: '/learning' }, { label: learning?.name ?? '' }]}
          onNavigate={navigate}
        />
      </div>
      <div className="page-title-box">
        <h2 className="page-title">학습 상세</h2>
        <div className="page-toolBox">
          <div className="page-toolBox-btns">
            <EditLearningButton experimentId={Number(id)} />
            <DeleteLearningButton experimentId={Number(id)} redirect="/learning" />
            <ModelRegisterButton experimentId={Number(id)} />
          </div>
        </div>
      </div>
      <div className="page-content page-pb-40">
        <h3 className="page-detail-title">상세 정보</h3>
        <div className="page-detail-list-box">
          <ul className="page-detail-list">
            {(finished || failed || inProgress) && (
              <li>
                <div className="page-detail_item-data">
                  {inProgress && (
                    <div className={styles.conditionBox}>
                      <Lottie
                        width="16px"
                        height="16px"
                        style={{ margin: '0' }}
                        isClickToPauseDisabled={true}
                        options={{
                          loop: true,
                          autoplay: true,
                          animationData: LoadingWhite,
                          rendererSettings: {
                            preserveAspectRatio: 'xMidYMid slice',
                          },
                        }}
                      />
                      <span>학습 진행중...</span>
                    </div>
                  )}
                  {finished && (
                    <div className={`${styles.conditionBox} ${styles.finish}`}>
                      <IconChkGreen />
                      <span>학습이 정상적으로 완료되었습니다.</span>
                    </div>
                  )}
                  {failed && (
                    <div className={`${styles.conditionBox} ${styles.fail}`}>
                      <IconErrRed />
                      <span>{learning?.train_msg ?? '학습이 실패하였습니다.'}</span>
                    </div>
                  )}
                </div>
              </li>
            )}
            <li>
              <div className="page-detail_item-name">Epoch</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={200}>
                  <div className={styles.progressBox}>
                    <div>
                      {learning?.current_epoch ?? 0} / {learning?.max_epoch ?? 0}
                    </div>
                    <div className={styles.progress}>
                      <div
                        className={styles.progressActionBar}
                        style={{
                          width: learning?.max_epoch
                            ? `${Math.min(
                                100,
                                ((learning?.current_epoch ?? 0) / learning.max_epoch) * 100
                              )}%`
                            : '0%',
                        }}
                      ></div>
                      <div className={styles.progressBar}></div>
                    </div>
                  </div>
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">이름</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={160}>
                  {learning?.name ?? '-'}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">생성일시</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={140}>
                  {learning?.created_at ? formatDateTime(learning.created_at) : '-'}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">경과 시간</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={100}>
                  {formatElapsed(learning?.elapsed_time)}
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">배포 서비스</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={120}>
                  -
                </DetailValue>
              </div>
            </li>
            <li>
              <div className="page-detail_item-name">설명</div>
              <div className="page-detail_item-data">
                <DetailValue isLoading={isPending} width={240}>
                  {learning?.description ?? '-'}
                </DetailValue>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <div className="page-content page-content-detail">
        <h3 className="page-detail-title">학습 결과</h3>
        <div className="page-content-detail-col2">
          <div className="page-content-detail-row2">
            <div className="page-detail-round-box page-flex-1">
              <div className="page-detail-round-name">Accuracy</div>
              <div className="page-detail-round-data page-h-75">
                <em>{formatMetric(learning?.accuracy)}</em>
              </div>
            </div>
            <div className="page-detail-round-box page-flex-1">
              <div className="page-detail-round-name">Precision</div>
              <div className="page-detail-round-data page-h-75">
                <em>{formatMetric(learning?.precision)}</em>
              </div>
            </div>
            <div className="page-detail-round-box page-flex-1">
              <div className="page-detail-round-name">Recall</div>
              <div className="page-detail-round-data page-h-75">
                <em>{formatMetric(learning?.recall)}</em>
              </div>
            </div>
            <div className="page-detail-round-box page-flex-1">
              <div className="page-detail-round-name">Average Precision</div>
              <div className="page-detail-round-data page-h-75">
                <em>{formatMetric(learning?.average_precision)}</em>
              </div>
            </div>
            <div className="page-detail-round-box page-flex-1">
              <div className="page-detail-round-name">Loss</div>
              <div className="page-detail-round-data page-h-75">
                <em>{formatMetric(learning?.loss)}</em>
              </div>
            </div>
          </div>
          <div className="page-content-detail-row2">
            <div className="page-detail-round-box page-flex-1">
              <div className="page-detail-round-name">Loss</div>
              <div className="page-detail-round-data page-h-400">
                {learning?.loss_history && learning.loss_history.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={learning.loss_history}
                      margin={{ top: 20, right: 20, bottom: 30, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                      <XAxis
                        dataKey="epoch"
                        label={{ value: 'Epoch', position: 'bottom', offset: 0 }}
                      />
                      <YAxis label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} />
                      <Tooltip labelFormatter={(label) => `Epoch ${label}`} />
                      <Line
                        type="monotone"
                        dataKey="loss"
                        stroke="#3385ff"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <em>-</em>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
