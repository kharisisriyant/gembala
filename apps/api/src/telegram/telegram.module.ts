import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { GroupsModule } from "../groups/groups.module"
import { PastoralNotesModule } from "../pastoral-notes/pastoral-notes.module"
import { TelegramController } from "./telegram.controller"
import { TelegramService } from "./telegram.service"
import { TelegramAgentService } from "./telegram-agent.service"
import { TelegramRepository } from "./telegram.repository"

@Module({
  imports: [MembersModule, GroupsModule, PastoralNotesModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramAgentService, TelegramRepository],
  exports: [TelegramService],
})
export class TelegramModule {}
