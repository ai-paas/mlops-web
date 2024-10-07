import { act, fireEvent, renderHook } from '@testing-library/react';
import { describe, it, vitest, expect, beforeEach, afterEach } from 'vitest';

import { useOutsideClick } from './useOutsideClick';

describe('useOutsideClick', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('요소의 바깥을 클릭했을 때, 콜백 함수를 실행해야한다.', () => {
    const callback = vitest.fn();
    const { result } = renderHook(() => useOutsideClick(callback));

    const div = document.createElement('div');
    container.appendChild(div);

    Object.defineProperty(result.current, 'current', {
      value: div,
      writable: true,
    });

    expect(callback).toHaveBeenCalledTimes(0);

    act(() => {
      fireEvent.mouseDown(document.body);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
