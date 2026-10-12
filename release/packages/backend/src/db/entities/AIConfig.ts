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

@Entity('ai_configs')
export class AIConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('varchar')
  provider!: string;

  @Column('varchar', { name: 'api_key', nullable: true })
  apiKey?: string; // Should be encrypted

  @Column('varchar', { nullable: true })
  model?: string;

  @Column('varchar', { name: 'base_url', nullable: true })
  baseUrl?: string;

  @Column('boolean', { default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.aiConfigs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
