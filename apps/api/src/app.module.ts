import { Module } from "@nestjs/common"
import { APP_GUARD, APP_PIPE } from "@nestjs/core"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { JwtModule, type JwtSignOptions } from "@nestjs/jwt"
import { ZodValidationPipe } from "nestjs-zod"
import { validateEnv } from "./config/env"
import { DrizzleModule } from "./db/drizzle.module"
import { AuthzModule } from "./authz/authz.module"
import { JwtAuthGuard } from "./authz/jwt-auth.guard"
import { RolesGuard } from "./authz/roles.guard"
import { MailModule } from "./mail/mail.module"
import { AuthModule } from "./auth/auth.module"
import { TagsModule } from "./tags/tags.module"
import { MembersModule } from "./members/members.module"
import { GroupsModule } from "./groups/groups.module"
import { DashboardModule } from "./dashboard/dashboard.module"
import { InvitesModule } from "./invites/invites.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: config.getOrThrow<string>("JWT_EXPIRES_IN") as JwtSignOptions["expiresIn"],
        },
      }),
    }),
    DrizzleModule,
    AuthzModule,
    MailModule,
    AuthModule,
    TagsModule,
    MembersModule,
    GroupsModule,
    DashboardModule,
    InvitesModule,
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
