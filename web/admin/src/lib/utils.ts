/**
 * Merge class names. Pass strings; falsy values are filtered out.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}


export const timeAgo = (dateString: string) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day ago`;
};

export const  formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ✅ Status Badge Color
export const getStatusStyles = (status: string) => {
  switch (status?.toLowerCase()) {
    case "approved":
      return "bg-green-100 text-green-600";
    case "rejected":
      return "bg-red-100 text-red-600";
    case "pending":
      return "bg-yellow-100 text-yellow-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
};