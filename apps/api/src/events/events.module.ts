import { Module } from "@nestjs/common"
import { GoogleModule } from "../google/google.module"
import { EventsController } from "./events.controller"
import { EventsService } from "./events.service"
import { EventsRepository } from "./events.repository"

@Module({
  imports: [GoogleModule],
  controllers: [EventsController],
  providers: [EventsService, EventsRepository],
  exports: [EventsService],
})
export class EventsModule {}
