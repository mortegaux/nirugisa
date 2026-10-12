import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  // Achievement identifier (e.g., 'first_recipe', 'week_streak_7')
  @Column({ type: 'varchar', length: 100 })
  achievementKey!: string;

  // Points awarded for this achievement
  @Column({ type: 'int', default: 0 })
  points!: number;

  // Progress towards achievement (for multi-step achievements)
  @Column({ type: 'int', default: 0 })
  progress!: number;

  // Target needed to complete achievement
  @Column({ type: 'int', default: 1 })
  target!: number;

  // Whether achievement is completed
  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  // Date when achievement was completed
  @Column({ type: 'datetime', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
