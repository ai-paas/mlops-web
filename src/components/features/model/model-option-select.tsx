import { Select } from '@innogrid/ui';

interface ModelOption {
  id: number;
  name: string;
}

interface ModelOptionSelectProps<T extends ModelOption> {
  options: T[];
  /** 선택된 옵션의 id (미선택 null) */
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder: string;
  errMessage?: string;
  isDisabled?: boolean;
}

/** id로 선택 상태를 들고 있는 폼 값(RHF Controller)과 옵션 객체를 주고받는 innogrid Select를 이어준다. */
export const ModelOptionSelect = <T extends ModelOption>({
  options,
  value,
  onChange,
  placeholder,
  errMessage,
  isDisabled,
}: ModelOptionSelectProps<T>) => (
  <Select
    placeholder={placeholder}
    isDisabled={isDisabled}
    options={options}
    getOptionLabel={(option: T) => option.name}
    getOptionValue={(option: T) => String(option.id)}
    value={options.find((option) => option.id === value) ?? null}
    onChange={(option: T | null) => onChange(option?.id ?? null)}
    errMessage={errMessage}
  />
);
