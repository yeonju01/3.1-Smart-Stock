export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  minStockLevel: number;
  genre: string;
  type: string;
  isSet?: boolean;
  description: string;
  imageUrl: string;
  lastUpdated: number;
  deletedAt?: number;
  order?: number; // 정렬 순서
}

export interface CalendarEvent {
  id: string;
  date: string;
  text: string;
}

export interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
}

export interface ExtractedProduct {
  name: string;
  price: number;
  genre: string;
  type: string;
  isSet?: boolean;
  description: string;
  imageBoundingBox?: {
    ymin: number;
    xmin: number;
    ymax: number;
    xmax: number;
  };
}

export interface Sale {
  id: string;
  timestamp: number;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
}

export type ThemeType = 'berry' | 'soda' | 'mint' | 'grape' | 'peach' | 'night' | 'mono';

export interface ThemeConfig {
  id: ThemeType;
  name: string;
  color: string;
  isDark: boolean;
}
