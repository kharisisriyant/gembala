import { Module } from "@nestjs/common"
import { InstanceTypesController } from "./instance-types.controller"
import { InstanceTypesService } from "./instance-types.service"
import { RoleTemplatesController } from "./role-templates.controller"
import { RoleTemplatesService } from "./role-templates.service"
import { ScheduleEventsController } from "./schedule-events.controller"
import { ScheduleEventsService } from "./schedule-events.service"
import { ServiceInstancesController } from "./service-instances.controller"
import { ServiceInstancesService } from "./service-instances.service"
import { RoleAssignmentsController } from "./role-assignments.controller"
import { RoleAssignmentsService } from "./role-assignments.service"

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
    RoleTemplatesService,
    ScheduleEventsService,
    ServiceInstancesService,
    RoleAssignmentsService,
  ],
})
export class SchedulingModule {}
