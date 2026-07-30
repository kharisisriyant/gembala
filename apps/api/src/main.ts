import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import { ConfigService } from "@nestjs/config"
import { AppModule } from "./app.module"

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  const config = app.get(ConfigService)

  app.setGlobalPrefix("api")
  app.enableCors({ origin: config.getOrThrow<string>("WEB_ORIGIN") })
  app.enableShutdownHooks()

  await app.listen(config.getOrThrow<number>("PORT"))
}

void bootstrap()
