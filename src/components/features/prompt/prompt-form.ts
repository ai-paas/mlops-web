import * as z from 'zod';

/** 본문에서 `{{# 변수 #}}` 표기의 변수명을 추출한다 — 앞뒤 공백은 trim, 중복은 제거. */
export const extractPromptVariables = (content: string): string[] => {
  const matches = content.matchAll(/\{\{#\s*([^{}#]+?)\s*#\}\}/g);
  return [...new Set([...matches].map((match) => match[1]))];
};

/** 사용 가능한 변수 목록(variable-types)에 없는 변수만 골라낸다. */
export const findInvalidPromptVariables = (content: string, availableTypes: string[]) =>
  extractPromptVariables(content).filter((variable) => !availableTypes.includes(variable));

export const PROMPT_FORM_MESSAGES = {
  nameRequired: '이름은 필수입니다.',
  contentRequired: '프롬프트 내용은 필수입니다.',
  invalidVariables: (variables: string[]) =>
    `사용할 수 없는 변수입니다: ${variables.map((variable) => `{{#${variable}#}}`).join(', ')}`,
} as const;

/**
 * 프롬프트 생성·편집 공용 스키마.
 * 사용 가능한 변수 목록은 서버에서 받아오므로 목록을 인자로 받아 스키마를 만든다
 * — 목록이 바뀌면 호출부가 resolver를 다시 만든다(useMemo).
 */
export const createPromptFormSchema = (availableTypes: string[]) =>
  z.object({
    name: z.string().min(1, PROMPT_FORM_MESSAGES.nameRequired),
    description: z.string(),
    content: z
      .string()
      .min(1, PROMPT_FORM_MESSAGES.contentRequired)
      .superRefine((content, ctx) => {
        const invalid = findInvalidPromptVariables(content, availableTypes);
        if (invalid.length > 0) {
          ctx.addIssue({ code: 'custom', message: PROMPT_FORM_MESSAGES.invalidVariables(invalid) });
        }
      }),
  });

export type PromptFormValues = z.infer<ReturnType<typeof createPromptFormSchema>>;

export const createInitialPromptFormValues = (): PromptFormValues => ({
  name: '',
  description: '',
  content: '',
});
