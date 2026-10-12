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
import { ShoppingListItem } from './ShoppingListItem';
import { MealPlan } from './MealPlan';

@Entity('shopping_lists')
export class ShoppingList {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column('varchar')
  name!: string;

  @Column('uuid', { name: 'meal_plan_id', nullable: true })
  mealPlanId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => User, (user) => user.shoppingLists, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => MealPlan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'meal_plan_id' })
  mealPlan?: MealPlan;

  @OneToMany(() => ShoppingListItem, (item) => item.shoppingList, { cascade: true })
  items!: ShoppingListItem[];
}
