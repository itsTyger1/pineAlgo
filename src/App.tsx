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
  ChevronDown
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
  const signalRef = useRef<HTMLDivElement>(null);
  const sectorRef = useRef<HTMLDivElement>(null);

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
        fetchAllAnalysis(data.map(s => s.symbol), timeframe);
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
    // Process in chunks of 5
    const chunks = [];
    for (let i = 0; i < list.length; i += 5) {
      chunks.push(list.slice(i, i + 5));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (sym) => {
          try {
            const data = await fetchWithRetry(`/api/analysis/${sym}?timeframe=${currentTF}`);
            if (data.error) throw new Error(data.error);
            return data;
          } catch (e) {
            console.warn(`Analysis failed for ${sym}:`, e);
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

      // Remove the breathing delay to speed up loading
    }
    setLoading(false);
  };

  const handleChartRedirect = (symbol: string) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const webUrl = `https://www.tradingview.com/chart/?symbol=${symbol}`;
    // Some versions of the app use tradingview://symbol/NAME
    const appUrl = `tradingview://symbol/${symbol}`;

    if (isMobile) {
      // Direct navigation to appUrl. If the app is installed, the OS will usually 
      // intercept this. If not, it might show an error. 
      // A common pattern is to try to open the app scheme and then fallback.
      window.location.href = appUrl;
      
      // Fallback to web after a short delay if the app didn't open (and thus the page didn't hide)
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.open(webUrl, '_blank');
        }
      }, 1500);
    } else {
      window.open(webUrl, '_blank');
    }
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
          <span className={`${baseClass} bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1`}>
            <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> 
            <span className="hidden md:inline">Standard Buy</span>
            <span className="md:hidden">Buy</span>
          </span>
        );
      case 'Value Pullback': 
        return (
          <span className={`${baseClass} bg-amber-500/20 text-amber-400 border border-amber-500/40 inline-flex items-center gap-1`}>
            <Info className="w-2.5 h-2.5 md:w-3 md:h-3" /> 
            <span className="hidden md:inline">Value Pullback</span>
            <span className="md:hidden">Value</span>
          </span>
        );
      case 'Sell Section': 
        return (
          <span className={`${baseClass} bg-rose-500/20 text-rose-400 border border-rose-500/40 inline-flex items-center gap-1`}>
            <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" /> 
            <span className="hidden md:inline">Sell Zone</span>
            <span className="md:hidden">Sell</span>
          </span>
        );
      default: 
        return <span className={`${baseClass} bg-white/5 text-slate-400 border border-white/10`}>Neutral</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 overflow-x-hidden relative">
      {/* Frosted Glass Background Accents */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[10%] bg-amber-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 h-14 md:h-20 border-b border-white/10 flex items-center justify-between px-3 md:px-8 backdrop-blur-md bg-slate-950/80">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-10 md:h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <BarChart3 className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </div>
          <h1 className="text-base md:text-xl font-bold tracking-tight text-white uppercase select-none hidden sm:block">
            PINE<span className="text-indigo-400 font-black">ALGO</span>
          </h1>
        </div>

        <div className={`flex-1 max-w-md mx-2 md:mx-8 relative group transition-all duration-300 ${isSearchOpen ? 'translate-y-0 opacity-100' : 'hidden lg:block'}`}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search Assets..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-white interactive-target"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="w-5 h-5" />
          </button>

          <div className="flex p-0.5 bg-white/5 rounded-lg border border-white/10 shrink-0">
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
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-all active:scale-95 disabled:opacity-50 interactive-target"
            disabled={loading}
            title="Force Sync"
          >
            <RefreshCcw className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Total Assets Counter */}
          <div className="flex items-baseline gap-1 md:gap-1.5 pl-2 md:pl-4 border-l border-white/10 font-mono">
            <span className="text-[8px] md:text-[10px] font-black uppercase text-slate-500 tracking-wider">Stocks Found:</span>
            <span className="text-xs md:text-sm font-black text-indigo-400">{stats.total}</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-full px-4 md:px-8 text-left py-4 md:py-8">
        {/* Status System Overlay */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 font-mono">
          <div className="flex flex-wrap items-center gap-3">
            {/* Market Flow Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white/5 backdrop-blur-md ${stats.buyCount + stats.valueCount > stats.sellCount ? 'border-emerald-500/30 text-emerald-400' : 'border-rose-500/30 text-rose-400'}`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${stats.buyCount + stats.valueCount > stats.sellCount ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest">
                Flow: {stats.buyCount + stats.valueCount > stats.sellCount ? 'Bullish' : 'Bearish'}
              </span>
            </div>

            {/* Sync Timer */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400">
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

            {/* Data Feed Tag */}
            <div className="hidden xl:flex items-center gap-2 px-2 py-1 rounded border border-white/5 bg-slate-900/40 opacity-40 hover:opacity-100 transition-opacity">
              <span className="text-[8px] font-black text-indigo-400/80 uppercase">Yahoo Feed v1.2</span>
            </div>
          </div>

          {/* Breakdown Notification Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2 w-full md:w-auto">
            <div className="flex flex-col px-2 py-1.5 md:px-3 md:py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg md:rounded-xl">
              <span className="text-xs font-black text-emerald-400 leading-none">{stats.buyCount}</span>
              <span className="text-[7.5px] md:text-[8px] uppercase font-bold text-emerald-400/60 tracking-wider mt-1">Standard Buys</span>
            </div>
            <div className="flex flex-col px-2 py-1.5 md:px-3 md:py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg md:rounded-xl">
              <span className="text-xs font-black text-amber-400 leading-none">{stats.valueCount}</span>
              <span className="text-[7.5px] md:text-[8px] uppercase font-bold text-amber-400/60 tracking-wider mt-1">Pullbacks</span>
            </div>
            <div className="flex flex-col px-2 py-1.5 md:px-3 md:py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg md:rounded-xl">
              <span className="text-xs font-black text-rose-400 leading-none">{stats.sellCount}</span>
              <span className="text-[7.5px] md:text-[8px] uppercase font-bold text-rose-400/60 tracking-wider mt-1">Sell Zones</span>
            </div>
            <div className="flex flex-col px-2 py-1.5 md:px-3 md:py-2 bg-white/5 border border-white/10 rounded-lg md:rounded-xl">
              <span className="text-xs font-black text-slate-300 leading-none">{stats.neutralCount}</span>
              <span className="text-[7.5px] md:text-[8px] uppercase font-bold text-slate-500 tracking-wider mt-1">Neutral</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm backdrop-blur-md">
            <AlertCircle className="w-4 h-4 shadow-rose-500/20" />
            <span className="font-medium tracking-tight font-mono">{error}</span>
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
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
              <button 
                onClick={() => setView('table')}
                className={`p-1.5 rounded-lg transition-all ${view === 'table' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-lg transition-all ${view === 'grid' ? 'bg-white/10 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {view === 'table' ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl shadow-black/40 w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono min-w-[550px] lg:min-w-0 table-fixed">
                <thead>
                  <tr className="border-b border-white/10 bg-slate-900/50 text-[9px] md:text-[10px] uppercase tracking-tighter md:tracking-wider font-bold text-slate-400">
                    <th className="px-1 md:px-4 py-2.5 sticky-col whitespace-nowrap w-[25%] font-mono">
                      <div className="flex items-center gap-1 md:gap-3">
                        <span className="w-4 md:w-8 text-right pr-1 md:pr-2 border-r border-white/10 shrink-0">#</span>
                        <div className="flex-1 flex justify-center">
                          <div className="relative inline-block text-left" ref={sectorRef}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setShowSectorDropdown(!showSectorDropdown); }}
                              className="bg-transparent text-[9px] md:text-[10px] font-bold uppercase tracking-tighter text-slate-400 hover:text-white transition-colors flex items-center gap-1 interactive-target"
                            >
                              <Filter className="w-2.5 h-2.5" />
                              Asset
                            </button>

                            {showSectorDropdown && (
                              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-56 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl max-h-64 overflow-y-auto">
                                <div className="px-3 py-1 mb-1 text-[8px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5 text-center">Filter by Sector</div>
                                {stats.sectors.map((sector) => (
                                  <button
                                    key={sector}
                                    onClick={(e) => { e.stopPropagation(); toggleSectorFilter(sector); }}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-all group/opt interactive-target"
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
                      className="px-1 md:px-4 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap w-[15%] text-center"
                      onClick={() => handleSort('marketCap')}
                    >
                      Cap
                    </th>
                    <th className="px-1 md:px-4 py-3 text-center group relative z-10 whitespace-nowrap w-[20%]">
                      <div className="flex items-center justify-center gap-1">
                        <div className="relative inline-block text-left" ref={signalRef}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setShowFilterDropdown(!showFilterDropdown); }}
                            className="bg-transparent text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors flex items-center gap-1 interactive-target"
                          >
                            <Filter className="w-2.5 h-2.5" />
                            Signal
                          </button>

                          {showFilterDropdown && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-xl">
                              {['Standard Buy', 'Value Pullback', 'Sell Section', 'Neutral'].map((option) => (
                                <button
                                  key={option}
                                  onClick={(e) => { e.stopPropagation(); toggleSignalFilter(option); }}
                                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 transition-all group/opt interactive-target"
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
                      className="px-1 md:px-4 py-3 cursor-pointer hover:text-white transition-colors whitespace-nowrap w-[15%] text-center"
                      onClick={() => handleSort('rsi')}
                    >
                      RSI
                    </th>
                    <th 
                      className="px-1 md:px-4 py-3 text-center cursor-pointer hover:text-white transition-colors whitespace-nowrap w-[10%]"
                      onClick={() => handleSort('change')}
                    >
                      %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {filteredStocks.map((stock) => (
                      <motion.tr 
                        key={stock.symbol}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group hover:bg-white/5 transition-colors cursor-pointer border-l-2 border-l-transparent hover:border-l-indigo-500"
                        onClick={() => handleChartRedirect(stock.symbol)}
                      >
                        <td className="px-1 md:px-4 py-2.5 sticky-col whitespace-nowrap">
                          <div className="flex items-center gap-1 md:gap-3">
                            <span className="text-[9px] md:text-[10px] text-slate-600 font-black w-4 md:w-8 text-right pr-1 md:pr-2 border-r border-white/10 shrink-0">{stock.mcRank}</span>
                            <div className="flex-1 flex flex-col items-center">
                              <span className="text-[11px] md:text-sm font-black text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tighter">{stock.symbol}</span>
                              <span className="text-[8px] md:text-[9px] text-indigo-400/60 font-bold uppercase truncate max-w-[60px] md:max-w-none">{stock.sector}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-1 md:px-4 py-3 text-[10px] md:text-[11px] text-slate-300 font-bold whitespace-nowrap text-center">
                          {formatMarketCap(stock.marketCap)}
                        </td>
                        <td className="px-1 md:px-4 py-3 text-center">
                          {getZoneBadge(stock.zone)}
                        </td>
                        <td className="px-1 md:px-4 py-3 text-center">
                          <div className={`text-[10px] md:text-[11px] font-black uppercase tracking-tighter ${stock.maFast > stock.maSlow ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stock.maFast > stock.maSlow ? 'Bull' : 'Bear'}
                          </div>
                          <div className="text-[8px] md:text-[9px] text-slate-600 mt-0.5 whitespace-nowrap hidden sm:block">{stock.maFast.toFixed(0)}/{stock.maSlow.toFixed(0)}</div>
                        </td>
                        <td className="px-1 md:px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5 md:gap-2">
                            <div className="w-10 md:w-24 h-1 bg-slate-900 rounded-full overflow-hidden shrink-0 hidden sm:block">
                              <div 
                                style={{ width: `${Math.min(100, Math.max(0, stock.rsi))}%` }}
                                className={`h-full ${stock.rsi >= 50 ? 'bg-indigo-500' : 'bg-slate-700'}`}
                              />
                            </div>
                            <span className="text-[9px] md:text-[10px] font-bold text-slate-400">{stock.rsi.toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="px-1 md:px-4 py-3 text-center">
                          <div className={`text-[10px] md:text-xs font-bold ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
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
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-xl">
                    <Search className="w-8 h-8 text-slate-600" />
                  </div>
                  <h3 className="text-white font-bold tracking-tight text-sm">No Active Assets Found</h3>
                  <p className="text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-[0.2em] max-w-xs mx-auto">Adjust search parameters or refresh data link.</p>
                </div>
              )}
            </div>
            
            <div className="h-10 border-t border-white/10 flex items-center justify-between px-4 md:px-6 bg-slate-900/30">
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
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 md:p-6 hover:bg-white/10 transition-all group relative overflow-hidden text-left cursor-pointer interactive-target"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-16 h-16 text-white" />
                  </div>
                  
                  <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="text-left">
                      <div className="flex items-baseline gap-2">
                        <h3 className="font-mono text-xl font-black text-white group-hover:text-indigo-400 transition-colors leading-none tracking-tighter">{stock.symbol}</h3>
                        <span className="text-[10px] font-black text-white/20">#{stock.mcRank}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold tracking-widest truncate max-w-[120px]">{stock.name}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-white tracking-widest">${stock.price.toFixed(2)}</div>
                      <div className={`text-[10px] font-bold mt-1 ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stock.change >= 0 ? '↑' : '↓'} {Math.abs(stock.change).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-5 relative text-left">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] uppercase tracking-[0.2em] font-black text-slate-500 border-b border-white/5 pb-1">
                        <span>Trend Signal</span>
                        <span className={stock.maFast > stock.maSlow ? 'text-emerald-400' : 'text-rose-400'}>
                          {stock.maFast > stock.maSlow ? 'Golden Cross' : 'Death Cross'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className="bg-slate-900/50 border border-white/5 p-2 rounded-lg py-1.5">
                          <div className="text-[8px] text-slate-600 uppercase">SMA 50</div>
                          <div className="text-white font-bold">{stock.maFast.toFixed(1)}</div>
                        </div>
                        <div className="bg-slate-900/50 border border-white/5 p-2 rounded-lg py-1.5">
                          <div className="text-[8px] text-slate-600 uppercase">SMA 200</div>
                          <div className="text-white font-bold">{stock.maSlow.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 text-left">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">RSI Intensity</span>
                        <span className="text-[10px] font-bold text-white">{stock.rsi.toFixed(1)}</span>
                      </div>
                      <div className="h-1 bg-slate-900 rounded-full overflow-hidden shrink-0">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${stock.rsi}%` }}
                          className={`h-full ${stock.rsi >= 50 ? 'bg-indigo-500' : 'bg-slate-700'}`}
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
          <div className="p-20 text-center text-slate-500 font-mono text-[10px] uppercase tracking-widest backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10">
            Initialising core modules...
          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer className="mt-12 md:mt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-10 md:py-16 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8 opacity-40 hover:opacity-100 transition-opacity">
          <div className="space-y-4 max-w-sm text-left">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <h4 className="text-[10px] md:text-[11px] font-black text-white uppercase tracking-[0.3em]">System Manifest</h4>
            </div>
            <p className="text-[10px] md:text-[11px] leading-relaxed text-slate-400 font-medium">This interface visualizes algorithmic decision zones derived from multi-period market metrics. Logic is server-authoritative and processed in real-time batches.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-12 text-left w-full md:w-auto">
            <div className="space-y-2 md:space-y-3">
              <h5 className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">Macro Delta</h5>
              <p className="text-[9px] md:text-[10px] text-slate-300">SMA Cross Detection</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <h5 className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">Relative Force</h5>
              <p className="text-[9px] md:text-[10px] text-slate-300">RSI Pulse Analysis</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <h5 className="text-[8px] md:text-[9px] font-black text-indigo-400 uppercase tracking-widest">Decision Logic</h5>
              <p className="text-[9px] md:text-[10px] text-slate-300">Zone Calibration</p>
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

