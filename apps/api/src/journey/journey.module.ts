import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { CoursesController } from "./courses.controller"
import { CoursesService } from "./courses.service"
import { CoursesRepository } from "./courses.repository"
import { JourneyController } from "./journey.controller"
import { JourneyService } from "./journey.service"
import { JourneyRepository } from "./journey.repository"
import { JourneyStagesController } from "./journey-stages.controller"
import { JourneyStagesRepository } from "./journey-stages.repository"
import { JourneyStagesService } from "./journey-stages.service"

@Module({
  imports: [MembersModule],
  controllers: [CoursesController, JourneyController, JourneyStagesController],
  providers: [CoursesService, CoursesRepository, JourneyService, JourneyRepository, JourneyStagesService, JourneyStagesRepository],
})
export class JourneyModule {}
