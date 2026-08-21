import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { GroupsModule } from "../groups/groups.module"
import { TelegramController } from "./telegram.controller"
import { TelegramService } from "./telegram.service"
import { TelegramAgentService } from "./telegram-agent.service"

@Module({
  imports: [MembersModule, GroupsModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramAgentService],
})
export class TelegramModule {}
