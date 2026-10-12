import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Recipe } from './Recipe';

@Entity('ingredients')
export class Ingredient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId!: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  quantity?: number;

  @Column('varchar', { nullable: true })
  unit?: string;

  @Column('varchar')
  name!: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('varchar', { nullable: true })
  section?: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  estimatedCost?: number;

  @Column('int', { default: 0 })
  order!: number;

  @ManyToOne(() => Recipe, (recipe) => recipe.ingredients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;
}
