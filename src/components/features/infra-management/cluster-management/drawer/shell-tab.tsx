import { useEffect, useRef, useState } from 'react';
import { Button } from '@innogrid/ui';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface ContainerOption {
  name: string;
}

interface ShellTabProps {
  clusterName?: string;
  namespace?: string;
  podName?: string;
  containers: ContainerOption[];
  enabled: boolean;
}

const SHELL_PRESETS = ['/bin/bash', '/bin/sh'];
const DEFAULT_SHELL = '/bin/bash';

export const ShellTab = ({ clusterName, namespace, podName, containers, enabled }: ShellTabProps) => {
  const [container, setContainer] = useState<string>('');
  const [command, setCommand] = useState<string>(DEFAULT_SHELL);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hostElRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const dataDisposerRef = useRef<{ dispose: () => void } | null>(null);
  const resizeDisposerRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (!enabled || !hostElRef.current || termRef.current) return;
    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, JetBrainsMono, monospace',
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostElRef.current);
    try {
      fit.fit();
    } catch {
      // ignore — initial fit can fail when host has zero size on first paint.
    }
    termRef.current = term;
    fitAddonRef.current = fit;

    return () => {
      try {
        dataDisposerRef.current?.dispose();
      } catch {
        // ignore
      }
      try {
        resizeDisposerRef.current?.dispose();
      } catch {
        // ignore
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hostElRef.current) return;
    const ro = new ResizeObserver(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // ignore
      }
    });
    ro.observe(hostElRef.current);
    return () => ro.disconnect();
  }, [enabled]);

  // 컨테이너 1개면 자동 선택
  useEffect(() => {
    if (!enabled) return;
    if (!container && containers.length === 1) {
      setContainer(containers[0].name);
    }
  }, [containers, container, enabled]);

  const closeWs = () => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    try {
      dataDisposerRef.current?.dispose();
    } catch {
      // ignore
    }
    dataDisposerRef.current = null;
    try {
      resizeDisposerRef.current?.dispose();
    } catch {
      // ignore
    }
    resizeDisposerRef.current = null;
  };

  const connect = () => {
    if (!clusterName || !namespace || !podName || !container) return;
    closeWs();
    const term = termRef.current;
    if (!term) return;
    setError(null);

    const params = new URLSearchParams();
    params.set('container', container);
    // backend 는 ExecPacket.command 를 comma-split (예: "/bin/bash,-l") — 사용자 입력 그대로 전달.
    params.set('command', command || DEFAULT_SHELL);
    params.set('tty', 'true');
    params.set('stdin', 'true');

    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl =
      `${wsScheme}://${window.location.host}/api/v1/any-cloud/kubernetes` +
      `/clusters/${encodeURIComponent(clusterName)}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(
        podName
      )}/exec?${params.toString()}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      term.clear();
      try {
        fitAddonRef.current?.fit();
      } catch {
        // ignore
      }
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      const dataDisp = term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(data).buffer);
        }
      });
      const resizeDisp = term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      });
      dataDisposerRef.current = dataDisp;
      resizeDisposerRef.current = resizeDisp;
    };
    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(ev.data));
        return;
      }
      if (typeof ev.data === 'string') {
        // backend 의 종료 frame ({"type":"end","exitCode":N,"errorCode":"...","message":"..."}) 처리.
        // 그 외 text 는 그대로 출력.
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed && (parsed.type === 'end' || 'exitCode' in parsed)) {
            const exitCode = parsed.exitCode ?? '-';
            term.writeln(`\r\n[종료, exit=${exitCode}]`);
            if (parsed.errorCode || parsed.message) {
              const detail = [parsed.errorCode, parsed.message].filter(Boolean).join(' — ');
              term.writeln(`[${detail}]`);
            }
            if (exitCode === 127) {
              term.writeln(
                `[힌트] command not found. 컨테이너에 ${command} 가 없을 수 있습니다. ` +
                  '상단의 sh / bash 프리셋 또는 /bin/ash, /bin/dash 등을 시도해 보세요.'
              );
            }
            ws.close();
            return;
          }
        } catch {
          // not JSON — fall through to text write
        }
        term.write(ev.data);
      }
    };
    ws.onerror = () => {
      setError('연결 오류 — 네트워크 또는 backend 상태 확인.');
    };
    ws.onclose = () => {
      setConnected(false);
    };
  };

  useEffect(() => {
    if (!enabled) return;
    if (container) connect();
    return () => closeWs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, enabled]);

  if (!enabled) return null;

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-[#6b7280]">컨테이너</label>
        <select
          value={container}
          onChange={(e) => setContainer(e.target.value)}
          disabled={containers.length === 0}
          className="rounded border border-[#d1d5db] bg-white px-2 py-1 text-[12px]"
        >
          <option value="" disabled>
            선택...
          </option>
          {containers.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="text-[12px] text-[#6b7280]">command</label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={DEFAULT_SHELL}
          className="w-[140px] rounded border border-[#d1d5db] bg-white px-2 py-1 font-mono text-[12px]"
        />
        <span className="flex items-center gap-1">
          {SHELL_PRESETS.map((preset) => (
            <Button
              key={preset}
              size="small"
              color={command === preset ? 'focus' : 'secondary'}
              onClick={() => setCommand(preset)}
            >
              {preset.replace('/bin/', '')}
            </Button>
          ))}
        </span>
        <span
          className={[
            'text-[11px]',
            connected ? 'text-[#15803d]' : 'text-[#9ca3af]',
          ].join(' ')}
        >
          {connected ? '● 연결됨' : '○ 연결 안됨'}
        </span>
        {error && <span className="text-[11px] text-[#dc2626]">{error}</span>}
        <span className="ml-auto">
          <Button
            size="small"
            color={connected ? 'secondary' : 'primary'}
            onClick={() => connect()}
            disabled={!container}
          >
            {connected ? '재연결' : '연결'}
          </Button>
        </span>
      </div>
      <div
        ref={hostElRef}
        className="min-h-[420px] flex-1 overflow-hidden rounded-md border border-[#1f2937] bg-[#1e1e1e] p-1"
      />
    </div>
  );
};