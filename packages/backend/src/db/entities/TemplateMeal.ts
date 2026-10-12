import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MealPlanTemplate } from './MealPlanTemplate';
import { Recipe } from './Recipe';

@Entity('template_meals')
export class TemplateMeal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'template_id' })
  templateId!: string;

  @ManyToOne(() => MealPlanTemplate, (template) => template.meals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template!: MealPlanTemplate;

  @Column({ name: 'day_offset', type: 'int' })
  dayOffset!: number; // 0, 1, 2, etc.

  @Column('varchar', { name: 'meal_type' })
  mealType!: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId!: string;

  @ManyToOne(() => Recipe, { eager: true })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;

  @Column({ type: 'int', nullable: true })
  servings?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
