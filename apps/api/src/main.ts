import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { ConfigService } from "@nestjs/config"
import { AppModule } from "./app.module"
import { setupSwagger } from "./swagger/setup-swagger"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix("api")
  app.enableCors({ origin: config.getOrThrow<string>("WEB_ORIGIN") })
  app.enableShutdownHooks()
  setupSwagger(app)

  await app.listen(config.getOrThrow<number>("PORT"))
}

void bootstrap()
