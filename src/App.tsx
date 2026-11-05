import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  Package, Plus, LayoutDashboard, Search, Minus, Loader2, Archive, 
  History, Download, Upload, Tags, RotateCcw, Edit3, Database, Wand2,
  SlidersHorizontal, Palette, Filter, Image as ImageIcon, Sparkles, ShoppingCart, CheckCircle2, Trash2,
  X, Camera, Move, ChevronDown
} from 'lucide-react';

import { Product, Sale, CalendarEvent, ThemeType } from './types';
import { extractProductInfo, editProductImage } from './geminiService';
import { dbManager, STORES } from './db';
import { THEMES, QUICK_TYPES, QUICK_GENRES, DEFAULT_VAL } from './constants';
import { 
  AppLogo, BottomSheet, ProductThumbnail, ProductCard, 
  AnalyticsDashboard
} from './components';
import { compressImage } from './utils';

const normalizeVal = (val?: string) => {
  const trimmed = val?.trim();
  return !trimmed || trimmed === '' ? DEFAULT_VAL : trimmed;
};

const ITEMS_PER_PAGE = 48;
const SALES_GROUPS_PER_PAGE = 20;

const App: React.FC = () => {
  // --- 상태 관리 ---
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('berry');
  const [activeTab, setActiveTab] = useState<'inventory' | 'dashboard' | 'sales'>('inventory');
  const [isInitialized, setIsInitialized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'out' | 'low'>('all');
  const [isAdding, setIsAdding] = useState(false);
  const [isWarehouseOpen, setIsWarehouseOpen] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [manualScaleValue, setManualScaleValue] = useState(100);
  const [manualX, setManualX] = useState(0);
  const [manualY, setManualY] = useState(0);
  const [imageEditPrompt, setImageEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'trash' | 'danger'>('success');
  const [isReorderMode, setIsReorderMode] = useState(false);

  // 대용량 데이터 렌더링 최적화를 위한 점진적 표시 개수
  const [productDisplayLimit, setProductDisplayLimit] = useState(ITEMS_PER_PAGE);
  const [salesDisplayLimit, setSalesDisplayLimit] = useState(SALES_GROUPS_PER_PAGE);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const lastDragPos = useRef({ x: 0, y: 0 });

  // 검색이나 필터 변경 시 점진적 표시 개수 초기화
  useEffect(() => {
    setProductDisplayLimit(ITEMS_PER_PAGE);
  }, [searchTerm, selectedGenre, selectedType, stockStatusFilter]);

  const activeTheme = useMemo(() => THEMES.find(t => t.id === currentTheme) || THEMES[0], [currentTheme]);

  // --- 헬퍼 함수 ---
  const showToast = useCallback((msg: string, type: 'success' | 'info' | 'trash' | 'danger' = 'success') => {
    setToastMessage(msg); setToastType(type);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const c = useCallback((type: string) => {
    const col = activeTheme.color;
    const iDark = activeTheme.isDark;
    switch (type) {
      case 'primary': return iDark ? `text-${col}-300` : `text-${col}-400`;
      case 'bg-primary': return iDark ? `bg-${col}-500` : `bg-${col}-400`;
      case 'bg-gradient-primary': return iDark ? `bg-gradient-to-t from-${col}-600 to-${col}-400` : `bg-gradient-to-t from-${col}-100 to-${col}-50`;
      case 'ring-primary': return `ring-${col}-100`;
      case 'text-main': return iDark ? 'text-white' : 'text-slate-800';
      case 'text-soft': return iDark ? `text-${col}-300` : `text-${col}-400`;
      case 'text-muted': return iDark ? 'text-slate-500' : 'text-slate-300';
      case 'bg-card': return iDark ? 'bg-slate-800' : 'bg-white';
      case 'bg-light': return iDark ? `bg-slate-700` : `bg-${col}-50`;
      case 'border-light': return iDark ? 'border-slate-700' : `border-${col}-100`;
      case 'focus-ring': return iDark ? `focus:ring-slate-600` : `focus:ring-${col}-50`;
      case 'is-dark': return iDark ? 'true' : '';
      default: return '';
    }
  }, [activeTheme]);

  // --- 생명주기 및 데이터 동기화 ---
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const [savedP, savedS, savedE, savedSet] = await Promise.all([
          dbManager.getAll<Product>(STORES.PRODUCTS),
          dbManager.getAll<Sale>(STORES.SALES),
          dbManager.getAll<CalendarEvent>(STORES.EVENTS),
          dbManager.getSettings()
        ]);
        
        if (!isMounted) return;

        let initialProducts = savedP.length ? savedP : [{ 
          id: 'sample_01', 
          name: '샘플: 블루베리 포토카드', 
          price: 5000, 
          stock: 20, 
          minStockLevel: 5, 
          genre: '오리지널', 
          type: '포토카드', 
          description: '', 
          imageUrl: '', 
          lastUpdated: Date.now(), 
          order: 0 
        }];
        
        // order 필드 보정
        initialProducts = initialProducts.map((p, i) => ({
          ...p,
          order: p.order !== undefined ? p.order : i
        })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
        setAllProducts(initialProducts);
        setSalesHistory(savedS || []); 
        setEvents(savedE || []); 
        if (savedSet?.theme) setCurrentTheme(savedSet.theme);
      } catch (e) { 
        console.error('Init data error:', e);
        if (isMounted) setAllProducts([]); 
      } finally {
        if (isMounted) setIsInitialized(true);
      }
    };
    initData();
    return () => { isMounted = false; };
  }, []);

  // [성능 개선 1]: 각 스토어별 독립적 디바운스 저장 (300ms)
  // 하나의 상태가 바뀔 때 모든 4개 테이블을 store.clear() & 전체 재작성하던 병목을 완벽히 해결
  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      dbManager.saveAll(STORES.PRODUCTS, allProducts).catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [allProducts, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      dbManager.saveAll(STORES.SALES, salesHistory).catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [salesHistory, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      dbManager.saveAll(STORES.EVENTS, events).catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [events, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    dbManager.saveSettings({ theme: currentTheme }).catch(console.error);
  }, [currentTheme, isInitialized]);

  // --- 연산된 데이터 (메모이제이션) ---
  const activeProducts = useMemo(() => 
    allProducts
      .filter(p => !p.deletedAt)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), 
    [allProducts]
  );
  
  const warehouseProducts = useMemo(() => 
    allProducts.filter(p => !!p.deletedAt).sort((a,b) => (b.deletedAt||0) - (a.deletedAt||0)), 
    [allProducts]
  );

  const productMap = useMemo(() => { 
    const m = new Map<string, Product>(); 
    activeProducts.forEach(p => m.set(p.id, p)); 
    return m; 
  }, [activeProducts]);
  
  const filteredProducts = useMemo(() => {
    const t = searchTerm.toLowerCase().trim();
    return activeProducts.filter(p => {
      const ms = !t || p.name.toLowerCase().includes(t);
      const mg = selectedGenre === 'all' || normalizeVal(p.genre) === selectedGenre;
      const mt = selectedType === 'all' || normalizeVal(p.type) === selectedType;
      let mSt = true;
      if (stockStatusFilter === 'out') mSt = p.stock === 0;
      else if (stockStatusFilter === 'low') mSt = p.stock > 0 && p.stock <= p.minStockLevel;
      return ms && mg && mt && mSt;
    });
  }, [activeProducts, searchTerm, selectedGenre, selectedType, stockStatusFilter]);

  // 렌더링에 사용할 슬라이스된 상품 목록 (대용량 데이터 성능 최적화)
  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, productDisplayLimit);
  }, [filteredProducts, productDisplayLimit]);

  const genres = useMemo(() => (['all', ...Array.from(new Set(activeProducts.map(p => normalizeVal(p.genre))))] as string[]).sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)), [activeProducts]);
  const types = useMemo(() => (['all', ...Array.from(new Set(activeProducts.map(p => normalizeVal(p.type))))] as string[]).sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : a.localeCompare(b)), [activeProducts]);
  
  // [일주일간 매출 합산]: 오늘 포함 최근 7일간 매출
  const weeklyRevenueStats = useMemo(() => {
    const start = new Date(); 
    start.setDate(start.getDate() - 6); 
    start.setHours(0, 0, 0, 0);
    const startTs = start.getTime();
    const periodSales = salesHistory.filter(s => s.timestamp >= startTs);
    const totalAmount = periodSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalItems = periodSales.reduce((sum, s) => sum + s.items.reduce((acc, it) => acc + it.quantity, 0), 0);
    return { totalAmount, totalItems, count: periodSales.length };
  }, [salesHistory]);

  // [한 달 누적 합산]: 이번 달 1일부터 오늘까지의 누적 매출
  const monthlyRevenueStats = useMemo(() => {
    const start = new Date(); 
    start.setDate(1); 
    start.setHours(0, 0, 0, 0);
    const startTs = start.getTime();
    const periodSales = salesHistory.filter(s => s.timestamp >= startTs);
    const totalAmount = periodSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalItems = periodSales.reduce((sum, s) => sum + s.items.reduce((acc, it) => acc + it.quantity, 0), 0);
    return { totalAmount, totalItems, count: periodSales.length };
  }, [salesHistory]);

  const totalCartAmount = useMemo(() => 
    Object.entries(cart).reduce((sum, [id, qty]) => sum + (productMap.get(id)?.price || 0) * (qty as number), 0), 
    [cart, productMap]
  );

  const cartTotalItems = useMemo(() => 
    Object.values(cart).reduce((a: number, b: number) => a + b, 0), 
    [cart]
  );

  const groupedSales = useMemo(() => {
    const groups: Record<string, Sale[]> = {};
    const sorted = [...salesHistory].sort((a,b) => b.timestamp - a.timestamp);
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      const d = new Date(s.timestamp); 
      const key = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
      if (!groups[key]) groups[key] = []; 
      groups[key].push(s);
    }
    return Object.entries(groups);
  }, [salesHistory]);

  const visibleGroupedSales = useMemo(() => {
    return groupedSales.slice(0, salesDisplayLimit);
  }, [groupedSales, salesDisplayLimit]);

  // --- 안정적인 콜백 핸들러 (ProductCard 불필요한 전체 리렌더 방지) ---
  const handleTabChange = useCallback((tab: typeof activeTab) => {
    setSearchTerm(''); setSelectedGenre('all'); setSelectedType('all'); setStockStatusFilter('all'); setActiveTab(tab);
    if (tab !== 'inventory') setIsReorderMode(false);
  }, []);

  const handleAddToCart = useCallback((id: string) => {
    setCart(prev => {
      const p = productMap.get(id);
      if (!p) return prev;
      const currentQty = prev[id] || 0;
      if (currentQty >= p.stock) return prev;
      return { ...prev, [id]: currentQty + 1 };
    });
  }, [productMap]);

  const handleEditProduct = useCallback((p: Product) => {
    setEditingProduct(p);
  }, []);

  const handleHistoryProduct = useCallback((p: Product) => {
    setHistoryProduct(p);
  }, []);

  const handleSale = useCallback(() => {
    const saleItems = Object.entries(cart).map(([id, qty]) => {
      const p = productMap.get(id); 
      return p ? { productId: p.id, name: p.name, quantity: qty as number, price: p.price } : null;
    }).filter((i): i is any => i !== null);

    setAllProducts(prev => prev.map(p => cart[p.id] ? { ...p, stock: Math.max(0, p.stock - cart[p.id]), lastUpdated: Date.now() } : p));
    setSalesHistory(prev => [{ id: Date.now().toString(), timestamp: Date.now(), items: saleItems, totalAmount: totalCartAmount }, ...prev]);
    setCart({}); 
    setIsCartOpen(false); 
    showToast('결제가 완료되었습니다 ♡');
  }, [cart, productMap, totalCartAmount, showToast]);

  const cancelSale = useCallback((sale: Sale) => {
    if (window.confirm('거래를 취소하시겠습니까?')) {
      setAllProducts(prev => prev.map(p => { 
        const i = sale.items.find(it => it.productId === p.id); 
        return i ? { ...p, stock: p.stock + i.quantity } : p; 
      }));
      setSalesHistory(prev => prev.filter(s => s.id !== sale.id)); 
      showToast('거래 취소 완료.', 'danger');
    }
  }, [showToast]);

  const moveToWarehouse = useCallback((product: Product) => {
    if (window.confirm('창고로 이동하시겠습니까?')) {
      setAllProducts(prev => prev.map(p => p.id === product.id ? { ...p, deletedAt: Date.now() } : p));
      setCart(prev => { const n = {...prev}; delete n[product.id]; return n; }); 
      setEditingProduct(null); 
      showToast('창고 이동 완료 ♡', 'trash');
    }
  }, [showToast]);

  const restoreFromWarehouse = useCallback((product: Product) => {
    setAllProducts(prev => prev.map(p => p.id === product.id ? { ...p, deletedAt: undefined } : p)); 
    showToast('상품 복구 완료 ♡');
  }, [showToast]);

  const handleImageEdit = async () => {
    if (!editingProduct?.imageUrl || !imageEditPrompt.trim()) return;
    setIsProcessing(true);
    try {
      const url = await editProductImage(editingProduct.imageUrl, imageEditPrompt);
      if (url) { 
        const compressed = await compressImage(url, 800, 800, 0.82);
        setEditingProduct({ ...editingProduct, imageUrl: compressed }); 
        setImageEditPrompt(''); 
        setIsEditingImage(false); 
        showToast('이미지 수정 완료 ♡'); 
      }
    } catch (e) { 
      alert('이미지 편집 오류'); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const moveProduct = useCallback((id: string, direction: 'prev' | 'next') => {
    setAllProducts(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx === -1) return prev;
      
      const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      
      const newProducts = [...prev];
      const [movedItem] = newProducts.splice(idx, 1);
      newProducts.splice(newIdx, 0, movedItem);
      
      return newProducts.map((p, i) => ({ ...p, order: i }));
    });
  }, []);

  const applyManualFilters = async () => {
    if (!editingProduct?.imageUrl) return;
    setIsProcessing(true);
    try {
      const img = new Image(); 
      img.crossOrigin = "anonymous"; 
      img.src = editingProduct.imageUrl;
      await new Promise(r => { img.onload = r; });
      const canvas = document.createElement('canvas'); 
      canvas.width = 800; 
      canvas.height = 800;
      const ctx = canvas.getContext('2d'); 
      if (!ctx) return;
      ctx.fillStyle = "white"; 
      ctx.fillRect(0, 0, 800, 800);
      const ratio = 800 / 288; 
      const baseScale = 800 / Math.max(img.width, img.height);
      const dw = (img.width * baseScale) * (manualScaleValue / 100); 
      const dh = (img.height * baseScale) * (manualScaleValue / 100);
      ctx.drawImage(img, (800 - dw) / 2 + (manualX * ratio), (800 - dh) / 2 + (manualY * ratio), dw, dh);
      
      const compressed = canvas.toDataURL('image/jpeg', 0.82);
      setEditingProduct({ ...editingProduct, imageUrl: compressed });
      setIsManualEditing(false); 
      setManualScaleValue(100); 
      setManualX(0); 
      setManualY(0);
    } catch (e) { 
      alert("이미지 처리 오류"); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  const handleDragStart = (e: any) => { 
    isDraggingRef.current = true; 
    const cX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX; 
    const cY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY; 
    lastDragPos.current = { x: cX, y: cY }; 
  };
  
  const handleDragMove = (e: any) => { 
    if (!isDraggingRef.current) return; 
    const cX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX; 
    const cY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY; 
    const dx = cX - lastDragPos.current.x; 
    const dy = cY - lastDragPos.current.y; 
    setManualX(p => p + dx); 
    setManualY(p => p + dy); 
    lastDragPos.current = { x: cX, y: cY }; 
  };
  
  const handleDragEnd = () => { 
    isDraggingRef.current = false; 
  };

  const saveEvent = useCallback((date: string, text: string) => {
    if (!text.trim()) { 
      setEvents(p => p.filter(e => e.date !== date)); 
      return; 
    }
    setEvents(p => { 
      const ex = p.find(e => e.date === date); 
      return ex ? p.map(e => e.date === date ? { ...e, text } : e) : [...p, { id: date, date, text }]; 
    });
  }, []);

  if (!isInitialized) {
    return (
      <div className={`flex-1 flex items-center justify-center min-h-[100dvh] ${activeTheme.isDark ? 'bg-slate-900' : 'bg-[#fffcfc]'}`}>
        <Loader2 className={`animate-spin ${c('primary')}`} size={36} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[100dvh] overflow-hidden ${activeTheme.isDark ? 'bg-slate-900' : 'bg-[#fffcfc]'}`}>
      <header className={`flex-shrink-0 z-40 ${activeTheme.isDark ? 'bg-slate-900/90' : 'bg-white/90'} glass border-b ${c('border-light')} px-6 py-4 safe-pt`}>
        <div className="flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 ${c('bg-primary')} rounded-2xl flex items-center justify-center text-white border border-white/40 shadow-none overflow-hidden p-1.5`}><AppLogo className="w-full h-full" /></div>
            <h1 className={`text-xl font-black ${c('text-main')} tracking-tighter italic leading-none ml-1`}>Smart Stock</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => { if(activeTab === 'inventory') setIsReorderMode(!isReorderMode) }} 
              className={`w-10 h-10 ${c('bg-light')} rounded-2xl flex items-center justify-center transition-all tap-effect border border-white/50 ${isReorderMode ? `${c('bg-primary')} text-white` : c('text-soft')}`}
              title="순서 변경 모드"
            >
              <Move size={20} strokeWidth={2.5}/>
            </button>
            <button onClick={() => setIsWarehouseOpen(true)} className={`w-10 h-10 ${c('bg-light')} rounded-2xl flex items-center justify-center ${c('text-soft')} tap-effect relative border border-white/50 shadow-none`} title="창고"><Archive size={20} className={c('primary')} />{warehouseProducts.length > 0 && <span className={`absolute -top-1 -right-1 ${c('bg-primary')} text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black border-2 border-white`}>{warehouseProducts.length}</span>}</button>
            <button onClick={() => setIsAdding(true)} className={`w-10 h-10 ${c('bg-light')} rounded-2xl flex items-center justify-center ${c('primary')} tap-effect border border-white/50 shadow-none`} title="상품 등록"><Plus size={24} strokeWidth={3}/></button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden max-w-7xl mx-auto w-full flex flex-col relative">
        {activeTab === 'inventory' && (
          <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300 overflow-hidden">
            <div className="flex-shrink-0 space-y-3 px-6 pt-5 mb-2">
              <div className="flex flex-col landscape:flex-row gap-3 md:items-center max-w-4xl mx-auto w-full">
                <div className="relative group flex-1">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 ${c('text-muted')} transition-colors group-focus-within:${c('primary')}`} size={16} strokeWidth={2.5}/>
                  <input type="text" placeholder="상품명 검색... ♡" className={`w-full pl-11 pr-5 py-3 rounded-2xl ${c('bg-card')} border ${c('border-light')} font-black italic outline-none text-[13px] focus:ring-2 ${c('focus-ring')} transition-all placeholder:${c('text-muted')} border-white/50 shadow-none`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="hidden landscape:flex gap-2">
                  <div className="relative"><select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className={`appearance-none h-full pl-4 pr-10 py-2 rounded-2xl border ${c('border-light')} ${c('bg-light')} text-[12px] font-black outline-none shadow-sm cursor-pointer`}>{genres.map(g => <option key={g} value={g}>{g === 'all' ? '장르 전체' : g}</option>)}</select><Tags size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" /></div>
                  <div className="relative"><select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className={`appearance-none h-full pl-4 pr-10 py-2 rounded-2xl border ${c('border-light')} ${c('bg-light')} text-[12px] font-black outline-none shadow-sm cursor-pointer`}>{types.map(t => <option key={t} value={t}>{t === 'all' ? '종류 전체' : t}</option>)}</select><Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" /></div>
                </div>
              </div>
              <div className="flex flex-col space-y-3 max-w-4xl mx-auto w-full landscape:hidden">
                <div className="flex items-center gap-2 px-1 overflow-x-auto no-scrollbar"><Tags size={14} className={c('text-soft')} /><div className="flex gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-1">{genres.map(g => (<button key={g} onClick={() => setSelectedGenre(g)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black transition-all tracking-tighter uppercase shrink-0 border-2 ${selectedGenre === g ? `${c('bg-primary')} ${c('text-primary')} border-white/40 bg-opacity-20` : `bg-transparent ${c('text-muted')} ${c('border-light')} bg-opacity-10`}`}>{g === 'all' ? '장르 전체' : g}</button>))}</div></div>
                <div className="flex items-center gap-2 px-1 overflow-x-auto no-scrollbar"><Filter size={14} className={c('text-soft')} /><div className="flex gap-1.5 flex-nowrap overflow-x-auto no-scrollbar pb-1">{types.map(t => (<button key={t} onClick={() => setSelectedType(t)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-[10px] font-black transition-all tracking-tighter uppercase shrink-0 border-2 ${selectedType === t ? `${c('bg-primary')} ${c('text-primary')} border-white/40 bg-opacity-20` : `bg-transparent ${c('text-muted')} ${c('border-light')} bg-opacity-10`}`}>{t === 'all' ? '종류 전체' : t}</button>))}</div></div>
              </div>
            </div>

            {isReorderMode && (
              <div className="px-6 mb-4 max-w-4xl mx-auto w-full">
                <div className={`${c('bg-light')} p-4 rounded-[1.8rem] border ${c('border-light')} flex items-center justify-between animate-in zoom-in duration-300`}>
                  <div className="flex items-center gap-2">
                    <Move size={16} className={c('text-primary')} />
                    <span className={`text-[12px] font-black ${c('text-main')} italic`}>위치 변경 모드 ON</span>
                  </div>
                  <button onClick={() => setIsReorderMode(false)} className={`px-4 py-1.5 rounded-full ${c('bg-primary')} text-white font-black text-[10px] tap-effect shadow-md`}>완료</button>
                </div>
              </div>
            )}

            <div className="px-6 mb-4 max-w-4xl mx-auto w-full">
              {stockStatusFilter !== 'all' && (
                <button onClick={() => setStockStatusFilter('all')} className={`px-4 py-3 rounded-2xl bg-slate-800 text-white font-black text-[12px] flex items-center gap-2 shadow-lg animate-in zoom-in duration-300 w-fit`}>
                  <X size={14} /> {stockStatusFilter === 'out' ? '품절 해제' : '재고 부족 해제'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-4 tab-content-scroll pb-40">
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 lg:gap-3">
                {visibleProducts.map(p => (
                  <ProductCard 
                    key={p.id} 
                    product={p} 
                    inCart={cart[p.id] || 0} 
                    onAdd={handleAddToCart} 
                    onEdit={handleEditProduct} 
                    onHistory={handleHistoryProduct} 
                    c={c} 
                    reorderMode={isReorderMode}
                    onMove={moveProduct}
                  />
                ))}
                {!filteredProducts.length && <div className="col-span-full py-20 text-center opacity-30 italic">표시할 상품이 없습니다.</div>}
              </div>

              {/* 대용량 목록 점진적 로드 버튼 (부드러운 스크롤 성능 유지) */}
              {filteredProducts.length > productDisplayLimit && (
                <div className="flex justify-center mt-6 mb-8">
                  <button 
                    onClick={() => setProductDisplayLimit(prev => prev + ITEMS_PER_PAGE)}
                    className={`px-6 py-3 rounded-2xl ${c('bg-light')} ${c('text-primary')} border-2 ${c('border-light')} font-black text-xs tap-effect flex items-center gap-2 shadow-sm`}
                  >
                    <span>더 보기 ({visibleProducts.length}/{filteredProducts.length})</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-40 space-y-5 animate-in fade-in duration-300 no-scrollbar overflow-x-visible">
            <div className="max-w-7xl mx-auto w-full flex flex-col gap-4 overflow-visible">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* 일주일간 매출 합산 (최근 7일) */}
                <div className={`${c('bg-primary')} p-5 rounded-[2.5rem] text-white flex-1 relative overflow-hidden border border-white/30 shadow-sm`}>
                  <div className="flex justify-between items-start">
                    <p className="text-[10px] font-black opacity-80 uppercase tracking-widest">일주일간 매출 합산 (최근 7일)</p>
                    <span className="text-[9px] font-black bg-white/20 px-2 py-0.5 rounded-full">{weeklyRevenueStats.count}건 결제</span>
                  </div>
                  <h2 className="text-2xl font-black mt-1 italic">₩{weeklyRevenueStats.totalAmount.toLocaleString()}</h2>
                  <p className="text-[9px] font-bold opacity-75 mt-0.5">총 {weeklyRevenueStats.totalItems.toLocaleString()}개 판매</p>
                </div>

                {/* 한 달 누적 합산 (이번 달) */}
                <div className={`${c('bg-card')} p-5 rounded-[2.5rem] ${c('text-main')} flex-1 border-2 ${c('border-light')} relative overflow-hidden shadow-sm`}>
                  <div className="flex justify-between items-start">
                    <p className={`text-[10px] font-black ${c('text-muted')} uppercase tracking-widest`}>한 달 누적 합산 ({new Date().getMonth() + 1}월)</p>
                    <span className={`text-[9px] font-black ${c('bg-light')} ${c('text-primary')} px-2 py-0.5 rounded-full border ${c('border-light')}`}>{monthlyRevenueStats.count}건 결제</span>
                  </div>
                  <h2 className={`text-2xl font-black mt-1 italic ${c('text-primary')}`}>₩{monthlyRevenueStats.totalAmount.toLocaleString()}</h2>
                  <p className={`text-[9px] font-bold ${c('text-muted')} mt-0.5`}>총 {monthlyRevenueStats.totalItems.toLocaleString()}개 판매</p>
                </div>
              </div>
              <AnalyticsDashboard sales={salesHistory} products={activeProducts} events={events} onSaveEvent={saveEvent} onFilterClick={(st) => { setStockStatusFilter(st); setActiveTab('inventory'); }} c={c} showToast={showToast} />
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-40 animate-in fade-in duration-300 flex flex-col gap-8 no-scrollbar">
             <div className="grid grid-cols-2 gap-4 max-w-4xl mx-auto w-full">
               <div className={`${c('bg-card')} p-5 rounded-[2.5rem] border-2 ${c('border-light')} space-y-4 flex flex-col shadow-sm`}>
                  <div className="flex items-center gap-2.5 shadow-none"><Palette size={16} className={c('text-primary')} /><h3 className={`text-[12px] font-black ${c('text-main')}`}>테마</h3></div>
                  <div className="grid grid-cols-3 gap-2 overflow-y-auto no-scrollbar flex-1">{THEMES.map(theme => (<button key={theme.id} onClick={() => setCurrentTheme(theme.id)} className={`flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all ${currentTheme === theme.id ? c('border-light') + ' ' + c('bg-light') : 'border-transparent opacity-60'}`}><div className={`w-5 h-5 rounded-full bg-${theme.color}-300 border-2 border-white`} /><span className={`text-[8px] font-black ${c('text-main')} truncate w-full text-center`}>{theme.name}</span></button>))}</div>
               </div>
               <div className={`${c('bg-card')} p-5 rounded-[2.5rem] border-2 ${c('border-light')} space-y-4 flex flex-col shadow-sm`}>
                  <div className="flex items-center gap-2.5"><Database size={16} className={c('text-primary')} /><h3 className={`text-[12px] font-black ${c('text-main')}`}>데이터</h3></div>
                  <div className="grid grid-cols-1 gap-2 flex-1">
                    <button onClick={() => { const b = new Blob([JSON.stringify({ allProducts, salesHistory, events, settings: { theme: currentTheme }, version: '2.5' }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = `SmartStock_Backup.json`; l.click(); }} className={`flex items-center justify-center gap-2 py-2.5 ${c('bg-light')} rounded-xl border-2 ${c('border-light')} tap-effect shadow-sm group`}><Download size={15} className={`${c('text-primary')} group-hover:scale-110 transition-transform`} /><span className={`text-[11px] font-black ${c('text-primary')}`}>백업 만들기</span></button>
                    <button onClick={() => fileInputRef.current?.click()} className={`flex items-center justify-center gap-2 py-2.5 bg-slate-100 text-slate-400 rounded-xl tap-effect border border-slate-200 opacity-80`}><Upload size={14}/><span className="text-[10px] font-black">데이터 복구</span></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => { const json = JSON.parse(ev.target?.result as string); if(json.allProducts) { setAllProducts(json.allProducts.sort((a:any, b:any) => (a.order??0)-(b.order??0))); setSalesHistory(json.salesHistory || []); setEvents(json.events || []); if(json.settings?.theme) setCurrentTheme(json.settings.theme); showToast('데이터 복구 완료 ♡'); } }; r.readAsText(f); }} />
                  </div>
               </div>
             </div>

             <div className="flex-1 space-y-6 max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-center gap-2 px-1"><History size={18} className={c('text-primary')} /><h3 className={`font-black ${c('text-primary')} text-lg`}>거래 기록 ♡</h3></div>
                {!salesHistory.length ? (<div className={`${c('bg-card')} p-16 rounded-[2.5rem] text-center border-2 ${c('border-light')} opacity-50 shadow-sm`}><p className="text-sm font-black italic">기록이 없습니다.</p></div>) : (
                  <div className="space-y-6 pb-20">
                    {visibleGroupedSales.map(([date, sales]) => (
                      <div key={date} className="space-y-3">
                        <div className="flex items-center gap-4 px-2">
                          <span className={`text-[12px] font-black ${c('text-primary')} italic whitespace-nowrap`}>{date}</span>
                          <div className={`h-[1px] flex-1 ${c('bg-light')} opacity-50`} />
                        </div>
                        <div className="flex flex-col gap-2">
                          {sales.map(s => (
                            <div key={s.id} className={`${c('bg-card')} px-5 py-4 rounded-[1.5rem] border-2 ${c('border-light')} flex justify-between items-stretch tap-effect group shadow-sm`}>
                              <div className="flex flex-col items-start gap-2 flex-1 min-w-0">
                                <p className={`text-[10px] font-black ${c('text-muted')} whitespace-nowrap shrink-0 mt-1`}>{new Date(s.timestamp).toLocaleString('ko-KR')}</p>
                                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                  {s.items.map((it, idx) => (
                                    <span key={idx} className={`text-[10px] font-black ${activeTheme.isDark ? 'text-white bg-slate-600' : `${c('text-primary')} ${c('bg-light')}`} px-2.5 py-1.5 rounded-full border border-white/20 whitespace-normal leading-tight break-all`}>
                                      {it.name} <span className="opacity-60 ml-0.5">x{it.quantity}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex flex-col items-end justify-between ml-4 shrink-0">
                                <p className={`font-black ${c('text-main')} text-base italic whitespace-nowrap`}>₩{s.totalAmount.toLocaleString()}</p>
                                <button onClick={() => cancelSale(s)} className={`p-1.5 ${c('bg-light')} ${c('text-soft')} rounded-lg opacity-0 group-hover:opacity-100 transition-opacity tap-effect`} title="거래 취소">
                                  <RotateCcw size={14}/>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {groupedSales.length > salesDisplayLimit && (
                      <div className="flex justify-center mt-4">
                        <button 
                          onClick={() => setSalesDisplayLimit(prev => prev + SALES_GROUPS_PER_PAGE)}
                          className={`px-6 py-3 rounded-2xl ${c('bg-light')} ${c('text-primary')} border-2 ${c('border-light')} font-black text-xs tap-effect flex items-center gap-2 shadow-sm`}
                        >
                          <span>이전 기록 더 보기 ({visibleGroupedSales.length}/{groupedSales.length}일)</span>
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      <nav className={`flex-shrink-0 fixed bottom-8 left-1/2 -translate-x-1/2 ${activeTheme.isDark ? 'bg-slate-800/95' : 'bg-white/95'} glass border ${c('border-light')} flex items-center justify-around w-[90%] max-w-md h-16 rounded-[2.5rem] z-[100] px-2 shadow-2xl transition-all`}>
        <button onClick={() => handleTabChange('dashboard')} className={`p-3 transition-all ${activeTab === 'dashboard' ? `${c('text-primary')} scale-110` : c('text-muted')}`} title="대시보드"><LayoutDashboard size={26}/></button>
        <button onClick={() => handleTabChange('inventory')} className={`p-3 transition-all ${activeTab === 'inventory' ? `${c('text-primary')} scale-110` : c('text-muted')}`} title="재고 관리"><Package size={26}/></button>
        <button onClick={() => handleTabChange('sales')} className={`p-3 transition-all ${activeTab === 'sales' ? `${c('text-primary')} scale-110` : c('text-muted')}`} title="기록 및 설정"><History size={26}/></button>
      </nav>

      {isWarehouseOpen && (
        <BottomSheet 
          title="창고" 
          onClose={() => setIsWarehouseOpen(false)} 
          c={c} 
          headerRight={
            <button 
              onClick={async () => { 
                if(warehouseProducts.length && window.confirm('창고를 비우시겠습니까?')) { 
                  const ids = warehouseProducts.map(p => p.id); 
                  setAllProducts(pr => pr.filter(p => !ids.includes(p.id)).sort((a,b) => (a.order??0)-(b.order??0))); 
                  for(const id of ids) await dbManager.deleteOne(STORES.PRODUCTS, id); 
                  showToast('창고 비우기 완료.', 'danger'); 
                } 
              }} 
              className={`p-2 ${c('bg-light')} text-rose-400 rounded-full border border-white/50 tap-effect`}
              title="창고 비우기"
            >
              <Trash2 size={20} strokeWidth={2.5} />
            </button>
          }
        >
          <div className="flex flex-col items-center gap-4 mb-4 max-w-2xl mx-auto px-2">
            {!warehouseProducts.length ? (
              <div className="text-center py-20 opacity-40 flex flex-col items-center gap-4"><Archive size={48} /><p className="text-[13px] font-black italic">보관 중인 상품이 없습니다 ♡</p></div>
            ) : warehouseProducts.map(p => (
              <div key={p.id} className={`flex items-center gap-4 p-4 ${c('bg-card')} border-2 ${c('border-light')} rounded-[1.8rem] shadow-sm w-full`}>
                <div className="w-14 h-14 rounded-2xl overflow-hidden shrink-0 shadow-inner"><ProductThumbnail product={p} c={c} isTrash hideTypo /></div>
                <div className="flex-1 min-w-0"><p className={`text-[13px] font-black ${c('text-main')} break-all leading-tight`}>{p.name}</p></div>
                <button onClick={() => restoreFromWarehouse(p)} className={`p-3 ${c('bg-light')} ${c('text-primary')} rounded-xl tap-effect shrink-0`} title="복구"><RotateCcw size={18}/></button>
              </div>
            ))}
          </div>
        </BottomSheet>
      )}

      {cartTotalItems > 0 && activeTab === 'inventory' && (
        <div className="fixed bottom-28 left-0 right-0 z-[60] flex justify-center px-6 animate-in slide-in-from-bottom-10 duration-500 pointer-events-none">
          <button onClick={() => setIsCartOpen(true)} className={`w-full max-w-sm ${c('bg-primary')} text-white p-5 rounded-[2.5rem] flex items-center justify-between border-4 border-white shadow-2xl tap-effect pointer-events-auto`}>
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 p-2 rounded-2xl"><ShoppingCart size={22} fill="currentColor" /></div>
              <span className="font-black text-sm italic">결제확인 ({cartTotalItems})</span>
            </div>
            <span className="font-black text-2xl italic tracking-tighter">₩{totalCartAmount.toLocaleString()}</span>
          </button>
        </div>
      )}

      {isCartOpen && (
        <BottomSheet 
          title="결제확인" 
          onClose={() => setIsCartOpen(false)} 
          c={c} 
          headerRight={
            <button 
              onClick={() => { if(window.confirm('장바구니를 비울까요?')) { setCart({}); setIsCartOpen(false); showToast('장바구니를 비웠습니다 ♡', 'danger'); } }} 
              className={`p-2.5 ${c('bg-light')} text-rose-500 rounded-full border border-white/50 tap-effect`}
              title="장바구니 비우기"
            >
              <Trash2 size={18} strokeWidth={2.5} />
            </button>
          }
        >
          <div className="space-y-3 mb-8 mt-2 max-h-[40vh] overflow-y-auto no-scrollbar pr-1">
            {Object.entries(cart).map(([id, q]) => { 
              const p = productMap.get(id); 
              if (!p) return null; 
              return (
                <div key={id} className={`flex items-center gap-4 p-4 ${c('bg-light')} rounded-[2.2rem] border ${c('border-light')} shadow-sm`}>
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-inner"><ProductThumbnail product={p} hideTypo c={c} hideText /></div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-black ${c('text-main')} leading-tight break-all`}>{p.name}</p>
                    <p className={`${c('text-primary')} font-black text-[13px] mt-0.5`}>₩{p.price.toLocaleString()} <span className="text-slate-400 font-normal">x{q}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setCart(v => { const n = {...v}; if((v[id]||0)<=1) delete n[id]; else n[id] = (v[id]||0)-1; return n; })} className={`p-2.5 ${c('bg-card')} rounded-xl border ${c('border-light')} tap-effect shadow-sm`}><Minus size={16}/></button>
                    <span className={`w-8 text-center font-black ${c('text-main')} text-[14px]`}>{q}</span>
                    <button onClick={() => { if(p.stock>(cart[id]||0)) setCart(v => ({...v, [id]: (v[id]||0)+1})) }} className={`p-2.5 ${c('bg-card')} rounded-xl border ${c('border-light')} tap-effect shadow-sm`}><Plus size={16}/></button>
                  </div>
                </div>
              ); 
            })}
          </div>
          <div className={`p-6 mb-8 rounded-[2.5rem] border-4 ${c('border-light')} ${c('bg-card')} flex flex-col items-center gap-1 shadow-inner relative overflow-hidden`}>
            <div className="absolute top-0 right-0 p-4 opacity-5"><ShoppingCart size={80}/></div>
            <p className={`text-[11px] font-black uppercase tracking-widest ${c('text-muted')}`}>결제 예정 금액</p>
            <h3 className={`text-4xl font-black italic tracking-tighter ${c('text-primary')}`}>₩{totalCartAmount.toLocaleString()}</h3>
          </div>
          <button onClick={handleSale} className={`w-full py-5 ${c('bg-primary')} text-white rounded-[2.5rem] font-black text-2xl tap-effect italic flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] border-2 border-white/30`}>
            <Sparkles size={24} />
            <span>총액 결제하기</span>
          </button>
        </BottomSheet>
      )}

      {editingProduct && (
        <BottomSheet 
          title={!allProducts.find(p => p.id === editingProduct.id) ? "신규 등록" : "상품 수정하기"} 
          onClose={() => setEditingProduct(null)} 
          c={c}
        >
          <div className="max-w-4xl mx-auto w-full flex flex-col landscape:flex-row gap-8">
            <div className="flex-1 flex flex-col items-center gap-4 landscape:border-r landscape:border-slate-100 landscape:pr-8">
              <div 
                className="relative aspect-square w-56 mx-auto rounded-[2.5rem] overflow-hidden border-4 border-white group cursor-pointer shadow-md bg-white flex items-center justify-center" 
                onClick={() => thumbnailInputRef.current?.click()}
              >
                <ProductThumbnail product={editingProduct} c={c} hideText />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><ImageIcon className="text-white" size={32}/></div>
                <input 
                  type="file" 
                  ref={thumbnailInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={async (e) => { 
                    const f = e.target.files?.[0]; 
                    if(!f) return; 
                    // [성능 개선 2]: 고화질 이미지를 800x800 경량 base64로 자동 압축하여 메모리 및 DB 용량 95% 절약
                    const compressed = await compressImage(f, 800, 800, 0.82);
                    setEditingProduct(prev => prev ? ({ ...prev, imageUrl: compressed }) : null);
                  }} 
                />
              </div>
              <div className="flex gap-2 w-full justify-center">
                <button onClick={() => setIsEditingImage(true)} className={`flex items-center gap-2 px-4 py-2 ${c('bg-light')} rounded-xl border ${c('border-light')} text-[11px] font-black ${c('text-soft')} tap-effect`}><Wand2 size={14}/> AI 자동 수정</button>
                <button onClick={() => setIsManualEditing(true)} className={`flex items-center gap-2 px-4 py-2 ${c('bg-light')} rounded-xl border ${c('border-light')} text-[11px] font-black ${c('text-soft')} tap-effect`}><SlidersHorizontal size={14}/> 수동 위치 조절</button>
              </div>
            </div>

            <div className="flex-[1.5] space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between items-end px-1">
                  <label className="text-[10px] font-black opacity-50 uppercase tracking-widest">상품명</label>
                  <button onClick={() => setEditingProduct({...editingProduct, isSet: !editingProduct.isSet})} className={`text-[10px] font-black px-3 py-1.5 rounded-xl border transition-all ${editingProduct.isSet ? `${c('bg-primary')} text-white` : `${c('bg-light')} opacity-40`}`}>{editingProduct.isSet ? "SET 상품 ON" : "SET OFF"}</button>
                </div>
                <input className={`w-full px-5 py-3.5 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[15px] outline-none ${c('focus-ring')}`} value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} placeholder="상품명 ♡" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black ml-1 opacity-50">가격</label>
                  <input type="number" className={`w-full px-5 py-3.5 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[14px] outline-none`} value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)||0})} placeholder="가격" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black ml-1 opacity-50">재고</label>
                  <input type="number" className={`w-full px-5 py-3.5 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[14px] outline-none`} value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)||0})} placeholder="재고" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black ml-1 opacity-50 uppercase tracking-widest">장르 / 작품명</label>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_GENRES.map(g => (
                    <button key={g} onClick={() => setEditingProduct({...editingProduct, genre: g})} className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${editingProduct.genre === g ? c('bg-primary') + ' text-white' : c('bg-light') + ' ' + c('text-soft')} border border-white/50`}>{g}</button>
                  ))}
                </div>
                <input className={`w-full px-5 py-3.5 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[13px] outline-none`} value={editingProduct.genre} onChange={e => setEditingProduct({...editingProduct, genre: e.target.value})} placeholder="장르 입력..." />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black ml-1 opacity-50 uppercase tracking-widest">종류 / 굿즈 타입</label>
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_TYPES.map(t => (
                    <button key={t} onClick={() => setEditingProduct({...editingProduct, type: t})} className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${editingProduct.type === t ? c('bg-primary') + ' text-white' : c('bg-light') + ' ' + c('text-soft')} border border-white/50`}>{t}</button>
                  ))}
                </div>
                <input className={`w-full px-5 py-3.5 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[13px] outline-none`} value={editingProduct.type} onChange={e => setEditingProduct({...editingProduct, type: e.target.value})} placeholder="종류 입력..." />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black ml-1 opacity-50">설명</label>
                <input className={`w-full px-5 py-3.5 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[13px] outline-none`} value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} placeholder="설명을 입력하세요..." />
              </div>

              <div className="flex gap-3 pt-4">
                {allProducts.find(p => p.id === editingProduct.id) && (
                  <button onClick={() => moveToWarehouse(editingProduct)} className={`p-4 ${c('bg-light')} rounded-2xl tap-effect shadow-sm`} title="창고로 이동"><Archive size={24} className={c('primary')} /></button>
                )}
                <button 
                  onClick={() => { 
                    setAllProducts(v => {
                      const isExisting = v.some(p => p.id === editingProduct.id);
                      if (isExisting) {
                        return v.map(p => p.id === editingProduct.id ? editingProduct : p).sort((a,b) => (a.order??0)-(b.order??0));
                      } else {
                        const minOrder = v.length > 0 ? Math.min(...v.map(p => p.order ?? 0)) : 0;
                        return [{ ...editingProduct, order: minOrder - 1 }, ...v].map((p, i) => ({ ...p, order: i }));
                      }
                    }); 
                    setEditingProduct(null); 
                    showToast('저장 완료 ♡'); 
                  }} 
                  className={`flex-1 py-4 ${c('bg-primary')} text-white rounded-2xl font-black text-lg tap-effect shadow-lg`}
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        </BottomSheet>
      )}

      {isEditingImage && (
        <BottomSheet title="AI 이미지 수정" onClose={() => setIsEditingImage(false)} c={c}>
          <div className="max-w-md mx-auto space-y-5">
            <div className="relative aspect-square w-52 mx-auto rounded-[2.5rem] overflow-hidden border-4 border-white shadow-lg bg-white flex items-center justify-center">
              <ProductThumbnail product={editingProduct!} c={c} hideText />
            </div>
            <p className="text-[12px] font-black text-center opacity-60 leading-relaxed px-6">"배경을 흰색으로", "더 밝게" 등 ♡</p>
            <div className="flex gap-2">
              <input className={`flex-1 px-5 py-4 rounded-2xl ${c('bg-light')} border ${c('border-light')} font-black text-[14px] outline-none`} value={imageEditPrompt} onChange={e => setImageEditPrompt(e.target.value)} placeholder="수정 요청..." />
              <button onClick={handleImageEdit} className={`p-4 ${c('bg-primary')} text-white rounded-2xl tap-effect`} disabled={isProcessing}><Wand2 size={24}/></button>
            </div>
          </div>
        </BottomSheet>
      )}

      {isManualEditing && (
        <BottomSheet title="이미지 수동 조절" onClose={() => setIsManualEditing(false)} c={c}>
          <div className="max-w-md mx-auto space-y-8">
            <div 
              className="relative aspect-square w-72 mx-auto rounded-[3rem] overflow-hidden border-8 border-white bg-white touch-none shadow-xl flex items-center justify-center" 
              onMouseDown={handleDragStart} 
              onMouseMove={handleDragMove} 
              onMouseUp={handleDragEnd} 
              onTouchStart={handleDragStart} 
              onTouchMove={handleDragMove} 
              onTouchEnd={handleDragEnd}
            >
              <img 
                src={editingProduct?.imageUrl} 
                alt="미리보기"
                className="max-w-none pointer-events-none object-contain p-2" 
                style={{ 
                  width: `${manualScaleValue}%`, 
                  position: 'absolute', 
                  top: '50%', 
                  left: '50%', 
                  transform: `translate(calc(-50% + ${manualX}px), calc(-50% + ${manualY}px))`, 
                  transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out' 
                }} 
              />
              <div className="absolute inset-0 border-2 border-dashed border-slate-200 rounded-[3rem] pointer-events-none opacity-40" />
            </div>
            <div className="space-y-5 px-6 pb-4">
              <div className="space-y-2">
                <div className="flex justify-between text-[11px] font-black opacity-60"><span>크기 조절</span><span>{manualScaleValue}%</span></div>
                <input type="range" min="50" max="300" value={manualScaleValue} onChange={(e) => setManualScaleValue(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-400" />
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={() => { setManualScaleValue(100); setManualX(0); setManualY(0); }} className={`flex-1 py-4 ${c('bg-light')} ${c('text-soft')} rounded-2xl font-black text-[13px] tap-effect`}>초기화</button>
                <button onClick={applyManualFilters} className={`flex-[2] py-4 ${c('bg-primary')} text-white rounded-2xl font-black text-[13px] tap-effect`}>변경 적용</button>
              </div>
            </div>
          </div>
        </BottomSheet>
      )}

      {isProcessing && (
        <div className={`fixed inset-0 ${activeTheme.isDark ? 'bg-slate-900/90' : 'bg-[#fffcfc]/90'} glass z-[300] flex flex-col items-center justify-center p-10 animate-in fade-in duration-300`}>
          <div className="relative mb-8">
            <div className={`w-24 h-24 border-4 ${c('border-light')} border-t-${activeTheme.color}-400 rounded-full animate-spin`} />
            <div className={`absolute inset-0 flex items-center justify-center ${c('primary')}`}><AppLogo className="w-12 h-12 animate-bounce" /></div>
          </div>
          <h3 className={`text-2xl font-black ${c('text-main')} italic`}>AI 분석 중...</h3>
        </div>
      )}

      {isAdding && (
        <BottomSheet title="상품 등록" onClose={() => setIsAdding(false)} c={c}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center max-w-lg mx-auto w-full pb-4">
            <label className={`border-4 border-dashed ${c('border-light')} rounded-[3rem] p-12 flex flex-col items-center gap-6 cursor-pointer hover:${c('bg-light')} group active:scale-95 transition-all shadow-sm`}>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={async (e) => { 
                  const f = e.target.files?.[0]; 
                  if(!f) return; 
                  setIsProcessing(true); 
                  setIsAdding(false); 
                  try {
                    const compressed = await compressImage(f, 800, 800, 0.82);
                    const rs = await extractProductInfo(compressed); 
                    if (rs && rs.length) { 
                      setAllProducts(pr => {
                        const newProds = rs.map((r, idx) => ({ 
                          id: (Date.now() + idx).toString(), 
                          name: r.name || '무제', 
                          price: Math.round((r.price || 0)/100)*100, 
                          genre: normalizeVal(r.genre), 
                          type: normalizeVal(r.type), 
                          isSet: !!r.isSet, 
                          description: r.description || '', 
                          stock: 10, 
                          minStockLevel: 3, 
                          imageUrl: compressed, 
                          lastUpdated: Date.now() 
                        }));
                        return [...newProds, ...pr].map((p, i) => ({ ...p, order: i }));
                      }); 
                      showToast('분석 완료 ♡'); 
                    } else {
                      showToast('상품 정보를 감지하지 못했습니다.', 'danger');
                    }
                  } catch (err) {
                    console.error(err);
                    showToast('이미지 분석 중 오류가 발생했습니다.', 'danger');
                  } finally {
                    setIsProcessing(false); 
                  }
                }} 
              />
              <div className={`p-7 ${c('bg-primary')} text-white rounded-3xl shadow-lg`}><Camera size={44} strokeWidth={2.5} /></div>
              <div className="text-center"><p className="font-black text-xl italic">AI 스마트스캔</p></div>
            </label>
            <button 
              onClick={() => { 
                setEditingProduct({ 
                  id: Date.now().toString(), 
                  name: '', 
                  price: 0, 
                  stock: 10, 
                  minStockLevel: 3, 
                  genre: '', 
                  type: '', 
                  isSet: false, 
                  description: '', 
                  imageUrl: '', 
                  lastUpdated: Date.now() 
                }); 
                setIsAdding(false); 
              }} 
              className={`w-full py-6 ${c('bg-light')} ${c('text-soft')} rounded-[3rem] font-black text-[15px] tap-effect border-2 border-dashed ${c('border-light')} flex flex-col items-center gap-3 active:scale-95`}
            >
              <Edit3 size={32} />
              <span>직접 입력</span>
            </button>
          </div>
        </BottomSheet>
      )}

      {historyProduct && (
        <BottomSheet title={`'${historyProduct.name}' 거래기록`} onClose={() => setHistoryProduct(null)} c={c} headerAlign="left">
          <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar px-2">
            {!salesHistory.filter(s => s.items.some(i => i.productId === historyProduct.id)).length ? (
              <div className="text-center py-10 opacity-40 italic">거래 이력이 없습니다.</div>
            ) : salesHistory.filter(s => s.items.some(i => i.productId === historyProduct.id)).map(s => (
              <div key={s.id} className={`p-4 rounded-2xl border ${c('border-light')} ${c('bg-light')} flex justify-between items-center shadow-sm`}>
                <div className="flex flex-col">
                  <span className="text-[11px] font-black opacity-40">{new Date(s.timestamp).toLocaleString()}</span>
                  <span className="text-[14px] font-black mt-0.5">수량: {s.items.find(i => i.productId === historyProduct.id)?.quantity}개</span>
                </div>
                <span className={`text-[15px] font-black ${c('text-primary')} italic`}>₩{((s.items.find(i => i.productId === historyProduct.id)?.price || 0) * (s.items.find(i => i.productId === historyProduct.id)?.quantity || 0)).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </BottomSheet>
      )}

      {toastMessage && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top duration-500 pointer-events-none">
          <div className={`${toastType === 'trash' || toastType === 'danger' ? 'bg-rose-500' : 'bg-emerald-500'} text-white px-10 py-3.5 rounded-full border-4 border-white shadow-2xl font-black text-[13px] flex items-center gap-3 whitespace-nowrap`}>
            {toastType === 'trash' || toastType === 'danger' ? <Trash2 size={20} /> : <CheckCircle2 size={20} />} 
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
