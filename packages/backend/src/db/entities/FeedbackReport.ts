import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('feedback_reports')
export class FeedbackReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar')
  type!: string;

  @Column('varchar', { length: 200 })
  summary!: string;

  @Column('text', { nullable: true })
  details?: string;

  @Column('varchar', { length: 500, nullable: true })
  route?: string;

  @Column('text', { name: 'user_agent', nullable: true })
  userAgent?: string;

  @Column('varchar', { length: 64, nullable: true })
  viewport?: string;

  @Column('varchar', { name: 'app_version', length: 64, nullable: true })
  appVersion?: string;

  @Column('uuid', { name: 'user_id', nullable: true })
  userId?: string;

  @Column('varchar', { default: 'open' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
