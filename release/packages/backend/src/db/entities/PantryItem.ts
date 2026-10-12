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

@Entity('pantry_items')
export class PantryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('varchar')
  name!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity!: number;

  @Column('varchar')
  unit!: string;

  @Column('varchar')
  category!: string;

  @Column('varchar', { nullable: true })
  location?: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate?: Date;

  @Column({ name: 'purchase_date', type: 'date', nullable: true })
  purchaseDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column('boolean', { name: 'is_low_stock', default: false })
  isLowStock!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
