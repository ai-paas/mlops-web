import type { Vm } from '@/types/vm';

type StepState = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

const STEPS: Array<{ key: 'PROVISION' | 'BOOTSTRAP' | 'VERIFY' | 'READY'; label: string }> = [
  { key: 'PROVISION', label: 'VM 프로비저닝' },
  { key: 'BOOTSTRAP', label: 'Kubernetes 부트스트랩' },
  { key: 'VERIFY', label: '연결 확인' },
  { key: 'READY', label: '완료' },
];

const STEP_ORDER: Record<string, number> = { PROVISION: 0, BOOTSTRAP: 1, VERIFY: 2, READY: 3 };

function deriveState(stepKey: string, vm: Vm | undefined): StepState {
  if (!vm) return 'pending';
  const current = vm.currentWorkflowStep ?? '';
  const lastFailed = vm.lastFailedStep ?? '';
  const status = vm.status ?? '';

  if (status === 'READY') return 'success';
  if (status === 'FAILED' || status === 'BLOCKED') {
    if (lastFailed === stepKey) return 'failed';
    const failedIdx = STEP_ORDER[lastFailed] ?? -1;
    const stepIdx = STEP_ORDER[stepKey] ?? -1;
    if (stepIdx < failedIdx) return 'success';
    return 'pending';
  }
  if (status === 'DELETING' || status === 'DELETED') {
    return stepKey === 'READY' ? 'skipped' : 'success';
  }
  // active workflow.
  if (stepKey === 'READY') return 'pending';
  if (current === stepKey) return 'running';
  const currentIdx = STEP_ORDER[current] ?? -1;
  const stepIdx = STEP_ORDER[stepKey] ?? -1;
  if (stepIdx < currentIdx) return 'success';
  return 'pending';
}

function timestampFor(stepKey: string, vm: Vm | undefined): string | undefined {
  if (!vm) return undefined;
  switch (stepKey) {
    case 'PROVISION':
      return vm.provisioningStartedAt;
    case 'BOOTSTRAP':
      return vm.bootstrappingStartedAt;
    case 'VERIFY':
      return vm.verifyingStartedAt;
    case 'READY':
      return vm.readyAt;
    default:
      return undefined;
  }
}

function formatDuration(start?: string, end?: string): string {
  if (!start) return '';
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return '';
  const sec = Math.floor((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const rs = sec % 60;
  if (m < 60) return `${m}m${rs ? ` ${rs}s` : ''}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm ? ` ${rm}m` : ''}`;
}

const STATE_STYLE: Record<StepState, { bg: string; fg: string; border: string; icon: string }> = {
  pending: { bg: '#f3f4f6', fg: '#6b7280', border: '#e5e7eb', icon: '○' },
  running: { bg: '#dbeafe', fg: '#1d4ed8', border: '#3b82f6', icon: '◐' },
  success: { bg: '#d1fae5', fg: '#047857', border: '#10b981', icon: '✓' },
  failed: { bg: '#fee2e2', fg: '#b91c1c', border: '#ef4444', icon: '✗' },
  skipped: { bg: '#f3f4f6', fg: '#9ca3af', border: '#e5e7eb', icon: '—' },
};

interface Props {
  vm?: Vm;
}

export function WorkflowStepper({ vm }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 8,
        padding: 16,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      {STEPS.map((step, idx) => {
        const state = deriveState(step.key, vm);
        const style = STATE_STYLE[state];
        const startedAt = timestampFor(step.key, vm);
        const nextStartedAt =
          idx + 1 < STEPS.length ? timestampFor(STEPS[idx + 1].key, vm) : undefined;
        const duration =
          state === 'success'
            ? formatDuration(startedAt, nextStartedAt)
            : state === 'running'
              ? formatDuration(startedAt)
              : '';
        const subStep = state === 'running' ? vm?.currentSubStep : undefined;
        return (
          <div
            key={step.key}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '10px 12px',
              background: style.bg,
              color: style.fg,
              border: `1px solid ${style.border}`,
              borderLeftWidth: state === 'running' ? 4 : 1,
              borderRadius: 6,
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <span style={{ fontSize: 14 }}>{style.icon}</span>
              <span style={{ fontSize: 13 }}>{step.label}</span>
            </div>
            {duration && <div style={{ fontSize: 11 }}>{duration}</div>}
            {subStep && (
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.85,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={subStep}
              >
                {subStep}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}