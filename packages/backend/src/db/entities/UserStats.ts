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

@Entity('user_stats')
export class UserStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { unique: true })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  // Total points earned
  @Column({ type: 'int', default: 0 })
  totalPoints!: number;

  // Current cooking streak (consecutive days)
  @Column({ type: 'int', default: 0 })
  currentStreak!: number;

  // Longest cooking streak achieved
  @Column({ type: 'int', default: 0 })
  longestStreak!: number;

  // Last date user cooked
  @Column({ type: 'date', nullable: true })
  lastCookingDate?: Date;

  // Total recipes created
  @Column({ type: 'int', default: 0 })
  recipesCreated!: number;

  // Total meals cooked/planned
  @Column({ type: 'int', default: 0 })
  mealsCooked!: number;

  // Total meal plans created
  @Column({ type: 'int', default: 0 })
  mealPlansCreated!: number;

  // Times used cooking mode
  @Column({ type: 'int', default: 0 })
  cookingModeUsed!: number;

  // Recipes shared
  @Column({ type: 'int', default: 0 })
  recipesShared!: number;

  // Level (calculated from total points)
  @Column({ type: 'int', default: 1 })
  level!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
