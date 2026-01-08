import React, { useState, useEffect, useRef } from 'react';
import { Upload, RefreshCw, BarChart2, ShieldCheck, Zap, TrendingUp, Settings } from 'lucide-react';

/**
 * LOTTO GENIUS - 통계적 균형 및 비인기 조합 필터 기반 로또 번호 생성기
 */

// --- Constants & Utilities ---

const getBallColor = (num: number) => {
    if (num <= 10) return 'bg-yellow-500 border-yellow-300 shadow-yellow-500/50';
    if (num <= 20) return 'bg-blue-500 border-blue-300 shadow-blue-500/50';
    if (num <= 30) return 'bg-red-500 border-red-300 shadow-red-500/50';
    if (num <= 40) return 'bg-slate-500 border-slate-300 shadow-slate-500/50';
    return 'bg-emerald-500 border-emerald-300 shadow-emerald-500/50';
};

// Types
type LottoDraw = number[];
type Stats = {
    avgSum: number;
    hotNumbers: number[];
};
type Game = {
    numbers: number[];
    sum: number;
    oddCount: number;
    hotCount: number;
};

// --- Components ---

const LottoBall = ({ number, animate }: { number: number, animate?: boolean }) => {
    return (
        <div
            className={`
        w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center 
        text-white font-bold text-lg sm:text-xl border-2 shadow-lg
        ${getBallColor(number)}
        ${animate ? 'animate-bounce-short' : ''}
        transition-all duration-300 transform hover:scale-110
      `}
        >
            {number}
        </div>
    );
};

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${colorClass} bg-opacity-20`}>
            <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
        </div>
        <div>
            <h3 className="text-slate-400 text-xs uppercase tracking-wider">{title}</h3>
            <div className="text-2xl font-bold text-white">{value}</div>
            {subtext && <div className="text-xs text-slate-500">{subtext}</div>}
        </div>
    </div>
);

export default function LottoGenius() {
    // State
    const [historyData, setHistoryData] = useState<LottoDraw[]>([]);
    const [tolerance, setTolerance] = useState(0.05); // 5% default
    const [generatedGames, setGeneratedGames] = useState<Game[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [stats, setStats] = useState<Stats>({ avgSum: 0, hotNumbers: [] });
    const [logs, setLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-load CSV on mount
    useEffect(() => {
        fetch('/lotto_results.csv')
            .then(res => {
                if (!res.ok) throw new Error("Failed to load CSV");
                return res.text();
            })
            .then(text => processCSV(text))
            .catch(err => console.log("Auto-load failed, waiting for user upload...", err));
    }, []);

    // --- Statistics Calculation ---
    useEffect(() => {
        if (!historyData || historyData.length === 0) return;

        // 1. Calculate Average Sum
        let totalSum = 0;
        const frequency: Record<number, number> = {};

        historyData.forEach(draw => {
            const sum = draw.reduce((a, b) => a + b, 0);
            totalSum += sum;
            draw.forEach(num => {
                frequency[num] = (frequency[num] || 0) + 1;
            });
        });

        const avgSum = totalSum / historyData.length;

        // 2. Identify Top 10 Hot Numbers
        const sortedNums = Object.keys(frequency)
            .map(num => ({ num: parseInt(num), count: frequency[parseInt(num)] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map(item => item.num);

        setStats({ avgSum, hotNumbers: sortedNums });
    }, [historyData]);

    // --- CSV Parsing ---
    const processCSV = (text: string) => {
        const lines = text.split('\n');
        const parsedData: LottoDraw[] = [];

        // Format: Round, N1, N2, N3, N4, N5, N6, Bonus
        // We only want N1..N6 (indices 1..6)

        lines.forEach((line) => {
            // Skip empty lines
            if (!line.trim()) return;

            // Split by comma
            const cols = line.split(',').map(s => s.trim());

            // Check if we have enough columns (at least 7: Round + 6 numbers)
            if (cols.length >= 7) {
                // Try parsing columns 1 to 6
                const potentialNumbers = cols.slice(1, 7).map(Number);

                // Validate they are real numbers and within range 1-45
                const validNumbers = potentialNumbers.filter(n => !isNaN(n) && n >= 1 && n <= 45);

                if (validNumbers.length === 6) {
                    parsedData.push(validNumbers);
                }
            }
        });

        if (parsedData.length > 0) {
            setHistoryData(parsedData);
            // Only alert if manually triggered or meaningful change? 
            // Let's avoid annoying alerts on auto-load, but good to know it worked.
            console.log(`Loaded ${parsedData.length} records.`);
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text === 'string') {
                processCSV(text);
                alert("CSV 파일이 로드되었습니다.");
            }
        };
        reader.readAsText(file);
    };

    // --- Core Algorithm ---
    const generateLottoNumbers = async () => {
        setIsGenerating(true);
        setGeneratedGames([]);
        setLogs([]);

        await new Promise(r => setTimeout(r, 500));

        const newGames: Game[] = [];
        let attempts = 0;
        const maxAttempts = 10000;

        // Default stats if no data loaded
        const currentAvgSum = stats.avgSum || 138; // 138 is theoretical avg sum of lotto (avg(1..45)=23 * 6 = 138)

        const targetMin = currentAvgSum * (1 - tolerance);
        const targetMax = currentAvgSum * (1 + tolerance);

        const addLog = (msg: string) => {
            setLogs(prev => [`[필터] ${msg}`, ...prev].slice(0, 5));
        };

        const currentHotNumbers = stats.hotNumbers.length > 0 ? stats.hotNumbers : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Fallback

        while (newGames.length < 5 && attempts < maxAttempts) {
            attempts++;

            // 1. Random Generation
            const numbers = new Set<number>();
            while (numbers.size < 6) {
                numbers.add(Math.floor(Math.random() * 45) + 1);
            }
            const candidate = Array.from(numbers).sort((a, b) => a - b);

            // --- FILTER 1: Statistical Balance (Sum) ---
            const sum = candidate.reduce((a, b) => a + b, 0);
            if (sum < targetMin || sum > targetMax) {
                if (attempts % 100 === 0) addLog(`합계(${sum}) 범위 초과`);
                continue;
            }

            // --- FILTER 2: Logic Filters ---

            // 2-1. Consecutive Numbers (3+)
            let consecutiveCount = 0;
            let hasThreeConsecutive = false;
            for (let i = 0; i < candidate.length - 1; i++) {
                if (candidate[i] + 1 === candidate[i + 1]) {
                    consecutiveCount++;
                    if (consecutiveCount >= 2) hasThreeConsecutive = true;
                } else {
                    consecutiveCount = 0;
                }
            }
            if (hasThreeConsecutive) {
                if (attempts % 100 === 0) addLog(`3연속 번호 발견`);
                continue;
            }

            // 2-2. Too Many Hot Numbers
            const hotCount = candidate.filter(n => currentHotNumbers.includes(n)).length;
            if (hotCount >= 3) {
                if (attempts % 100 === 0) addLog(`인기 번호 과다(${hotCount})`);
                continue;
            }

            // 2-3. Birthday Bias
            const allBirthday = candidate.every(n => n <= 31);
            if (allBirthday) {
                if (attempts % 100 === 0) addLog(`생일 패턴(저번호) 발견`);
                continue;
            }

            // 2-4. Odd/Even Balance
            const oddCount = candidate.filter(n => n % 2 !== 0).length;
            if (oddCount === 0 || oddCount === 6 || oddCount === 1 || oddCount === 5) {
                if (attempts % 100 === 0) addLog(`홀짝 불균형(${oddCount}:${6 - oddCount})`);
                continue;
            }

            // Success
            newGames.push({ numbers: candidate, sum, oddCount, hotCount });
        }

        setGeneratedGames(newGames);
        setIsGenerating(false);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-emerald-500 selection:text-white pb-20">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur-lg border-b border-white/5 sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <div className="bg-gradient-to-tr from-emerald-400 to-cyan-500 p-2 rounded-lg shadow-lg shadow-emerald-500/20">
                            <Zap className="w-6 h-6 text-white" fill="currentColor" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Lotto Genius <span className="text-emerald-400">AI</span></h1>
                            <p className="text-xs text-slate-400">통계 기반 로또 예측 시스템</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">

                {/* Intro/Upload Section */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-500 blur-3xl opacity-20 group-hover:opacity-30 transition"></div>

                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
                            <Settings className="w-5 h-5 mr-2 text-purple-400" />
                            분석 설정
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">데이터베이스 상태</label>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 flex items-center justify-center space-x-2 bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-lg transition border border-slate-600"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>CSV 업데이트</span>
                                    </button>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <div className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-xs flex items-center text-slate-400 font-mono">
                                        Records: {historyData.length}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-slate-400 mb-2">예측 허용 범위 (Tolerance)</label>
                                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                                    <button
                                        onClick={() => setTolerance(0.02)}
                                        className={`flex-1 py-1.5 text-sm rounded-md transition ${tolerance === 0.02 ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Strict (±2%)
                                    </button>
                                    <button
                                        onClick={() => setTolerance(0.05)}
                                        className={`flex-1 py-1.5 text-sm rounded-md transition ${tolerance === 0.05 ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Standard (±5%)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Dashboard */}
                    <div className="grid grid-cols-1 gap-4">
                        <StatCard
                            title="평균 합계 (Avg Sum)"
                            value={stats.avgSum > 0 ? stats.avgSum.toFixed(1) : "N/A"}
                            subtext={stats.avgSum > 0 ? `Target: ${(stats.avgSum * (1 - tolerance)).toFixed(0)} ~ ${(stats.avgSum * (1 + tolerance)).toFixed(0)}` : "데이터 로드 필요"}
                            icon={TrendingUp}
                            colorClass="bg-emerald-500"
                        />
                        <StatCard
                            title="최다 빈출 (Hot Numbers)"
                            value={stats.hotNumbers.length > 0 ? stats.hotNumbers.slice(0, 5).join(', ') : "N/A"}
                            subtext="Too hot to handle? (제외 필터 적용)"
                            icon={BarChart2}
                            colorClass="bg-orange-500"
                        />
                    </div>
                </section>

                {/* Action Button */}
                <div className="flex justify-center space-x-4">
                    <button
                        onClick={generateLottoNumbers}
                        disabled={isGenerating || historyData.length === 0}
                        className={`
              relative overflow-hidden group
              px-12 py-5 rounded-full font-bold text-xl tracking-wider
              text-white shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)]
              transition-all duration-300 transform hover:scale-105 active:scale-95
              ${(isGenerating || historyData.length === 0) ? 'bg-slate-700 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400'}
            `}
                    >
                        <span className="relative z-10 flex items-center space-x-3">
                            {isGenerating ? (
                                <>
                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                    <span>분석 중...</span>
                                </>
                            ) : (
                                <>
                                    <Zap className="w-6 h-6" fill="currentColor" />
                                    <span>AI 번호 생성</span>
                                </>
                            )}
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            setGeneratedGames([]);
                            setLogs([]);
                        }}
                        disabled={generatedGames.length === 0}
                        className={`
                            px-6 py-5 rounded-full font-bold text-lg
                            transition-all duration-300 transform hover:scale-105 active:scale-95
                            border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800
                            ${generatedGames.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        초기화
                    </button>
                </div>

                {/* Logs Area */}
                {logs.length > 0 && (
                    <div className="bg-black/30 rounded-lg p-3 text-xs font-mono text-slate-500 overflow-hidden border border-slate-800">
                        {logs.map((log, i) => (
                            <div key={i} className="truncate">{log}</div>
                        ))}
                    </div>
                )}

                {/* Results Section */}
                {generatedGames.length > 0 && (
                    <section className="space-y-4 animate-fade-in-up">
                        <h3 className="text-xl font-bold text-white flex items-center space-x-2 border-l-4 border-emerald-500 pl-4">
                            <span>추천 조합</span>
                            <span className="text-sm font-normal text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                5 Games
                            </span>
                        </h3>

                        <div className="grid gap-4">
                            {generatedGames.map((game, index) => (
                                <div
                                    key={index}
                                    className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between hover:border-emerald-500/50 transition duration-300 group shadow-lg"
                                >
                                    <div className="flex items-center space-x-4 mb-4 sm:mb-0 w-full sm:w-auto justify-center">
                                        <span className="text-slate-500 font-mono text-sm mr-2">#{index + 1}</span>
                                        <div className="flex space-x-2 sm:space-x-3">
                                            {game.numbers.map((num) => (
                                                <LottoBall key={num} number={num} animate={true} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex space-x-6 text-xs sm:text-sm text-slate-400 w-full sm:w-auto justify-between sm:justify-end px-4 sm:px-0 border-t sm:border-t-0 border-slate-700 pt-3 sm:pt-0 mt-2 sm:mt-0">
                                        <div className="flex flex-col items-center sm:items-end">
                                            <span className="text-xs text-slate-600 uppercase">Sum</span>
                                            <span className="text-emerald-400 font-bold">{game.sum}</span>
                                        </div>
                                        <div className="flex flex-col items-center sm:items-end">
                                            <span className="text-xs text-slate-600 uppercase">Odd/Even</span>
                                            <span className="text-slate-300">{game.oddCount}:{6 - game.oddCount}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Algorithm Info */}
                <section className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mt-8">
                    <h4 className="text-slate-300 font-semibold mb-4 flex items-center">
                        <ShieldCheck className="w-5 h-5 mr-2 text-indigo-400" />
                        시스템 적용 알고리즘
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-400">
                        <div className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <p><strong>합계 필터:</strong> {stats.avgSum > 0 ? `역대 평균(${stats.avgSum.toFixed(0)})` : '평균'} 기준 ±{(tolerance * 100).toFixed(0)}% 이내</p>
                        </div>
                        <div className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <p><strong>연속 번호:</strong> 3연속 번호 제외</p>
                        </div>
                        <div className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <p><strong>과열 번호:</strong> 인기 번호 3개 이상 중복 제외</p>
                        </div>
                        <div className="flex items-start space-x-2">
                            <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                            <p><strong>패턴 제거:</strong> 생일 패턴(1~31) 및 홀짝 쏠림 제외</p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
