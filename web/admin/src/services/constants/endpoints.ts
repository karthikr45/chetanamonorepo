/**
 * Admin web → API endpoint paths.
 * Routes are relative to NEXT_PUBLIC_API_BASE_URL (which already
 * includes the NestJS '/api' global prefix).
 */

export const API_ENDPOINTS = {
  auth: {
    /** POST: legacy alias kept for typed callers. Real path: /auth/signin */
    verifyLogin: "/auth/signin",
    signin: "/auth/signin",
    logout: "/auth/logout",
    refreshToken: "/auth/refresh",
    me: "/auth/me",
  },
  user: {
    profile: "/auth/me",
    update: "/users",
  },
  studentsDetails: {
    /** GET: list students with fees (paginated). */
    getStudentsDetailsByBranch: "/students",
    /** GET/PATCH/PUT usage: /students/:id */
    getStudentById: "/students",
    /** PATCH usage: /students/:id  (partial update) */
    updateStudentById: "/students",
    /** GET: list academic years for the current tenant. */
    getAcademicYears: "/academic-years",
    /** GET: /students/by-admission/with-fees?admissionNumber=...&academicYear=... */
    getStudentByAdmission: "/students/by-admission/with-fees",
    /** POST: bulk-apply a penalty for a term (all / selected admissions). */
    addPenalty: "/fees/penalty/add",
    /** POST: bulk-waive a penalty for a term (all / selected admissions). */
    waivePenalty: "/fees/penalty/waive",
    /** POST: parent-portal-style direct order creation (admin "Pay Now" flow). */
    createOrder: "/payments/create-order",
    /** POST: validate an Excel before commit. */
    checkTermDetails: "/students/upload/validate",
    /** POST: confirm and persist the previously-validated Excel. */
    uploadStudentData: "/students/upload/confirm",
    /** GET: latest 5 students added to the tenant. */
    getLatestStudents: "/students/latest",
    /** GET: download the .xlsx upload template */
    uploadTemplate: "/students/upload/template",
    /** GET: notifications surfaced on the admin dashboard. */
    getAdminNotifications: "/notifications",
  },
  notifications: {
    list: "/notifications",
    unreadCount: "/notifications/unread-count",
    markAllRead: "/notifications/read-all",
    /** PATCH usage: /notifications/:id/read */
    markRead: "/notifications",
  },
  templates: {
    getTemplates: "/templates",
    saveTemplate: "/templates",
  },
  tenants: {
    saveTenant: "/tenants/save",
    getTenants: "/tenants/get-tenant",
    /** GET usage: /tenants/get-tenant/:id */
    getTenantById: "/tenants/get-tenant",
    saveTenantConfig: "/tenant-configs/upsert",
    /** GET usage: /tenant-configs/tenant/:tenantId */
    getTenantConfigsByTenantId: "/tenant-configs/tenant",
    /** GET/DELETE usage: /tenant-configs/:id */
    deleteTenantConfigById: "/tenant-configs",
    /** PATCH usage: /tenants/:id  (the API uses generic /:id, not /update/:id) */
    updateTenant: "/tenants",
  },
  admins: {
    saveAdmin: "/admins/save",
    getAdmins: "/admins/get-admin",
  },
  payments: {
    createOrder: "/payments/create-order",
    verifyPayment: "/payments/verify-payment",
  },
  payNow: {
    /** Admin-side "Pay Now" lookup. Same as parent's /by-admission/with-fees. */
    getStudentWithFees: "/students/by-admission/with-fees",
  },
  fees: {
    getDashboardStats: "/fees/dashboard/stats",
  },
  parents: {
    list: "/parents",
    create: "/parents",
    /** Usage: /parents/:id */
    detail: "/parents",
    /** Usage: /parents/:id */
    update: "/parents",
    /** Usage: /parents/:id */
    remove: "/parents",
    /** Usage: /parents/:id/students */
    addStudent: "/parents",
    /** Usage: /parents/:id/students/:linkId */
    removeStudent: "/parents",
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
