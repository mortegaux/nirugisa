import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { RecipeCollection } from './RecipeCollection';
import { Recipe } from './Recipe';

@Entity('recipe_collection_items')
@Unique(['collectionId', 'recipeId'])
export class RecipeCollectionItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'collection_id' })
  collectionId!: string;

  @Column('uuid', { name: 'recipe_id' })
  recipeId!: string;

  @CreateDateColumn({ name: 'added_at' })
  addedAt!: Date;

  @ManyToOne(() => RecipeCollection, (collection) => collection.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'collection_id' })
  collection!: RecipeCollection;

  @ManyToOne(() => Recipe, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipe_id' })
  recipe!: Recipe;
}
