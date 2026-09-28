// Route decorators (Public, RequirePermission, RequireSystemAdmin) tag each
// operation with these vendor extensions; setupSwagger turns them into the
// security requirements and descriptions Swagger UI shows.
export const X_PUBLIC = "x-public"
export const X_PERMISSION = "x-required-permission"
export const X_SYSTEM_ADMIN = "x-system-admin"
