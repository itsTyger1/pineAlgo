/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, useRef, memo } from 'react';
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

interface SearchInputProps {
  search: string;
  onSearchChange: (value: string) => void;
  isDarkMode: boolean;
}

const SearchInput = memo(({ search, onSearchChange, isDarkMode }: SearchInputProps) => {
  const [localValue, setLocalValue] = useState(search);

  // Sync with parent's search if parent clears it (e.g. from the outside)
  useEffect(() => {
    setLocalValue(search);
  }, [search]);

  // Debounce localValue updates to parent's search state
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localValue);
    }, 150);
    return () => clearTimeout(timer);
  }, [localValue, onSearchChange]);

  return (
    <input 
      type="text" 
      placeholder="Search Stocks..." 
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      className={`w-full border rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all duration-150 ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 placeholder:text-slate-600' : 'bg-slate-50/80 border-slate-200/50 text-slate-700 focus:bg-white focus:border-indigo-500/30 focus:shadow-[0_0_12px_rgba(99,102,241,0.05)] placeholder:text-slate-400'}`}
    />
  );
});

export default function App() {
  const [symbols, setSymbols] = useState<{ symbol: string, marketCap: number }[]>([]);
  const [timeframe, setTimeframe] = useState<'1h' | '4hr' | '1d' | '1wk' | '1mo'>('1d');
  const [stocksByTimeframe, setStocksByTimeframe] = useState<Record<string, Record<string, StockAnalysis>>>({
    '1h': {},
    '4hr': {},
    '1d': {},
    '1wk': {},
    '1mo': {}
  });

  // Master source of truth for current timeframe's data, filtered by current symbols list to ensure consistency
  const stocks = useMemo(() => {
    const tfData = stocksByTimeframe[timeframe] || {};
    const symbolSet = new Set(symbols.map(s => s.symbol));
    const filtered: Record<string, StockAnalysis> = {};
    Object.keys(tfData).forEach(symbol => {
      if (symbolSet.has(symbol)) {
        filtered[symbol] = tfData[symbol];
      }
    });
    return filtered;
  }, [stocksByTimeframe, timeframe, symbols]);

  const [loading, setLoading] = useState(true);
  const fetchingTimeframes = useRef<Set<string>>(new Set());

  const [displayedCountsByTimeframe, setDisplayedCountsByTimeframe] = useState<Record<string, number>>({
    '1h': 0, '4hr': 0, '1d': 0, '1wk': 0, '1mo': 0
  });

  // Master source of truth for current timeframe's data
  const analyzedCount = useMemo(() => {
    const tfData = stocksByTimeframe[timeframe] || {};
    return symbols.filter(s => !!tfData[s.symbol]).length;
  }, [stocksByTimeframe, timeframe, symbols]);

  const displayedAnalyzedCount = displayedCountsByTimeframe[timeframe] || 0;

  // Smooth single-digit increment effect
  useEffect(() => {
    const visual = displayedCountsByTimeframe[timeframe] || 0;

    if (visual < analyzedCount) {
      const diff = analyzedCount - visual;
      // Speed up if the gap is large, but keep it feeling "per digit"
      const increment = diff > 40 ? Math.floor(diff / 10) : 1;

      const timer = setTimeout(() => {
        setDisplayedCountsByTimeframe(prev => ({
          ...prev,
          [timeframe]: prev[timeframe] + increment
        }));
      }, 25);
      return () => clearTimeout(timer);
    } else if (visual > analyzedCount && analyzedCount === 0) {
      // Hard reset only when data is actually cleared
      setDisplayedCountsByTimeframe(prev => ({
        ...prev,
        [timeframe]: 0
      }));
    }
  }, [analyzedCount, timeframe, displayedCountsByTimeframe]);

  const [search, setSearch] = useState('');

  const [view, setView] = useState<'grid' | 'table'>('table');
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'marketCap' | 'change' | 'zone'>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hSignalFilter, setHSignalFilter] = useState<string[]>([]);
  const [hrSignalFilter, setHrSignalFilter] = useState<string[]>([]);
  const [dSignalFilter, setDSignalFilter] = useState<string[]>([]);
  const [wSignalFilter, setWSignalFilter] = useState<string[]>([]);
  const [mSignalFilter, setMSignalFilter] = useState<string[]>([]);
  const [activeSignalDropdown, setActiveSignalDropdown] = useState<'1h' | '4hr' | '1d' | '1wk' | '1mo' | null>(null);
  const [sectorFilters, setSectorFilters] = useState<string[]>([]);
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('theme');
        const dark = saved ? saved === 'dark' : true;
        if (dark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return dark;
      }
    } catch (e) {
      console.warn('LocalStorage not accessible:', e);
    }
    return true;
  });
  const hSignalRef = useRef<HTMLDivElement>(null);
  const hrSignalRef = useRef<HTMLDivElement>(null);
  const dSignalRef = useRef<HTMLDivElement>(null);
  const wSignalRef = useRef<HTMLDivElement>(null);
  const mSignalRef = useRef<HTMLDivElement>(null);
  const sectorRef = useRef<HTMLDivElement>(null);
  const activeTimeframeRef = useRef(timeframe);

  useEffect(() => {
    activeTimeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    try {
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('LocalStorage not accessible for saving:', e);
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const isOutsideHSignal = !hSignalRef.current || !hSignalRef.current.contains(target);
      const isOutsideHrSignal = !hrSignalRef.current || !hrSignalRef.current.contains(target);
      const isOutsideDSignal = !dSignalRef.current || !dSignalRef.current.contains(target);
      const isOutsideWSignal = !wSignalRef.current || !wSignalRef.current.contains(target);
      const isOutsideMSignal = !mSignalRef.current || !mSignalRef.current.contains(target);
      const isOutsideSector = !sectorRef.current || !sectorRef.current.contains(target);

      if (isOutsideHSignal && isOutsideHrSignal && isOutsideDSignal && isOutsideWSignal && isOutsideMSignal) {
        setActiveSignalDropdown(null);
      }

      if (isOutsideSector) {
        setShowSectorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSignalFilter = (tf: '1h' | '4hr' | '1d' | '1wk' | '1mo', filter: string) => {
    const setter = tf === '1h' ? setHSignalFilter : tf === '4hr' ? setHrSignalFilter : tf === '1d' ? setDSignalFilter : tf === '1wk' ? setWSignalFilter : setMSignalFilter;
    setter(prev =>
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

  // Robust fetch with retry
  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3) => {
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

  const fetchStocks = async (refresh = false) => {
    try {
      setLoading(true);
      setError(null);
      fetchingTimeframes.current.clear();
      setDisplayedCountsByTimeframe({ '1h': 0, '4hr': 0, '1d': 0, '1wk': 0, '1mo': 0 });
      const data = await fetchWithRetry(`/api/stocks${refresh ? '?refresh=true' : ''}`);
      if (Array.isArray(data)) {
        const uniqueData = data.slice(0, 500); // Explicitly cap client side too
        setSymbols(uniqueData);
        setStocksByTimeframe({ '1h': {}, '4hr': {}, '1d': {}, '1wk': {}, '1mo': {} });

        // Start ALL timeframes in parallel for fastest possible load
        const allTFs = ['1h', '4hr', '1d', '1wk', '1mo'] as const;
        const allPromises = allTFs.map(tf =>
          fetchAllAnalysis(uniqueData.map(s => s.symbol), tf, refresh)
        );

        // Wait for the active timeframe to finish (for loading state)
        const activeIndex = allTFs.indexOf(activeTimeframeRef.current);
        await allPromises[activeIndex];
      } else {
        setError('Failed to fetch stock list');
      }
    } catch (err: any) {
      setError(`Connection error: ${err.message || 'System calibrating'}. Please wait...`);
      console.error(err);
    } finally {
      setLoading(false);
      setLastSynced(new Date());
    }
  };

  const fetchAllAnalysis = async (list: string[], currentTF: string, refresh = false) => {
    if (fetchingTimeframes.current.has(currentTF)) return;
    fetchingTimeframes.current.add(currentTF);

    // Only set global loading if this specific fetch is for the active timeframe
    const isCurrent = () => activeTimeframeRef.current === currentTF;
    if (isCurrent()) setLoading(true);

    const batchSize = 50; // Larger batches = fewer HTTP round-trips
    const chunks = [];
    for (let i = 0; i < list.length; i += batchSize) {
      chunks.push(list.slice(i, i + batchSize));
    }

    const maxConcurrentBatches = 3; // Multiple batches in flight simultaneously
    const activeRequests = new Set();
    const remainingChunks = [...chunks];

    return new Promise<void>((resolve) => {
      const processNext = async () => {
        if (remainingChunks.length === 0 && activeRequests.size === 0) {
          if (isCurrent()) setLoading(false);
          fetchingTimeframes.current.delete(currentTF);
          resolve();
          return;
        }

        while (remainingChunks.length > 0 && activeRequests.size < maxConcurrentBatches) {
          const chunk = remainingChunks.shift()!;
          const promise = (async () => {
            let success = false;
            let retryCount = 0;
            const maxRetries = 2; // Reduced back to 2 to avoid long cycles blocking other timeframes

            while (!success && retryCount <= maxRetries) {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                const response = await fetch('/api/analysis/batch', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ symbols: chunk, timeframe: currentTF, refresh }),
                  signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                  if (response.status === 429) {
                    await new Promise(r => setTimeout(r, 2500 * (retryCount + 1)));
                    throw new Error('429');
                  }
                  throw new Error(`HTTP ${response.status}`);
                }

                const results = await response.json();
                if (Array.isArray(results) && results.length > 0) {
                  setStocksByTimeframe(prev => {
                    const timeframeData = { ...prev[currentTF] };
                    results.forEach(res => {
                      if (res && res.symbol) {
                        timeframeData[res.symbol] = res;
                      }
                    });
                    return { ...prev, [currentTF]: timeframeData };
                  });
                  success = true;
                } else if (Array.isArray(results) && results.length === 0) {
                  // If we got an empty array (likely server-side timeout), consider it a retryable failure
                  throw new Error('Server returned empty batch');
                }
              } catch (e: any) {
                retryCount++;
                if (retryCount > maxRetries) break;
                // Exponential backoff
                await new Promise(r => setTimeout(r, 1000 * retryCount));
              }
            }
          })();

          activeRequests.add(promise);
          promise.finally(() => {
            activeRequests.delete(promise);
            processNext();
          });
        }
      };

      processNext();
    });
  };

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
    return symbols.map(s => {
      // Find the first available analysis for this symbol to provide metadata
      const analysis = stocksByTimeframe['1d'][s.symbol] || stocksByTimeframe['1h'][s.symbol] || stocksByTimeframe['4hr'][s.symbol] || stocksByTimeframe['1wk'][s.symbol] || stocksByTimeframe['1mo'][s.symbol] || {
        symbol: s.symbol,
        name: s.symbol,
        price: 0,
        change: 0,
        marketCap: s.marketCap,
        maFast: 0,
        maSlow: 0,
        rsi: 0,
        zone: 'Neutral Zone',
        sector: 'Unknown',
        industry: 'Unknown',
        lastUpdated: ''
      };
      return {
        ...analysis,
        name: s.name || analysis.name || s.symbol,
        mcRank: symbolRanks[s.symbol] || 999
      };
    });
  }, [symbols, stocksByTimeframe, symbolRanks]);

  const filteredStocks = useMemo(() => {
    const list = rankedStocks.filter(s => {
      const matchesSearch = s.symbol.toLowerCase().includes(search.toLowerCase()) ||
        s.name.toLowerCase().includes(search.toLowerCase());
      const matchesH = hSignalFilter.length === 0 || hSignalFilter.includes(stocksByTimeframe['1h'][s.symbol]?.zone || 'Neutral Zone');
      const matchesHr = hrSignalFilter.length === 0 || hrSignalFilter.includes(stocksByTimeframe['4hr'][s.symbol]?.zone || 'Neutral Zone');
      const matchesD = dSignalFilter.length === 0 || dSignalFilter.includes(stocksByTimeframe['1d'][s.symbol]?.zone || 'Neutral Zone');
      const matchesW = wSignalFilter.length === 0 || wSignalFilter.includes(stocksByTimeframe['1wk'][s.symbol]?.zone || 'Neutral Zone');
      const matchesM = mSignalFilter.length === 0 || mSignalFilter.includes(stocksByTimeframe['1mo'][s.symbol]?.zone || 'Neutral Zone');

      const matchesSector = sectorFilters.length === 0 || sectorFilters.includes(s.sector);
      return matchesSearch && matchesH && matchesHr && matchesD && matchesW && matchesM && matchesSector;
    });

    return [...list].sort((a, b) => {
      const factor = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'marketCap') return (a.marketCap - b.marketCap) * factor;
      if (sortBy === 'change') return (a.change - b.change) * factor;
      if (sortBy === 'zone') {
        const weights: Record<string, number> = {
          'Buy Zone': 1,
          'Value Zone': 2,
          'Sell Zone': 3,
          'Neutral Zone': 4
        };
        const valA = weights[a.zone] || 4;
        const valB = weights[b.zone] || 4;
        return (valA - valB) * factor;
      }
      return 0;
    });
  }, [rankedStocks, search, sortBy, sortOrder, hSignalFilter, hrSignalFilter, dSignalFilter, wSignalFilter, mSignalFilter, sectorFilters, stocksByTimeframe]);

  const [visibleCount, setVisibleCount] = useState(50);
  const observerRef = useRef<HTMLDivElement>(null);

  // Reset progressive scroll count when search or filters change
  useEffect(() => {
    setVisibleCount(50);
  }, [search, hSignalFilter, hrSignalFilter, dSignalFilter, wSignalFilter, mSignalFilter, sectorFilters, sortBy, sortOrder]);

  const visibleStocks = useMemo(() => {
    return filteredStocks.slice(0, visibleCount);
  }, [filteredStocks, visibleCount]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 50, filteredStocks.length));
      }
    }, { threshold: 0.1 });

    const currentTarget = observerRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [filteredStocks.length]);

  const formatMarketCap = (val: number) => {
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toLocaleString()}`;
  };

  const handleSort = (key: 'marketCap' | 'change' | 'zone') => {
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
      buyCount: list.filter(s => s.zone === 'Buy Zone').length,
      valueCount: list.filter(s => s.zone === 'Value Zone').length,
      sellCount: list.filter(s => s.zone === 'Sell Zone').length,
      neutralCount: list.filter(s => !['Buy Zone', 'Value Zone', 'Sell Zone'].includes(s.zone)).length,
      total: list.length,
      sectors
    };
  }, [stocks]);

  const getZoneBadge = (zone: string) => {
    const baseClass = "px-1.5 md:px-3 py-0.5 md:py-1 rounded font-bold uppercase tracking-tighter text-[8px] md:text-[10px] whitespace-nowrap";
    switch (zone) {
      case 'Buy Zone':
        return (
          <span className={`${baseClass} inline-flex items-center gap-1 transition-all duration-300 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-emerald-50/70 text-emerald-700 border-emerald-200/60 border'}`}>
            <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden md:inline">Buy Zone</span>
            <span className="md:hidden">Buy</span>
          </span>
        );
      case 'Value Zone':
        return (
          <span className={`${baseClass} inline-flex items-center gap-1 transition-all duration-300 ${isDarkMode ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-50/70 text-amber-700 border-amber-200/60 border'}`}>
            <Info className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden md:inline">Value Zone</span>
            <span className="md:hidden">Value</span>
          </span>
        );
      case 'Sell Zone':
        return (
          <span className={`${baseClass} inline-flex items-center gap-1 transition-all duration-300 ${isDarkMode ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' : 'bg-rose-50/70 text-rose-700 border-rose-200/60 border'}`}>
            <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" />
            <span className="hidden md:inline">Sell Zone</span>
            <span className="md:hidden">Sell</span>
          </span>
        );
      default:
        return <span className={`transition-all duration-300 ${baseClass} ${isDarkMode ? 'bg-white/5 text-slate-400 border border-white/10' : 'bg-slate-50/70 text-slate-600 border border-slate-200/60'}`}>Neutral</span>;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-indigo-500/30 relative ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#FAF9F5] text-slate-600'}`}>
      {/* Frosted Glass Background Accents */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] ${isDarkMode ? 'bg-blue-600/20' : 'bg-blue-500/5'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] ${isDarkMode ? 'bg-emerald-600/10' : 'bg-emerald-600/4'}`}></div>
        <div className={`absolute top-[20%] right-[10%] w-[30%] h-[10%] rounded-full blur-[120px] ${isDarkMode ? 'bg-amber-600/10' : 'bg-amber-600/4'}`}></div>
      </div>

      {/* Header */}
      <header className={`sticky top-0 z-50 h-14 md:h-20 border-b flex items-center justify-between px-3 md:px-8 backdrop-blur-md transition-all duration-300 ${isDarkMode ? 'bg-slate-950/80 border-white/10' : 'bg-white/80 border-slate-200/30 shadow-[0_2px_20px_rgba(0,0,0,0.015)]'}`}>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-7 h-7 md:w-10 md:h-10 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <BarChart3 className="w-4 h-4 md:w-6 md:h-6 text-white" />
          </div>
          <h1 className={`text-base md:text-xl font-bold tracking-tight uppercase select-none hidden sm:block ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
            PINE<span className="text-indigo-400 font-black">ALGO</span>
          </h1>
        </div>

        <div className={`flex-1 max-w-md mx-2 md:mx-8 relative group transition-all duration-300 ${isSearchOpen ? 'translate-y-0 opacity-100' : 'hidden lg:block'}`}>
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 group-focus-within:text-indigo-400 transition-colors ${isDarkMode ? 'text-slate-500' : 'text-slate-400/80'}`} />
          <SearchInput 
            search={search}
            onSearchChange={setSearch}
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            className={`p-2 rounded-full transition-all interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100/50'}`}
            onClick={() => setIsDarkMode(!isDarkMode)}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
          </button>

          <button
            className={`lg:hidden p-2 interactive-target ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            onClick={() => fetchStocks(true)}
            className={`p-2 rounded-full transition-all active:scale-95 disabled:opacity-50 interactive-target ${isDarkMode ? 'hover:bg-white/10 text-slate-400 hover:text-white' : 'hover:bg-slate-100/50 text-slate-400 hover:text-slate-700'}`}
            disabled={loading}
            title="Force Sync"
          >
            <RefreshCcw className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Total Assets Counter */}
          <div className="flex items-center pl-2 md:pl-4 border-l shrink-0 font-mono border-white/10 dark:border-white/10 border-slate-200/30">
            <div className="flex flex-col items-end w-24 md:w-32">
              <div className="flex items-center justify-between w-full mb-1">
                <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-tight ${displayedAnalyzedCount >= (symbols.length || 500) ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {displayedAnalyzedCount >= (symbols.length || 500) && (symbols.length > 0) ? 'Ready' : 'Analyzing'}
                </span>
                <span className="text-[10px] md:text-[11px] font-black text-slate-500 tabular-nums">
                  {Math.round((displayedAnalyzedCount / (symbols.length || 1)) * 100)}%
                </span>
              </div>

              <div className={`w-full h-1.5 md:h-2 rounded-full overflow-hidden border relative ${isDarkMode
                  ? 'bg-slate-900 border-white/10 shadow-[inset_0_0_6px_rgba(0,0,0,0.6)]'
                  : 'bg-slate-100/80 border-slate-200/35 shadow-[inset_0_0_4px_rgba(0,0,0,0.02)]'
                } ${displayedAnalyzedCount < (symbols.length || 500) && (symbols.length > 0)
                  ? (isDarkMode ? 'shadow-[inset_0_0_8px_rgba(99,102,241,0.35)]' : 'shadow-[inset_0_0_6px_rgba(99,102,241,0.04)]')
                  : ''
                }`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(displayedAnalyzedCount / (symbols.length || 1)) * 100}%` }}
                  transition={{ type: "tween", ease: "easeOut", duration: 0.15 }}
                  className={`h-full ${displayedAnalyzedCount >= (symbols.length || 500) && (symbols.length > 0)
                      ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.7)]'
                      : 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.7),inset_0_0_4px_rgba(255,255,255,0.3)] animate-pulse'
                    }`}
                />
              </div>

              <span className="mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right whitespace-nowrap opacity-70">
                {displayedAnalyzedCount} / {symbols.length || '500'} Stocks
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full max-w-full px-4 md:px-8 text-left py-4 md:py-8">
        {/* Status System Overlay */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 md:gap-4 mb-3 md:mb-5 font-mono">
          <div className="flex flex-row items-center justify-start gap-1 md:gap-2 overflow-x-auto whitespace-nowrap w-full md:w-auto pb-0.5 md:pb-0 select-none">
            {/* Market Flow Status */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border backdrop-blur-md shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100/50 border-slate-200/30'} ${stats.buyCount + stats.valueCount > stats.sellCount ? 'border-emerald-500/20 text-emerald-600' : 'border-rose-500/20 text-rose-600'}`}>
              <div className={`w-1 h-1 rounded-full animate-pulse ${stats.buyCount + stats.valueCount > stats.sellCount ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
              <span className="text-[7.5px] md:text-[9.5px] font-black uppercase tracking-wider">
                <span className="hidden md:inline">Flow: {stats.buyCount + stats.valueCount > stats.sellCount ? 'Bullish' : 'Bearish'}</span>
                <span className="md:hidden">{stats.buyCount + stats.valueCount > stats.sellCount ? 'Bull' : 'Bear'}</span>
              </span>
            </div>

            {/* Sync Timer */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border shrink-0 ${isDarkMode ? 'border-white/10 bg-white/5 text-slate-400' : 'border-slate-200/35 bg-slate-100/50 text-slate-500'}`}>
              <RefreshCcw className={`w-2 h-2 md:w-3 md:h-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-[7.5px] md:text-[9.5px] font-bold uppercase tracking-wider">
                <span className="hidden md:inline">{lastSynced ? `Synced: ${lastSynced.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Calibrating...'}</span>
                <span className="md:hidden">{lastSynced ? `Sync: ${lastSynced.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Calibrating'}</span>
              </span>
            </div>

            {/* Loading Finished Notification */}
            <AnimatePresence>
              {!loading && stats.total > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shrink-0"
                >
                  <Check className="w-2 h-2 md:w-3 md:h-3" />
                  <span className="text-[7.5px] md:text-[9.5px] font-black uppercase tracking-wider">
                    <span className="hidden md:inline">Analysis Core Ready</span>
                    <span className="md:hidden">Ready</span>
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className={`hidden xl:flex items-center gap-2 px-2.5 py-1 rounded border opacity-40 hover:opacity-100 transition-opacity ${isDarkMode ? 'border-white/5 bg-slate-900/40' : 'border-slate-200/30 bg-slate-100/50'}`}>
              <span className="text-[8px] font-black text-indigo-400/80 uppercase">Yahoo Feed v1.2</span>
            </div>
          </div>

          {/* Breakdown Notification Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2 w-full md:w-auto">
            <button
              onClick={() => toggleSignalFilter('1d', 'Buy Zone')}
              className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${dSignalFilter.includes('Buy Zone') ? (isDarkMode ? 'bg-emerald-500/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-[0_2px_8px_rgba(16,185,129,0.06)]') : (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50/20 text-emerald-600/80 border-emerald-100/40 hover:bg-emerald-50/50')}`}
            >
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>{stats.buyCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-emerald-400/60' : 'text-emerald-600/50'}`}>Buy Zones</span>
            </button>
            <button
              onClick={() => toggleSignalFilter('1d', 'Value Zone')}
              className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${dSignalFilter.includes('Value Zone') ? (isDarkMode ? 'bg-amber-500/30 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-amber-50 border-amber-200 text-amber-700 shadow-[0_2px_8px_rgba(245,158,11,0.06)]') : (isDarkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50/20 text-amber-600/80 border-amber-100/40 hover:bg-amber-50/50')}`}
            >
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>{stats.valueCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-amber-400/60' : 'text-amber-600/50'}`}>Value Zones</span>
            </button>
            <button
              onClick={() => toggleSignalFilter('1d', 'Sell Zone')}
              className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${dSignalFilter.includes('Sell Zone') ? (isDarkMode ? 'bg-rose-500/30 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'bg-rose-50 border-rose-200 text-rose-700 shadow-[0_2px_8px_rgba(244,63,94,0.06)]') : (isDarkMode ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50/20 text-rose-600/80 border-rose-100/40 hover:bg-rose-50/50')}`}
            >
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-rose-400' : 'text-rose-700'}`}>{stats.sellCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-rose-400/60' : 'text-rose-600/50'}`}>Sell Zones</span>
            </button>
            <button
              onClick={() => toggleSignalFilter('1d', 'Neutral Zone')}
              className={`flex flex-col px-2 py-1.5 md:px-3 md:py-2 border rounded-lg md:rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${dSignalFilter.includes('Neutral Zone') ? (isDarkMode ? 'bg-white/20 border-white/40' : 'bg-slate-200 border-slate-300 text-slate-700') : (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50/50 border-slate-200/35 text-slate-500 hover:bg-slate-100/50')}`}
            >
              <span className={`text-xs font-black leading-none ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{stats.neutralCount}</span>
              <span className={`text-[7.5px] md:text-[8px] uppercase font-bold tracking-wider mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Neutral Zone</span>
            </button>
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
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}>Filters:</span>
            <div className="relative" ref={sectorRef}>
              <button
                onClick={() => setShowSectorDropdown(!showSectorDropdown)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all active:scale-95 group ${isDarkMode ? 'bg-slate-900 border-white/10 hover:border-indigo-500/50' : 'bg-white border-slate-200/60 hover:border-indigo-500/30 text-slate-700 hover:text-indigo-600 shadow-sm'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-all ${sectorFilters.length > 0 ? 'bg-indigo-500' : 'bg-slate-500'}`}></div>
                <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300 group-hover:text-white' : 'text-slate-700 group-hover:text-indigo-600'}`}>
                  {sectorFilters.length === 0 ? 'Sector' : `Filtering: ${sectorFilters.length} Sectors`}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${showSectorDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSectorDropdown && (
                <div className={`absolute top-full left-0 mt-3 w-64 border rounded-xl shadow-2xl p-2 z-[100] backdrop-blur-xl transition-all ${isDarkMode ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200/60 shadow-[0_12px_40px_rgba(0,0,0,0.06)]'}`}>
                  <div className={`px-3 py-1.5 mb-2 text-[8px] font-black uppercase tracking-widest border-b flex justify-between items-center ${isDarkMode ? 'text-slate-500 border-white/5' : 'text-slate-500 border-slate-100'}`}>
                    <span>Filter by Sector</span>
                    {sectorFilters.length > 0 && (
                      <button onClick={() => setSectorFilters([])} className="text-indigo-400 hover:text-indigo-300 normal-case">Clear All</button>
                    )}
                  </div>
                  {stats.sectors.map((sector) => (
                    <button
                      key={sector}
                      onClick={() => toggleSectorFilter(sector)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-between mb-1 ${sectorFilters.includes(sector)
                          ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50/70 text-indigo-600')
                          : (isDarkMode ? 'text-slate-400 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50/80')
                        }`}
                    >
                      <span className="truncate">{sector}</span>
                      {sectorFilters.includes(sector) && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {loading && <div className="text-[10px] font-bold text-indigo-400 animate-pulse tracking-[0.2em] hidden sm:block">SYNCHRONIZING...</div>}
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex p-1 rounded-xl border transition-all duration-300 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-100/80 border-slate-200/60'}`}>
              <button
                onClick={() => setView('table')}
                className={`p-1.5 rounded-lg transition-all ${view === 'table' ? (isDarkMode ? 'bg-white/10 text-white shadow-lg' : 'bg-white text-slate-800 shadow-sm border border-slate-200/10') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600 hover:text-slate-800')}`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('grid')}
                className={`p-1.5 rounded-lg transition-all ${view === 'grid' ? (isDarkMode ? 'bg-white/10 text-white shadow-lg' : 'bg-white text-slate-800 shadow-sm border border-slate-200/10') : (isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-600 hover:text-slate-800')}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {view === 'table' ? (
          <div className={`backdrop-blur-xl border rounded-2xl flex flex-col shadow-2xl transition-all duration-300 w-full ${isDarkMode ? 'bg-white/5 border-white/10 shadow-black/40' : 'bg-white border-slate-200/60 shadow-xl shadow-slate-100/30 backdrop-blur-md'}`}>
            <div className={`overflow-x-auto rounded-t-2xl ${filteredStocks.length < 4 ? 'min-h-[280px]' : ''}`}>
              <table className="w-full text-left border-separate border-spacing-0 font-mono min-w-[550px] lg:min-w-0 table-fixed">
                <thead>
                  <tr className={`text-[9px] md:text-[10px] uppercase tracking-tighter md:tracking-wider font-bold transition-all duration-300 ${isDarkMode ? 'bg-slate-900/50 text-slate-400' : 'bg-slate-50 text-slate-600 border-b border-slate-200/60'}`}>
                    <th
                      className={`px-1 md:px-4 py-2.5 sticky left-0 whitespace-nowrap w-[23%] font-mono transition-colors duration-150 z-30 border-l-2 border-l-transparent border-b ${isDarkMode ? 'bg-slate-950 border-r border-white/10 border-b-white/10' : 'bg-white border-r border-slate-200/60 border-b border-slate-200/60'}`}
                      style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden', willChange: 'transform' }}
                    >
                      <div className="flex items-center gap-1 md:gap-3">
                        <span 
                          onClick={() => handleSort('marketCap')}
                          className={`w-4 md:w-8 text-right pr-1 md:pr-2 border-r shrink-0 cursor-pointer transition-colors duration-150 ${
                            sortBy === 'marketCap' 
                              ? (isDarkMode ? 'text-indigo-400 font-black' : 'text-indigo-600 font-black') 
                              : (isDarkMode ? 'border-white/10 text-slate-400 hover:text-white' : 'border-slate-200/60 text-slate-500 hover:text-indigo-600')
                          }`}
                          title="Sort by Rank / Market Cap"
                        >
                          #
                        </span>
                        <div className="flex-1 flex justify-center">
                          <span 
                            onClick={() => handleSort('change')}
                            className={`text-[9px] md:text-[10px] font-bold uppercase tracking-tighter cursor-pointer transition-colors duration-150 ${
                              sortBy === 'change'
                                ? (isDarkMode ? 'text-indigo-400 font-black' : 'text-indigo-600 font-black')
                                : (isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-700 hover:text-indigo-600')
                            }`}
                            title="Sort by % Change"
                          >
                            Asset
                          </span>
                        </div>
                      </div>
                    </th>
                    <th
                      className={`px-1 md:px-4 py-3 text-center whitespace-nowrap w-[15%] border-b ${isDarkMode ? 'border-b-white/10 text-slate-400' : 'border-b-slate-200/60 text-slate-600'}`}
                    >
                      Price
                    </th>
                    {['1h', '4hr', '1d', '1wk', '1mo'].map((tf) => (
                      <th key={tf} className={`px-1 md:px-4 py-3 text-center group relative whitespace-nowrap w-[10%] border-b ${isDarkMode ? 'border-b-white/10' : 'border-b-slate-200/60 text-slate-600'}`}>
                        <div
                          className="relative inline-block text-left"
                          ref={tf === '1h' ? hSignalRef : tf === '4hr' ? hrSignalRef : tf === '1d' ? dSignalRef : tf === '1wk' ? wSignalRef : mSignalRef}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSignalDropdown(prev => prev === tf ? null : tf as any);
                            }}
                            className={`flex items-center justify-center gap-0.5 text-[8px] md:text-[10px] uppercase font-bold tracking-wider hover:text-indigo-400 transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-600 hover:text-indigo-600'}`}
                          >
                            {tf === '1h' ? '1H' : tf === '4hr' ? '4H' : tf === '1d' ? 'D' : tf === '1wk' ? 'W' : 'M'}
                            <Filter className={`w-2 h-2 ${(tf === '1h' ? hSignalFilter : tf === '4hr' ? hrSignalFilter : tf === '1d' ? dSignalFilter : tf === '1wk' ? wSignalFilter : mSignalFilter).length > 0 ? 'text-indigo-400' : ''}`} />
                          </button>
                          {activeSignalDropdown === tf && (
                            <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-3 w-40 border rounded-xl shadow-2xl p-2 z-[100] backdrop-blur-xl ${isDarkMode ? 'bg-slate-950 border-white/10' : 'bg-white border-slate-200/60 shadow-2xl shadow-slate-100/50 backdrop-blur-md'}`}>
                              <div className={`px-3 py-1.5 mb-1 text-[8px] font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-slate-500 border-white/5' : 'text-slate-500 border-slate-100'}`}>
                                {tf === '1h' ? 'Hourly' : tf === '4hr' ? '4 Hour' : tf === '1d' ? 'Daily' : tf === '1wk' ? 'Weekly' : 'Monthly'} Filter
                              </div>
                              {['Buy Zone', 'Value Zone', 'Sell Zone', 'Neutral Zone'].map((option) => (
                                <button
                                  key={`${tf}-${option}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSignalFilter(tf as any, option);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all ${(tf === '1h' ? hSignalFilter : tf === '4hr' ? hrSignalFilter : tf === '1d' ? dSignalFilter : tf === '1wk' ? wSignalFilter : mSignalFilter).includes(option)
                                      ? (isDarkMode ? 'bg-indigo-50/20 text-indigo-400' : 'bg-indigo-50/70 text-indigo-600')
                                      : (isDarkMode ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')
                                    }`}
                                >
                                  <span>{option}</span>
                                  {(tf === '1h' ? hSignalFilter : tf === '4hr' ? hrSignalFilter : tf === '1d' ? dSignalFilter : tf === '1wk' ? wSignalFilter : mSignalFilter).includes(option) && <Check className="w-3 h-3" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </th>
                    ))}
                    <th
                      className={`px-1 md:px-4 py-3 cursor-pointer transition-colors whitespace-nowrap w-[12%] text-center border-b ${
                        sortBy === 'marketCap'
                          ? (isDarkMode ? 'text-indigo-400 font-black' : 'text-indigo-600 font-black')
                          : (isDarkMode ? 'border-b-white/10 hover:text-white' : 'border-b-slate-200/60 text-slate-600 hover:text-indigo-600')
                      }`}
                      onClick={() => handleSort('marketCap')}
                    >
                      Cap
                    </th>
                  </tr>
                </thead>
                <tbody className="transition-all duration-300">
                  {visibleStocks.map((stock) => (
                    <tr
                      key={stock.symbol}
                      className={`group transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50/60'}`}
                    >
                      <td
                        className={`px-1 md:px-4 py-2.5 sticky left-0 whitespace-nowrap transition-colors duration-150 z-30 border-l-2 border-l-transparent group-hover:border-l-indigo-500 border-b ${isDarkMode ? 'bg-slate-950 border-r border-white/10 border-b-white/5 group-hover:bg-slate-900' : 'bg-white border-r border-slate-200/60 border-b border-slate-200/60 group-hover:bg-slate-50'}`}
                        style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden', willChange: 'transform' }}
                      >
                        <div className="flex items-center gap-1 md:gap-3">
                          <span className={`text-[9px] md:text-[10px] font-black w-4 md:w-8 text-right pr-1 md:pr-2 border-r shrink-0 ${isDarkMode ? 'text-slate-600 border-white/10' : 'text-slate-500 border-slate-200/60'}`}>{stock.mcRank}</span>
                          <div className="flex-1 flex flex-col items-center">
                            <div className="relative inline-flex items-center justify-center">
                              <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); handleChartRedirect(stock.symbol); }}
                                className={`text-[11px] md:text-sm font-black transition-colors uppercase tracking-tighter underline ${isDarkMode ? 'text-white hover:text-indigo-400' : 'text-slate-800 hover:text-indigo-600'}`}
                              >
                                {stock.symbol}
                              </a>
                              {stock.change !== undefined && stock.change !== null && stock.price > 0 && (
                                <span className={`absolute left-full ml-1.5 whitespace-nowrap text-[7px] md:text-[9px] font-mono font-bold leading-none ${
                                  stock.change === 0
                                    ? (isDarkMode ? 'text-slate-400' : 'text-slate-500')
                                    : stock.change > 0
                                    ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                                    : (isDarkMode ? 'text-rose-400' : 'text-rose-600')
                                  }`}>
                                  {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                                </span>
                              )}
                            </div>
                            <span className={`text-[8px] md:text-[9px] ${isDarkMode ? 'text-indigo-400/60' : 'text-indigo-600/80'} font-bold uppercase truncate max-w-[60px] md:max-w-none mt-1 sector-label`}>{stock.sector}</span>
                          </div>
                        </div>
                      </td>
                      <td className={`px-1 md:px-4 py-3 text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'}`}>
                        <div className={`text-[10px] md:text-sm font-bold ${
                          stock.price === 0 || stock.change === 0
                            ? (isDarkMode ? 'text-white' : 'text-slate-800')
                            : stock.change > 0
                            ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                            : (isDarkMode ? 'text-rose-400' : 'text-rose-600')
                        }`}>
                          ${stock.price.toFixed(2)}
                        </div>
                      </td>
                      <td id={`h-signal-${stock.symbol}`} className={`px-1 md:px-4 py-3 text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'}`}>
                        {getZoneBadge(stocksByTimeframe['1h'][stock.symbol]?.zone || 'Neutral Zone')}
                      </td>
                      <td id={`hr-signal-${stock.symbol}`} className={`px-1 md:px-4 py-3 text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'}`}>
                        {getZoneBadge(stocksByTimeframe['4hr'][stock.symbol]?.zone || 'Neutral Zone')}
                      </td>
                      <td id={`d-signal-${stock.symbol}`} className={`px-1 md:px-4 py-3 text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'}`}>
                        {getZoneBadge(stocksByTimeframe['1d'][stock.symbol]?.zone || 'Neutral Zone')}
                      </td>
                      <td id={`w-signal-${stock.symbol}`} className={`px-1 md:px-4 py-3 text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'}`}>
                        {getZoneBadge(stocksByTimeframe['1wk'][stock.symbol]?.zone || 'Neutral Zone')}
                      </td>
                      <td id={`m-signal-${stock.symbol}`} className={`px-1 md:px-4 py-3 text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'}`}>
                        {getZoneBadge(stocksByTimeframe['1mo'][stock.symbol]?.zone || 'Neutral Zone')}
                      </td>
                      <td className={`px-1 md:px-4 py-3 text-[10px] md:text-[11px] font-bold whitespace-nowrap text-center border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/60'} ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                        {formatMarketCap(stock.marketCap)}
                      </td>
                    </tr>
                  ))}
                  {visibleStocks.length < filteredStocks.length && (
                    <tr ref={observerRef}>
                      <td colSpan={8} className={`py-4 text-center text-xs font-black text-slate-500 uppercase tracking-widest border-b ${isDarkMode ? 'border-white/5' : 'border-slate-200/40'}`}>
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                          <span>Loading More Stocks...</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {filteredStocks.length === 0 && !loading && (
                <div className="p-12 md:p-24 text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 border shadow-xl transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50/50 border-slate-200/35 shadow-slate-100/50'}`}>
                    <Search className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className={`font-bold tracking-tight text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>No Active Assets Found</h3>
                  <p className="text-[10px] text-slate-400 mt-2 font-mono uppercase tracking-[0.2em] max-w-xs mx-auto">Adjust search parameters or refresh data link.</p>
                </div>
              )}
            </div>

            <div className={`h-10 border-t flex items-center justify-between px-4 md:px-6 transition-all duration-300 ${isDarkMode ? 'border-white/10 bg-slate-900/30' : 'border-slate-200/30 bg-slate-50/40 rounded-b-2xl'}`}>
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
              {visibleStocks.map((stock) => (
                <motion.div
                  key={stock.symbol}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleChartRedirect(stock.symbol)}
                  className={`backdrop-blur-xl border rounded-2xl p-5 md:p-6 transition-all group relative overflow-hidden text-left cursor-pointer interactive-target ${isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white/80 border-slate-200/45 hover:border-indigo-300 hover:bg-white shadow-xl shadow-slate-100/40 hover:shadow-indigo-500/5'}`}
                >
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className={`w-16 h-16 ${isDarkMode ? 'text-white' : 'text-slate-200/30'}`} />
                  </div>

                  <div className="flex justify-between items-start mb-5 relative z-10">
                    <div className="text-left">
                      <div className="flex items-baseline gap-2">
                        <h3 className={`font-mono text-xl font-black group-hover:text-indigo-500 transition-colors leading-none tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stock.symbol}</h3>
                        <span className="text-[10px] font-black opacity-20">#{stock.mcRank}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 uppercase font-bold tracking-widest truncate max-w-[120px]">{stock.name}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-black tracking-widest ${
                        stock.price === 0 || stock.change === 0
                          ? (isDarkMode ? 'text-white' : 'text-slate-800')
                          : stock.change > 0
                          ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                          : (isDarkMode ? 'text-rose-400' : 'text-rose-600')
                      }`}>${stock.price.toFixed(2)}</div>
                      <div className={`text-[10px] font-bold mt-1 ${
                        stock.price === 0 || stock.change === 0
                          ? (isDarkMode ? 'text-slate-500' : 'text-slate-400')
                          : stock.change > 0
                          ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600')
                          : (isDarkMode ? 'text-rose-400' : 'text-rose-600')
                      }`}>
                        {stock.change === 0 ? '' : stock.change > 0 ? '↑' : '↓'} {Math.abs(stock.change).toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mb-5 relative text-left">
                    <div className="space-y-2">
                      <div className={`flex justify-between items-center text-[9px] uppercase tracking-[0.2em] font-black border-b pb-1 ${isDarkMode ? 'text-slate-500 border-white/5' : 'text-slate-400/80 border-slate-100/60'}`}>
                        <span>Trend Signal</span>
                        <span className={stock.maFast > stock.maSlow ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') : (isDarkMode ? 'text-rose-400' : 'text-rose-600')}>
                          {stock.maFast > stock.maSlow ? 'Golden Cross' : 'Death Cross'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                        <div className={`border p-2 rounded-lg py-1.5 ${isDarkMode ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50/50 border-slate-200/35'}`}>
                          <div className="text-[8px] text-slate-500 uppercase">SMA 50</div>
                          <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stock.maFast.toFixed(1)}</div>
                        </div>
                        <div className={`border p-2 rounded-lg py-1.5 ${isDarkMode ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50/50 border-slate-200/35'}`}>
                          <div className="text-[8px] text-slate-500 uppercase">SMA 200</div>
                          <div className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stock.maSlow.toFixed(1)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 text-left">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">RSI Intensity</span>
                        <span className={`text-[10px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{stock.rsi.toFixed(1)}</span>
                      </div>
                      <div className={`h-1 rounded-full overflow-hidden shrink-0 ${isDarkMode ? 'bg-slate-900' : 'bg-slate-200/50'}`}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stock.rsi}%` }}
                          className={`h-full ${stock.rsi >= 50 ? 'bg-indigo-500' : (isDarkMode ? 'bg-slate-700' : 'bg-slate-400/80')}`}
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
            {visibleStocks.length < filteredStocks.length && (
              <div ref={observerRef} className="col-span-full py-8 text-center text-xs font-black text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
                <RefreshCcw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Loading More Stocks...</span>
              </div>
            )}
          </div>
        )}


        {symbols.length === 0 && loading && (
          <div className={`p-20 text-center font-mono text-[10px] uppercase tracking-widest backdrop-blur-xl rounded-2xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-500' : 'bg-white border-slate-200 text-slate-400 shadow-xl shadow-slate-200/50'}`}>
            Initialising core modules...
          </div>
        )}

      </main>

      <footer className="mt-12 md:mt-20">
        <div className={`max-w-7xl mx-auto px-6 md:px-8 py-10 md:py-16 border-t flex flex-col md:flex-row justify-between items-start md:items-center gap-8 opacity-40 hover:opacity-100 transition-opacity ${isDarkMode ? 'border-white/10' : 'border-slate-200/40'}`}>
          <div className="space-y-4 max-w-sm text-left">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              <h4 className={`text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>System Manifest</h4>
            </div>
            <p className={`text-[10px] md:text-[11px] leading-relaxed font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>This interface visualizes algorithmic decision zones derived from multi-period market metrics. Logic is server-authoritative and processed in real-time batches.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-12 text-left w-full md:w-auto">
            <div className="space-y-2 md:space-y-3">
              <h5 className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500/80'}`}>Macro Delta</h5>
              <p className={`text-[9px] md:text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>SMA Cross Detection</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <h5 className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500/80'}`}>Relative Force</h5>
              <p className={`text-[9px] md:text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>RSI Pulse Analysis</p>
            </div>
            <div className="space-y-2 md:space-y-3">
              <h5 className={`text-[8px] md:text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-500/80'}`}>Decision Logic</h5>
              <p className={`text-[9px] md:text-[10px] ${isDarkMode ? 'text-slate-300' : 'text-slate-500'}`}>Zone Calibration</p>
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

