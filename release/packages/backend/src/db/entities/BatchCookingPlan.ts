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
import { Recipe } from './Recipe';

@Entity('batch_cooking_plans')
export class BatchCookingPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column('uuid')
  recipeId!: string;

  @ManyToOne(() => Recipe)
  @JoinColumn({ name: 'recipeId' })
  recipe!: Recipe;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Date when batch cooking is planned
  @Column({ type: 'date' })
  cookingDate!: Date;

  // Number of batches to prepare
  @Column({ type: 'int', default: 1 })
  batches!: number;

  // Servings per batch
  @Column({ type: 'int', default: 4 })
  servingsPerBatch!: number;

  // Storage method
  @Column({ type: 'varchar', length: 50, nullable: true })
  storageMethod?: 'refrigerate' | 'freeze' | 'pantry';

  // Storage duration in days
  @Column({ type: 'int', nullable: true })
  storageDuration?: number;

  // Reheating instructions
  @Column({ type: 'text', nullable: true })
  reheatingInstructions?: string;

  // Prep notes
  @Column({ type: 'text', nullable: true })
  prepNotes?: string;

  // Status
  @Column({ type: 'varchar', length: 20, default: 'planned' })
  status!: 'planned' | 'in-progress' | 'completed';

  // Prep checklist (JSON array of tasks)
  @Column({ type: 'jsonb', nullable: true })
  prepChecklist?: Array<{
    task: string;
    completed: boolean;
    order: number;
  }>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
