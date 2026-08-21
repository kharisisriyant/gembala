import { Global, Module } from "@nestjs/common"
import { AuthContextService } from "./auth-context.service"
import { ScopeService } from "./scope.service"

@Global()
@Module({
  providers: [ScopeService, AuthContextService],
  exports: [ScopeService, AuthContextService],
})
export class AuthzModule {}
