import { Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('penalties')
export class Penalty {
  @PrimaryGeneratedColumn('uuid')
  id: string;
}
