import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());

  const appEnv = configService.get<string>('APP_ENV');
  if (appEnv === 'development') {
    app.enableCors({ origin: '*' });
  } else {
    const origins = (configService.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
    app.enableCors({ origin: origins });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  if (appEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('EkklesiaApp API')
      .setDescription('EkklesiaApp backend API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
