import { describe, expect, it } from 'vitest';
import type * as z from 'zod';
import {
  MEMBER_FORM_MESSAGES,
  createInitialMemberCreateFormValues,
  createInitialMemberEditFormValues,
  memberCreateSchema,
  memberEditSchema,
  type MemberCreateFormValues,
  type MemberEditFormValues,
} from './member-form';

// 스키마 이슈를 필드별 첫 메시지로 요약한다 — RHF fieldState.error.message와 같은 관점
const fieldErrors = <T extends Record<string, unknown>>(schema: z.ZodType<T>, values: T) => {
  const result = schema.safeParse(values);
  const errors: Partial<Record<keyof T, string>> = {};
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in errors)) errors[field as keyof T] = issue.message;
  }
  return errors;
};

// 모든 규칙을 통과하는 기준 값 — 각 테스트는 필요한 필드만 덮어쓴다
const validCreate = (): MemberCreateFormValues => ({
  ...createInitialMemberCreateFormValues(),
  name: '홍길동',
  memberId: 'hong-gildong',
  email: 'hong@example.com',
  password: 'Abcd123!',
  passwordConfirm: 'Abcd123!',
  phone: '01012345678',
  description: '테스트 회원',
});

const validEdit = (): MemberEditFormValues => ({
  ...createInitialMemberEditFormValues(),
  name: '홍길동',
  memberId: 'hong-gildong',
  email: 'hong@example.com',
  phone: '01012345678',
});

describe('memberCreateSchema', () => {
  it('기준 값은 검증을 통과한다', () => {
    expect(fieldErrors(memberCreateSchema, validCreate())).toEqual({});
  });

  it.each([
    ['이름이 비어 있으면', { name: '' }, 'name', MEMBER_FORM_MESSAGES.required],
    ['연락처가 비어 있으면', { phone: '' }, 'phone', MEMBER_FORM_MESSAGES.required],
    ['이름에 한글 외 문자가 있으면', { name: 'John' }, 'name', MEMBER_FORM_MESSAGES.name],
    ['이름에 숫자가 섞여 있으면', { name: '홍길동1' }, 'name', MEMBER_FORM_MESSAGES.name],
    [
      '아이디에 대문자가 있으면',
      { memberId: 'Hong-gildong' },
      'memberId',
      MEMBER_FORM_MESSAGES.memberId,
    ],
    ['아이디가 5자 미만이면', { memberId: 'abcd' }, 'memberId', MEMBER_FORM_MESSAGES.memberId],
    [
      '이메일에 최상위 도메인이 없으면',
      { email: 'hong@example' },
      'email',
      MEMBER_FORM_MESSAGES.email,
    ],
    [
      '비밀번호에 특수문자가 없으면',
      { password: 'Abcd1234', passwordConfirm: 'Abcd1234' },
      'password',
      MEMBER_FORM_MESSAGES.password,
    ],
    [
      '비밀번호 확인이 다르면',
      { passwordConfirm: 'Abcd123?' },
      'passwordConfirm',
      MEMBER_FORM_MESSAGES.passwordConfirm,
    ],
    ['연락처가 9자리면', { phone: '010123456' }, 'phone', MEMBER_FORM_MESSAGES.phone],
  ] as const)('%s 해당 필드 에러를 낸다', (_label, override, field, message) => {
    expect(fieldErrors(memberCreateSchema, { ...validCreate(), ...override })[field]).toBe(message);
  });

  it('이메일 로컬 파트의 점(.)은 기존 규칙대로 허용하지 않는다 (특성화 — TEST_PLAN 부록 A)', () => {
    const values = { ...validCreate(), email: 'hong.gildong@example.com' };

    expect(fieldErrors(memberCreateSchema, values).email).toBe(MEMBER_FORM_MESSAGES.email);
  });
});

describe('memberEditSchema', () => {
  it('비밀번호를 비워 두면 변경 없음으로 보고 통과한다', () => {
    expect(fieldErrors(memberEditSchema, validEdit())).toEqual({});
  });

  it('이메일·연락처는 필수다', () => {
    expect(fieldErrors(memberEditSchema, { ...validEdit(), email: '', phone: '' })).toEqual({
      email: MEMBER_FORM_MESSAGES.required,
      phone: MEMBER_FORM_MESSAGES.required,
    });
  });

  it('비밀번호를 입력하면 규칙과 확인 일치를 검사한다', () => {
    const invalid = { ...validEdit(), password: 'weak', passwordConfirm: 'other' };
    expect(fieldErrors(memberEditSchema, invalid)).toEqual({
      password: MEMBER_FORM_MESSAGES.password,
      passwordConfirm: MEMBER_FORM_MESSAGES.passwordConfirm,
    });

    const valid = { ...validEdit(), password: 'Abcd123!', passwordConfirm: 'Abcd123!' };
    expect(fieldErrors(memberEditSchema, valid)).toEqual({});
  });

  it('확인란만 입력해도 비밀번호 변경으로 보고 검사한다', () => {
    const values = { ...validEdit(), passwordConfirm: 'Abcd123!' };

    expect(fieldErrors(memberEditSchema, values)).toEqual({
      password: MEMBER_FORM_MESSAGES.password,
      passwordConfirm: MEMBER_FORM_MESSAGES.passwordConfirm,
    });
  });
});
