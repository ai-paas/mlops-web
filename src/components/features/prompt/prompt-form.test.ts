import { describe, expect, it } from 'vitest';
import {
  createInitialPromptFormValues,
  createPromptFormSchema,
  extractPromptVariables,
  findInvalidPromptVariables,
  PROMPT_FORM_MESSAGES,
} from './prompt-form';

const AVAILABLE = ['context', 'query'];

// 필드별 첫 에러 메시지만 모아 단언을 단순화한다
const fieldErrors = (values: Record<string, unknown>, availableTypes = AVAILABLE) => {
  const result = createPromptFormSchema(availableTypes).safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]).reverse()
  );
};

describe('extractPromptVariables', () => {
  it('{{#변수#}} 표기의 변수명을 순서대로 추출한다', () => {
    expect(extractPromptVariables('질문: {{#query#}} 참고: {{#context#}}')).toEqual([
      'query',
      'context',
    ]);
  });

  it('변수명 앞뒤 공백을 제거하고 중복은 한 번만 담는다', () => {
    expect(extractPromptVariables('{{# context #}} 그리고 {{#context#}}')).toEqual(['context']);
  });

  it('변수 표기가 없으면 빈 배열을 돌려준다', () => {
    expect(extractPromptVariables('변수 없는 본문 {{ 일반 중괄호 }}')).toEqual([]);
  });
});

describe('findInvalidPromptVariables', () => {
  it('사용 가능한 목록에 없는 변수만 골라낸다', () => {
    expect(findInvalidPromptVariables('{{#context#}} {{#foo#}} {{#bar#}}', AVAILABLE)).toEqual([
      'foo',
      'bar',
    ]);
  });
});

describe('createPromptFormSchema', () => {
  it('초기값은 이름·본문 필수 에러가 난다', () => {
    expect(fieldErrors(createInitialPromptFormValues())).toEqual({
      name: PROMPT_FORM_MESSAGES.nameRequired,
      content: PROMPT_FORM_MESSAGES.contentRequired,
    });
  });

  it('사용 가능한 변수만 쓴 본문은 통과한다', () => {
    const result = createPromptFormSchema(AVAILABLE).safeParse({
      name: '상담 프롬프트',
      description: '',
      content: '{{#context#}}를 참고해 {{#query#}}에 답해줘',
    });

    expect(result.success).toBe(true);
  });

  it('사용할 수 없는 변수가 있으면 변수명을 나열한 에러를 본문에 붙인다', () => {
    expect(
      fieldErrors({ name: '이름', description: '', content: '참고: {{#foo#}} {{#bar#}}' })
    ).toEqual({ content: PROMPT_FORM_MESSAGES.invalidVariables(['foo', 'bar']) });
  });

  it('사용 가능한 변수 목록이 바뀌면 같은 본문의 판정도 바뀐다', () => {
    const values = { name: '이름', description: '', content: '{{#foo#}}' };

    expect(fieldErrors(values, [])).toHaveProperty('content');
    expect(fieldErrors(values, ['foo'])).toEqual({});
  });
});
