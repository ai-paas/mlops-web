import { describe, expect, it } from 'vitest';
import {
  buildKnowledgeBaseCreatePayload,
  createInitialKnowledgeBaseFormValues,
  getKnowledgeBaseCreateErrorMessage,
  knowledgeBaseFormSchema,
  KNOWLEDGE_BASE_STEP_FIELDS,
  type KnowledgeBaseFormValues,
} from './knowledge-base-form';

const createValidValues = (): KnowledgeBaseFormValues => ({
  ...createInitialKnowledgeBaseFormValues(),
  name: '사내 규정 문서',
  file: new File(['규정'], '규정.PDF', { type: 'application/pdf' }),
});

// 스키마 이슈를 필드별 첫 메시지로 요약한다 — RHF fieldState.error.message와 같은 관점
const fieldErrors = (values: KnowledgeBaseFormValues) => {
  const result = knowledgeBaseFormSchema.safeParse(values);
  const errors: Partial<Record<keyof KnowledgeBaseFormValues, string>> = {};
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) {
      errors[field as keyof KnowledgeBaseFormValues] = issue.message;
    }
  }
  return errors;
};

describe('지식 베이스 생성 폼', () => {
  it('실호출로 검증된 권장 기본값을 사용한다', () => {
    const values = createInitialKnowledgeBaseFormValues();

    expect(values).toMatchObject({
      chunk_size: 500,
      chunk_overlap: 50,
      language: { id: 1 },
      embedding_model: { id: 13, name: 'bge-m3' },
      chunk_type: { id: 1 },
      search_method: { id: 1 },
      top_k: 3,
      threshold: 0.4,
    });
  });

  it('단계별 trigger 필드 목록을 합치면 폼 전체 필드와 일치한다', () => {
    const stepFields = [
      ...KNOWLEDGE_BASE_STEP_FIELDS.basic,
      ...KNOWLEDGE_BASE_STEP_FIELDS.embedding,
    ];

    expect([...stepFields].sort()).toEqual(
      Object.keys(createInitialKnowledgeBaseFormValues()).sort()
    );
  });
  it('권장값과 대문자 확장자 파일은 전체 검증을 통과한다', () => {
    expect(fieldErrors(createValidValues())).toEqual({});
  });

  it('공백 이름과 지원하지 않는 파일 확장자를 차단한다', () => {
    const values = createValidValues();
    values.name = '   ';
    values.file = new File(['text'], 'readme.txt', { type: 'text/plain' });

    expect(fieldErrors(values)).toMatchObject({
      name: '이름을 입력해주세요.',
      file: '지원되는 문서 파일을 업로드해주세요.',
    });
  });

  it.each([300, 1000])('청크 길이 경계값 %d을 허용한다', (chunkSize) => {
    const values = createValidValues();
    values.chunk_size = chunkSize;
    values.chunk_overlap = Math.min(50, chunkSize - 1);

    expect(fieldErrors(values).chunk_size).toBeUndefined();
  });

  it.each([299, 1001, 500.5])('허용 범위 밖 또는 비정수 청크 길이 %d을 차단한다', (chunkSize) => {
    const values = createValidValues();
    values.chunk_size = chunkSize;

    expect(fieldErrors(values).chunk_size).toBeDefined();
  });

  it('청크 중첩 0과 청크 길이보다 1 작은 값은 허용한다', () => {
    const values = createValidValues();
    values.chunk_overlap = 0;
    expect(fieldErrors(values).chunk_overlap).toBeUndefined();

    values.chunk_overlap = values.chunk_size - 1;
    expect(fieldErrors(values).chunk_overlap).toBeUndefined();
  });

  it.each([500, 501])('청크 길이와 같거나 큰 중첩값 %d을 차단한다', (chunkOverlap) => {
    const values = createValidValues();
    values.chunk_overlap = chunkOverlap;

    expect(fieldErrors(values).chunk_overlap).toBe('청크 중첩은 청크 길이보다 작아야 합니다.');
  });

  it.each([1, 20])('Top K 경계값 %d을 허용한다', (topK) => {
    const values = createValidValues();
    values.top_k = topK;

    expect(fieldErrors(values).top_k).toBeUndefined();
  });

  it.each([0, 21, 3.5])('범위를 벗어나거나 비정수인 Top K %d을 차단한다', (topK) => {
    const values = createValidValues();
    values.top_k = topK;

    expect(fieldErrors(values).top_k).toBeDefined();
  });

  it.each([0, 1])('점수 임계값 경계값 %d을 허용한다', (threshold) => {
    const values = createValidValues();
    values.threshold = threshold;

    expect(fieldErrors(values).threshold).toBeUndefined();
  });

  it.each([-0.1, 1.1])('범위를 벗어난 점수 임계값 %d을 차단한다', (threshold) => {
    const values = createValidValues();
    values.threshold = threshold;

    expect(fieldErrors(values).threshold).toBeDefined();
  });

  it('배포 검증 목록에 없는 임베딩 모델을 차단한다', () => {
    const values = createValidValues();
    values.embedding_model = { id: 39, name: '미배포 테스트 모델' };

    expect(fieldErrors(values).embedding_model).toBe('배포가 확인된 임베딩 모델을 선택해주세요.');
  });

  it('빈 설명은 multipart에서 제외하고 나머지 값을 직렬화한다', () => {
    const values = createValidValues();
    values.description = '   ';

    const payload = buildKnowledgeBaseCreatePayload(values);

    expect(payload.has('description')).toBe(false);
    expect(payload.get('name')).toBe('사내 규정 문서');
    expect(payload.get('embedding_model_id')).toBe('13');
    expect(payload.get('chunk_size')).toBe('500');
    expect(payload.get('chunk_overlap')).toBe('50');
    expect(payload.get('top_k')).toBe('3');
    expect(payload.get('threshold')).toBe('0.4');
    expect(payload.get('file')).toBe(values.file);
  });

  it('설명 앞뒤 공백은 제거해서 전송한다', () => {
    const values = createValidValues();
    values.description = '  2026년 개정판  ';

    expect(buildKnowledgeBaseCreatePayload(values).get('description')).toBe('2026년 개정판');
  });

  it('Deployment not found를 사용자 안내 문구로 변환한다', () => {
    expect(getKnowledgeBaseCreateErrorMessage(new Error('Deployment not found'))).toBe(
      '선택한 임베딩 모델이 배포되어 있지 않습니다. 다른 모델을 선택하세요.'
    );
  });

  it('서버 detail 문자열은 그대로 사용하고 기술적인 기본 메시지는 숨긴다', () => {
    expect(getKnowledgeBaseCreateErrorMessage(new Error('이름이 중복되었습니다.'))).toBe(
      '이름이 중복되었습니다.'
    );
    expect(
      getKnowledgeBaseCreateErrorMessage(
        new Error('Request failed with status code 422 Unprocessable Entity')
      )
    ).toBe('지식 베이스 생성 중 오류가 발생했습니다.');
  });
});
