import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Document, Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { User, UserDocument } from '../users/schema/user.schema.js';
import { Session } from './schema/session.schema.js';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { parseDurationMs } from '../../common/utils/parse-duration-ms.js';

type SessionDocument = Session & Document;

const DEFAULT_REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private refreshTtlMs(): number {
    return parseDurationMs(
      this.configService.get<string>('REFRESH_TTL'),
      DEFAULT_REFRESH_TTL_MS,
    );
  }

  async login(user: UserDocument, deviceId: string) {
    const payload = { sub: user._id, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomBytes(32).toString('hex');

    await this.sessionModel.findOneAndDelete({ userId: user._id, deviceId });

    const session = new this.sessionModel({
      userId: user._id,
      deviceId: deviceId,
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      refreshTokenHash: crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex'),
    });
    await session.save();
    return { accessToken, refreshToken, sessionId: session._id };
  }

  async register(
    userData: Pick<
      User,
      | 'username'
      | 'email'
      | 'passwordHash'
      | 'homeInstitutionId'
      | 'role'
      | 'rite'
    >,
    deviceId: string,
  ) {
    const newUser = new this.userModel(userData);
    newUser.passwordHash = await bcrypt.hash(newUser.passwordHash, 12);

    try {
      await newUser.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException(
          'Email already registered, try logging in instead',
        );
      }
      throw error;
    }

    return this.login(newUser, deviceId);
  }
  async refreshToken(refreshToken: string) {
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const session = await this.sessionModel.findOne({ refreshTokenHash });
    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.userModel.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload = { sub: user._id, role: user.role };
    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = crypto.randomBytes(32).toString('hex');

    session.refreshTokenHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');
    session.expiresAt = new Date(Date.now() + this.refreshTtlMs());
    await session.save();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }
  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      return null;
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return null;
    }
    return user;
  }
  async logout(sessionId: string, userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    await this.sessionModel.deleteOne({ _id: sessionId, userId: userObjectId });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    // 400, not 401: a 401 would make the app try to refresh and log the user out
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    // revoke every refresh token, so a stolen session cannot outlive the change
    await this.sessionModel.deleteMany({ userId: user._id });
    return { message: 'Password changed. Please log in again.' };
  }
}
