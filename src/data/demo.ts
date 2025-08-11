export type Role = 'farmer' | 'middleman' | 'industrialist';

export type DemoProduct = {
  id: string;
  name: string;
  cropType: string;
  pricePerUnit: number;
  unit: string;
  quantity: number;
  sellerRole: Role;
};

export type DemoTransaction = {
  id: string;
  productId: string;
  buyerRole: Role;
  sellerRole: Role;
  units: number;
  unitPrice: number;
  profitMargin: number; // absolute value per txn
  timestamp: string;
};

export const demoProducts: DemoProduct[] = [
  { id: 'p1', name: 'Premium Wheat', cropType: 'Wheat', pricePerUnit: 24, unit: 'kg', quantity: 1200, sellerRole: 'farmer' },
  { id: 'p2', name: 'Basmati Rice', cropType: 'Rice', pricePerUnit: 36, unit: 'kg', quantity: 800, sellerRole: 'farmer' },
  { id: 'p3', name: 'Organic Maize', cropType: 'Maize', pricePerUnit: 18, unit: 'kg', quantity: 1500, sellerRole: 'farmer' },
  { id: 'p4', name: 'Soybean', cropType: 'Soybean', pricePerUnit: 42, unit: 'kg', quantity: 600, sellerRole: 'middleman' },
];

export const demoTransactions: DemoTransaction[] = [
  { id:'t1', productId:'p1', buyerRole:'middleman', sellerRole:'farmer', units:500, unitPrice:22, profitMargin: 1500, timestamp: '2024-01-15' },
  { id:'t2', productId:'p2', buyerRole:'industrialist', sellerRole:'farmer', units:300, unitPrice:35, profitMargin: 1200, timestamp: '2024-02-20' },
  { id:'t3', productId:'p1', buyerRole:'industrialist', sellerRole:'middleman', units:250, unitPrice:28, profitMargin: 1800, timestamp: '2024-03-10' },
  { id:'t4', productId:'p3', buyerRole:'middleman', sellerRole:'farmer', units:700, unitPrice:17, profitMargin: 900, timestamp: '2024-04-05' },
  { id:'t5', productId:'p2', buyerRole:'industrialist', sellerRole:'farmer', units:200, unitPrice:34, profitMargin: 800, timestamp: '2024-05-25' },
];
