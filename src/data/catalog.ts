export interface YouTubeCategoryOption {
  label: string;
  categoryId?: string;
}

export const FEED_CATEGORIES: YouTubeCategoryOption[] = [
  { label: 'All' },
  { label: 'Music', categoryId: '10' },
  { label: 'Gaming', categoryId: '20' },
  { label: 'Science & Tech', categoryId: '28' },
  { label: 'Education', categoryId: '27' },
  { label: 'Sports', categoryId: '17' },
  { label: 'Film & Animation', categoryId: '1' },
  { label: 'News', categoryId: '25' },
];
