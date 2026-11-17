import { Module } from "@nestjs/common"
import { GoogleModule } from "../google/google.module"
import { RoomsController } from "./rooms.controller"
import { RoomsService } from "./rooms.service"
import { RoomsRepository } from "./rooms.repository"

@Module({
  imports: [GoogleModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsRepository],
  exports: [RoomsService],
})
export class RoomsModule {}
