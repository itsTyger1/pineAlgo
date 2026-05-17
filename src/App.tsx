/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  RefreshCcw, 
  ChevronRight,
  Info,
  ExternalLink,
  Table as TableIcon,
  LayoutGrid,
  BarChart3,
  Filter,
  Check,
  ChevronDown,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StockAnalysis {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: number;
  maFast: number;
  maSlow: number;
  rsi: number;
  zone: string;
  sector: string;
  industry: string;
  lastUpdated: string;
}

export default function App() {
  const [symbols, setSymbols] = useState<{symbol: string, marketCap: number}[]>([]);
  const [stocks, setStocks] = useState<Record<string, StockAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('table');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'marketCap' | 'change' | 'rsi' | 'zone'>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [timeframe, setTimeframe] = useState<'1d' | '1wk' | '1mo'>('1d');
  const [signalFilters, setSignalFilters] = useState<string[]>([]);
  const [sectorFilters, setSectorFilters] = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true;
    }
    return true;
  });
  const signalRef = useRef<HTMLDivElement>(null);
  const sectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (signalRef.current && !signalRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (sectorRef.current && !sectorRef.current.contains(event.target as Node)) {
        setShowSectorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSignalFilter = (filter: string) => {
    setSignalFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter) 
        : [...prev, filter]
    );
  };

  const toggleSectorFilter = (filter: string) => {
    setSectorFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter) 
        : [...prev, filter]
    );
  };

  const symbolRanks = useMemo(() => {
    return [...symbols]
      .sort((a, b) => b.marketCap - a.marketCap)
      .reduce((acc, curr, i) => {
        acc[curr.symbol] = i + 1;
        return acc;
      }, {} as Record<string, number>);
  }, [symbols]);

  useEffect(() => {
    fetchStocks();
  }, []);

  useEffect(() => {
    if (symbols.length > 0) {
      setStocks({});
      fetchAllAnalysis(symbols.map(s => s.symbol), timeframe);
    }
  }, [timeframe]);

  // Robust fetch with retry
  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 2) => {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429 && retries > 0) {
          await new Promise(r => setTimeout(r, 1000));
          return fetchWithRetry(url, options, retries - 1);
        }
        throw new Error(`HTTP Error: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  };

  const fetchStocks = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchWithRetry('/api/stocks');
      if (Array.isArray(data)) {
        setSymbols(data);
        setStocks({});
        await fetchAllAnalysis(data.map(s => s.symbol), timeframe);
      } else {
        setError('Failed to fetch stock list');
      }
    } catch (err) {
      setError('Connection error: System calibrating. Please wait...');
      console.error(err);
    } finally {
      setLoading(false);
      setLastSynced(new Date());
    }
  };

  const fetchAllAnalysis = async (list: string[], currentTF: string) => {
    setLoading(true);
    // Process in chunks to balance speed and reliability
    // 15 is a good balance for higher volumes (500 assets)
    const batchSize = 15;
    const chunks = [];
    for (let i = 0; i < list.length; i += batchSize) {
      chunks.push(list.slice(i, i + batchSize));
    }

    let failCount = 0;

    for (const [index, chunk] of chunks.entries()) {
      const results = await Promise.all(
        chunk.map(async (sym) => {
          try {
            // Add a small randomized jitter to distribute server load if multiple clients hit at once
            const jitter = Math.random() * 200;
            if (index > 0) await new Promise(r => setTimeout(r, jitter));
            
            const data = await fetchWithRetry(`/api/analysis/${sym}?timeframe=${currentTF}`);
            if (data.error) throw new Error(data.error);
            return data;
          } catch (e) {
            console.warn(`Analysis failed for ${sym}:`, e);
            failCount++;
            return null;
          }
        })
      );

      setStocks(prev => {
        const next = { ...prev };
        results.forEach(res => {
          if (res && res.symbol) {
            next[res.symbol] = res;
          }
        });
        return next;
      });
    }

    if (failCount > list.length / 2) {
      setError(`Notice: High latency detected. Only ${list.length - failCount} out of ${list.length} assets could be fully synchronized. Try refreshing in a few moments.`);
    }

    setLoading(false);
  };

  const [pullY, setPullY] = useState(0);
  const touchStart = useRef(0);

  useEffect(() => {
    let currentPullY = 0;
    const scrollThreshold = 80;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        touchStart.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const scrollPos = window.scrollY || document.documentElement.scrollTop;
      
      if (scrollPos <= 0) {
        const delta = e.touches[0].clientY - touchStart.current;
        if (delta > 0) {
          // If we are pulling down, update visual state
          currentPullY = Math.min(delta * 0.4, 100);
          setPullY(currentPullY);
          
          // Only prevent default if we have actually pulled a bit to avoid
          // breaking horizontal swipes or minimal accidental vertical movements
          if (currentPullY > 10 && e.cancelable) {
            e.preventDefault();
          }
        } else {
          currentPullY = 0;
          setPullY(0);
        }
      }
    };

    const onTouchEnd = () => {
      if (currentPullY >= scrollThreshold && !loading) {
        fetchStocks();
      }
      currentPullY = 0;
      setPullY(0);
    };

    // Use passive: false so we CAN prevent default browser pull-to-refresh if needed
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [loading]); // Only re-bind if loading state changes (to capture correct fetchStocks ref if needed, though fetchStocks is likely stable)

  const handleChartRedirect = (symbol: string) => {
    const userAgent = navigator.userAgent || navigator.vendor;
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const webUrl = `https://www.tradingview.com/chart/?symbol=${symbol.toUpperCase()}`;
    
    // For Android, use the Intent system which is highly reliable for specific app navigation
    if (isAndroid) {
      const intentUrl = `intent://www.tradingview.com/chart/?symbol=${symbol.toUpperCase()}#Intent;scheme=https;package=com.tradingview.tradingviewapp;end`;
      window.location.href = intentUrl;
      return;
    }

    // For iOS, Universal Links usually work best if triggered via location.href
    // However, we can try the direct scheme first
    if (isIOS) {
      const appUrl = `tradingview://chart?symbol=${symbol.toUpperCase()}`;
      window.location.href = appUrl;
      
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.location.href = webUrl;
        }
      }, 1200);
      return;
    }

    // Desktop
    window.open(webUrl, '_blank');
  };

  const rankedStocks = useMemo(() => {
    const list = Object.values(stocks) as StockAnalysis[];
    return list.map(s => ({
      ...s,
      mcRank: symbolRanks[s.symbol] || 999
    }));
  }, [stocks, symbolRanks]);

  const filteredStocks = useMemo(() => {
    const list = rankedStocks.filter(s => {
      const matchesSearch = s.symbol.toLowerCase().includes(search.toLowerCase()) || 
                            s.name.toLowerCase().includes(search.toLowerCase());
      const matchesSignal = signalFilters.length === 0 || signalFilters.includes(s.zone);
      const matchesSector = sectorFilters.length === 0 || sectorFilters.includes(s.sector);
      return matchesSearch && matchesSignal && matchesSector;
    });

    return [...list].sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'marketCap') return (a.marketCap - b.marketCap) * factor;
      if (sortBy === 'change') return (a.change - b.change) * factor;
      if (sortBy === 'rsi') return (a.rsi - b.rsi) * factor;
      if (sortBy === 'zone') {
        const weights: Record<string, number> = {
          'Standard Buy': 1,
          'Value Pullback': 2,
          'Sell Section': 3,
          'Neutral': 4
        };
        const valA = weights[a.zone] || 4;
        const valB = weights[b.zone] || 4;
        return (valA - valB) * factor;
      }
      return 0;
    });
  }, [rankedStocks, search, sortBy, sortOrder, signalFilters, sectorFilters]);

  const formatMarketCap = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const handleSort = (key: 'marketCap' | 'change' | 'rsi' | 'zone') => {
    if (sortBy === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const stats = useMemo(() => {
    const list = Object.values(stocks) as StockAnalysis[];
    const sectors = Array.from(new Set(list.map(s => s.sector))).filter(Boolean).sort();
    return {
      buyCount: list.filter(s => s.zone === 'Standard Buy').length,
      valueCount: list.filter(s => s.zone === 'Value Pullback').length,
      sellCount: list.filter(s => s.zone === 'Sell Section').length,
      neutralCount: list.filter(s => !['Standard Buy', 'Value Pullback', 'Sell Section'].includes(s.zone)).length,
      total: list.length,
      sectors
    };
  }, [stocks]);

  const getZoneBadge = (zone: string) => {
    const baseClass = "px-1.5 md:px-3 py-0.5 md:py-1 rounded font-bold uppercase tracking-tighter text-[8px] md:text-[10px] whitespace-nowrap";
    switch (zone) {
      case 'Standard Buy': 
        return (
          <span className={`${baseClass} inline-flex items-center gap-1 transition-all duration-300 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-emerald-50 text-emerald-600 border-emerald-200 border'}`}>
            <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> 
            <span className="hidden md:inline">Standard Buy</span>
            <span className="md:hidden">Buy</span>
          </span>
        );
      case 'Value Pullback': 
        return (
          <span className={`${baseClass} inline-flex items-center gap-1 transition-all duration-300 ${isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-50 text-amber-600 border-amber-200 border'}`}>
            <Info className="w-2.5 h-2.5 md:w-3 md:h-3" /> 
            <span className="hidden md:inline">Value Pullback</span>
            <span className="md:hidden">Value</span>
          </span>
        );
      case 'Sell Section': 
        return (
          <span className={`${baseClass} inline-flex items-center gap-1 transition-all duration-300 ${isDarkMode ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-rose-50 text-rose-600 border-rose-200 border'}`}>
            <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" /> 
            <span className="hidden md:inline">Sell Zone</span>
            <span className="md:hidden">Sell</span>
          </span>
        );
      default: 
        return <span className={`transition-all duration-300 ${baseClass} ${isDarkMode ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>Neutral</span>;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative overscroll-y-none ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Pull to Refresh Indicator */}
      <div 
        id="pull-refresh-indicator"
        className="fixed top-0 left-0 w-full z-[100] flex items-center justify-center pointer-events-none transition-transform"
        style={{ transform: `translateY(${pullY - 50}px)`, opacity: pullY > 15 ? 1 : 0 }}
      >
        <div className={`rounded-full p-2.5 shadow-2xl flex items-center gap-2 transition-all duration-300 ${isDarkMode ? 'bg-indigo-600 border-white/20 shadow-indigo-500/50 text-white' : 'bg-white border-slate-200 shadow-slate-200 text-indigo-600 border'}`}>
          <RefreshCcw className={`w-4 h-4 ${loading || pullY >= 80 ? 'animate-spin' : ''}`} />
          {pullY >= 80 && !loading && <span className={`text-[8px] font-black uppercase tracking-widest pr-1 ${isDarkMode ? 'text-white' : 'text-indigo-600'}`}>Release to Sync</span>}
        </div>
      </div>
      {/* Frosted Glass Background Accents */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-600/10'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] ${isDarkMode ? 'bg-emerald-600/10' : 'bg-emerald-600/5'}`}></div>
        <div className={`absolute top-[20%] right-[10%] w-[30%] h-[10%] rounded-full blur-[120px] ${isDarkMode ? 'bg-amber-600/10' : 'bg-amber-600/5'}`}></div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 h-14 md:h-20 border-b flex items-center justify-between px-3 md:px-8 backdrop-blur-md transition-all duration-300 ${isDarkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-10 md:h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <BarChart3 className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </div>
          <h1 className={`text-base md:text-xl font-bold tracking-tight uppercase select-none hidden sm:block ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            PINE<span className="text-indigo-400 font-black">ALGO</span>
          </h1>
        </div>

        <div className={`flex-1 max-w-md mx-2 md:mx-8 relative group transition-all duration-300 ${isSearchOpen ? 'translate-y-0 opacity-100' : 'hidden lg:block'}`}>
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 group-focus-within:text-indigo-400 transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <input 
            type="text" 
            placeholder="Search Assets..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 placeholder:text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-900 focus:bg-white placeholder:text-slate-400'}`}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            className={`p-2 rounded-full transition-all interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          <button 
            className={`lg:hidden p-2 interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="w-5 h-5" />
          </button>

          <div className={`flex p-0.5 rounded-lg border shrink-0 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
            {[
              { id: '1d', label: '1D' },
              { id: '1wk', label: '1W' },
              { id: '1mo', label: '1M' }
            ].map((tf) => (
              <button
                key={tf.id}
                onClick={() => setTimeframe(tf.id as any)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                  timeframe === tf.id 
                    ? 'bg-indigo-500 text-white shadow-lg' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button 
            onClick={fetchStocks}
            className={`p-2 rounded-full transition-all active:scale-95 disabled:opacity-50 interactive-target ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
            disabled={loading}
            title="Force Sync"
          >
            <RefreshCcw className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Total Assets Counter */}
          <div className={`flex items-baseline gap-1 md:gap-1.5 pl-2 md:pl-4 border-l font-mono ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 tracking-wider">Analyzed:</span>
            <span className="text-xs md:text-sm font-black text-indigo-400">{stats.total} <span className="text-[10px] text-slate-500 font-bold">/ {symbols.length || '...'}</span></span>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-full px-4 md:px-8 text-left py-4 md:py-8">
        {/* Status System Overlay */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 font-mono">
          <div className="flex flex-wrap items-center gap-3">
            {/* Market Flow Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'} ${stats.buyCount + stats.valueCount > stats.sellCount ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${stats.buyCount + stats.valueCount > stats.sellCount ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                Flow: {stats.buyCount + stats.valueCount > stats.sellCount ? 'Bullish' : 'Bearish'}
              </span>
            </div>

            {/* Sync Timer */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
              <RefreshCcw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {lastSynced ? `Synced: ${lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Calibrating...'}
              </span>
            </div>

            {/* Loading Finished Notification */}
            <AnimatePresence>
              {!loading && stats.total > 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                >
                  <Check className="w-3 h-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Analysis Core Ready</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`hidden xl:flex items-center gap-2 px-2 py-1 rounded border opacity-40 hover:opacity-100 transition-opacity ${isDarkMode ? 'border-white/5 bg-slate-900/40' : 'border-slate-200 bg-slate-100'}`}>
              <span className="text-[8px] font-black text-indigo-400/80 uppercase">Yahoo Feed v1.2</span>
            </div>
          </div>

          {/* Breakdown Notification Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2 w-full md:w-auto">
            <div className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>{stats.buyCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Standard Buys</span>
            </div>
            <div className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl ${isDarkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>{stats.valueCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-amber-400/60' : 'text-amber-600/60'}`}>Pullbacks</span>
            </div>
            <div className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl ${isDarkMode ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>{stats.sellCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-rose-400/60' : 'text-rose-600/60'}`}>Sell Zones</span>
            </div>
            <div className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{stats.neutralCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Neutral</span>
            </div>
          </div>
        </div>

        {error && (
          <div className={`mb-6 p-4 border rounded-2xl flex items-center gap-3 text-sm backdrop-blur-md transition-all ${isDarkMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 font-mono' : 'bg-rose-50 border-rose-200 text-rose-600 font-sans'}`}>
            <AlertCircle className={`w-4 h-4 ${isDarkMode ? 'shadow-rose-500/20' : ''}`} />
            <span className="font-medium tracking-tight whitespace-pre-wrap">{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-4 h-0.5 bg-indigo-500"></div>
              Asset Monitor
            </div>
            {loading && <div className="text-[10px] font-bold text-indigo-400 animate-pulse tracking-[0.2em]">SYNCHRONIZING...</div>}
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex p-1 rounded-xl border transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
              <button 
                onClick={() => setView('table')}
                className={`p-1.5 rounded-lg transition-all ${view === 'table' ? (isDarkMode ? 'bg-white/10 text-white shadow-lg' : 'bg-white text-slate-950 shadow-sm') : 'text-slate-500 hover:text-slate-300'}`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-lg transition-all ${view === 'grid' ? (isDarkMode ? 'bg-white/10 text-white shadow-lg' : 'bg-white text-slate-950 shadow-sm') : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {view === 'table' ? (
          <div className={`backdrop-blur-xl border rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all duration-300 w-full ${isDarkMode ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono min-w-[550px] lg:min-w-0 table-fixed">
                <thead>
                  <tr className={`border-b text-[9px] md:text-[10px] uppercase tracking-tighter md:tracking-wider font-bold transition-all duration-300 ${isDarkMode ? 'border-white/10 bg-slate-900/50 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                    <th className={`px-1 md:px-4 py-2.5 sticky left-0 z-10 backdrop-blur-md whitespace-nowrap w-[25%] font-mono transition-all duration-300 ${isDarkMode ? 'bg-slate-950/80 border-r border-white/10' : 'bg-white/80 border-r border-slate-200'}`}>
                      <div className="flex items-center gap-1 md:gap-3">
                        <span className="w-4 md:w-8 text-right pr-1 md:pr-2 border-r border-white/10 shrink-0">#</span>
                        <div className="flex-1 flex justify-center">
                          <div className="relative inline-block text-left" ref={sectorRef}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowSectorDropdown(!showSectorDropdown); }}
                              className={`bg-transparent text-[9px] md:text-[10px] font-bold uppercase tracking-tighter transition-colors flex items-center gap-1 interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                              <Filter className="w-2.5 h-2.5" />
                              Asset
                            </button>

                            {showSectorDropdown && (
                              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 border rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl max-h-64 overflow-y-auto transition-all ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                                <div className={`px-3 py-1 mb-1 text-[8px] font-black uppercase tracking-widest border-b text-center ${isDarkMode ? 'text-slate-500 border-white/5' : 'text-slate-400 border-slate-100'}`}>Filter by Sector</div>
                                {stats.sectors.map((sector) => (
                                  <button
                                    key={sector}
                                    onClick={(e) => { e.stopPropagation(); toggleSectorFilter(sector); }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all group/opt interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                                  >
                                    <span className={sectorFilters.includes(sector) ? 'text-indigo-400' : ''}>{sector}</span>
                                    {sectorFilters.includes(sector) && <Check className="w-3 h-3 text-indigo-400" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </th>
                    <th 
                      className={`px-1 md:px-4 py-3 cursor-pointer transition-colors whitespace-nowrap w-[15%] text-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-950'}`}
                      onClick={() => handleSort('marketCap')}
                    >
                      Cap
                    </th>
                    <th className="px-1 md:px-4 py-3 text-center group relative z-10 whitespace-nowrap w-[20%]">
                      <div className="flex items-center justify-center gap-1">
                        <div className="relative inline-block text-left" ref={signalRef}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowFilterDropdown(!showFilterDropdown); }}
                            className={`bg-transparent text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
                          >
                            <Filter className="w-2.5 h-2.5" />
                            Signal
                          </button>

                          {showFilterDropdown && (
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 border rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl transition-all ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200'}`}>
                              {['Standard Buy', 'Value Pullback', 'Sell Section', 'Neutral'].map((option) => (
                                <button
                                  key={option}
                                  onClick={(e) => { e.stopPropagation(); toggleSignalFilter(option); }}
                                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all group/opt interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
                                >
                                  <span className={signalFilters.includes(option) ? 'text-indigo-400' : ''}>{option}</span>
                                  {signalFilters.includes(option) && <Check className="w-3 h-3 text-indigo-400" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                    <th className="px-1 md:px-4 py-3 whitespace-nowrap w-[15%] text-center">Trend</th>
                    <th 
                      className={`px-1 md:px-4 py-3 cursor-pointer transition-colors whitespace-nowrap w-[15%] text-center ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-950'}`}
                      onClick={() => handleSort('rsi')}
                    >
                      RSI
                    </th>
                    <th 
                      className={`px-1 md:px-4 py-3 text-center cursor-pointer transition-colors whitespace-nowrap w-[10%] ${isDarkMode ? 'hover:text-white' : 'hover:text-slate-950'}`}
                      onClick={() => handleSort('change')}
                    >
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y transition-all duration-300 ${isDarkMode ? 'divide-white/5' : 'divide-slate-200'}`}>
                  <AnimatePresence mode="popLayout">
                    {filteredStocks.map((stock) => (
                      <motion.tr 
                        key={stock.symbol}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`group transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-indigo-500 ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}
                        onClick={() => handleChartRedirect(stock.symbol)}
                      >
                        <td className={`px-1 md:px-4 py-2.5 sticky left-0 z-10 backdrop-blur-md whitespace-nowrap transition-all duration-300 ${isDarkMode ? 'bg-slate-950/80' : 'bg-white/80 border-r border-slate-100/50'}`}>
                          <div className="flex items-center gap-1 md:gap-3">
                            <span className={`text-[9px] md:text-[10px] font-black w-4 md:w-8 text-right pr-1 md:pr-2 border-r shrink-0 ${isDarkMode ? 'text-slate-600 border-white/10' : 'text-slate-400 border-slate-200'}`}>{stock.mcRank}</span>
                            <div className="flex-1 flex flex-col items-center">
                              <span className={`text-[11px] md:text-sm font-black group-hover:text-indigo-400 transition-colors uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stock.symbol}</span>
                              <span className="text-[8px] md:text-[9px] text-indigo-400/60 font-bold uppercase truncate max-w-[60px] md:max-w-none">{stock.sector}</span>
                            </div>
                          </div>
                        </td>
                        <td className={`px-1 md:px-4 py-3 text-[10px] md:text-[11px] font-bold whitespace-nowrap text-center ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {formatMarketCap(stock.marketCap)}
                        </td>
                        <td className="px-1 md:px-4 py-3 text-center">
                          {getZoneBadge(stock.zone)}
                        </td>
                        <td className="px-1 md:px-4 py-3 text-center">
                          <div className={`text-[10px] md:text-[11px] font-black uppercase tracking-tighter ${stock.maFast > stock.maSlow ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stock.maFast > stock.maSlow ? 'Bull' : 'Bear'}
                          </div>
                          <div className={`text-[8px] md:text-[9px] mt-0.5 whitespace-nowrap hidden sm:block ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>{stock.maFast.toFixed(0)}/{stock.maSlow.toFixed(0)}</div>
                        </td>
                        <td className="px-1 md:px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5 md:gap-2">
                            <div className={`w-10 md:w-24 h-1 rounded-full overflow-hidden shrink-0 hidden sm:block ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
                              <div 
                                style={{ width: `${Math.min(100, Math.max(0, stock.rsi))}%` }}
                                className={`h-full ${stock.rsi >= 50 ? 'bg-indigo-500' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-400')}`}
                              />
                            </div>
                            <span className={`text-[9px] md:text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{stock.rsi.toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="px-1 md:px-4 py-3 text-center">
                          <div className={`text-[10px] md:text-xs font-bold ${stock.change >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-600')}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(1)}%
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredStocks.length === 0 && !loading && (
                <div className="p-12 md:p-24 text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border shadow-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200 shadow-slate-100'}`}>
                    <Search className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className={`font-bold tracking-tight text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>No Active Assets Found</h3>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-[0.2em] max-w-xs mx-auto">Adjust search parameters or refresh data link.</p>
                </div>
              )}
            </div>
            
            <div className={`h-10 border-t flex items-center justify-between px-4 md:px-6 transition-all duration-300 ${isDarkMode ? 'border-white/10 bg-slate-900/30' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Live Stream Active</span>
              </div>
              <div className="flex gap-4">
                <span className="text-[10px] text-slate-500 font-mono text-right">Showing {filteredStocks.length} Assets</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-left">
            <AnimatePresence>
              {filteredStocks.map((stock) => (
                <motion.div 
                  key={stock.symbol}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleChartRedirect(stock.symbol)}
                  className={`backdrop-blur-xl border rounded-2xl p-5 md:p-6 transition-all group relative overflow-hidden text-left cursor-pointer interactive-target ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:border-indigo-200 shadow-xl shadow-slate-200/40 '}`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className={`w-16 h-16 ${isDarkMode ? 'text-white' : 'text-slate-900'}`} />
                  </div>
                  
                  <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="text-left">
                      <div className="flex items-baseline gap-2">
                        <h3 className={`font-mono text-xl font-black group-hover:text-indigo-400 transition-colors leading-none tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stock.symbol}</h3>
                        <span className="text-[10px] font-black opacity-20">#{stock.mcRank}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold tracking-widest truncate max-w-[120px]">{stock.name}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>${stock.price.toFixed(2)}</div>
                      <div className={`text-[10px] font-bold mt-1 ${stock.change >= 0 ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-600')}`}>
                        {stock.change >= 0 ? '↑' : '↓'} {Math.abs(stock.change).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-5 relative text-left">
                    <div className="space-y-2">
                      <div className={`flex justify-between items-center text-[9px] uppercase tracking-[0.2em] font-black border-b pb-1 ${isDarkMode ? 'text-slate-500 border-white/5' : 'text-slate-400 border-slate-100'}`}>
                        <span>Trend Signal</span>
                        <span className={stock.maFast > stock.maSlow ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-600')}>
                          {stock.maFast > stock.maSlow ? 'Golden Cross' : 'Death Cross'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className={`border p-2 rounded-lg py-1.5 ${isDarkMode ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="text-[8px] text-slate-600 uppercase">SMA 50</div>
                          <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stock.maFast.toFixed(1)}</div>
                        </div>
                        <div className={`border p-2 rounded-lg py-1.5 ${isDarkMode ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="text-[8px] text-slate-600 uppercase">SMA 200</div>
                          <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stock.maSlow.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 text-left">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">RSI Intensity</span>
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stock.rsi.toFixed(1)}</span>
                      </div>
                      <div className={`h-1 rounded-full overflow-hidden shrink-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200'}`}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stock.rsi}%` }}
                          className={`h-full ${stock.rsi >= 50 ? 'bg-indigo-500' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-400')}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="relative text-left">
                    {getZoneBadge(stock.zone)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}


        {symbols.length === 0 && loading && (
          <div className={`p-20 text-center font-mono text-[10px] uppercase tracking-widest backdrop-blur-xl rounded-2xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-white border-slate-200 text-slate-400 shadow-xl shadow-slate-200/50'}`}>
            Initialising core modules...
          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer className="mt-12 md:mt-20">
        <div className={`max-w-7xl mx-auto px-6 md:px-8 py-10 md:py-16 border-t flex flex-col md:flex-row justify-between items-start md:items-center gap-8 opacity-40 hover:opacity-100 transition-opacity ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="space-y-4 max-w-sm text-left">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <h4 className={`text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>System Manifest</h4>
            </div>
            <p className={`text-[10px] md:text-[11px] leading-relaxed font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>This interface visualizes algorithmic decision zones derived from multi-period market metrics. Logic is server-authoritative and processed in real-time batches.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-12 text-left w-full md:w-auto">
            <div className="space-y-2 md:space-y-3">
              <h5 className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">Macro Delta</h5>
              <p className={`text-[9px] md:text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>SMA Cross Detection</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <h5 className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">Relative Force</h5>
              <p className={`text-[9px] md:text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>RSI Pulse Analysis</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <h5 className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">Decision Logic</h5>
              <p className={`text-[9px] md:text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Zone Calibration</p>
            </div>
          </div>
        </div>
        <div className="h-10 bg-indigo-600 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
          <p className="text-[8px] md:text-[9px] uppercase tracking-[0.3em] md:tracking-[0.4em] font-black text-white/90 relative z-10 flex items-center gap-2 md:gap-4 px-4 text-center">
            <span className="opacity-40 select-none hidden sm:inline">///</span>
            Analysis Node v4.2.0 — Data © 2026 Yahoo Finance Core — Real-time Calibration Active
            <span className="opacity-40 select-none hidden sm:inline">///</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

