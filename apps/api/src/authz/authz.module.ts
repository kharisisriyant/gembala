import { Global, Module } from "@nestjs/common"
import { AuthContextService } from "./auth-context.service"
import { AuthContextRepository } from "./auth-context.repository"
import { ScopeService } from "./scope.service"
import { ScopeRepository } from "./scope.repository"
import { AuthModule } from "../auth/auth.module"

@Global()
@Module({
  imports: [AuthModule],
  providers: [ScopeService, ScopeRepository, AuthContextService, AuthContextRepository],
  exports: [ScopeService, AuthContextService],
})
export class AuthzModule {}
