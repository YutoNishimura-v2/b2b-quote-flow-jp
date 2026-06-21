import type { CSSProperties, ReactNode } from "react";

const toneStyles: Record<string, CSSProperties> = {
  neutral: {
    background: "#f6f6f7",
    borderColor: "#d4d4d8",
    color: "#3f3f46",
  },
  new: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1d4ed8",
  },
  reviewing: {
    background: "#fffbeb",
    borderColor: "#fde68a",
    color: "#92400e",
  },
  success: {
    background: "#ecfdf3",
    borderColor: "#bbf7d0",
    color: "#166534",
  },
  critical: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#991b1b",
  },
  info: {
    background: "#f0f9ff",
    borderColor: "#bae6fd",
    color: "#075985",
  },
};

export const pageStackStyle: CSSProperties = {
  display: "grid",
  gap: 18,
};

export const cardGridStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

export const compactGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

export const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
};

export const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 860,
};

export const thStyle: CSSProperties = {
  borderBottom: "1px solid #e4e4e7",
  color: "#52525b",
  fontSize: 12,
  fontWeight: 700,
  padding: "10px 8px",
  textAlign: "left",
};

export const tdStyle: CSSProperties = {
  borderBottom: "1px solid #f1f1f1",
  padding: "12px 8px",
  verticalAlign: "top",
};

export const inputStyle: CSSProperties = {
  border: "1px solid #c9cccf",
  borderRadius: 6,
  boxSizing: "border-box",
  font: "inherit",
  padding: "9px 11px",
  width: "100%",
};

export const primaryButtonStyle: CSSProperties = {
  background: "#202223",
  border: "1px solid #202223",
  borderRadius: 6,
  color: "#ffffff",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 650,
  minHeight: 40,
  padding: "9px 14px",
};

export const secondaryButtonStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #c9cccf",
  borderRadius: 6,
  color: "#202223",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 600,
  minHeight: 36,
  padding: "8px 12px",
};

export const mutedTextStyle: CSSProperties = {
  color: "#616161",
  fontSize: 13,
  lineHeight: 1.55,
  margin: 0,
};

export const sectionTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.4,
  margin: 0,
};

export const fieldLabelStyle: CSSProperties = {
  color: "#616161",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  margin: 0,
};

export const fieldValueStyle: CSSProperties = {
  fontSize: 14,
  lineHeight: 1.5,
  margin: "3px 0 0",
};

export function Card({
  title,
  children,
  action,
}: {
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e4e4e7",
        borderRadius: 8,
        padding: 18,
      }}
    >
      {title || action ? (
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          {title ? <h2 style={sectionTitleStyle}>{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  helpText,
}: {
  label: string;
  value: ReactNode;
  helpText?: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e4e4e7",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <p style={{ ...mutedTextStyle, fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 750, margin: "6px 0 0" }}>
        {value}
      </p>
      {helpText ? <p style={{ ...mutedTextStyle, marginTop: 6 }}>{helpText}</p> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p style={fieldLabelStyle}>{label}</p>
      <div style={fieldValueStyle}>{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "new" | "reviewing" | "success" | "critical" | "info";
}) {
  return (
    <span
      style={{
        ...toneStyles[tone],
        border: "1px solid",
        borderRadius: 999,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        padding: "5px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "NEW"
      ? "new"
      : status === "REVIEWING"
        ? "reviewing"
        : status === "QUOTE_CREATED" || status === "SENT" || status === "WON"
          ? "success"
          : status === "LOST"
            ? "neutral"
            : "info";

  return <Badge tone={tone}>{quoteStatusLabel(status)}</Badge>;
}

export function QuoteFlag({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Badge tone={active ? "success" : "neutral"}>
      {children}: {active ? "あり" : "なし"}
    </Badge>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "critical" | "neutral";
  children: ReactNode;
}) {
  return (
    <div
      style={{
        ...toneStyles[tone],
        border: "1px solid",
        borderRadius: 8,
        lineHeight: 1.55,
        padding: 12,
      }}
    >
      {children}
    </div>
  );
}

export function quoteStatusLabel(status: string) {
  switch (status) {
    case "NEW":
      return "新規";
    case "REVIEWING":
      return "対応中";
    case "QUOTE_CREATED":
      return "下書き注文作成済み";
    case "SENT":
      return "見積送付済み";
    case "WON":
      return "受注";
    case "LOST":
      return "失注";
    default:
      return status || "-";
  }
}

export function eventTypeLabel(type: string) {
  switch (type) {
    case "quote_created":
      return "見積依頼作成";
    case "merchant_notification_sent":
      return "通知送信";
    case "merchant_notification_skipped":
      return "通知スキップ";
    case "merchant_notification_failed":
      return "通知失敗";
    case "draft_order_created":
      return "下書き注文作成";
    case "quote_updated":
      return "ステータス更新";
    case "settings_updated":
      return "設定更新";
    default:
      return type;
  }
}

export function formatDateTime(value: Date | string | number | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function isToday(value: Date | string | number | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
