import { RESOURCE_CATEGORIES, type ResourceId } from './resource-meta';

interface ResourceNavigationRailProps {
  value: ResourceId;
  onChange: (id: ResourceId) => void;
}

export const ResourceNavigationRail = ({ value, onChange }: ResourceNavigationRailProps) => {
  return (
    <nav
      aria-label="cluster 리소스 navigation"
      className="w-[200px] shrink-0 border-r border-[#e5e7eb] bg-[#fafafa] py-3"
    >
      {RESOURCE_CATEGORIES.map((category) => (
        <div key={category.id} className="mb-3 last:mb-0">
          <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
            {category.label}
          </div>
          <ul className="m-0 list-none p-0">
            {category.items.map((item) => {
              const selected = item.id === value;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onChange(item.id)}
                    aria-current={selected ? 'page' : undefined}
                    className={[
                      'flex w-full cursor-pointer items-center gap-2 border-0 px-4 py-2 text-left text-[13px] transition-colors',
                      selected
                        ? 'border-l-2 border-l-[#2563eb] bg-[#eff6ff] font-semibold text-[#1d4ed8]'
                        : 'border-l-2 border-l-transparent bg-transparent text-[#374151] hover:bg-[#f3f4f6]',
                    ].join(' ')}
                  >
                    {item.label}
                    {!item.namespaced && (
                      <span
                        className="ml-auto rounded bg-[#f3f4f6] px-1.5 py-0.5 text-[9px] font-medium text-[#6b7280]"
                        title="cluster-scoped — namespace selector 영향 없음"
                      >
                        cluster
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};