import { Global, Module } from "@nestjs/common"
import { ConsoleMailService } from "./console-mail.service"
import { MailService } from "./mail.service"

@Global()
@Module({
  providers: [{ provide: MailService, useClass: ConsoleMailService }],
  exports: [MailService],
})
export class MailModule {}
