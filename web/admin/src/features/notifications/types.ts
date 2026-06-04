/** A single notification row visible to the current user (role-scoped by the API). */
export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  /** Category: 'approval' | 'template' | 'announcement' | 'chat' | 'general' | … */
  type: string;
  /** In-app route to open when the notification is clicked. */
  linkUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  recipientId: string | null;
  recipientRole: string | null;
}

/** Display metadata per notification type — label + accent colours for the chip. */
export const NOTIFICATION_TYPE_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  approval: { label: "Approval", color: "#92400e", bg: "#fef3c7" },
  template: { label: "Template", color: "#3730a3", bg: "#e0e7ff" },
  announcement: { label: "Announcement", color: "#155e75", bg: "#cffafe" },
  chat: { label: "Message", color: "#166534", bg: "#dcfce7" },
  general: { label: "General", color: "#475569", bg: "#e2e8f0" },
};

export function notificationTypeMeta(type: string) {
  return NOTIFICATION_TYPE_META[type] ?? NOTIFICATION_TYPE_META.general;
}
