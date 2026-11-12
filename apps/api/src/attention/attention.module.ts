import { Module } from "@nestjs/common"
import { CareRequestsModule } from "../care-requests/care-requests.module"
import { GroupsModule } from "../groups/groups.module"
import { JourneyModule } from "../journey/journey.module"
import { MembersModule } from "../members/members.module"
import { AttentionService } from "./attention.service"

@Module({
  imports: [MembersModule, GroupsModule, CareRequestsModule, JourneyModule],
  providers: [AttentionService],
  exports: [AttentionService],
})
export class AttentionModule {}
