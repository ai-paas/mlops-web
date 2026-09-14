// 8 CSP 선택 카드 — brand color + 실제 Simple Icons CDN 의 brand 로고 (CC0).
// dropdown 대신 시각적 그리드. 선택 상태 = 강한 outline + 체크 표시.
//
// Simple Icons CDN: https://cdn.simpleicons.org/<slug>/<hex-color>
//   - slug: 공식 brand slug (소문자, hyphen 없음)
//   - color: 6-digit hex (without #). 흰색 = "ffffff"

interface CspOption {
  value: string;
  label: string;
  description: string;
  color: string;          // brand background
  textColor?: string;     // contrast (default white)
  iconSlug: string;       // Simple Icons brand slug — https://simpleicons.org
}

export const CSP_OPTIONS: CspOption[] = [
  {
    value: 'AWS',
    label: 'AWS',
    description: 'Amazon Web Services',
    color: '#FF9900',
    iconSlug: 'amazonwebservices',
  },
  {
    value: 'GCP',
    label: 'GCP',
    description: 'Google Cloud Platform',
    color: '#4285F4',
    iconSlug: 'googlecloud',
  },
  {
    value: 'AZURE',
    label: 'Azure',
    description: 'Microsoft Azure',
    color: '#0078D4',
    iconSlug: 'microsoftazure',
  },
  {
    value: 'OPENSTACK',
    label: 'OpenStack',
    description: 'OpenStack Cloud',
    color: '#ED1944',
    iconSlug: 'openstack',
  },
  {
    value: 'ALIBABA',
    label: 'Alibaba',
    description: 'Alibaba Cloud',
    color: '#FF6A00',
    iconSlug: 'alibabacloud',
  },
  {
    value: 'OCI',
    label: 'OCI',
    description: 'Oracle Cloud Infrastructure',
    color: '#C74634',
    iconSlug: 'oracle',
  },
  {
    value: 'DIGITALOCEAN',
    label: 'DigitalOcean',
    description: 'DigitalOcean',
    color: '#0080FF',
    iconSlug: 'digitalocean',
  },
];

interface CspSelectorProps {
  value?: string;
  onChange: (value: string) => void;
}

export const CspSelector = ({ value, onChange }: CspSelectorProps) => {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
      }}
    >
      {CSP_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '14px 10px',
              borderRadius: 8,
              border: selected ? `2px solid ${opt.color}` : '1px solid #e5e7eb',
              background: selected ? `${opt.color}10` : '#fff',
              cursor: 'pointer',
              transition: 'border-color 120ms, background 120ms, transform 120ms',
              outline: 'none',
            }}
            onMouseDown={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
            }}
          >
            {selected && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: opt.color,
                  color: '#fff',
                  fontSize: 12,
                  lineHeight: '18px',
                  textAlign: 'center',
                  fontWeight: 700,
                }}
              >
                ✓
              </span>
            )}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: opt.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={`https://cdn.simpleicons.org/${opt.iconSlug}/${(opt.textColor ?? '#fff').replace('#', '')}`}
                alt={`${opt.label} logo`}
                width={22}
                height={22}
                loading="lazy"
                onError={(e) => {
                  // CDN 미동작 시 fallback — label 앞 1~2 글자만 표시.
                  const target = e.currentTarget as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent && !parent.querySelector('[data-icon-fallback]')) {
                    const span = document.createElement('span');
                    span.dataset.iconFallback = '1';
                    span.style.color = opt.textColor ?? '#fff';
                    span.style.fontSize = '14px';
                    span.style.fontWeight = '700';
                    span.style.letterSpacing = '-0.02em';
                    span.textContent = opt.label.slice(0, 3).toUpperCase();
                    parent.appendChild(span);
                  }
                }}
              />
            </div>
            <div style={{ textAlign: 'center', width: '100%', marginTop: 4 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#1a1a1a',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {opt.label}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#666',
                  marginTop: 2,
                  lineHeight: 1.3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {opt.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

// CSP 별 credentials 입력 예제 — backend 의 ProvisioningCredentialRules 와 일치.
export const CSP_PLACEHOLDERS: Record<string, string> = {
  AWS: `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

또는 JSON:
{"AWS_ACCESS_KEY_ID":"AKIA...","AWS_SECRET_ACCESS_KEY":"..."}`,
  GCP: `# 둘 중 하나
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}

# 또는 backend 가 접근 가능한 파일 경로
GOOGLE_APPLICATION_CREDENTIALS=/etc/gcp/sa-key.json`,
  AZURE: `ARM_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ARM_CLIENT_SECRET=...
ARM_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ARM_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
  OPENSTACK: `OS_AUTH_URL=https://identity.example.com:5000/v3
OS_USERNAME=admin
OS_PASSWORD=...
OS_PROJECT_NAME=admin
OS_USER_DOMAIN_NAME=Default
OS_PROJECT_DOMAIN_NAME=Default`,
  ALIBABA: `ALICLOUD_ACCESS_KEY=LTAI...
ALICLOUD_SECRET_KEY=...`,
  OCI: `TF_VAR_tenancy_ocid=ocid1.tenancy.oc1..aaaaaaaa...
TF_VAR_user_ocid=ocid1.user.oc1..aaaaaaaa...
TF_VAR_fingerprint=aa:bb:cc:dd:ee:ff:00:11:22:33:44:55:66:77:88:99
TF_VAR_region=ap-seoul-1

# 둘 중 하나 — inline 또는 path
TF_VAR_private_key=-----BEGIN PRIVATE KEY-----
MIIEvQIB...
-----END PRIVATE KEY-----
또는
TF_VAR_private_key_path=/etc/oci/api-key.pem`,
  DIGITALOCEAN: `DIGITALOCEAN_TOKEN=dop_v1_...

# 또는 (구버전 호환)
DIGITALOCEAN_ACCESS_TOKEN=dop_v1_...`,
};