export type DashboardStatItem = {
  total: number;
  thisMonth: number;
  previousMonth: number;
  percentageChange: number;
  trend: "increase" | "decrease" | "no_change";
};

export type DashboardStatsData = {
  students: DashboardStatItem;
  amount: DashboardStatItem;
  penalty: DashboardStatItem;
};

export type DashboardStatsApiResponse = {
  success: boolean;
  data: DashboardStatsData;
  message: string;
};
