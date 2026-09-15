const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** 바이트 수를 사람이 읽는 크기 문자열로 바꾼다. 1024 단위, B는 정수·그 외는 소수점 2자리. */
export const formatFileSize = (bytes?: number | null): string => {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes) || bytes < 0) return '-';
  if (bytes === 0) return '0 B';

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${exponent === 0 ? value : value.toFixed(2)} ${UNITS[exponent]}`;
};
