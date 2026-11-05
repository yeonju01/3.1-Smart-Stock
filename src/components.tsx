import React, { useState, useEffect, memo, useRef, useMemo } from 'react';
import { 
  Package, X, Settings, History, 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2,
  StickyNote, Trash2, Clock, TrendingUp, BarChart3, PieChart, AlertCircle,
  Move, Tags, CalendarDays
} from 'lucide-react';
import { Product, Sale, CalendarEvent } from './types';
import { normalizeVal } from './constants';

export const AppLogo = memo(({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M128 360 L384 360 L384 480 L128 480 Z" fill="currentColor" opacity="0.7" />
    <path d="M128 360 L70 250 L240 260 L256 360 Z" fill="currentColor" opacity="0.8" />
    <path d="M384 360 L442 250 L272 260 L256 360 Z" fill="currentColor" opacity="0.6" />
    {/* 별 디자인 및 색상 순화 */}
    <path d="M256 30 L285 98 L358 98 L296 147 L319 223 L256 174 L193 223 L216 147 L154 98 L227 98 Z" fill="currentColor" opacity="0.9" />
    {/* 반짝임 효과 별 중심으로 재정렬 */}
    <path d="M256 10 L256 25 M360 80 L345 90 M410 170 L395 165 M350 260 L335 245 M162 260 L177 245 M102 170 L117 165 M152 80 L167 90" stroke="currentColor" strokeWidth="18" strokeLinecap="round" fill="none" opacity="0.5" />
  </svg>
));

export const BottomSheet = memo(({ title, children, onClose, headerRight, c, titleStyle, headerAlign = 'center' }: { 
  title: string | React.ReactNode, 
  children: React.ReactNode, 
  onClose: () => void, 
  headerRight?: React.ReactNode, 
  c: (cls: string) => string, 
  titleStyle?: string, 
  headerAlign?: 'center' | 'left' 
}) => {
  const [dragY, setDragY] = useState(0);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = Math.max(0, currentY - startY.current);
    setDragY(deltaY);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    if (dragY > 120) onClose(); else setDragY(0);
  };

  return (
    <div className={`fixed inset-0 ${c('is-dark') ? 'bg-black/70' : 'bg-slate-900/15'} backdrop-blur-md z-[100] flex items-end justify-center px-0 animate-in fade-in duration-300`}>
      <div 
        className={`${c('bg-card')} w-full max-w-4xl rounded-t-[3rem] p-6 pb-12 border-t border-white/40 overflow-y-auto no-scrollbar max-h-[94vh] landscape:max-h-[95vh] animate-in slide-in-from-bottom duration-500 relative shadow-2xl transition-transform ease-out`}
        style={{ transform: `translateY(${dragY}px)`, transition: isDragging.current ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div 
          className="w-full flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        >
          <div className={`w-14 h-1.5 ${c('bg-light')} rounded-full mx-auto opacity-60`} />
        </div>
        <div className={`flex flex-col ${headerAlign === 'center' ? 'items-center' : 'items-start'} ${title ? 'mb-6' : 'mb-2'} relative min-h-[44px] justify-center`}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2 z-50">
            {headerRight}
            <button onClick={onClose} className={`p-2.5 ${c('bg-light')} rounded-full ${c('text-soft')} tap-effect border border-white/50 shadow-sm`}>
              <X size={22} strokeWidth={3} />
            </button>
          </div>
          {title && <h2 className={titleStyle || `text-xl font-black ${c('text-main')} leading-snug ${headerAlign === 'center' ? 'text-center w-full px-12' : 'text-left pr-12'} break-keep`}>{title}</h2>}
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
  );
});

export const ProductThumbnail = memo(({ product, c, hideText = false, isTrash = false, hideTypo = false }: { 
  product: Product, 
  c: (cls: string) => string, 
  hideText?: boolean, 
  isTrash?: boolean, 
  hideTypo?: boolean 
}) => {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= product.minStockLevel;

  return (
    <div className="relative w-full h-full group bg-white flex items-center justify-center overflow-hidden">
      {product.imageUrl ? (
        <div className="w-full h-full flex items-center justify-center pointer-events-none">
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            loading="lazy"
            decoding="async"
            className={`w-full h-full object-cover ${isTrash ? 'grayscale opacity-60' : ''}`} 
          />
        </div>
      ) : (
        <div className={`w-full h-full flex flex-col items-center justify-center p-4 text-center ${c('bg-light')} ${c('text-soft')} relative overflow-hidden pointer-events-none`}>
          <div className="absolute inset-0 opacity-5 flex items-center justify-center -rotate-12 scale-150">
             <Package size={120} strokeWidth={1} />
          </div>
          {!hideTypo && (
            <div className="flex flex-col items-center justify-center flex-1 z-10">
              <span className="text-[18px] font-black leading-tight break-all px-2 mb-1 whitespace-pre-line">
                {product.name ? product.name.split(' ').join('\n') : '상품명\n없음'}
              </span>
              <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{product.type || 'ETC'}</span>
            </div>
          )}
        </div>
      )}
      {!hideText && !isTrash && (
        <>
          <div className="absolute inset-0 z-20 pointer-events-none">
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span className="text-white font-black text-[10px] border-2 border-white px-2 py-1 rounded-lg rotate-12 uppercase tracking-tighter shadow-xl">SOLD OUT</span>
              </div>
            )}
          </div>
          <div className="absolute left-2 bottom-2 z-30 flex flex-col gap-0.5 pointer-events-none items-start">
             {!isOutOfStock && (
               <div className={`px-1.5 py-0.5 rounded text-[8px] font-black shadow-sm uppercase border border-slate-200/50 ${isLowStock ? 'bg-amber-100/90 text-amber-700' : 'bg-slate-100/80 text-slate-500'}`}>
                 {product.stock}개 남음
               </div>
             )}
          </div>
        </>
      )}
    </div>
  );
});

interface ProductCardProps {
  product: Product;
  inCart: number;
  onAdd: (id: string) => void;
  onEdit: (p: Product) => void;
  onHistory: (p: Product) => void;
  c: (cls: string) => string;
  reorderMode?: boolean;
  onMove?: (id: string, dir: 'prev' | 'next') => void;
}

export const ProductCard = memo(({ 
  product, inCart, onAdd, onEdit, onHistory, c, reorderMode, onMove 
}: ProductCardProps) => {
  const isOutOfStock = product.stock === 0;

  return (
    <div className="relative group">
      <div 
        onClick={() => !reorderMode && !isOutOfStock && inCart < product.stock && onAdd(product.id)} 
        className={`${c('bg-card')} rounded-[1.5rem] border-2 ${c('border-light')} overflow-hidden flex flex-col transition-all duration-200 shadow-sm relative active:scale-[0.94] active:shadow-inner cursor-pointer`}
      >
        <div className="relative aspect-square overflow-hidden bg-white pointer-events-none">
          <ProductThumbnail product={product} c={c} />
          {inCart > 0 && !reorderMode && (
            <div className="absolute top-2 left-2 z-40 bg-rose-500 text-white text-[24px] min-w-[64px] h-[64px] px-2 rounded-[24px] flex items-center justify-center font-black border-[5px] border-white shadow-2xl animate-in zoom-in duration-300">{inCart}</div>
          )}
        </div>

        <div className="p-2 flex flex-col flex-1 gap-1 items-start border-t border-slate-50">
          <div className="flex gap-1 flex-wrap w-full overflow-hidden mb-0.5">
            {product.isSet && <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-yellow-300 text-white uppercase shadow-sm shrink-0">SET</span>}
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${c('bg-light')} ${c('text-soft')} uppercase truncate max-w-[50%]`}>{product.genre || '장르없음'}</span>
            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded ${c('bg-light')} ${c('text-soft')} opacity-70 uppercase truncate max-w-[50%]`}>{product.type || '기타'}</span>
          </div>
          <h4 className={`text-[12px] font-black ${c('text-main')} leading-tight break-words text-left w-full line-clamp-2 min-h-[1.6em]`}>{product.name}</h4>
          <div className="mt-auto flex justify-between items-center w-full gap-1 pt-1">
            <span className={`text-[13px] font-black ${c('text-primary')} italic tracking-tight`}>₩{product.price.toLocaleString()}</span>
            {!reorderMode && (
              <button onClick={(e) => { e.stopPropagation(); onHistory(product); }} className={`p-1.5 ${c('bg-light')} ${c('text-soft')} rounded border border-slate-100 active:scale-90 transition-all shrink-0`}>
                <History size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </div>

      {reorderMode ? (
        <div className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-[1px] flex items-center justify-center gap-2 rounded-[1.5rem]">
          <button 
            onClick={(e) => { e.stopPropagation(); onMove?.(product.id, 'prev'); }} 
            className="w-10 h-10 bg-white text-slate-800 rounded-xl shadow-xl flex items-center justify-center active:scale-90 transition-all border border-slate-200"
          >
            <ChevronLeft size={24} strokeWidth={3} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMove?.(product.id, 'next'); }} 
            className="w-10 h-10 bg-white text-slate-800 rounded-xl shadow-xl flex items-center justify-center active:scale-90 transition-all border border-slate-200"
          >
            <ChevronRight size={24} strokeWidth={3} />
          </button>
        </div>
      ) : (
        <div className="absolute top-1.5 right-1.5 z-50">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(product); }} 
            className={`p-1.5 ${c('bg-card')} ${c('text-soft')} rounded-lg shadow-sm border-2 ${c('border-light')} transition-colors pointer-events-auto hover:bg-slate-50`}
          >
            <Settings size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.name === next.product.name &&
    prev.product.price === next.product.price &&
    prev.product.stock === next.product.stock &&
    prev.product.imageUrl === next.product.imageUrl &&
    prev.product.genre === next.product.genre &&
    prev.product.type === next.product.type &&
    prev.product.isSet === next.product.isSet &&
    prev.product.order === next.product.order &&
    prev.inCart === next.inCart &&
    prev.reorderMode === next.reorderMode &&
    prev.c === next.c
  );
});

export const SimpleCalendar = memo(({ events, sales, products = [], onSaveEvent, onDeleteEvent, c, showToast }: { 
  events: CalendarEvent[], sales: Sale[], products?: Product[], onSaveEvent: (date: string, text: string) => void, onDeleteEvent: (date: string) => void, c: (cls: string) => string, showToast: (msg: string, type?: 'success' | 'info' | 'trash' | 'danger') => void
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [eventText, setEventText] = useState('');
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const days = [];
  for (let i = 0; i < firstDayOfMonth(year, month); i++) days.push(null);
  for (let i = 1; i <= daysInMonth(year, month); i++) days.push(i);

  // Fast sales lookup map by date key
  const salesByDate = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(s => {
      const sDate = new Date(s.timestamp);
      const key = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + s.totalAmount);
    });
    return map;
  }, [sales]);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    events.forEach(e => map.set(e.date, e));
    return map;
  }, [events]);

  const getEvent = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventsByDate.get(dateStr);
  };

  const getDailySalesAmount = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return salesByDate.get(dateStr) || 0;
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    setEventText(getEvent(day)?.text || '');
  };

  useEffect(() => { 
    if (selectedDay) setEventText(getEvent(selectedDay)?.text || ''); 
  }, [eventsByDate, selectedDay, year, month]);

  const selectedDateStr = selectedDay ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : null;
  const currentDailySales = selectedDay ? getDailySalesAmount(selectedDay) : 0;

  // 선택된 날짜의 카테고리별 일일 매출 요약
  const selectedDayCategories = useMemo(() => {
    if (!selectedDateStr || currentDailySales === 0) return [];
    const daySales = sales.filter(s => {
      const sDate = new Date(s.timestamp);
      return `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}` === selectedDateStr;
    });

    const catMap: Record<string, { name: string, revenue: number, quantity: number }> = {};
    daySales.forEach(s => {
      s.items.forEach(item => {
        const p = productMap.get(item.productId);
        const catName = normalizeVal(p?.type || '기타');
        if (!catMap[catName]) {
          catMap[catName] = { name: catName, revenue: 0, quantity: 0 };
        }
        catMap[catName].revenue += item.quantity * item.price;
        catMap[catName].quantity += item.quantity;
      });
    });

    return Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
  }, [selectedDateStr, currentDailySales, sales, productMap]);

  return (
    <div className={`${c('bg-card')} p-6 rounded-[2.5rem] border ${c('border-light')} space-y-4 shadow-sm w-full relative h-full flex flex-col overflow-visible`}>
      <div className="flex justify-between items-center mb-1 px-1 gap-4 shrink-0">
        <h3 className={`font-black ${c('text-primary')} flex items-center gap-2 text-[14px] uppercase tracking-tighter`}>
          <CalendarIcon size={16} className="shrink-0" /> <span className="whitespace-nowrap uppercase">기록 달력</span>
        </h3>
        <div className="flex gap-1.5 shrink-0 ml-auto">
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className={`p-2 ${c('bg-light')} rounded-xl ${c('text-soft')} tap-effect shadow-none`}><ChevronLeft size={16}/></button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className={`p-2 ${c('bg-light')} rounded-xl ${c('text-soft')} tap-effect shadow-none`}><ChevronRight size={16}/></button>
        </div>
      </div>
      <div className={`text-center font-black ${c('text-primary')} mb-2 text-[12px]`}>{year}년 {month + 1}월</div>
      <div className="grid grid-cols-7 gap-1 flex-1 min-h-0">
        {['일','월','화','수','목','금','토'].map(d => <div key={d} className={`text-center text-[9px] font-black ${c('text-muted')} uppercase py-1`}>{d}</div>)}
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const isSelection = selectedDay === day;
          const event = getEvent(day);
          const salesAmount = getDailySalesAmount(day);
          return (
            <button key={day} onClick={() => handleDayClick(day)} className={`relative h-12 rounded-xl flex flex-col items-center justify-start py-1 transition-all select-none border ${isSelection ? `ring-2 ${c('ring-primary')} ${c('bg-light')}` : ''} ${isToday ? `${c('bg-primary')} text-white border-transparent` : event ? `${c('bg-card')} ${c('border-light')} ${c('text-main')}` : `${c('bg-light/30')} border-transparent ${c('text-muted')} hover:${c('bg-light')}`}`}>
              <span className="text-[10px] font-black">{day}</span>
              {salesAmount > 0 && <div className={`text-[7px] font-black mt-0.5 truncate max-w-full px-0.5 ${isToday ? 'text-white' : 'text-emerald-400'}`}>₩{(salesAmount / 1000).toFixed(0)}k</div>}
              {event && <div className="mt-auto mb-0.5 w-full px-1 overflow-hidden"><div className={`text-[9px] truncate text-center font-black ${isToday ? 'text-white' : c('text-soft')} opacity-90 leading-none`}>{event.text}</div></div>}
            </button>
          );
        })}
      </div>
      {selectedDay && (
        <div className={`mt-2 p-5 ${c('bg-light')} rounded-[2rem] border ${c('border-light')} animate-in slide-in-from-bottom-2 duration-300 space-y-3 shrink-0 shadow-inner pb-6`}>
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2"><StickyNote size={14} className={c('text-primary')} /><p className={`text-[12px] font-black ${c('text-primary')} tracking-tight uppercase`}>{year}. {month+1}. {selectedDay}</p></div>
            {currentDailySales > 0 && <div className={`${c('bg-primary')} text-white px-2.5 py-1 rounded-full text-[9px] font-black shadow-sm border border-white/30 animate-in zoom-in`}>일일 매출: ₩{currentDailySales.toLocaleString()}</div>}
          </div>

          {/* 해당 일자의 카테고리별 일일 매출 요약 칩 */}
          {selectedDayCategories.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className={`text-[10px] font-black ${c('text-muted')} px-1 flex items-center gap-1`}>
                <Tags size={11} className={c('text-primary')} />
                <span>카테고리별 일일 매출</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedDayCategories.map(cat => (
                  <div key={cat.name} className={`${c('bg-card')} px-2.5 py-1 rounded-xl border ${c('border-light')} flex items-center gap-1.5 shadow-xs text-[10px] font-black`}>
                    <span className={c('text-main')}>{cat.name}</span>
                    <span className={c('text-primary')}>₩{cat.revenue.toLocaleString()}</span>
                    <span className="opacity-50 text-[8px]">({cat.quantity}개)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {getEvent(selectedDay) && (
            <div className={`${c('bg-card')} p-3 rounded-xl border ${c('border-light')} shadow-sm animate-in fade-in duration-300 relative group`}>
                <p className={`text-[12px] font-bold ${c('text-main')} leading-relaxed break-all whitespace-pre-wrap pr-8`}>{getEvent(selectedDay)?.text}</p>
                <button onClick={() => { if(selectedDateStr) { onDeleteEvent(selectedDateStr); setEventText(''); showToast('기록이 삭제되었습니다.', 'danger'); } }} className="absolute top-2 right-2 p-1.5 text-rose-300 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
            </div>
          )}
          <div className="flex gap-2 items-center bg-white rounded-2xl border-2 border-slate-100 pr-1.5 overflow-hidden shadow-sm w-full">
            <input className={`flex-1 min-w-0 h-11 bg-transparent px-3 text-[13px] font-black outline-none transition-all placeholder:${c('text-muted')}`} placeholder="기록하기... ♡" value={eventText} onChange={(e) => setEventText(e.target.value)} />
            <button onClick={() => { if(selectedDateStr) { onSaveEvent(selectedDateStr, eventText); setEventText(''); showToast('일정이 저장되었습니다 ♡'); } }} className={`w-9 h-9 ${c('bg-primary')} text-white rounded-xl tap-effect shadow-sm flex items-center justify-center shrink-0`}><CheckCircle2 size={16} strokeWidth={3} /></button>
          </div>
        </div>
      )}
    </div>
  );
});

export const AnalyticsDashboard = memo(({ sales, products, events, onSaveEvent, onFilterClick, c, showToast }: { 
  sales: Sale[], products: Product[], events: CalendarEvent[], onSaveEvent: (date: string, text: string) => void, onFilterClick: (status: 'out' | 'low') => void, c: (cls: string) => string, showToast: (msg: string, type?: 'success' | 'info' | 'trash' | 'danger') => void
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'category' | 'hourly' | 'product' | 'stock'>('daily');
  const [categoryType, setCategoryType] = useState<'type' | 'genre'>('type');
  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(0); // 0 = 오늘, 1 = 어제, ...

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  const regMap = useMemo(() => {
    const map: Record<string, number> = {};
    [...products].sort((a, b) => a.lastUpdated - b.lastUpdated).forEach((p, idx) => { map[p.id] = idx + 1; });
    return map;
  }, [products]);

  const hourlyData = useMemo(() => {
    const res = []; const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600000); const hour = d.getHours();
      const hSales = sales.filter(s => { const sd = new Date(s.timestamp); return sd.getHours() === hour && sd.toDateString() === d.toDateString(); });
      res.push({ label: `${hour}시`, value: hSales.reduce((acc, s) => acc + s.totalAmount, 0), count: hSales.length });
    }
    return res;
  }, [sales]);

  const dailyData = useMemo(() => {
    const res = []; const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(now.getDate() - i); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dSales = sales.filter(s => { const sd = new Date(s.timestamp); return `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}` === key; });
      res.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, value: dSales.reduce((acc, s) => acc + s.totalAmount, 0), count: dSales.length });
    }
    return res;
  }, [sales]);

  // [카테고리마다 일일 매출 합계 계산]
  const targetCategoryDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - selectedDateOffset);
    return d;
  }, [selectedDateOffset]);

  const targetCategoryDateStr = useMemo(() => {
    const y = targetCategoryDate.getFullYear();
    const m = targetCategoryDate.getMonth() + 1;
    const d = targetCategoryDate.getDate();
    const diffText = selectedDateOffset === 0 ? '오늘' : selectedDateOffset === 1 ? '어제' : `${selectedDateOffset}일 전`;
    return `${y}년 ${m}월 ${d}일 (${diffText})`;
  }, [targetCategoryDate, selectedDateOffset]);

  const dailyCategoryStats = useMemo(() => {
    const targetKey = `${targetCategoryDate.getFullYear()}-${String(targetCategoryDate.getMonth() + 1).padStart(2, '0')}-${String(targetCategoryDate.getDate()).padStart(2, '0')}`;
    
    const daySales = sales.filter(s => {
      const sd = new Date(s.timestamp);
      return `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}` === targetKey;
    });

    const totalDayRevenue = daySales.reduce((acc, s) => acc + s.totalAmount, 0);
    const catMap: Record<string, { key: string, name: string, revenue: number, quantity: number, orderCount: number }> = {};

    daySales.forEach(sale => {
      sale.items.forEach(item => {
        const p = productMap.get(item.productId);
        const rawCategory = categoryType === 'type' ? p?.type : p?.genre;
        const catKey = normalizeVal(rawCategory);

        if (!catMap[catKey]) {
          catMap[catKey] = {
            key: catKey,
            name: catKey,
            revenue: 0,
            quantity: 0,
            orderCount: 0
          };
        }
        catMap[catKey].revenue += item.price * item.quantity;
        catMap[catKey].quantity += item.quantity;
        catMap[catKey].orderCount += 1;
      });
    });

    const list = Object.values(catMap).sort((a, b) => b.revenue - a.revenue);
    const maxRev = Math.max(...list.map(c => c.revenue), 1);

    return {
      list,
      totalRevenue: totalDayRevenue,
      totalQuantity: list.reduce((sum, item) => sum + item.quantity, 0),
      maxRevenue: maxRev
    };
  }, [sales, targetCategoryDate, categoryType, productMap]);

  const prodRev = useMemo(() => {
    const m: Record<string, { id: string, name: string, revenue: number }> = {};
    sales.forEach(s => s.items.forEach(i => { if (!m[i.productId]) m[i.productId] = { id: i.productId, name: i.name, revenue: 0 }; m[i.productId].revenue += i.quantity * i.price; }));
    return Object.values(m).sort((a, b) => b.revenue - a.revenue).slice(0, 15);
  }, [sales]);

  const stockData = useMemo(() => [...products].sort((a, b) => a.stock - b.stock), [products]);
  const maxV = useMemo(() => Math.max(...(viewMode === 'hourly' ? hourlyData : dailyData).map(d => d.value), 1), [viewMode, hourlyData, dailyData]);
  const maxS = useMemo(() => Math.max(...stockData.map(d => d.stock), 1), [stockData]);
  const curData = viewMode === 'hourly' ? hourlyData : dailyData;
  const outC = products.filter(p => p.stock === 0).length;
  const lowC = products.filter(p => p.stock > 0 && p.stock <= p.minStockLevel).length;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 w-full items-start overflow-visible">
      <div className="grid grid-cols-2 gap-3 w-full order-1 lg:order-1 lg:col-span-2">
        <button onClick={() => onFilterClick('out')} className={`p-4 rounded-[1.8rem] border shadow-sm transition-all tap-effect ${outC > 0 ? 'bg-rose-50 border-rose-100' : `${c('bg-light')} ${c('border-light')}`} text-left group`}>
          <div className="flex justify-between items-center">
            <div><p className={`text-[9px] font-black uppercase mb-0.5 ${outC > 0 ? 'text-rose-300' : c('text-muted')}`}>품절</p><div className="flex items-baseline gap-0.5"><span className={`text-2xl font-black italic ${outC === 0 ? 'opacity-20' : 'text-rose-400'}`}>{outC}</span><span className={`text-[10px] font-black ${outC === 0 ? 'opacity-20' : 'text-rose-300'}`}>건</span></div></div>
            <AlertCircle className={outC > 0 ? 'text-rose-300' : 'text-slate-200'} size={24} />
          </div>
        </button>
        <button onClick={() => onFilterClick('low')} className={`p-4 rounded-[1.8rem] border shadow-sm transition-all tap-effect ${lowC > 0 ? 'bg-amber-50 border-amber-100' : `${c('bg-light')} ${c('border-light')}`} text-left group`}>
          <div className="flex justify-between items-center">
            <div><p className={`text-[9px] font-black uppercase mb-0.5 ${lowC > 0 ? 'text-amber-400' : c('text-muted')}`}>재고 부족</p><div className="flex items-baseline gap-0.5"><span className={`text-2xl font-black italic ${lowC === 0 ? 'opacity-20' : 'text-amber-500'}`}>{lowC}</span><span className={`text-[10px] font-black ${lowC === 0 ? 'opacity-20' : 'text-amber-400'}`}>건</span></div></div>
            <Package className={lowC > 0 ? 'text-amber-400' : 'text-slate-200'} size={24} />
          </div>
        </button>
      </div>

      <div className={`${c('bg-card')} p-6 rounded-[2.5rem] border ${c('border-light')} space-y-4 relative overflow-visible h-full w-full flex flex-col shadow-sm order-2 lg:order-2`}>
        <div className="flex justify-between items-center px-1 gap-2 shrink-0">
          <h3 className={`font-black ${c('text-primary')} flex items-center gap-2 text-[14px] uppercase tracking-tighter`}>
            {viewMode === 'hourly' ? <Clock size={18}/> : viewMode === 'daily' ? <TrendingUp size={18}/> : viewMode === 'category' ? <Tags size={18}/> : viewMode === 'product' ? <PieChart size={18}/> : <Package size={18}/>}
            <span className="uppercase">
              {viewMode === 'hourly' ? '시간별 매출' : viewMode === 'daily' ? '최근 매출' : viewMode === 'category' ? '카테고리별 일일 매출' : viewMode === 'product' ? '인기 상품' : '재고 현황'}
            </span>
          </h3>
          <div className={`flex ${c('bg-light')} p-1 rounded-xl gap-1 shrink-0 ml-auto`}>
            {(['daily', 'category', 'product', 'hourly', 'stock'] as const).map((m) => (
              <button 
                key={m} 
                onClick={() => setViewMode(m)} 
                className={`p-1.5 rounded-lg transition-all ${viewMode === m ? `${c('bg-card')} ${c('text-primary')} shadow-sm` : c('text-soft')}`}
                title={m === 'daily' ? '최근 매출' : m === 'category' ? '카테고리별 일일 매출' : m === 'product' ? '인기 상품' : m === 'hourly' ? '시간별 매출' : '재고 현황'}
              >
                {m === 'hourly' ? <Clock size={14}/> : m === 'daily' ? <TrendingUp size={14}/> : m === 'category' ? <Tags size={14}/> : m === 'product' ? <BarChart3 size={14}/> : <Package size={14}/>}
              </button>
            ))}
          </div>
        </div>

        {/* 카테고리별 일일 매출 뷰 전용 상단 툴바 (날짜 이동 및 분류 기준 선택) */}
        {viewMode === 'category' && (
          <div className="space-y-2 pt-1 pb-1">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setSelectedDateOffset(prev => prev + 1)}
                  className={`p-1.5 rounded-lg ${c('bg-light')} ${c('text-soft')} tap-effect border border-white/50`}
                  title="이전 날짜"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className={`text-[11px] font-black ${c('text-main')} whitespace-nowrap`}>
                  {targetCategoryDateStr}
                </span>
                <button 
                  onClick={() => setSelectedDateOffset(prev => Math.max(0, prev - 1))}
                  disabled={selectedDateOffset === 0}
                  className={`p-1.5 rounded-lg ${c('bg-light')} ${c('text-soft')} tap-effect border border-white/50 ${selectedDateOffset === 0 ? 'opacity-30 cursor-not-allowed' : ''}`}
                  title="다음 날짜"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {selectedDateOffset !== 0 && (
                <button 
                  onClick={() => setSelectedDateOffset(0)}
                  className={`text-[9px] font-black px-2 py-1 rounded-lg ${c('bg-primary')} text-white tap-effect`}
                >
                  오늘
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex gap-1">
                <button 
                  onClick={() => setCategoryType('type')}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all ${categoryType === 'type' ? `${c('bg-primary')} text-white shadow-xs` : `${c('bg-light')} ${c('text-soft')}`}`}
                >
                  종류별 (Type)
                </button>
                <button 
                  onClick={() => setCategoryType('genre')}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all ${categoryType === 'genre' ? `${c('bg-primary')} text-white shadow-xs` : `${c('bg-light')} ${c('text-soft')}`}`}
                >
                  장르별 (Genre)
                </button>
              </div>

              <span className={`text-[10px] font-black ${c('text-primary')}`}>
                일일 합계: ₩{dailyCategoryStats.totalRevenue.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div className="h-[220px] flex items-end px-1 pt-4 flex-1 overflow-visible">
          {(viewMode === 'hourly' || viewMode === 'daily') && (
            <div className="flex items-end justify-between w-full h-full gap-2 relative overflow-visible">
              {curData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative h-full justify-end overflow-visible">
                  <div className={`w-full ${c('bg-gradient-primary')} rounded-t-lg chart-bar-animation relative cursor-default`} style={{ height: `${(d.value / maxV) * 100}%`, minHeight: '4px' }}>
                    {d.value > 0 && (
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-2 py-1.5 rounded-xl font-black whitespace-nowrap z-[100] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center gap-0.5 border border-white/20 shadow-2xl">
                        <span>₩{(d.value / 10000).toFixed(1)}만</span>
                        <span className="opacity-60 text-[7px] font-bold text-slate-300">(결제 {d.count}건)</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-[8px] font-black ${c('text-soft')} whitespace-nowrap uppercase`}>{d.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* 카테고리별 일일 매출 목록 뷰 */}
          {viewMode === 'category' && (
            <div className="w-full h-full overflow-y-auto no-scrollbar space-y-3 pr-1">
              {dailyCategoryStats.list.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 gap-2 opacity-50">
                  <Tags size={32} className={c('text-soft')} />
                  <p className={`text-center ${c('text-muted')} font-bold text-[11px] italic`}>
                    해당 일자의 카테고리별 판매 기록이 없습니다 ♡
                  </p>
                </div>
              ) : (
                dailyCategoryStats.list.map((cat, i) => {
                  const sharePercent = dailyCategoryStats.totalRevenue > 0 
                    ? ((cat.revenue / dailyCategoryStats.totalRevenue) * 100).toFixed(1)
                    : '0.0';
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-black gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-4 h-4 rounded-full ${c('bg-light')} ${c('text-primary')} flex items-center justify-center text-[8px] shrink-0 font-mono`}>
                            {i + 1}
                          </span>
                          <span className={`${c('text-main')} truncate`}>{cat.name}</span>
                          <span className="opacity-45 text-[8px] whitespace-nowrap font-normal">
                            ({cat.quantity}개 / {sharePercent}%)
                          </span>
                        </div>
                        <span className={`${c('text-primary')} shrink-0 italic`}>
                          ₩{cat.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div className={`w-full ${c('bg-light')} h-2 rounded-full overflow-hidden shadow-inner`}>
                        <div 
                          className={`${c('bg-gradient-primary')} h-full rounded-full transition-all duration-700`}
                          style={{ width: `${(cat.revenue / dailyCategoryStats.maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {(viewMode === 'product' || viewMode === 'stock') && (
            <div className="w-full h-full overflow-y-auto no-scrollbar space-y-3 pr-1">
              {(viewMode === 'product' ? prodRev : stockData).length === 0 ? (
                <div className={`py-12 text-center ${c('text-muted')} font-bold text-[11px] italic`}>
                  데이터가 부족합니다 ♡
                </div>
              ) : (
                (viewMode === 'product' ? prodRev : stockData).map((p: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-[10px] font-black gap-2">
                      <span className={`${c('text-main-soft')} truncate flex-1`}>
                        {p.name} (상품번호: {regMap[p.id || p.productId] || '?'}번)
                      </span>
                      <span className={`${viewMode === 'product' ? c('text-primary') : p.stock === 0 ? "text-rose-400" : p.stock <= p.minStockLevel ? "text-amber-400" : c('text-primary')} shrink-0`}>
                        {viewMode === 'product' ? `₩${p.revenue.toLocaleString()}` : `${p.stock}개`}
                      </span>
                    </div>
                    <div className={`w-full ${p.stock === 0 && viewMode === 'stock' ? 'bg-rose-50' : c('bg-light')} h-2 rounded-full overflow-hidden shadow-inner`}>
                      <div 
                        className={`${viewMode === 'product' ? c('bg-gradient-primary') : p.stock === 0 ? "bg-rose-300" : p.stock <= p.minStockLevel ? "bg-amber-300" : c('bg-primary')} h-full rounded-full transition-all duration-1000`} 
                        style={{ width: p.stock === 0 && viewMode === 'stock' ? '100%' : `${((viewMode === 'product' ? p.revenue : p.stock) / (viewMode === 'product' ? (prodRev[0] as any).revenue : maxS)) * 100}%` }} 
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-full order-3 lg:order-3">
        <SimpleCalendar 
          events={events} 
          sales={sales} 
          products={products}
          onSaveEvent={onSaveEvent} 
          onDeleteEvent={(date) => onSaveEvent(date, '')} 
          c={c} 
          showToast={showToast} 
        />
      </div>
    </div>
  );
});
