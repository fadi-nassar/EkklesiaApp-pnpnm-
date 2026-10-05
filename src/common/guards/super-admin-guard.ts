import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || 'superAdmin' !== user.role) {
      throw new ForbiddenException(
        'Access denied. Super admin privileges required.',
      );
    }

    return true;
  }
}
