import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MealPlan } from './MealPlan';
import { Recipe } from './Recipe';

@Entity('meal_plan_recipes')
export class MealPlanRecipe {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'meal_plan_id' })
  mealPlanId!: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId!: string;

  @Column({ type: 'date' })
  date!: Date;

  @Column('varchar', { name: 'meal_type' })
  mealType!: string;

  @Column('int', { default: 1 })
  servings!: number;

  @Column('text', { nullable: true })
  notes?: string;

  @ManyToOne(() => MealPlan, (mealPlan) => mealPlan.meals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meal_plan_id' })
  mealPlan!: MealPlan;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;
}
