import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { TemplateMeal } from './TemplateMeal';

@Entity('meal_plan_templates')
export class MealPlanTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('varchar')
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'int' })
  duration!: number; // Number of days

  @Column('simple-array', { nullable: true })
  tags?: string[];

  @OneToMany(() => TemplateMeal, (meal) => meal.template, {
    cascade: true,
    eager: true,
  })
  meals!: TemplateMeal[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
