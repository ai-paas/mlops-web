import { vi } from 'vitest';

// 토스트 호출 검증용 안정 스파이. useToast()가 렌더마다 새 객체를 반환해도 open은
// 이 스파이를 공유하므로 테스트에서 import해 호출 내용을 단언할 수 있다.
// vi.mock 팩토리는 '@innogrid/ui'가 처음 import되는 시점(이 모듈 평가 완료 후)에야
// 실행되므로 호이스팅된 팩토리가 이 변수를 참조해도 TDZ에 걸리지 않는다.
// (호출 기록은 전역 clearMocks 설정이 테스트 간 자동 초기화한다)
export const toastOpenSpy = vi.fn();

// @innogrid/ui 컴포넌트 모킹
// Input/Textarea는 react-hook-form의 {...register()}가 넘기는 ref/onBlur가 동작해야
// reset()으로 채운 값이 DOM에 반영되므로 forwardRef + props 스프레드로 구현한다.
vi.mock('@innogrid/ui', async () => {
  const { forwardRef, useState } = await import('react');

  const Input = forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement> & {
      errMessage?: string;
      customSize?: { width?: number | string; height?: number | string };
    }
  >(({ errMessage, customSize, ...props }, ref) => (
    <>
      <input
        ref={ref}
        style={customSize ? { width: customSize.width, height: customSize.height } : undefined}
        {...props}
      />
      {errMessage && <span>{errMessage}</span>}
    </>
  ));
  Input.displayName = 'Input';

  // 로그인 페이지 등에서 라벨·placeholder 없이 쓰여 접근성 쿼리가 불가능하므로
  // (실제 컴포넌트도 자체 라벨은 렌더하지 않는다) data-testid를 이스케이프 해치로 제공한다.
  const Password = forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement> & {
      errMessage?: string;
      customSize?: { width?: number | string; height?: number | string };
    }
  >(({ errMessage, customSize, ...props }, ref) => (
    <>
      <input
        type="password"
        data-testid="password-input"
        ref={ref}
        style={customSize ? { width: customSize.width, height: customSize.height } : undefined}
        {...props}
      />
      {errMessage && <span>{errMessage}</span>}
    </>
  ));
  Password.displayName = 'Password';

  const Textarea = forwardRef<
    HTMLTextAreaElement,
    React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
      errMessage?: string;
      customSize?: { width?: number; height?: number };
    }
  >(({ errMessage, customSize, ...props }, ref) => (
    <>
      <textarea
        ref={ref}
        style={customSize ? { width: customSize.width, height: customSize.height } : undefined}
        {...props}
      />
      {errMessage && <span>{errMessage}</span>}
    </>
  ));
  Textarea.displayName = 'Textarea';

  // PopoverTrigger 등 radix asChild가 ref를 전달하므로 forwardRef로 구현한다.
  // isLoading은 DOM 속성이 아니므로 스프레드 전에 걸러낸다 (React 경고 방지).
  const Button = forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & {
      color?: string;
      size?: string;
      isLoading?: boolean;
    }
  >(({ children, color, size, isLoading, ...props }, ref) => (
    <button ref={ref} data-color={color} data-size={size} data-loading={isLoading} {...props}>
      {children}
    </button>
  ));
  Button.displayName = 'Button';

  // 라벨 버튼 + 활성 컴포넌트만 렌더하는 경량 목 — 실제처럼 비활성 탭 내용은 마운트하지 않는다.
  const Tabs = ({
    labels = [],
    components = [],
  }: {
    labels?: React.ReactNode[];
    components?: React.ReactNode[];
  }) => {
    const [active, setActive] = useState(0);

    return (
      <div>
        <div role="tablist">
          {labels.map((label, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">{components[active]}</div>
      </div>
    );
  };

  return {
    Button,

    // path가 있는 항목은 onNavigate 호출 버튼으로 렌더 — 브레드크럼 이동 검증용
    BreadCrumb: ({
      items = [],
      onNavigate,
    }: {
      items?: { label: string; path?: string }[];
      onNavigate?: (path: string) => void;
    }) => (
      <nav aria-label="경로">
        {items.map((item, i) =>
          item.path ? (
            <button key={i} type="button" onClick={() => onNavigate?.(item.path as string)}>
              {item.label}
            </button>
          ) : (
            <span key={i}>{item.label}</span>
          )
        )}
      </nav>
    ),

    Tabs,

    Modal: ({
      isOpen,
      children,
      title,
      action,
      buttonTitle,
      buttonDisabled,
      subButton,
    }: {
      isOpen: boolean;
      children: React.ReactNode;
      title: string;
      action?: () => void;
      onRequestClose?: () => void;
      buttonTitle?: string;
      buttonDisabled?: boolean;
      subButton?: React.ReactNode;
    }) =>
      isOpen ? (
        <div role="dialog" aria-label={title}>
          <h2>{title}</h2>
          {children}
          <div>
            {subButton}
            <button disabled={buttonDisabled} onClick={action}>
              {buttonTitle}
            </button>
          </div>
        </div>
      ) : null,

    Input,

    Password,

    Textarea,

    // 옵션을 네이티브 select로 렌더링하는 경량 목 — 검색·메뉴 포지셔닝 로직은 생략.
    // placeholder를 aria-label로 노출하므로 getByRole('combobox') 또는 getByLabelText로 조회한다.
    Select: ({
      options = [],
      value,
      placeholder,
      onChange,
      errMessage,
      getOptionLabel = (option) => String((option as { text?: unknown })?.text ?? ''),
      getOptionValue = (option) => String((option as { value?: unknown })?.value ?? ''),
    }: {
      options?: unknown[];
      value?: unknown;
      placeholder?: string;
      onChange?: (option: unknown | null) => void;
      errMessage?: string;
      getOptionLabel?: (option: unknown) => string;
      getOptionValue?: (option: unknown) => string;
      menuPosition?: string;
    }) => (
      <>
        <select
          aria-label={placeholder}
          value={value != null ? getOptionValue(value) : ''}
          onChange={(event) => {
            const selected =
              options.find((option) => getOptionValue(option) === event.target.value) ?? null;
            onChange?.(selected);
          }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={getOptionValue(option)} value={getOptionValue(option)}>
              {getOptionLabel(option)}
            </option>
          ))}
        </select>
        {errMessage && <span>{errMessage}</span>}
      </>
    ),

    // 네이티브 file input으로 렌더링하는 경량 목 — 드래그앤드롭·미리보기는 생략.
    // 실제 컴포넌트처럼 extensions에 없는 확장자는 onError를 호출하고 파일을 넘기지 않는다.
    FileDrop: ({
      id,
      description,
      extensions,
      files = [],
      multiple,
      onAddFile,
      onDeleteFile,
      onError,
    }: {
      id?: string;
      description?: React.ReactNode;
      extensions?: string[];
      files?: File[];
      multiple?: boolean;
      onAddFile?: (files: File[]) => void;
      onDeleteFile?: (value: { file: File; fileIndex: number }) => void;
      onError?: (value: { errorFiles: File[]; errorMessage: string }) => void;
    }) => (
      <div>
        <input
          aria-label="파일 업로드"
          data-testid={id}
          multiple={multiple}
          type="file"
          onChange={(event) => {
            const list = Array.from(event.currentTarget.files ?? []);
            const isAllowed = (file: File) =>
              !extensions?.length ||
              extensions.some((ext) => file.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`));
            const errorFiles = list.filter((file) => !isAllowed(file));
            if (errorFiles.length > 0) {
              // 실제 컴포넌트와 같은 시그니처({ errorFiles, errorMessage })로 호출한다
              onError?.({ errorFiles, errorMessage: '허용되지 않는 파일 형식입니다.' });
              return;
            }
            onAddFile?.(list);
          }}
        />
        <div>{description}</div>
        {files.map((file, index) => (
          <div key={`${file.name}-${file.size}`}>
            <span>{file.name}</span>
            <button type="button" onClick={() => onDeleteFile?.({ file, fileIndex: index })}>
              삭제
            </button>
          </div>
        ))}
      </div>
    ),

    // 단일 라디오 경량 목 — label 텍스트로 getByRole('radio', { name })이 동작한다.
    RadioButton: ({
      id,
      label,
      checked,
      onCheckedChange,
    }: {
      id?: string;
      label?: string;
      value?: string;
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }) => (
      <label htmlFor={id}>
        <input type="radio" id={id} checked={checked} onChange={() => onCheckedChange?.(true)} />
        {label}
      </label>
    ),

    // 네이티브 라디오로 렌더링하는 경량 목 — label 텍스트로 getByRole('radio', { name })이 동작한다.
    RadioGroupButton: ({
      id,
      options = [],
      value,
      onValueChange,
    }: {
      id?: string;
      orientation?: string;
      options?: { label: string; value: string }[];
      value?: string;
      onValueChange?: (value: string) => void;
    }) => (
      <div role="radiogroup">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              name={id}
              checked={option.value === value}
              onChange={() => onValueChange?.(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    ),

    // 배열 value([number]) 규약만 유지한 네이티브 range 목
    Slider: ({
      value,
      onValueChange,
      min,
      max,
      step,
    }: {
      value?: number[];
      onValueChange?: (value: number[]) => void;
      min?: number;
      max?: number;
      step?: number;
    }) => (
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value?.[0] ?? 0}
        onChange={(event) => onValueChange?.([Number(event.target.value)])}
      />
    ),

    // 모든 아이템을 펼친 상태로 렌더링하는 경량 목 — 접기/펼치기 상태 로직은 생략
    Accordion: ({
      components = [],
    }: {
      components?: { label: React.ReactNode; component: React.ReactNode }[];
      defaultValue?: string;
    }) => (
      <div>
        {components.map((item, i) => (
          <div key={i}>
            <div>{item.label}</div>
            {item.component}
          </div>
        ))}
      </div>
    ),

    // 트리거와 메뉴 아이템을 항상 렌더링하는 경량 목 — open/onOpenChange 상태 로직은 생략
    DropdownMenu: ({
      children,
      menus,
    }: {
      children: React.ReactNode;
      menus: {
        label: React.ReactNode;
        onSelect?: (event: Event) => void;
        disabled?: boolean;
      }[];
    }) => (
      <div>
        {children}
        <div role="menu">
          {menus.map((menu, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={menu.disabled}
              onClick={() => menu.onSelect?.(new Event('select'))}
            >
              {menu.label}
            </button>
          ))}
        </div>
      </div>
    ),

    AlertDialog: ({
      isOpen,
      children,
      confirmButtonText,
      cancelButtonText,
      onClickConfirm,
      onClickClose,
    }: {
      isOpen: boolean;
      children: React.ReactNode;
      confirmButtonText?: string;
      cancelButtonText?: string;
      onClickConfirm?: () => void;
      onClickClose?: () => void;
    }) =>
      isOpen ? (
        <div role="alertdialog">
          {children}
          <button onClick={onClickClose}>{cancelButtonText}</button>
          <button onClick={onClickConfirm}>{confirmButtonText}</button>
        </div>
      ) : null,

    // 로딩 표지로 getByRole('status')로 조회할 수 있는 경량 목 — 애니메이션은 생략
    Skeleton: ({ style }: { variant?: string; style?: React.CSSProperties }) => (
      <div role="status" style={style} />
    ),

    useToast: () => ({ open: toastOpenSpy }),
  };
});
