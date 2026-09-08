import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@innogrid/ui';

import {
  useTestFillMaskWorkflow,
  useTestMLWorkflow,
  useTestProteinClassificationWorkflow,
  useTestProteinStructurePredictionWorkflow,
  useTestRagWorkflow,
} from '@/hooks/service/workflows';
import type { WorkflowModel, WorkflowModelTask } from '@/types/workflow';
import styles from '@/pages/workflow/workflow.module.scss';
import { getServerErrorMessage } from '@/lib/api';

type TestKind =
  | 'rag'
  | 'ml'
  | 'protein-classification'
  | 'fill-mask'
  | 'protein-structure-prediction';

const TEST_KIND_BY_TASK: Partial<Record<WorkflowModelTask, TestKind>> = {
  'text-generation': 'rag',
  vqa: 'rag',
  'object-detection': 'ml',
  'protein-classification': 'protein-classification',
  'fill-mask': 'fill-mask',
  'protein-structure-prediction': 'protein-structure-prediction',
};

const TEST_LABEL: Record<TestKind, string> = {
  rag: '텍스트 생성',
  ml: '객체 탐지',
  'protein-classification': '단백질 분류',
  'fill-mask': '마스크 예측',
  'protein-structure-prediction': '단백질 구조 예측',
};

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

interface WorkflowTestTabProps {
  workflowId?: string;
  workflowStatus?: string;
  workflowModels: WorkflowModel[];
  isModelsPending: boolean;
}

export function WorkflowTestTab({
  workflowId,
  workflowStatus,
  workflowModels,
  isModelsPending,
}: WorkflowTestTabProps) {
  const [text, setText] = useState('');
  const [epitope, setEpitope] = useState('');
  const [cdr3b, setCdr3b] = useState('');
  const [sequence, setSequence] = useState('');
  const [topK, setTopK] = useState(5);
  const [numLoops, setNumLoops] = useState(3);
  const [numSamplingSteps, setNumSamplingSteps] = useState(50);
  const [image, setImage] = useState<File>();
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const chatIdRef = useRef(0);
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const rag = useTestRagWorkflow();
  const ml = useTestMLWorkflow();
  const classification = useTestProteinClassificationWorkflow();
  const fillMask = useTestFillMaskWorkflow();
  const structure = useTestProteinStructurePredictionWorkflow();

  const testKind = useMemo(() => {
    const kinds = new Set(
      workflowModels
        .map((model) => model.task && TEST_KIND_BY_TASK[model.task])
        .filter((kind): kind is TestKind => Boolean(kind))
    );
    return kinds.size === 1 ? [...kinds][0] : undefined;
  }, [workflowModels]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [chatMessages, rag.isPending]);

  const mutation =
    testKind === 'ml'
      ? ml
      : testKind === 'protein-classification'
        ? classification
        : testKind === 'fill-mask'
          ? fillMask
          : structure;

  const appendChatMessage = (message: Omit<ChatMessage, 'id'>) => {
    chatIdRef.current += 1;
    setChatMessages((prev) => [...prev, { ...message, id: chatIdRef.current }]);
  };

  const sendChat = () => {
    const trimmed = text.trim();
    if (!workflowId || !trimmed || rag.isPending) return;

    appendChatMessage({ role: 'user', content: trimmed });
    setText('');
    if (chatInputRef.current) chatInputRef.current.style.height = 'auto';

    rag.testRagWorkflow(
      { surro_workflow_id: workflowId, text: trimmed },
      {
        onSuccess: (data) => {
          appendChatMessage({
            role: 'assistant',
            content: data.final_result ?? JSON.stringify(data.results, null, 2),
          });
        },
        onError: (error) => {
          appendChatMessage({
            role: 'assistant',
            content: getServerErrorMessage(
              error,
              '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            ),
            isError: true,
          });
        },
      }
    );
  };

  const submit = () => {
    if (!workflowId || !testKind) return;
    if (testKind === 'ml' && image) ml.testMLWorkflow({ surro_workflow_id: workflowId, image });
    if (testKind === 'protein-classification') {
      classification.testProteinClassificationWorkflow({
        surro_workflow_id: workflowId,
        epitope,
        cdr3b,
      });
    }
    if (testKind === 'fill-mask') {
      fillMask.testFillMaskWorkflow({ surro_workflow_id: workflowId, sequence, top_k: topK });
    }
    if (testKind === 'protein-structure-prediction') {
      structure.testProteinStructurePredictionWorkflow({
        surro_workflow_id: workflowId,
        sequence,
        num_loops: numLoops,
        num_sampling_steps: numSamplingSteps,
      });
    }
  };

  if (isModelsPending)
    return <div className={styles.testEmpty}>모델 정보를 불러오는 중입니다.</div>;
  if (workflowStatus !== 'ACTIVE') {
    return (
      <div className={styles.testEmpty}>
        테스트는 ACTIVE 상태의 워크플로우에서 사용할 수 있습니다.
      </div>
    );
  }
  if (!testKind) {
    return <div className={styles.testEmpty}>지원하는 단일 task의 배포 모델이 없습니다.</div>;
  }

  if (testKind === 'rag') {
    return (
      <div className={styles.chatPanel}>
        <div className={styles.chatHeader}>
          <h4>{TEST_LABEL[testKind]} 테스트</h4>
          <Button
            size="small"
            color="secondary"
            disabled={rag.isPending || chatMessages.length === 0}
            onClick={() => setChatMessages([])}
          >
            새 채팅
          </Button>
        </div>
        <div className={styles.chatMessages} ref={chatListRef}>
          {chatMessages.length === 0 && !rag.isPending ? (
            <div className={styles.chatEmpty}>메시지를 입력해 워크플로우를 테스트해보세요.</div>
          ) : (
            chatMessages.map((message) => (
              <div
                key={message.id}
                className={`${styles.chatMessage} ${
                  message.role === 'user' ? styles.chatUser : styles.chatAssistant
                }`}
              >
                <div
                  className={`${styles.chatBubble} ${message.isError ? styles.chatBubbleError : ''}`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
          {rag.isPending && (
            <div className={`${styles.chatMessage} ${styles.chatAssistant}`}>
              <div className={`${styles.chatBubble} ${styles.chatTyping}`}>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
        <div className={styles.chatInputBox}>
          <div className={styles.chatInputField}>
            <textarea
              ref={chatInputRef}
              rows={1}
              placeholder="메시지를 입력하세요. (Enter 전송, Shift+Enter 줄바꿈)"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                event.target.style.height = 'auto';
                event.target.style.height = `${event.target.scrollHeight}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  sendChat();
                }
              }}
            />
            <Button
              color="primary"
              size="medium"
              disabled={!text.trim() || rag.isPending}
              onClick={sendChat}
            >
              전송
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const mlPredictions =
    ml.testResult?.results.flatMap((item) =>
      item.error == null ? (item.result?.predictions ?? []) : []
    ) ?? [];
  const mlImageInfo = ml.testResult?.results.find((item) => item.error == null)?.result
    ?.image_info;

  // box는 [x1, y1, x2, y2] 픽셀 좌표. 표시 크기와 무관하도록 기준 크기 대비 퍼센트로 환산한다.
  const getBoxStyle = (box: number[]) => {
    if (!mlImageInfo || box.length < 4) return undefined;
    const { model_input_size, original_size } = mlImageInfo;
    const fitsModelInput = box[2] <= model_input_size.width && box[3] <= model_input_size.height;
    const ref = fitsModelInput ? model_input_size : original_size;
    return {
      left: `${(box[0] / ref.width) * 100}%`,
      top: `${(box[1] / ref.height) * 100}%`,
      width: `${((box[2] - box[0]) / ref.width) * 100}%`,
      height: `${((box[3] - box[1]) / ref.height) * 100}%`,
    };
  };

  const isValid =
    testKind === 'ml'
      ? Boolean(image)
      : testKind === 'protein-classification'
        ? Boolean(epitope.trim() && cdr3b.trim())
        : testKind === 'fill-mask'
          ? Boolean(sequence.trim()) && Number.isInteger(topK) && topK > 0
          : Boolean(sequence.trim()) &&
            Number.isInteger(numLoops) &&
            numLoops > 0 &&
            Number.isInteger(numSamplingSteps) &&
            numSamplingSteps > 0;

  return (
    <div className={styles.testPanel}>
      <section className={styles.testForm}>
        <h4>{TEST_LABEL[testKind]} 테스트</h4>
        {testKind === 'ml' && (
          <label>
            이미지
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImage(event.target.files?.[0])}
            />
          </label>
        )}
        {testKind === 'protein-classification' && (
          <>
            <label>
              Epitope 서열
              <input value={epitope} onChange={(event) => setEpitope(event.target.value)} />
            </label>
            <label>
              CDR3β 서열
              <input value={cdr3b} onChange={(event) => setCdr3b(event.target.value)} />
            </label>
          </>
        )}
        {(testKind === 'fill-mask' || testKind === 'protein-structure-prediction') && (
          <label>
            서열
            <textarea value={sequence} onChange={(event) => setSequence(event.target.value)} />
          </label>
        )}
        {testKind === 'fill-mask' && (
          <label>
            Top K
            <input
              type="number"
              min={1}
              max={100}
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
            />
          </label>
        )}
        {testKind === 'protein-structure-prediction' && (
          <div className={styles.testOptions}>
            <label>
              반복 횟수
              <input
                type="number"
                min={1}
                value={numLoops}
                onChange={(event) => setNumLoops(Number(event.target.value))}
              />
            </label>
            <label>
              샘플링 단계
              <input
                type="number"
                min={1}
                value={numSamplingSteps}
                onChange={(event) => setNumSamplingSteps(Number(event.target.value))}
              />
            </label>
          </div>
        )}
        <Button
          color="primary"
          size="medium"
          disabled={!isValid || mutation.isPending}
          onClick={submit}
        >
          {mutation.isPending ? '테스트 중...' : '테스트 실행'}
        </Button>
      </section>
      <section className={styles.testResult}>
        <h4>테스트 결과</h4>
        {mutation.isError ? (
          <div className={styles.testError}>테스트 요청에 실패했습니다.</div>
        ) : !mutation.testResult ? (
          <div className={styles.testEmpty}>테스트를 실행하면 결과가 표시됩니다.</div>
        ) : testKind === 'ml' ? (
          ml.testResult?.final_result ? (
            <div className={styles.testDetectionImageBox}>
              <img
                className={styles.testResultImage}
                src={`data:image/jpeg;base64,${ml.testResult.final_result}`}
                alt="객체 탐지 결과 이미지"
              />
              {mlPredictions.map((prediction, index) => {
                const boxStyle = getBoxStyle(prediction.box);
                return boxStyle ? (
                  <div key={index} className={styles.testDetectionBox} style={boxStyle}>
                    <span>
                      {prediction.label} {(prediction.score * 100).toFixed(1)}%
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          ) : (
            <div className={styles.testError}>결과 이미지를 받지 못했습니다.</div>
          )
        ) : (
          <pre>{JSON.stringify(mutation.testResult, null, 2)}</pre>
        )}
      </section>
    </div>
  );
}
