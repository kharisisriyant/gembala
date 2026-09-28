import { Module } from "@nestjs/common"
import { MembersModule } from "../members/members.module"
import { CoursesController } from "./courses.controller"
import { CoursesService } from "./courses.service"
import { CoursesRepository } from "./courses.repository"
import { JourneyController } from "./journey.controller"
import { JourneyService } from "./journey.service"
import { JourneyRepository } from "./journey.repository"

@Module({
  imports: [MembersModule],
  controllers: [CoursesController, JourneyController],
  providers: [CoursesService, CoursesRepository, JourneyService, JourneyRepository],
})
export class JourneyModule {}
