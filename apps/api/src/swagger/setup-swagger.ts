import type { INestApplication } from "@nestjs/common"
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from "@nestjs/swagger"
import { cleanupOpenApiDoc } from "nestjs-zod"
import { X_PERMISSION, X_PUBLIC, X_SYSTEM_ADMIN } from "./extensions"

const STATUS_TEXT: Record<string, string> = {
  "200": "OK",
  "201": "Created",
  "204": "No content",
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle("Gembala API")
    .setDescription(
      "Church management API. All routes are served under the `/api` prefix and, unless marked public, require a bearer token from `POST /auth/login`. Data access is further limited by the caller's permissions and tag scope.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)
  annotateSecurity(document)

  SwaggerModule.setup("docs", app, cleanupOpenApiDoc(document), {
    useGlobalPrefix: true,
    jsonDocumentUrl: "docs-json",
    swaggerOptions: { persistAuthorization: true },
  })
}

function annotateSecurity(document: OpenAPIObject): void {
  for (const path of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const op = path[method] as
        | (Record<string, unknown> & {
            description?: string
            security?: Record<string, string[]>[]
            requestBody?: unknown
            responses?: Record<string, unknown>
          })
        | undefined
      if (!op) continue

      const isPublic = op[X_PUBLIC] === true
      const permission = op[X_PERMISSION] as string | undefined
      const systemAdmin = op[X_SYSTEM_ADMIN] === true

      const notes: string[] = []
      if (isPublic) notes.push("**Public** — no authentication required.")
      if (permission) notes.push(`Requires permission \`${permission}\`.`)
      if (systemAdmin) notes.push("Requires the **system admin** role.")
      if (notes.length) op.description = [op.description, notes.join(" ")].filter(Boolean).join("\n\n")

      // Only DTO-backed bodies go through the ZodValidationPipe.
      if (JSON.stringify(op.requestBody ?? "").includes("$ref")) {
        op.responses ??= {}
        op.responses["400"] ??= { description: "Request validation failed" }
      }
      for (const [status, res] of Object.entries(op.responses ?? {})) {
        const response = res as { description?: string }
        if (!response.description) response.description = STATUS_TEXT[status] ?? ""
      }

      op.security = isPublic ? [] : [{ bearer: [] }]
      if (!isPublic) {
        op.responses ??= {}
        op.responses["401"] ??= { description: "Missing, invalid, or expired bearer token" }
        if (permission || systemAdmin) {
          op.responses["403"] ??= { description: "Caller lacks the required permission or scope" }
        }
      }
    }
  }
}
