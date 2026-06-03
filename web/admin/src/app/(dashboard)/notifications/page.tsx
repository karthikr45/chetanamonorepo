"use client";

import { getNotifications } from "@/features/notifications/service/notification.service";
import { formatDate, getStatusStyles, timeAgo } from "@/lib/utils";
import { useEffect, useState } from "react";

const TABS = [
  { id: "template", label: "Template" },
  { id: "discount", label: "Discount" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const Notifications = () => {
  const [activeTab, setActiveTab] = useState<TabId>("template");
  const [notificationData, setNotificationData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      try {
        // const branch = "hyd";
        // const role = "Admin";
        const branch = localStorage.getItem("branch") ? "hyd" : "hyd";
        const role = localStorage.getItem("role") ? "Admin" : "Admin";

        const response = await getNotifications(role, branch);
        setNotificationData(response);
      } catch {
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // ✅ Filter notifications based on tab
  const filteredNotifications =
    notificationData?.notifications?.filter((n: any) => {
      if (activeTab === "template") return n.type === "templateApproval";
      if (activeTab === "discount") return n.type === "discountApproval";
      return true;
    }) || [];
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 🔹 Tabs */}
      <div
        className="flex items-center gap-1 rounded-xl border p-1"
        style={{
          backgroundColor: "#f3f4f6",
          borderColor: "var(--app-divider)",
        }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`relative rounded-lg px-5 py-2 text-sm font-medium transition-all duration-200 w-1/2 ${
              activeTab === id
                ? "shadow-sm"
                : "hover:bg-[var(--app-nav-hover-bg)]"
            }`}
            style={
              activeTab === id
                ? {
                    backgroundColor: "var(--app-card-bg)",
                    color: "var(--app-text-primary)",
                  }
                : { color: "var(--app-text-secondary)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* 🔹 Content */}
      <div className="space-y-3">
        {loading && <p className="text-center text-gray-500">Loading...</p>}

        {!loading && filteredNotifications?.length === 0 && (
          <p className="text-center text-gray-400">No notifications found</p>
        )}

        {filteredNotifications?.map((notification: any, index: number) => (
          <div
            key={index}
            className="rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition"
          >
            {notification?.type === "templateApproval" && (
              <>
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {notification?.templateDetails?.title}
                    </h3>

                    <p className="text-sm text-gray-600 mt-1">
                      {notification?.templateDetails?.message}
                    </p>
                  </div>
                  {/* <p>{timeAgo(notification.date)}</p> */}
                  <p className="text-sm text-gray-600 mt-1">{formatDate(notification.date)}</p>
                </div>

                <div className="flex justify-between mt-3 text-xs text-gray-500">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusStyles(
                      notification.templateDetails?.status,
                    )}`}
                  >
                    {notification.templateDetails?.status}
                  </span>

                  <span>{notification?.templateDetails?.branch}</span>
                </div>
              </>
            )}

            {notification.type === "discountApproval" && (
              <p className="text-sm text-gray-600 mt-1">
                {notification?.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Notifications;
