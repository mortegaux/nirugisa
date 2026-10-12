export type TaxonomyType = 'category' | 'tag';

export interface Taxonomy {
  id: string;
  userId: string;
  name: string;
  type: TaxonomyType;
  color?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxonomyCreateDto {
  name: string;
  type: TaxonomyType;
  color?: string;
}

export interface TaxonomyUpdateDto {
  name?: string;
  color?: string;
}
