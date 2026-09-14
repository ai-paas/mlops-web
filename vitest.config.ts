import { defineConfig, mergeConfig, coverageConfigDefaults } from 'vitest/config';
import viteConfig from './vite.config';

// vite.config.ts(플러그인·alias·scss additionalData 포함)를 그대로 상속해
// 테스트마다 scss/svg를 수동 목킹할 필요를 없앤다.
export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup-tests.ts'],
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        // date.ts 등 로컬 타임존 의존 유틸의 기대값을 CI/로컬에서 동일하게 고정
        env: { TZ: 'Asia/Seoul' },
        clearMocks: true,
        // 실제 @innogrid/ui Table(가상화)과 lazy 라우트를 렌더하는 테스트가 병렬 부하에서
        // 기본값 5000ms를 넘겨 간헐 실패했다. 파일이 늘 때마다 재발하므로 여유를 둔다.
        testTimeout: 15000,
        server: {
          deps: {
            // @innogrid/ui가 CSS를 import하므로 vite 파이프라인으로 인라인 처리
            inline: ['@innogrid/ui'],
          },
        },
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html', 'lcov'],
          include: ['src/**/*.{ts,tsx}'],
          exclude: [...coverageConfigDefaults.exclude, 'src/test/**'],
          // 래칫 방식: 2026-09-14 실측치(St 33.18/Br 24.31/Fn 29.85/Ln 34.01) 기준 하한.
          // 실행 간 편차(±1pt 관측)를 감안해 1.3pt 이상 여유를 둔다.
          // 커버리지가 오르면 임계값도 함께 올린다 — 내리는 변경은 금지.
          thresholds: {
            statements: 31.8,
            branches: 23.0,
            functions: 28.5,
            lines: 32.7,
          },
        },
      },
    })
  )
);
