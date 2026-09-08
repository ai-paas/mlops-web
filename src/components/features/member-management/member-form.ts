import * as z from 'zod';

// 멤버 생성/수정 폼 규칙 — 두 페이지와 액션 컴포넌트가 공유한다.
// 정규식은 기존 수동 검증 규칙을 그대로 옮겼다(동작 변경 없음).
export const MEMBER_ID_PATTERN = /^[a-z0-9-]{5,45}$/;
// 로컬 파트에 '.'을 허용하지 않는 기존 규칙 유지 — TEST_PLAN 부록 A(특성화)
export const EMAIL_PATTERN = /^[a-zA-Z0-9]+@[a-zA-Z]+(\.[a-zA-Z]+)+$/;
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=])[A-Za-z\d!@#$%^&*()_\-+=]{8,16}$/;
const NAME_PATTERN = /^[가-힣]+$/;
const PHONE_PATTERN = /^\d{10,11}$/;

export const MEMBER_FORM_MESSAGES = {
  required: '필수 항목을 입력해주세요.',
  name: '이름은 한글만 입력 가능합니다.',
  memberId: "아이디는 소문자, 숫자, '-' 조합으로 5~45자여야 합니다.",
  email: '이메일 형식이 올바르지 않습니다.',
  password: '비밀번호는 8~16자, 영문 대/소문자·숫자·특수문자를 모두 포함해야 합니다.',
  passwordConfirm: '비밀번호가 일치하지 않습니다.',
  phone: '연락처는 숫자만 입력 가능하며 10~11자리여야 합니다.',
} as const;

const roleSchema = z.enum(['user', 'admin']);
export type MemberRole = z.infer<typeof roleSchema>;

const requiredString = () => z.string().min(1, MEMBER_FORM_MESSAGES.required);
const emailSchema = requiredString().regex(EMAIL_PATTERN, MEMBER_FORM_MESSAGES.email);
// 연락처는 숫자만 보관한다(표시는 formatPhone)
const phoneSchema = requiredString().regex(PHONE_PATTERN, MEMBER_FORM_MESSAGES.phone);

export const memberCreateSchema = z
  .object({
    name: requiredString().regex(NAME_PATTERN, MEMBER_FORM_MESSAGES.name),
    memberId: requiredString().regex(MEMBER_ID_PATTERN, MEMBER_FORM_MESSAGES.memberId),
    email: emailSchema,
    password: requiredString().regex(PASSWORD_PATTERN, MEMBER_FORM_MESSAGES.password),
    passwordConfirm: z.string(),
    phone: phoneSchema,
    role: roleSchema,
    description: z.string(),
  })
  .superRefine((values, context) => {
    if (values.password !== values.passwordConfirm) {
      context.addIssue({
        code: 'custom',
        path: ['passwordConfirm'],
        message: MEMBER_FORM_MESSAGES.passwordConfirm,
      });
    }
  });

export type MemberCreateFormValues = z.infer<typeof memberCreateSchema>;

// 수정: 이름·아이디는 읽기 전용, 비밀번호는 선택 — 둘 중 하나라도 입력하면 규칙·일치를 검사한다
export const memberEditSchema = z
  .object({
    name: z.string(),
    memberId: z.string(),
    email: emailSchema,
    password: z.string(),
    passwordConfirm: z.string(),
    phone: phoneSchema,
    role: roleSchema,
    description: z.string(),
  })
  .superRefine((values, context) => {
    const willChangePassword = Boolean(values.password || values.passwordConfirm);
    if (!willChangePassword) return;

    if (!PASSWORD_PATTERN.test(values.password)) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: MEMBER_FORM_MESSAGES.password,
      });
    }
    if (values.password !== values.passwordConfirm) {
      context.addIssue({
        code: 'custom',
        path: ['passwordConfirm'],
        message: MEMBER_FORM_MESSAGES.passwordConfirm,
      });
    }
  });

export type MemberEditFormValues = z.infer<typeof memberEditSchema>;

const EMPTY_MEMBER_FORM = {
  name: '',
  memberId: '',
  email: '',
  password: '',
  passwordConfirm: '',
  phone: '',
  role: 'user',
  description: '',
} as const satisfies MemberCreateFormValues & MemberEditFormValues;

export const createInitialMemberCreateFormValues = (): MemberCreateFormValues => ({
  ...EMPTY_MEMBER_FORM,
});

export const createInitialMemberEditFormValues = (): MemberEditFormValues => ({
  ...EMPTY_MEMBER_FORM,
});
