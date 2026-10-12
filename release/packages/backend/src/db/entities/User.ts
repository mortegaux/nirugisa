import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Recipe } from './Recipe';
import { MealPlan } from './MealPlan';
import { ShoppingList } from './ShoppingList';
import { AIConfig } from './AIConfig';
import { UserRole } from '@nommable/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('varchar', { unique: true })
  email!: string;

  @Column('varchar', { unique: true })
  username!: string;

  @Column('varchar', { name: 'first_name', nullable: true })
  firstName?: string;

  @Column('varchar', { name: 'last_name', nullable: true })
  lastName?: string;

  @Column('varchar', { name: 'profile_photo_url', nullable: true })
  profilePhotoUrl?: string;

  @Column('varchar', { name: 'password_hash' })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column('boolean', { name: 'is_system_admin', default: false })
  isSystemAdmin!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => Recipe, (recipe) => recipe.user)
  recipes!: Recipe[];

  @OneToMany(() => MealPlan, (mealPlan) => mealPlan.user)
  mealPlans!: MealPlan[];

  @OneToMany(() => ShoppingList, (shoppingList) => shoppingList.user)
  shoppingLists!: ShoppingList[];

  @OneToMany(() => AIConfig, (aiConfig) => aiConfig.user)
  aiConfigs!: AIConfig[];
}
