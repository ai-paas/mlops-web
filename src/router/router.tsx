import { Suspense, lazy, type ComponentType } from 'react';
import { Navigate, Outlet, createBrowserRouter, type RouteObject } from 'react-router';
import DefaultLayout from '@/pages/layout';
import { useAuth } from '@/hooks/useAuth';

const LoginPage = lazy(() => import('@/pages/login/page'));
const HomePage = lazy(() => import('@/pages/page'));
const DashboardPage = lazy(() => import('@/pages/dashboard/page'));

const ServicePage = lazy(() => import('@/pages/service/page'));
const ServiceDetailPage = lazy(() => import('@/pages/service/[id]/page'));

const WorkflowPage = lazy(() => import('@/pages/workflow/workflow/page'));
const WorkflowCreatePage = lazy(() => import('@/pages/workflow/workflow/create/page'));
const WorkflowDetailPage = lazy(() => import('@/pages/workflow/workflow/[id]/page'));
const WorkflowEditPage = lazy(() => import('@/pages/workflow/workflow/[id]/edit/page'));
const WorkflowTemplatePage = lazy(() => import('@/pages/workflow/templates/page'));
const WorkflowTemplateCreatePage = lazy(() => import('@/pages/workflow/templates/create/page'));
const WorkflowTemplateDetailPage = lazy(() => import('@/pages/workflow/templates/[id]/page'));
const WorkflowTemplateEditPage = lazy(() => import('@/pages/workflow/templates/[id]/edit/page'));

const ModelCatalogPage = lazy(() => import('@/pages/model/model-catalog/page'));
const ModelCatalogCreatePage = lazy(() => import('@/pages/model/model-catalog/create/page'));
const ModelCatalogDetailPage = lazy(() => import('@/pages/model/model-catalog/[id]/page'));
const CustomModelPage = lazy(() => import('@/pages/model/custom-model/page'));
const CustomModelCreatePage = lazy(() => import('@/pages/model/custom-model/create/page'));
const CustomModelCreateHuggingfacePage = lazy(
  () => import('@/pages/model/custom-model/create/huggingface/page')
);
const CustomModelCreateKagglePage = lazy(
  () => import('@/pages/model/custom-model/create/kaggle/page')
);
const CustomModelDetailPage = lazy(() => import('@/pages/model/custom-model/[id]/page'));

const DatasetPage = lazy(() => import('@/pages/dataset/page'));
const DatasetCreatePage = lazy(() => import('@/pages/dataset/create/page'));
const DatasetDetailPage = lazy(() => import('@/pages/dataset/[id]/page'));

const KnowledgeBasePage = lazy(() => import('@/pages/knowledge-base/page'));
const KnowledgeBaseCreatePage = lazy(() => import('@/pages/knowledge-base/create/page'));
const KnowledgeBaseDetailPage = lazy(() => import('@/pages/knowledge-base/[id]/page'));

const PromptPage = lazy(() => import('@/pages/prompt/page'));
const PromptCreatePage = lazy(() => import('@/pages/prompt/create/page'));
const PromptDetailPage = lazy(() => import('@/pages/prompt/[id]/page'));

const LearningPage = lazy(() => import('@/pages/learning/page'));
const LearningCreatePage = lazy(() => import('@/pages/learning/create/page'));
const LearningDetailPage = lazy(() => import('@/pages/learning/[id]/page'));

const ClusterManagementPage = lazy(() => import('@/pages/infra-management/cluster-management/page'));
const ClusterCreatePage = lazy(
  () => import('@/pages/infra-management/cluster-management/create/page')
);
const ClusterEditPage = lazy(() => import('@/pages/infra-management/cluster-management/edit/page'));
const ClusterDetailPage = lazy(
  () => import('@/pages/infra-management/cluster-management/[id]/page')
);
const ClusterAddonsPage = lazy(
  () => import('@/pages/infra-management/cluster-management/[id]/addons/page')
);
const ClusterAgentFleetPage = lazy(() => import('@/pages/infra-management/cluster-agent/page'));
const CredentialsPage = lazy(() => import('@/pages/infra-management/credentials/page'));
const CredentialsCreatePage = lazy(() => import('@/pages/infra-management/credentials/create/page'));
const AuditLogsPage = lazy(() => import('@/pages/infra-management/audit-logs/page'));
const OperationsPage = lazy(() => import('@/pages/infra-management/operations/page'));
const ProvisioningPage = lazy(() => import('@/pages/infra-management/provisioning/page'));
const ProvisioningCreatePage = lazy(
  () => import('@/pages/infra-management/provisioning/create/page')
);
const VmDetailPage = lazy(() => import('@/pages/infra-management/provisioning/[id]/page'));
const MonitoringPage = lazy(() => import('@/pages/infra-management/monitoring/page'));
const WorkloadPage = lazy(() => import('@/pages/infra-management/workload/page'));
const AcceleratorPage = lazy(() => import('@/pages/infra-management/accelerator/page'));
const UsagePage = lazy(() => import('@/pages/infra-management/usage/page'));
const ApplicationCatalogPage = lazy(() => import('@/pages/infra-management/application/catalog/page'));
const CatalogDetailPage = lazy(
  () => import('@/pages/infra-management/application/catalog/[chartName]/page')
);
const ApplicationHelmReleasePage = lazy(
  () => import('@/pages/infra-management/application/helm-release/page')
);
const HelmReleaseCreatePage = lazy(
  () => import('@/pages/infra-management/application/helm-release/create/page')
);
const HelmReleaseDetailPage = lazy(
  () => import('@/pages/infra-management/application/helm-release/[namespace]/[name]/page')
);
const ApplicationHelmRepositoryPage = lazy(
  () => import('@/pages/infra-management/application/helm-repository/page')
);

const MemberManagementPage = lazy(() => import('@/pages/member-management/page'));
const MemberManagementDetailPage = lazy(() => import('@/pages/member-management/[id]/page'));
const MemberCreatePage = lazy(() => import('@/pages/member-management/create/page'));
const MemberEditPage = lazy(() => import('@/pages/member-management/[id]/edit/page'));

// eslint-disable-next-line react-refresh/only-export-components
const PageLoading = () => (
  <div className="animate-delayed-fade-in flex h-full min-h-80 w-full items-center justify-center opacity-0">
    <div
      className="size-8 animate-spin rounded-full border-3 border-gray-200 border-t-gray-500"
      role="status"
      aria-label="로딩 중"
    />
  </div>
);

const page = (Component: ComponentType) => (
  <Suspense fallback={<PageLoading />}>
    <Component />
  </Suspense>
);

// 관리자 전용 구간의 패스리스 레이아웃 라우트 — DefaultLayout(인증 가드) 안쪽에서만 쓴다.
// 메뉴는 이미 비관리자에게 숨겨져 있어(menu.tsx) 직접 URL 진입만 해당하므로 403 페이지 대신 홈으로 보낸다.
// 사용처가 늘면 공용 컴포넌트로 분리(PageLoading과 같은 기준).
// eslint-disable-next-line react-refresh/only-export-components
const AdminRoute = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
};

// 라우트 정의를 분리 export — 테스트에서 createMemoryRouter(routes, { initialEntries })로
// 라우팅/인증 가드 통합 테스트를 작성할 수 있게 한다.
export const routes: RouteObject[] = [
  {
    path: '/login',
    element: page(LoginPage),
  },
  {
    path: '/',
    element: <DefaultLayout />,
    children: [
      {
        index: true,
        element: page(HomePage),
      },
      {
        path: 'service',
        element: page(ServicePage),
      },
      {
        path: 'service/:id',
        element: page(ServiceDetailPage),
      },
      {
        path: 'workflow',
        children: [
          {
            index: true,
            element: <Navigate to="workflow" replace />,
          },
          {
            path: 'workflow',
            element: page(WorkflowPage),
          },
          {
            path: 'templates',
            element: page(WorkflowTemplatePage),
          },
          {
            path: 'templates/create',
            element: page(WorkflowTemplateCreatePage),
          },
          {
            path: 'templates/:id',
            element: page(WorkflowTemplateDetailPage),
          },
          {
            path: 'templates/:id/edit',
            element: page(WorkflowTemplateEditPage),
          },
          {
            path: 'workflow/create',
            element: page(WorkflowCreatePage),
          },
          {
            path: 'workflow/:id',
            element: page(WorkflowDetailPage),
          },
          {
            path: 'workflow/:id/edit',
            element: page(WorkflowEditPage),
          },
        ],
      },
      {
        path: 'model',
        children: [
          {
            path: 'model-catalog',
            element: page(ModelCatalogPage),
          },
          {
            path: 'model-catalog/create',
            element: page(ModelCatalogCreatePage),
          },
          {
            path: 'model-catalog/:id',
            element: page(ModelCatalogDetailPage),
          },
          {
            path: 'custom-model',
            element: page(CustomModelPage),
          },
          {
            path: 'custom-model/create',
            element: page(CustomModelCreatePage),
          },
          {
            path: 'custom-model/create/huggingface',
            element: page(CustomModelCreateHuggingfacePage),
          },
          {
            path: 'custom-model/create/kaggle',
            element: page(CustomModelCreateKagglePage),
          },
          {
            path: 'custom-model/:id',
            element: page(CustomModelDetailPage),
          },
        ],
      },
      {
        path: 'dataset',
        element: page(DatasetPage),
      },
      {
        path: 'dataset/create',
        element: page(DatasetCreatePage),
      },
      {
        path: 'dataset/:id',
        element: page(DatasetDetailPage),
      },
      {
        path: 'knowledge-base',
        element: page(KnowledgeBasePage),
      },
      {
        path: 'knowledge-base/create',
        element: page(KnowledgeBaseCreatePage),
      },
      {
        path: 'knowledge-base/:id',
        element: page(KnowledgeBaseDetailPage),
      },
      {
        path: 'prompt',
        element: page(PromptPage),
      },
      {
        path: 'prompt/create',
        element: page(PromptCreatePage),
      },
      {
        path: 'prompt/:id',
        element: page(PromptDetailPage),
      },
      {
        path: 'learning',
        element: page(LearningPage),
      },
      {
        path: 'learning/create',
        element: page(LearningCreatePage),
      },
      {
        path: 'learning/:id',
        element: page(LearningDetailPage),
      },
      {
        path: 'dashboard',
        element: page(DashboardPage),
      },
      {
        path: 'infra-management',
        children: [
          {
            path: 'cluster-management',
            children: [
              {
                index: true,
                element: page(ClusterManagementPage),
              },
              {
                path: 'create',
                element: page(ClusterCreatePage),
              },
              {
                path: 'edit/:clusterId',
                element: page(ClusterEditPage),
              },
              {
                path: ':id',
                element: page(ClusterDetailPage),
              },
              {
                path: ':id/addons',
                element: page(ClusterAddonsPage),
              },
            ],
          },
          {
            path: 'credentials',
            element: page(CredentialsPage),
          },
          {
            path: 'credentials/create',
            element: page(CredentialsCreatePage),
          },
          {
            path: 'audit-logs',
            element: page(AuditLogsPage),
          },
          {
            path: 'operations',
            element: page(OperationsPage),
          },
          {
            path: 'cluster-agent',
            element: page(ClusterAgentFleetPage),
          },
          {
            path: 'provisioning',
            element: page(ProvisioningPage),
          },
          {
            path: 'provisioning/create',
            element: page(ProvisioningCreatePage),
          },
          {
            path: 'provisioning/:id',
            element: page(VmDetailPage),
          },
          {
            path: 'monitoring',
            element: page(MonitoringPage),
          },
          {
            path: 'workload',
            element: page(WorkloadPage),
          },
          {
            path: 'accelerator',
            element: page(AcceleratorPage),
          },
          {
            path: 'usage',
            element: page(UsagePage),
          },
          {
            path: 'application',
            children: [
              {
                path: 'catalog',
                element: page(ApplicationCatalogPage),
              },
              {
                path: 'catalog/:chartName',
                element: page(CatalogDetailPage),
              },
              {
                path: 'helm-release',
                element: page(ApplicationHelmReleasePage),
              },
              {
                path: 'helm-release/create',
                element: page(HelmReleaseCreatePage),
              },
              {
                path: 'helm-release/:namespace/:name',
                element: page(HelmReleaseDetailPage),
              },
              {
                path: 'helm-repository',
                element: page(ApplicationHelmRepositoryPage),
              },
            ],
          },
        ],
      },
      {
        // 멤버 관리는 admin 전용 — 일반 계정의 직접 URL 진입을 차단한다
        element: <AdminRoute />,
        children: [
          {
            path: 'member-management',
            element: page(MemberManagementPage),
          },
          {
            path: 'member-management/:id',
            element: page(MemberManagementDetailPage),
          },
          {
            path: 'member-management/create',
            element: page(MemberCreatePage),
          },
          {
            path: 'member-management/:id/edit',
            element: page(MemberEditPage),
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
