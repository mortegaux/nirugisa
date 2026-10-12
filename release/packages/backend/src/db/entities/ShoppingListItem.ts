import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ShoppingList } from './ShoppingList';
import { Recipe } from './Recipe';

@Entity('shopping_list_items')
export class ShoppingListItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'shopping_list_id' })
  shoppingListId!: string;

  @Column('varchar')
  name!: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  quantity?: number;

  @Column('varchar', { nullable: true })
  unit?: string;

  @Column('varchar', { nullable: true })
  category?: string;

  @Column('boolean', { default: false })
  checked!: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('uuid', { name: 'recipe_id', nullable: true })
  recipeId?: string;

  @Column('int', { default: 0 })
  order!: number;

  @ManyToOne(() => ShoppingList, (list) => list.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shopping_list_id' })
  shoppingList!: ShoppingList;

  @ManyToOne(() => Recipe, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recipe_id' })
  recipe?: Recipe;
}
