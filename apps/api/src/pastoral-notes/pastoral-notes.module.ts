import { Module } from "@nestjs/common"
import { PastoralNotesController } from "./pastoral-notes.controller"
import { PastoralNotesService } from "./pastoral-notes.service"
import { PastoralNotesRepository } from "./pastoral-notes.repository"

@Module({
  controllers: [PastoralNotesController],
  providers: [PastoralNotesService, PastoralNotesRepository],
  // Exported so the Telegram bot can record notes with source "telegram".
  exports: [PastoralNotesService],
})
export class PastoralNotesModule {}
