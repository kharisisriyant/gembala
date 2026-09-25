import { Module } from "@nestjs/common"
import { InstanceTypesController } from "./instance-types.controller"
import { InstanceTypesService } from "./instance-types.service"
import { InstanceTypesRepository } from "./instance-types.repository"
import { RoleTemplatesController } from "./role-templates.controller"
import { RoleTemplatesService } from "./role-templates.service"
import { RoleTemplatesRepository } from "./role-templates.repository"
import { ScheduleEventsController } from "./schedule-events.controller"
import { ScheduleEventsService } from "./schedule-events.service"
import { ScheduleEventsRepository } from "./schedule-events.repository"
import { ServiceInstancesController } from "./service-instances.controller"
import { ServiceInstancesService } from "./service-instances.service"
import { ServiceInstancesRepository } from "./service-instances.repository"
import { RoleAssignmentsController } from "./role-assignments.controller"
import { RoleAssignmentsService } from "./role-assignments.service"
import { RoleAssignmentsRepository } from "./role-assignments.repository"

@Module({
  controllers: [
    InstanceTypesController,
    RoleTemplatesController,
    ScheduleEventsController,
    ServiceInstancesController,
    RoleAssignmentsController,
  ],
  providers: [
    InstanceTypesService,
    InstanceTypesRepository,
    RoleTemplatesService,
    RoleTemplatesRepository,
    ScheduleEventsService,
    ScheduleEventsRepository,
    ServiceInstancesService,
    ServiceInstancesRepository,
    RoleAssignmentsService,
    RoleAssignmentsRepository,
  ],
})
export class SchedulingModule {}
