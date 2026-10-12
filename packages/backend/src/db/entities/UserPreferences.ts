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

@Entity('user_preferences')
export class UserPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  // Dietary restrictions
  @Column('simple-array', { nullable: true })
  dietaryRestrictions?: string[]; // e.g., ['vegetarian', 'gluten-free', 'dairy-free']

  // Food allergies (critical - should warn user)
  @Column('simple-array', { nullable: true })
  allergies?: string[]; // e.g., ['peanuts', 'shellfish', 'eggs']

  // Foods the user dislikes
  @Column('simple-array', { nullable: true })
  dislikes?: string[]; // e.g., ['mushrooms', 'cilantro', 'olives']

  // Foods the user loves
  @Column('simple-array', { nullable: true })
  favorites?: string[]; // e.g., ['chicken', 'pasta', 'chocolate']

  // Preferred cuisines
  @Column('simple-array', { nullable: true })
  preferredCuisines?: string[]; // e.g., ['Italian', 'Mexican', 'Asian']

  // Cooking skill level
  @Column({ type: 'varchar', length: 20, nullable: true })
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';

  // Maximum cooking time willing to spend (in minutes)
  @Column({ type: 'int', nullable: true })
  maxCookingTime?: number;

  // Household size
  @Column({ type: 'int', nullable: true })
  householdSize?: number;

  // Spice tolerance
  @Column({ type: 'varchar', length: 20, nullable: true })
  spiceTolerance?: 'none' | 'mild' | 'medium' | 'hot' | 'very-hot';

  // Budget consciousness
  @Column({ type: 'varchar', length: 20, nullable: true })
  budgetLevel?: 'budget' | 'moderate' | 'splurge';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
