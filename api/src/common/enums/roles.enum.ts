export enum Role {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  FIN_ADMIN = 'fin_admin',
  OPS_ADMIN = 'ops_admin',
  PARENT = 'parent',
}

/** Roles a tenant ADMIN is allowed to assign to other users within the same tenant. */
export const TENANT_MANAGEABLE_ROLES: Role[] = [
  Role.ADMIN,
  Role.FIN_ADMIN,
  Role.OPS_ADMIN,
];
