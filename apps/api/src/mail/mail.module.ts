import { Global, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { ConsoleMailService } from "./console-mail.service"
import { MailService } from "./mail.service"
import { ResendMailService } from "./resend-mail.service"

@Global()
@Module({
  providers: [
    ConsoleMailService,
    {
      provide: MailService,
      inject: [ConfigService, ConsoleMailService],
      useFactory: (config: ConfigService, consoleMail: ConsoleMailService) =>
        config.get<string>("RESEND_API_KEY") ? new ResendMailService(config) : consoleMail,
    },
  ],
  exports: [MailService],
})
export class MailModule {}
