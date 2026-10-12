import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { UserRole } from '@nommable/shared';

@Entity('user_invitations')
export class UserInvitation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { unique: true })
  email!: string;

  @Column('uuid', { name: 'invited_by_id' })
  invitedById!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'invited_by_id' })
  invitedBy!: User;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column('varchar', { unique: true })
  token!: string;

  @Column('datetime', { name: 'expires_at' })
  expiresAt!: Date;

  @Column('boolean', { default: false })
  accepted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
