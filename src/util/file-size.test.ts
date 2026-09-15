import { describe, it, expect } from 'vitest';
import { formatFileSize } from './file-size';

describe('formatFileSize', () => {
  it('0 바이트는 단위 없이 0 B로 표시한다', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('1KB 미만은 B 단위 정수로 표시한다', () => {
    expect(formatFileSize(442)).toBe('442 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('1024배마다 단위가 올라간다', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1024 ** 2)).toBe('1.00 MB');
    expect(formatFileSize(1024 ** 3)).toBe('1.00 GB');
    expect(formatFileSize(1024 ** 4)).toBe('1.00 TB');
  });

  it('TB를 넘어도 TB 단위를 유지한다', () => {
    expect(formatFileSize(1024 ** 5)).toBe('1024.00 TB');
  });

  it('실제 모델 파일 크기를 소수점 2자리로 표시한다', () => {
    expect(formatFileSize(1519)).toBe('1.48 KB');
    expect(formatFileSize(4721)).toBe('4.61 KB');
    expect(formatFileSize(135795376)).toBe('129.50 MB');
  });

  it('값이 없거나 유효하지 않으면 하이픈을 반환한다', () => {
    expect(formatFileSize(undefined)).toBe('-');
    expect(formatFileSize(null)).toBe('-');
    expect(formatFileSize(Number.NaN)).toBe('-');
    expect(formatFileSize(-1)).toBe('-');
  });
});
