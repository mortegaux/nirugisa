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
import { Ingredient } from './Ingredient';

@Entity('recipes')
export class Recipe {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('varchar')
  title!: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column('int', { nullable: true })
  servings?: number;

  @Column('int', { name: 'prep_time', nullable: true })
  prepTime?: number;

  @Column('int', { name: 'cook_time', nullable: true })
  cookTime?: number;

  @Column('int', { name: 'total_time', nullable: true })
  totalTime?: number;

  @Column('varchar', { nullable: true })
  difficulty?: string;

  @Column('varchar', { name: 'image_url', nullable: true })
  imageUrl?: string;

  @Column('varchar', { name: 'source_url', nullable: true })
  sourceUrl?: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('simple-json', { nullable: true })
  instructions?: string[];

  @Column('simple-json', { nullable: true })
  categories?: string[];

  @Column('simple-json', { nullable: true })
  tags?: string[];

  @Column('simple-json', { nullable: true })
  nutrition?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };

  @Column('boolean', { name: 'is_ai_generated', default: false })
  isAiGenerated!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.recipes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => Ingredient, (ingredient) => ingredient.recipe, { cascade: true })
  ingredients!: Ingredient[];
}
