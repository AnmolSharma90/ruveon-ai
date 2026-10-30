import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Goal,
  IndianRupee,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PiggyBank,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

const SpendingTrendChart = lazy(() => import('./Charts').then((module) => ({ default: module.SpendingTrendChart })));
const CategorySpendingChart = lazy(() => import('./Charts').then((module) => ({ default: module.CategorySpendingChart })));
const MonthlyExpenseChart = lazy(() => import('./Charts').then((module) => ({ default: module.MonthlyExpenseChart })));

const currentDate = new Date();
function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const sections = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'faq', label: 'FAQ' },
];

const categoryColors = {
  Housing: '#38bdf8',
  Food: '#10b981',
  Transport: '#f59e0b',
  Shopping: '#a78bfa',
  Bills: '#fb7185',
  Health: '#22c55e',
  Entertainment: '#f97316',
  Travel: '#14b8a6',
  Salary: '#34d399',
  Freelance: '#60a5fa',
  Investments: '#c084fc',
  Other: '#94a3b8',
};

const defaultForm = {
  type: 'expense',
  category: 'Food',
  description: '',
  merchant: '',
  amount: '',
  date: getLocalDateString(),
  paymentMethod: 'UPI',
  notes: '',
};

const budgetFormDefault = { category: 'Food', limit: '', period: getLocalDateString().slice(0, 7), kind: 'category' };
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || '/api/v1';
const SESSION_KEY = 'ruveon-user';

const mapTransactionFromApi = (item) => ({
  id: item.id,
  type: item.type,
  category: item.category,
  description: item.description,
  merchant: item.merchant,
  amount: Number(item.amount),
  date: item.date,
  paymentMethod: item.payment_method,
  notes: item.notes || '',
});

const mapBudgetFromApi = (item) => ({
  id: item.id,
  category: item.category,
  limit: Number(item.limit_amount),
  period: item.period,
  type: item.kind || 'category',
  spent: Number(item.spent_amount || 0),
});

const requestJson = async (url, options = {}) => {
  let session = null;
  if (typeof window !== 'undefined') {
    try {
      session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || `Request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(errorText);
      message = parsed.detail || message;
    } catch {
      // Keep the response text when the server does not return JSON.
    }
    if (
      response.status === 401 &&
      !url.endsWith('/users/logout') &&
      !url.endsWith('/users/login') &&
      !url.endsWith('/users')
    ) {
      window.dispatchEvent(new CustomEvent('ruveon:session-expired', { detail: message }));
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  throw new Error('The API returned an unexpected response. Check the deployed API URL configuration.');
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodTransactions(transactions, period) {
  if (!transactions?.length) return [];
  const now = new Date();
  if (period === 'This month') {
    const monthKey = getMonthKey(now);
    return transactions.filter((item) => item.date.startsWith(monthKey));
  }
  if (period === 'Last 3 months') {
    const monthKeys = new Set();
    for (let i = 0; i < 3; i += 1) {
      const target = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.add(getMonthKey(target));
    }
    return transactions.filter((item) => monthKeys.has(item.date.slice(0, 7)));
  }
  if (period === 'This year') {
    return transactions.filter((item) => item.date.startsWith(String(now.getFullYear())));
  }
  return transactions;
}

function sumAmounts(items, type) {
  return items
    .filter((item) => item.type === type)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function createCsv(rows) {
  const headers = ['date', 'type', 'category', 'description', 'merchant', 'amount', 'paymentMethod', 'notes'];
  const escapeCell = (value) => {
    const stringValue = value == null ? '' : String(value);
    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCell(row[header])).join(','));
  });

  return lines.join('\n');
}

function App() {
  const [transactions, setTransactions] = useState([]);
  const [transactionOffset, setTransactionOffset] = useState(0);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [loadingMoreTransactions, setLoadingMoreTransactions] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [reportSummaryApi, setReportSummaryApi] = useState(null);
  const [financialDataVersion, setFinancialDataVersion] = useState(0);
  const [goalForm, setGoalForm] = useState({ title: '', target: '', saved: '', color: '#14b8a6' });
  const [goalEditId, setGoalEditId] = useState(null);
  const [activeUserId, setActiveUserId] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const stored = window.localStorage.getItem(SESSION_KEY);
    if (!stored) return 1;
    try {
      const parsed = JSON.parse(stored);
      return Number(parsed.id || 1);
    } catch {
      return 1;
    }
  });
  const [authenticated, setAuthenticated] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem(SESSION_KEY));
  });
  const [sessionValidated, setSessionValidated] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.localStorage.getItem(SESSION_KEY);
  });
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('This month');
  const [transactionForm, setTransactionForm] = useState(defaultForm);
  const [transactionEditId, setTransactionEditId] = useState(null);
  const [budgetForm, setBudgetForm] = useState(budgetFormDefault);
  const [budgetEditId, setBudgetEditId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [dateFilter, setDateFilter] = useState('');
  const [reportStart, setReportStart] = useState(() => `${getMonthKey(new Date())}-01`);
  const [reportEnd, setReportEnd] = useState(() => getLocalDateString());
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authErrors, setAuthErrors] = useState({});
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleSessionExpired = (event) => {
      window.localStorage.removeItem(SESSION_KEY);
      setAuthenticated(false);
      setSessionValidated(true);
      setActiveUserId(0);
      setTransactions([]);
      setTransactionOffset(0);
      setHasMoreTransactions(false);
      setBudgets([]);
      setSavingsGoals([]);
      setDashboardSummary(null);
      setReportSummaryApi(null);
      setWhatsappStatus(null);
      navigate('/login', {
        replace: true,
        state: { sessionExpired: true, reason: event.detail },
      });
    };
    window.addEventListener('ruveon:session-expired', handleSessionExpired);
    return () => window.removeEventListener('ruveon:session-expired', handleSessionExpired);
  }, [navigate]);

  useEffect(() => {
    if (!authenticated) {
      setSessionValidated(true);
      return undefined;
    }

    let active = true;
    const validateSession = async () => {
      setSessionValidated(false);
      try {
        await requestJson(`${API_BASE}/users/me`);
        if (active) setSessionValidated(true);
      } catch (error) {
        if (active && !window.localStorage.getItem(SESSION_KEY)) return;
        if (active) {
          setTransactions([]);
          setTransactionOffset(0);
          setHasMoreTransactions(false);
          setBudgets([]);
          setSavingsGoals([]);
          setDashboardSummary(null);
          setApiError(`Unable to verify your session: ${error.message}`);
          setSessionValidated(true);
        }
      }
    };
    const onPageShow = () => {
      setTransactions([]);
      setTransactionOffset(0);
      setHasMoreTransactions(false);
      setBudgets([]);
      setSavingsGoals([]);
      setDashboardSummary(null);
      setReportSummaryApi(null);
      validateSession();
    };
    const onPageHide = () => {
      setTransactions([]);
      setTransactionOffset(0);
      setHasMoreTransactions(false);
      setBudgets([]);
      setSavingsGoals([]);
      setDashboardSummary(null);
      setReportSummaryApi(null);
      setSessionValidated(false);
    };
    validateSession();
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      active = false;
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [activeUserId, authenticated]);

  useEffect(() => {
    if (!authenticated) return undefined;
    let session = null;
    try {
      session = JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
    }
    const timeoutMs = Math.max(1000, Number(session?.idle_timeout_seconds || 1800) * 1000);
    let lastActivity = Date.now();
    let lastServerActivity = Date.now();
    let timer;
    const expireForInactivity = () => {
      requestJson(`${API_BASE}/users/logout`, { method: 'POST' }).catch((error) => {
        setApiError(`Your session expired, but the server could not revoke it: ${error.message}`);
      });
      window.localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new CustomEvent('ruveon:session-expired', { detail: 'inactivity timeout' }));
    };
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(expireForInactivity, timeoutMs);
    };
    const markActivity = () => {
      lastActivity = Date.now();
      if (lastActivity - lastServerActivity >= 60_000) {
        lastServerActivity = lastActivity;
        requestJson(`${API_BASE}/users/me`).catch((error) => {
          setApiError(`Unable to refresh your session: ${error.message}`);
        });
      }
      resetTimer();
    };
    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    resetTimer();
    return () => {
      window.clearTimeout(timer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    };
  }, [authenticated]);

  useEffect(() => {
    if (authenticated && (location.pathname === '/login' || location.pathname === '/register')) {
      navigate('/dashboard');
    }
  }, [authenticated, location.pathname, navigate]);

  useEffect(() => {
    if (!authenticated || !sessionValidated) return;

    const loadData = async () => {
      setApiError('');
      setTransactions([]);
      setBudgets([]);
      setSavingsGoals([]);
      setReportSummaryApi(null);
      try {
        const [transactionResponse, budgetResponse, goalsResponse, whatsappResponse, dashboardResponse] = await Promise.all([
          requestJson(`${API_BASE}/transactions?limit=100&offset=0`),
          requestJson(`${API_BASE}/budgets`),
          requestJson(`${API_BASE}/goals`),
          requestJson(`${API_BASE}/whatsapp/status`),
          requestJson(`${API_BASE}/dashboard`),
        ]);

        if (Array.isArray(transactionResponse)) {
          setTransactions(transactionResponse.map(mapTransactionFromApi));
          setTransactionOffset(transactionResponse.length);
          setHasMoreTransactions(transactionResponse.length === 100);
        }

        if (Array.isArray(budgetResponse)) {
          setBudgets(budgetResponse.map(mapBudgetFromApi));
        }

        if (Array.isArray(goalsResponse)) {
          setSavingsGoals(
            goalsResponse.map((item) => ({
              id: item.id,
              title: item.title,
              target: Number(item.target_amount),
              saved: Number(item.saved_amount),
              color: item.color || '#14b8a6',
            })),
          );
        }
        setWhatsappStatus(whatsappResponse);
        setDashboardSummary(dashboardResponse);
      } catch (error) {
        setTransactions([]);
        setTransactionOffset(0);
        setHasMoreTransactions(false);
        setBudgets([]);
        setSavingsGoals([]);
        setWhatsappStatus(null);
        setDashboardSummary(null);
        setApiError(`Unable to load your account data: ${error.message}`);
      }
    };

    loadData();
  }, [activeUserId, authenticated, sessionValidated]);

  useEffect(() => {
    if (!authenticated || !sessionValidated || !reportStart || !reportEnd || reportStart > reportEnd) {
      setReportSummaryApi(null);
      return undefined;
    }
    let active = true;
    setReportSummaryApi(null);
    requestJson(`${API_BASE}/reports?start_date=${reportStart}&end_date=${reportEnd}`)
      .then((response) => {
        if (active) setReportSummaryApi(response);
      })
      .catch((error) => {
        if (active) {
          setReportSummaryApi(null);
          setApiError(`Unable to load report totals: ${error.message}`);
        }
      });
    return () => {
      active = false;
    };
  }, [activeUserId, authenticated, financialDataVersion, reportEnd, reportStart, sessionValidated]);

  const totalIncome = useMemo(() => sumAmounts(transactions, 'income'), [transactions]);
  const totalExpenses = useMemo(() => sumAmounts(transactions, 'expense'), [transactions]);
  const netCashFlow = totalIncome - totalExpenses;
  const currentMonthKey = getMonthKey(new Date());
  const monthlyTransactions = useMemo(
    () => transactions.filter((item) => item.date.startsWith(currentMonthKey)),
    [transactions, currentMonthKey],
  );
  const expensesFromLoadedTransactions = useMemo(
    () => sumAmounts(monthlyTransactions, 'expense'),
    [monthlyTransactions],
  );
  const monthlyExpenseTotal = dashboardSummary
    ? Number(dashboardSummary.total_expenses)
    : expensesFromLoadedTransactions;
  const overallBudget = useMemo(
    () => dashboardSummary
      ? Number(dashboardSummary.monthly_budget)
      : budgets.find((item) => item.type === 'overall' && item.period === currentMonthKey)?.limit || 0,
    [budgets, currentMonthKey, dashboardSummary],
  );
  const remainingBudget = overallBudget - monthlyExpenseTotal;
  const transactionCount = transactions.length;
  const incomeFromLoadedTransactions = useMemo(
    () => sumAmounts(monthlyTransactions, 'income'),
    [monthlyTransactions],
  );
  const monthlyIncome = dashboardSummary
    ? Number(dashboardSummary.total_income)
    : incomeFromLoadedTransactions;
  const savingsProgress = Math.max(0, Math.min(100, ((monthlyIncome - monthlyExpenseTotal) / Math.max(monthlyIncome, 1)) * 100));

  const categorySpendingFromLoadedTransactions = useMemo(() => {
    const grouped = {};
    monthlyTransactions
      .filter((item) => item.type === 'expense')
      .forEach((item) => {
        grouped[item.category] = (grouped[item.category] || 0) + Number(item.amount || 0);
      });

    return Object.entries(grouped)
      .map(([category, value]) => ({ name: category, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [monthlyTransactions]);
  const categorySpending = dashboardSummary?.category_spending?.length
    ? dashboardSummary.category_spending
    : categorySpendingFromLoadedTransactions;

  const trendDataFromLoadedTransactions = useMemo(() => {
    const months = [];
    const current = new Date();

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
      const monthKey = getMonthKey(d);
      const monthLabel = d.toLocaleString('en-IN', { month: 'short' });
      const value = transactions
        .filter((item) => item.type === 'expense' && item.date.startsWith(monthKey))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      months.push({ month: monthLabel, value });
    }

    return months;
  }, [transactions]);
  const trendData = dashboardSummary?.expense_trend?.length
    ? dashboardSummary.expense_trend.map((entry) => ({ month: entry.name, value: entry.value }))
    : trendDataFromLoadedTransactions;

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [transactions],
  );

  const budgetCards = useMemo(
    () =>
      budgets
        .map((budget) => {
          const calculatedSpent = transactions
            .filter(
              (item) =>
                item.type === 'expense' &&
                (budget.type === 'overall' || item.category.toLowerCase() === budget.category.toLowerCase()) &&
                item.date.startsWith(budget.period),
            )
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
          const spent = budget.spent ?? calculatedSpent;
          const remaining = budget.limit - spent;
          const progress = Math.min((spent / Math.max(budget.limit, 1)) * 100, 100);
          return {
            ...budget,
            spent,
            remaining,
            progress,
          };
        }),
    [budgets, transactions],
  );

  const reportTransactions = useMemo(() => {
    const start = new Date(reportStart);
    const end = new Date(reportEnd);
    return transactions.filter((item) => {
      const target = new Date(item.date);
      return target >= start && target <= end;
    });
  }, [transactions, reportStart, reportEnd]);

  const reportSummaryFromLoadedTransactions = useMemo(() => {
    const income = sumAmounts(reportTransactions, 'income');
    const expense = sumAmounts(reportTransactions, 'expense');
    return {
      income,
      expense,
      net: income - expense,
      savingsRate: income > 0 ? (income - expense) / income : 0,
    };
  }, [reportTransactions]);
  const reportSummary = reportSummaryApi
    ? {
      income: Number(reportSummaryApi.income),
      expense: Number(reportSummaryApi.expense),
      net: Number(reportSummaryApi.net),
      savingsRate: Number(reportSummaryApi.savings_rate),
      monthlyTrend: reportSummaryApi.monthly_trend,
      categorySpending: reportSummaryApi.category_spending,
    }
    : {
      ...reportSummaryFromLoadedTransactions,
      monthlyTrend: [],
      categorySpending: [],
    };

  const filteredTransactions = useMemo(() => {
    let data = [...transactions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.description.toLowerCase().includes(term) ||
          item.merchant.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term),
      );
    }

    if (typeFilter !== 'all') {
      data = data.filter((item) => item.type === typeFilter);
    }

    if (categoryFilter !== 'all') {
      data = data.filter((item) => item.category === categoryFilter);
    }

    if (dateFilter) {
      data = data.filter((item) => item.date === dateFilter);
    }

    data.sort((a, b) => {
      if (sortBy === 'amount-desc') return Number(b.amount) - Number(a.amount);
      if (sortBy === 'amount-asc') return Number(a.amount) - Number(b.amount);
      if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
      return new Date(b.date) - new Date(a.date);
    });

    return data;
  }, [transactions, searchTerm, typeFilter, categoryFilter, dateFilter, sortBy]);

  const insights = useMemo(() => {
    const totalOutFlow = monthlyExpenseTotal;
    const categoryInsight = [...categorySpending].sort((a, b) => b.value - a.value)[0];
    const overspent = budgetCards.filter((item) => item.spent > item.limit);
    const possibleSavings = Math.max(0, totalOutFlow * 0.18);
    const goal = Math.max(0, monthlyIncome - monthlyExpenseTotal);

    return [
      {
        title: 'Spending pattern',
        detail: categoryInsight
          ? `${categoryInsight.name} is driving ${formatCurrency(categoryInsight.value)} in spending this month.`
          : 'Monthly spend is balanced and within your average range.',
      },
      {
        title: 'Budget overruns',
        detail: overspent.length
          ? `${overspent.length} category budget${overspent.length > 1 ? 's are' : ' is'} over target.`
          : 'No category is currently exceeding its budget plan.',
      },
      {
        title: 'Potential savings',
        detail: `You could redirect approximately ${formatCurrency(possibleSavings)} by reducing non-essential categories.`,
      },
      {
        title: 'Monthly savings target',
        detail: `Aim to save ${formatCurrency(Math.max(5000, goal * 0.3))} this month to stay ahead of your plan.`,
      },
    ];
  }, [budgetCards, categorySpending, monthlyExpenseTotal, monthlyIncome]);

  const handleAuthInput = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
    setAuthErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateAuth = () => {
    const errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authForm.email)) {
      errors.email = 'Enter a valid email address.';
    }
    if (!authForm.password || authForm.password.length < 8) {
      errors.password = 'Password must contain at least 8 characters.';
    }
    if (authMode === 'register' && !authForm.name.trim()) {
      errors.name = 'Name is required.';
    }
    setAuthErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const persistSession = (user, accessToken = '', idleTimeoutSeconds = 1800) => {
    const session = {
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.name || 'User',
      idle_timeout_seconds: idleTimeoutSeconds,
      ...(accessToken ? { access_token: accessToken } : {}),
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    setActiveUserId(Number(user.id));
    setAuthenticated(true);
    setSessionValidated(false);
  };

  const handleSubmitAuth = async (event) => {
    event.preventDefault();
    setApiError('');
    if (!validateAuth() || authSubmitting) return;

    setAuthSubmitting(true);
    try {
      const payload = {
        email: authForm.email.trim().toLowerCase(),
        password: authForm.password,
      };

      const endpoint = authMode === 'register' ? `${API_BASE}/users` : `${API_BASE}/users/login`;
      const requestBody = authMode === 'register'
        ? { ...payload, full_name: authForm.name.trim() }
        : payload;

      const response = await requestJson(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      persistSession(response.user, response.access_token, response.session_idle_timeout_seconds);
      if (new URLSearchParams(location.search).get('connect') === 'whatsapp') {
        await handleConnectWhatsApp();
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const message = error.message || 'Authentication failed';
      if (message.toLowerCase().includes('already exists')) {
        setAuthErrors((prev) => ({ ...prev, email: 'An account already exists for this email. Please log in instead.' }));
      } else if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('unauthorized')) {
        setAuthErrors((prev) => ({ ...prev, password: 'Invalid email or password.' }));
      } else {
        setAuthErrors((prev) => ({ ...prev, password: message }));
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    setApiError('');
    try {
      const link = await requestJson(`${API_BASE}/whatsapp/link-code`, { method: 'POST' });
      window.location.assign(link.whatsapp_url);
    } catch (error) {
      setApiError(`Unable to connect WhatsApp: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    let logoutError = '';
    try {
      await requestJson(`${API_BASE}/users/logout`, { method: 'POST' });
    } catch (error) {
      logoutError = error.message;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_KEY);
    }
    setAuthenticated(false);
    setSessionValidated(true);
    setActiveUserId(0);
    setTransactions([]);
    setTransactionOffset(0);
    setHasMoreTransactions(false);
    setBudgets([]);
    setSavingsGoals([]);
    setDashboardSummary(null);
    setReportSummaryApi(null);
    setWhatsappStatus(null);
    setApiError(logoutError ? `Your device signed out, but the server could not revoke the session: ${logoutError}` : '');
    navigate('/', { replace: true });
  };

  const refreshDashboardSummary = async () => {
    const updatedSummary = await requestJson(`${API_BASE}/dashboard`);
    setDashboardSummary(updatedSummary);
  };

  const refreshBudgetData = async () => {
    const updatedBudgets = await requestJson(`${API_BASE}/budgets`);
    setBudgets(updatedBudgets.map(mapBudgetFromApi));
  };

  const handleLoadMoreTransactions = async () => {
    if (loadingMoreTransactions || !hasMoreTransactions) return;
    setLoadingMoreTransactions(true);
    try {
      const response = await requestJson(
        `${API_BASE}/transactions?limit=100&offset=${transactionOffset}`,
      );
      const page = response.map(mapTransactionFromApi);
      setTransactions((previous) => [...previous, ...page]);
      setTransactionOffset((previous) => previous + page.length);
      setHasMoreTransactions(page.length === 100);
    } catch (error) {
      setApiError(`Unable to load more transactions: ${error.message}`);
    } finally {
      setLoadingMoreTransactions(false);
    }
  };

  const handleTransactionFormSubmit = async (event) => {
    event.preventDefault();
    if (!transactionForm.description.trim() || !transactionForm.amount || Number(transactionForm.amount) <= 0) {
      return;
    }

    const payload = {
      ...transactionForm,
      amount: Number(transactionForm.amount),
      description: transactionForm.description.trim(),
      merchant: transactionForm.merchant.trim() || transactionForm.description.trim(),
      notes: transactionForm.notes.trim(),
    };

    try {
      const apiPayload = {
        type: payload.type,
        category: payload.category,
        description: payload.description,
        merchant: payload.merchant,
        amount: payload.amount,
        date: payload.date,
        payment_method: payload.paymentMethod,
        notes: payload.notes,
      };

      if (transactionEditId) {
        const updated = await requestJson(`${API_BASE}/transactions/${transactionEditId}`, {
          method: 'PUT',
          body: JSON.stringify(apiPayload),
        });
        setTransactions((prev) => prev.map((item) => (item.id === transactionEditId ? mapTransactionFromApi(updated) : item)));
      } else {
        const created = await requestJson(`${API_BASE}/transactions`, {
          method: 'POST',
          body: JSON.stringify(apiPayload),
        });
        setTransactions((prev) => [mapTransactionFromApi(created), ...prev]);
        setTransactionOffset((previous) => previous + 1);
      }
    } catch (error) {
      window.alert(`Transaction was not saved: ${error.message}`);
      return;
    }

    setFinancialDataVersion((version) => version + 1);
    Promise.all([refreshDashboardSummary(), refreshBudgetData()]).catch((error) => {
      setApiError(`Transaction saved, but financial summaries could not be refreshed: ${error.message}`);
    });
    setTransactionForm(defaultForm);
    setTransactionEditId(null);
  };

  const handleEditTransaction = (item) => {
    setTransactionEditId(item.id);
    setTransactionForm({
      type: item.type,
      category: item.category,
      description: item.description,
      merchant: item.merchant,
      amount: String(item.amount),
      date: item.date,
      paymentMethod: item.paymentMethod,
      notes: item.notes || '',
    });
  };

  const handleDeleteTransaction = async (id) => {
    const item = transactions.find((entry) => entry.id === id);
    if (!item) return;
    if (window.confirm(`Delete transaction "${item.description}"?`)) {
      try {
        await requestJson(`${API_BASE}/transactions/${id}`, { method: 'DELETE' });
        setTransactions((prev) => prev.filter((entry) => entry.id !== id));
        setTransactionOffset((previous) => Math.max(0, previous - 1));
        setFinancialDataVersion((version) => version + 1);
        Promise.all([refreshDashboardSummary(), refreshBudgetData()]).catch((error) => {
          setApiError(`Transaction deleted, but financial summaries could not be refreshed: ${error.message}`);
        });
      } catch (error) {
        window.alert(`Transaction was not deleted: ${error.message}`);
      }
    }
  };

  const handleGoalSubmit = async (event) => {
    event.preventDefault();
    if (!goalForm.title.trim() || !goalForm.target || Number(goalForm.target) <= 0) return;

    const payload = {
      title: goalForm.title.trim(),
      target_amount: Number(goalForm.target),
      saved_amount: Number(goalForm.saved || 0),
      color: goalForm.color,
    };

    try {
      if (goalEditId) {
        const updated = await requestJson(`${API_BASE}/goals/${goalEditId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSavingsGoals((prev) => prev.map((item) => (item.id === goalEditId
          ? { id: item.id, title: updated.title, target: Number(updated.target_amount), saved: Number(updated.saved_amount), color: updated.color || '#14b8a6' }
          : item)));
      } else {
        const created = await requestJson(`${API_BASE}/goals`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSavingsGoals((prev) => [...prev, { id: created.id, title: created.title, target: Number(created.target_amount), saved: Number(created.saved_amount), color: created.color || '#14b8a6' }]);
      }
    } catch (error) {
      window.alert(`Savings goal was not saved: ${error.message}`);
      return;
    }

    setGoalForm({ title: '', target: '', saved: '', color: '#14b8a6' });
    setGoalEditId(null);
  };

  const handleGoalDelete = async (id) => {
    const item = savingsGoals.find((goal) => goal.id === id);
    if (!item) return;
    if (window.confirm(`Delete savings goal "${item.title}"?`)) {
      try {
        await requestJson(`${API_BASE}/goals/${id}`, { method: 'DELETE' });
        setSavingsGoals((prev) => prev.filter((goal) => goal.id !== id));
      } catch (error) {
        window.alert(`Savings goal was not deleted: ${error.message}`);
      }
    }
  };

  const handleEditGoal = (goal) => {
    setGoalEditId(goal.id);
    setGoalForm({ title: goal.title, target: String(goal.target), saved: String(goal.saved), color: goal.color || '#14b8a6' });
  };

  const handleBudgetSubmit = async (event) => {
    event.preventDefault();
    if (!budgetForm.limit || Number(budgetForm.limit) <= 0 || (budgetForm.kind === 'category' && !budgetForm.category.trim())) return;

    const payload = {
      category: budgetForm.kind === 'overall' ? 'Overall' : budgetForm.category.trim(),
      limit: Number(budgetForm.limit),
      period: budgetForm.period,
      type: budgetForm.kind,
    };

    try {
      if (budgetEditId) {
        const updated = await requestJson(`${API_BASE}/budgets/${budgetEditId}`, {
          method: 'PUT',
          body: JSON.stringify({
            category: payload.category,
            limit_amount: payload.limit,
            period: payload.period,
            kind: payload.type,
          }),
        });
        setBudgets((prev) => prev.map((item) => (item.id === budgetEditId ? mapBudgetFromApi(updated) : item)));
      } else {
        const created = await requestJson(`${API_BASE}/budgets`, {
          method: 'POST',
          body: JSON.stringify({
            category: payload.category,
            limit_amount: payload.limit,
            period: payload.period,
            kind: payload.type,
          }),
        });
        setBudgets((prev) => [...prev, mapBudgetFromApi(created)]);
      }
    } catch (error) {
      window.alert(`Budget was not saved: ${error.message}`);
      return;
    }

    setBudgetForm(budgetFormDefault);
    setBudgetEditId(null);
    Promise.all([refreshDashboardSummary(), refreshBudgetData()]).catch((error) => {
      setApiError(`Budget saved, but financial summaries could not be refreshed: ${error.message}`);
    });
  };

  const handleDeleteBudget = async (id) => {
    const item = budgets.find((entry) => entry.id === id);
    if (!item || !window.confirm(`Delete the ${item.type === 'overall' ? 'monthly' : item.category} budget for ${item.period}?`)) return;
    try {
      await requestJson(`${API_BASE}/budgets/${id}`, { method: 'DELETE' });
      setBudgets((prev) => prev.filter((entry) => entry.id !== id && !(entry.type === 'overall' && entry.id === id)));
      Promise.all([refreshDashboardSummary(), refreshBudgetData()]).catch((error) => {
        setApiError(`Budget deleted, but financial summaries could not be refreshed: ${error.message}`);
      });
    } catch (error) {
      window.alert(`Budget was not deleted: ${error.message}`);
    }
  };

  const exportCsv = () => {
    const selected = getPeriodTransactions(transactions, reportPeriod);
    const blob = new Blob([createCsv(selected.map((row) => ({
      date: row.date,
      type: row.type,
      category: row.category,
      description: row.description,
      merchant: row.merchant,
      amount: row.amount,
      paymentMethod: row.paymentMethod,
      notes: row.notes || '',
    })))], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ruveon-${reportPeriod.toLowerCase().replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const currentSummary = {
    totalExpenses: monthlyExpenseTotal,
    totalIncome: monthlyIncome,
    netCashFlow: monthlyIncome - monthlyExpenseTotal,
    remainingBudget,
    monthlyBudget: overallBudget,
    savingsProgress,
    transactionCount: monthlyTransactions.length,
  };

  const protectedPage = (element) => {
    if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return sessionValidated ? element : <SessionLoading />;
  };

  return (
    <div className="app-shell">
      <Header
        authenticated={authenticated}
        onLogout={handleLogout}
        onConnectWhatsApp={handleConnectWhatsApp}
        whatsappStatus={whatsappStatus}
      />
      {apiError && (
        <div className="container" role="alert">
          <p className="form-error">{apiError}</p>
        </div>
      )}
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              authenticated={authenticated && sessionValidated}
              user={(() => {
                try {
                  return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
                } catch {
                  return null;
                }
              })()}
              whatsappStatus={whatsappStatus}
              onConnectWhatsApp={handleConnectWhatsApp}
            />
          }
        />
        <Route path="/features/expense-tracking" element={<FeaturePage feature="expense-tracking" />} />
        <Route path="/features/smart-budgeting" element={<FeaturePage feature="smart-budgeting" />} />
        <Route path="/features/savings-insights" element={<FeaturePage feature="savings-insights" />} />
        <Route path="/features/reports" element={<FeaturePage feature="reports" />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<AuthPage authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} authErrors={authErrors} authSubmitting={authSubmitting} handleAuthInput={handleAuthInput} handleSubmitAuth={handleSubmitAuth} showPassword={showPassword} setShowPassword={setShowPassword} authenticated={authenticated} />} />
        <Route path="/register" element={<AuthPage authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} authErrors={authErrors} authSubmitting={authSubmitting} handleAuthInput={handleAuthInput} handleSubmitAuth={handleSubmitAuth} showPassword={showPassword} setShowPassword={setShowPassword} authenticated={authenticated} />} />
        <Route
          path="/dashboard"
          element={protectedPage(
              <DashboardPage
                transactions={transactions}
                reportPeriod={reportPeriod}
                setReportPeriod={setReportPeriod}
                summary={currentSummary}
                categorySpending={categorySpending}
                trendData={trendData}
                recentTransactions={recentTransactions}
                budgetCards={budgetCards}
                savingsGoals={savingsGoals}
              />
          )}
        />
        <Route
          path="/transactions"
          element={protectedPage(
              <TransactionsPage
                transactions={filteredTransactions}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                categoryFilter={categoryFilter}
                setCategoryFilter={setCategoryFilter}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                transactionForm={transactionForm}
                setTransactionForm={setTransactionForm}
                transactionEditId={transactionEditId}
                setTransactionEditId={setTransactionEditId}
                onSubmit={handleTransactionFormSubmit}
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
                allCategories={[...new Set(transactions.map((item) => item.category))]}
                hasMoreTransactions={hasMoreTransactions}
                loadingMoreTransactions={loadingMoreTransactions}
                onLoadMore={handleLoadMoreTransactions}
              />
          )}
        />
        <Route
          path="/budgets"
          element={protectedPage(
              <BudgetsPage
                budgets={budgetCards}
                budgetForm={budgetForm}
                setBudgetForm={setBudgetForm}
                budgetEditId={budgetEditId}
                setBudgetEditId={setBudgetEditId}
                onSubmit={handleBudgetSubmit}
                onDelete={handleDeleteBudget}
              />
          )}
        />
        <Route
          path="/reports"
          element={protectedPage(
              <ReportsPage
                reportTransactions={reportTransactions}
                reportSummary={reportSummary}
                reportStart={reportStart}
                setReportStart={setReportStart}
                reportEnd={reportEnd}
                setReportEnd={setReportEnd}
                transactions={transactions}
                getPeriodTransactions={getPeriodTransactions}
                exportCsv={exportCsv}
                setReportPeriod={setReportPeriod}
              />
          )}
        />
        <Route
          path="/savings"
          element={protectedPage(
              <SavingsPage
                insights={insights}
                savingsGoals={savingsGoals}
                totalIncome={monthlyIncome}
                totalExpenses={monthlyExpenseTotal}
                goalForm={goalForm}
                setGoalForm={setGoalForm}
                goalEditId={goalEditId}
                setGoalEditId={setGoalEditId}
                onGoalSubmit={handleGoalSubmit}
                onGoalDelete={handleGoalDelete}
                onGoalEdit={handleEditGoal}
              />
          )}
        />
        <Route path="/lending" element={protectedPage(<LendingPage />)} />
      </Routes>
    </div>
  );
}

function FeaturePage({ feature }) {
  const content = {
    'expense-tracking': {
      title: 'Expense Tracking',
      icon: Wallet,
      eyebrow: 'Know where your money goes',
      intro: 'Expense tracking gives you a clear, organized view of the money you spend each day.',
      paragraphs: [
        'Record a purchase when it happens or add it later with its amount, date, and a category that makes sense to you. Groceries, college fees, petrol, subscriptions, and other personal categories can all be tracked in one place.',
        'When spending is grouped by category, patterns become easier to spot. Review past transactions to remember what you paid, compare everyday costs, and notice expenses that are quietly growing. A consistent record helps you make decisions with real information instead of guesswork.',
        'For example, a month of small café purchases may add up to more than expected. Seeing that total can help you choose a realistic change without losing sight of the things you enjoy.',
      ],
      points: ['Record income and everyday purchases', 'Use your own categories and descriptions', 'Search and review transaction history'],
    },
    'smart-budgeting': {
      title: 'Smart Budgeting',
      icon: Calculator,
      eyebrow: 'Make a plan that fits your month',
      intro: 'A budget is a spending plan that helps you decide how to use your money before the month gets busy.',
      paragraphs: [
        'Set a monthly limit for your overall spending, then add category limits for areas such as food, travel, bills, or any category you create. As transactions are recorded, Ruveon shows how much of each limit has been used and what remains.',
        'Progress indicators make it easier to notice when a category is getting close to its limit. That early signal gives you time to pause, adjust another part of your plan, or update a limit when your circumstances change.',
        'Budgets are saved by month, so a new month starts with a fresh plan while your earlier limits and transaction history remain available for review. You stay in control of the amounts and can edit or remove a plan whenever needed.',
      ],
      points: ['Create monthly and category-wise limits', 'See spending progress and remaining amounts', 'Adjust budgets as your priorities change'],
    },
    'savings-insights': {
      title: 'Savings Insights',
      icon: PiggyBank,
      eyebrow: 'Turn small habits into progress',
      intro: 'Savings insights help you understand the choices behind your monthly surplus and build a plan for what comes next.',
      paragraphs: [
        'Review income and expenses together to see how much is left after spending. Category totals can reveal subscriptions, frequent small purchases, or other costs that may be worth reconsidering. The goal is not to judge spending, but to help you decide what matters most.',
        'Create a savings goal for something important, choose a target amount, and update your progress over time. A clear goal can make saving feel more manageable by turning a large target into steady steps.',
        'For instance, setting aside a chosen amount each month for an emergency fund makes progress visible and helps you balance today’s needs with future plans. Your transaction history and goal progress give you practical context for each adjustment.',
      ],
      points: ['Review the relationship between income and spending', 'Find categories to reconsider', 'Set goals and keep track of progress'],
    },
    reports: {
      title: 'Reports',
      icon: BarChart3,
      eyebrow: 'See the bigger financial picture',
      intro: 'Reports turn your saved transactions into a straightforward view of how money moves over time.',
      paragraphs: [
        'Choose a date range to review income, expenses, net cash flow, and savings rate. Category totals help explain where spending went, while monthly summaries show how your finances changed from one period to another.',
        'Compare historical months to spot patterns such as seasonal bills, changing travel costs, or a steady increase in a particular category. Looking at income alongside expenses helps you understand whether your current habits are supporting the plans you have.',
        'You can also review the largest transactions in a selected period and export records for your own reference. Reports are based on the transactions saved to your account, giving you a useful starting point for informed everyday decisions.',
      ],
      points: ['Review monthly and yearly summaries', 'Compare income, expenses, and cash flow', 'Explore category totals and transaction history'],
    },
  }[feature];

  if (!content) return <Navigate to="/" replace />;
  const Icon = content.icon;

  return (
    <main className="page-shell feature-page">
      <section className="section">
        <div className="container">
          <Link to="/#features" className="text-link feature-back-link">
            <ChevronRight size={16} className="back-chevron" /> Back to Features
          </Link>
          <div className="feature-detail card-surface">
            <div className="feature-detail-icon"><Icon size={28} /></div>
            <span className="eyebrow dark">{content.eyebrow}</span>
            <h1>{content.title}</h1>
            <p className="feature-detail-intro">{content.intro}</p>
            <div className="feature-detail-content">
              <div>
                {content.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <aside className="feature-takeaways card-surface">
                <h2>What you can do</h2>
                {content.points.map((point) => (
                  <div key={point} className="feature-takeaway">
                    <CheckCircle2 size={17} />
                    <span>{point}</span>
                  </div>
                ))}
                <Link to="/#features" className="btn btn-primary">
                  Explore other features <ArrowRight size={17} />
                </Link>
              </aside>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SessionLoading() {
  return (
    <main className="page-shell">
      <div className="container session-loading" role="status">
        <ShieldCheck size={24} />
        <p>Verifying your session before loading account information…</p>
      </div>
    </main>
  );
}

function LendingPage() {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState({ total_lent: 0, total_recovered: 0, outstanding: 0, pending_count: 0, overdue_count: 0 });
  const [loanForm, setLoanForm] = useState({
    borrower_name: '',
    principal: '',
    date_lent: getLocalDateString(),
    expected_repayment_date: '',
    notes: '',
  });
  const [repaymentAmounts, setRepaymentAmounts] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadLoans = async () => {
    const [loanData, summaryData] = await Promise.all([
      requestJson(`${API_BASE}/loans`),
      requestJson(`${API_BASE}/loans/summary`),
    ]);
    setLoans(loanData);
    setSummary(summaryData);
  };

  useEffect(() => {
    loadLoans().catch((loadError) => setError(`Unable to load lending records: ${loadError.message}`));
  }, []);

  const createLoan = async (event) => {
    event.preventDefault();
    if (!loanForm.borrower_name.trim() || Number(loanForm.principal) <= 0) return;
    setError('');
    setSaving(true);
    try {
      await requestJson(`${API_BASE}/loans`, {
        method: 'POST',
        body: JSON.stringify({
          ...loanForm,
          borrower_name: loanForm.borrower_name.trim(),
          principal: Number(loanForm.principal),
          expected_repayment_date: loanForm.expected_repayment_date || null,
        }),
      });
      setLoanForm({
        borrower_name: '',
        principal: '',
        date_lent: getLocalDateString(),
        expected_repayment_date: '',
        notes: '',
      });
      await loadLoans();
    } catch (saveError) {
      setError(`Lending record was not saved: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addRepayment = async (loan) => {
    const amount = Number(repaymentAmounts[loan.id]);
    if (!amount || amount <= 0) return;
    setError('');
    setSaving(true);
    try {
      await requestJson(`${API_BASE}/loans/${loan.id}/repayments`, {
        method: 'POST',
        body: JSON.stringify({ amount, paid_at: getLocalDateString() }),
      });
      setRepaymentAmounts((previous) => ({ ...previous, [loan.id]: '' }));
      await loadLoans();
    } catch (saveError) {
      setError(`Repayment was not recorded: ${saveError.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page-shell">
      <div className="container page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow dark">Money lent and repayments</span>
            <h1>Lending</h1>
          </div>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <section className="stat-grid report-grid">
          <StatCard label="Total money lent" value={formatCurrency(Number(summary.total_lent))} tone="neutral" icon={<Banknote size={18} />} />
          <StatCard label="Money recovered" value={formatCurrency(Number(summary.total_recovered))} tone="success" icon={<TrendingUp size={18} />} />
          <StatCard label="Outstanding" value={formatCurrency(Number(summary.outstanding))} tone="warning" icon={<Wallet size={18} />} />
          <StatCard label="Overdue repayments" value={String(summary.overdue_count)} tone="danger" icon={<Bell size={18} />} />
        </section>

        <section className="content-grid lending-layout">
          <div className="card-surface form-card">
            <div className="panel-header"><h3>Record money lent</h3></div>
            <p className="muted-copy">Lending is tracked as money owed to you, not as an expense or income.</p>
            <form className="stack-form" onSubmit={createLoan}>
              <div className="field-group">
                <label htmlFor="borrower-name">Borrower</label>
                <input id="borrower-name" value={loanForm.borrower_name} onChange={(event) => setLoanForm((prev) => ({ ...prev, borrower_name: event.target.value }))} placeholder="Person's name" required />
              </div>
              <div className="field-group">
                <label htmlFor="loan-principal">Amount lent</label>
                <input id="loan-principal" type="number" min="0.01" step="0.01" value={loanForm.principal} onChange={(event) => setLoanForm((prev) => ({ ...prev, principal: event.target.value }))} placeholder="0.00" required />
              </div>
              <div className="two-field-row">
                <div className="field-group">
                  <label htmlFor="date-lent">Date lent</label>
                  <input id="date-lent" type="date" value={loanForm.date_lent} onChange={(event) => setLoanForm((prev) => ({ ...prev, date_lent: event.target.value }))} required />
                </div>
                <div className="field-group">
                  <label htmlFor="repayment-due">Expected repayment</label>
                  <input id="repayment-due" type="date" value={loanForm.expected_repayment_date} onChange={(event) => setLoanForm((prev) => ({ ...prev, expected_repayment_date: event.target.value }))} />
                </div>
              </div>
              <div className="field-group">
                <label htmlFor="loan-notes">Notes</label>
                <input id="loan-notes" value={loanForm.notes} onChange={(event) => setLoanForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional" />
              </div>
              <button className="btn btn-primary full-btn" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save lending record'}</button>
            </form>
          </div>

          <div className="loan-list">
            {loans.length === 0 ? (
              <div className="card-surface empty-state"><p>No lending records yet. Money you lend will appear here with its repayment history.</p></div>
            ) : loans.map((loan) => {
              const outstanding = Number(loan.principal) - Number(loan.repaid_amount);
              const overdue = loan.status !== 'repaid' && loan.expected_repayment_date && loan.expected_repayment_date < getLocalDateString();
              return (
                <article key={loan.id} className="card-surface loan-card">
                  <div className="loan-card-header">
                    <div>
                      <h3>{loan.borrower_name}</h3>
                      <p>Lent {loan.date_lent}{loan.expected_repayment_date ? ` · Due ${loan.expected_repayment_date}` : ''}</p>
                    </div>
                    <span className={`chip ${loan.status === 'repaid' ? 'success' : overdue ? 'danger' : 'warning'}`}>
                      {loan.status === 'repaid' ? 'Repaid' : overdue ? 'Overdue' : loan.status === 'partially_repaid' ? 'Partially repaid' : 'Pending'}
                    </span>
                  </div>
                  <div className="loan-amount-grid">
                    <div><small>Principal</small><strong>{formatCurrency(Number(loan.principal))}</strong></div>
                    <div><small>Recovered</small><strong>{formatCurrency(Number(loan.repaid_amount))}</strong></div>
                    <div><small>Outstanding</small><strong>{formatCurrency(outstanding)}</strong></div>
                  </div>
                  {loan.notes && <p className="muted-copy">{loan.notes}</p>}
                  {outstanding > 0 && (
                    <div className="repayment-entry">
                      <input
                        type="number"
                        min="0.01"
                        max={outstanding}
                        step="0.01"
                        value={repaymentAmounts[loan.id] || ''}
                        onChange={(event) => setRepaymentAmounts((previous) => ({ ...previous, [loan.id]: event.target.value }))}
                        placeholder="Repayment amount"
                        aria-label={`Repayment amount from ${loan.borrower_name}`}
                      />
                      <button className="btn btn-secondary" type="button" disabled={saving} onClick={() => addRepayment(loan)}>Record repayment</button>
                    </div>
                  )}
                  {loan.repayments?.length > 0 && (
                    <details className="repayment-history">
                      <summary>Repayment history ({loan.repayments.length})</summary>
                      {loan.repayments.map((repayment) => (
                        <div key={repayment.id} className="split-row">
                          <span>{repayment.paid_at}</span>
                          <strong>{formatCurrency(Number(repayment.amount))}</strong>
                        </div>
                      ))}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

function PrivacyPage() {
  return (
    <main className="page-shell privacy-page">
      <section className="section">
        <div className="container privacy-document">
          <span className="eyebrow">Privacy notice</span>
          <h1>How Ruveon handles your information</h1>
          <p className="privacy-updated">Last updated: October 30, 2026</p>
          <p className="privacy-lead">
            Ruveon is a personal finance tracker. This notice explains what information the app uses,
            why it is used, and what happens when you connect Ruvi on WhatsApp.
          </p>
          <p className="privacy-operator">
            <strong>Service operator:</strong> Ruveon AI, operated by Anmol Sharma.
          </p>

          <div className="privacy-launch-warning" role="note">
            <strong>Before inviting the public</strong>
            <p>
              Account deletion is not currently self-service. Confirm the privacy inbox below is
              monitored, and establish a reliable account deletion and data-retention process before
              inviting the public.
            </p>
          </div>

          <section className="privacy-policy-section">
            <h2>Information you provide</h2>
            <ul>
              <li>
                <strong>Account details:</strong> your name, email address, and password. Passwords
                are stored as password hashes; the app does not store the original password.
              </li>
              <li>
                <strong>Finance records:</strong> transactions and the details you enter, such as
                amounts, dates, categories, merchants, payment methods, and notes, plus budgets and
                savings goals.
              </li>
              <li>
                <strong>WhatsApp connection:</strong> if you choose to link WhatsApp, the WhatsApp
                account identifier and link status are stored. Incoming message text is processed to
                handle link/unlink commands, answer questions, or save a financial action you request.
                Message identifiers and generated replies are retained to prevent duplicate actions and
                retry failed replies; incoming message text is not retained as chat history.
              </li>
            </ul>
          </section>

          <section className="privacy-policy-section">
            <h2>How your information is used and shared</h2>
            <ul>
              <li>
                Ruveon uses account and finance records to provide sign-in, transaction, budget,
                savings, dashboard, and reporting features.
              </li>
              <li>
                If you message Ruvi on WhatsApp, the message text and a limited account summary
                (current-month income, expenses, cash flow, budget, transaction count, savings goals,
                and outstanding lending names and amounts) are sent to Google Gemini to interpret the
                request or generate a reply. Individual transaction descriptions and notes are not
                included in that summary. If you ask Ruvi to record or update a financial action, the
                validated result is saved to your Ruveon account and appears on the website.
              </li>
              <li>
                WhatsApp messages are transmitted through Meta’s WhatsApp Business Platform. Meta,
                Google, and the hosting/database providers configured by the operator process data
                according to their own terms and privacy practices.
              </li>
              <li>
                The app is not a bank and does not connect to bank accounts. Do not enter bank
                credentials, full card numbers, or other authentication secrets.
              </li>
            </ul>
          </section>

          <section className="privacy-policy-section">
            <h2>Storage, security, and retention</h2>
            <p>
              Account and finance data are stored by the database provider configured for the
              service. The browser stores the sign-in token in local storage until you log out or
              clear site data; the token may expire and require you to sign in again. Use log out on
              shared devices. The service uses password hashing and authenticated API requests, but
              no online service can promise absolute security.
            </p>
            <p>
              The app currently has no account deletion control. Until an operator contact and
              deletion process are published, it cannot offer a reliable self-service deletion
              request. The operator must establish how account records and backups are deleted and
              update this notice with the applicable retention period before inviting users.
            </p>
          </section>

          <section className="privacy-policy-section">
            <h2>Your choices and contact</h2>
            <p>
              You can edit or remove transactions, budgets, and goals in the app. To unlink WhatsApp,
              send <code>unlink</code> to Ruvi. For privacy questions or account-deletion requests,
              email <a href="mailto:ruveonai@gmail.com">ruveonai@gmail.com</a>.
            </p>
          </section>

          <p className="privacy-disclaimer">
            Ruvi provides general informational responses, not professional financial, tax, or
            investment advice. This notice describes the current app behavior and must be reviewed
            by the operator for the laws and services applicable to the deployed product.
          </p>
        </div>
      </section>
    </main>
  );
}

function Header({ authenticated, onLogout, onConnectWhatsApp, whatsappStatus }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/#features', label: 'Features' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/transactions', label: 'Transactions' },
    { to: '/budgets', label: 'Budgets' },
    { to: '/lending', label: 'Lending' },
    { to: '/reports', label: 'Reports' },
    { to: '/savings', label: 'Savings' },
  ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.hash]);

  return (
    <header className="topbar">
      <div className={`container topbar-inner${authenticated ? ' has-session-actions' : ''}`}>
        <Link to="/" className="brand" aria-label="Ruveon AI home">
          <span className="brand-mark">R</span>
          <span>Ruveon AI</span>
        </Link>

        <div id="site-navigation" className={`topbar-menu${mobileMenuOpen ? ' is-open' : ''}`}>
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((item) => {
              const isActive = item.label === 'Features'
                ? location.pathname === '/' && location.hash === '#features'
                : location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={isActive ? 'nav-link active' : 'nav-link'}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {authenticated && (
          <div className="topbar-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={!whatsappStatus?.configured || whatsappStatus.linked}
              onClick={() => {
                setMobileMenuOpen(false);
                onConnectWhatsApp();
              }}
            >
              <MessageSquareText size={16} />
              {whatsappStatus?.linked
                ? 'WhatsApp connected'
                : whatsappStatus?.configured
                  ? 'Connect WhatsApp'
                  : whatsappStatus
                    ? 'WhatsApp unavailable'
                    : 'Checking WhatsApp…'}
            </button>
            <button type="button" className="icon-button" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
            >
              Log out
            </button>
          </div>
        )}

        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="site-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}

function LandingPage({ authenticated, user, whatsappStatus, onConnectWhatsApp }) {
  const navigate = useNavigate();

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const featureCards = [
    { title: 'Expense tracking', path: '/features/expense-tracking', icon: Wallet, description: 'Capture and categorize purchases in the portal, with your activity saved to your account.' },
    { title: 'Smart budgets', path: '/features/smart-budgeting', icon: Calculator, description: 'Set monthly and category limits with clear warnings before overspending.' },
    { title: 'Savings insights', path: '/features/savings-insights', icon: PiggyBank, description: 'See where you can save more and monitor progress toward goals.' },
    { title: 'Reports', path: '/features/reports', icon: BarChart3, description: 'Review trends and compare cash flow with simple, accurate reporting tools.' },
  ];

  return (
    <main className="page-shell landing-page">
      <section className="hero section">
        <div className="container hero-grid">
          <div className="hero-copy">
            {!authenticated && (
              <div className="landing-entry-actions" aria-label="Account and WhatsApp actions">
                <Link to="/login" className="btn btn-ghost">Login</Link>
                <Link to="/register" className="btn btn-primary">Sign Up</Link>
                <Link
                  to="/login?connect=whatsapp"
                  className="btn btn-secondary"
                  aria-label="Connect Ruvi on WhatsApp"
                >
                  <MessageSquareText size={16} />
                  WhatsApp
                </Link>
              </div>
            )}
            <span className="eyebrow">
              <Sparkles size={16} />
              Premium personal finance intelligence
            </span>
            <h1>Spend Smarter. Save Better.</h1>
            <p>
              Ruveon AI combines effortless expense tracking, monthly budgets, and thoughtful savings guidance in one premium personal finance platform.
            </p>
            <div className="cta-row">
              <button className="btn btn-primary" onClick={() => navigate('/login')}>
                Get started <ArrowRight size={18} />
              </button>
              <button className="btn btn-secondary" onClick={() => scrollToSection('features')}>
                Explore features
              </button>
            </div>
            <ul className="trust-list">
              <li>AI-powered summaries</li>
              <li>WhatsApp-first experience</li>
              <li>Private and transparent recommendations</li>
            </ul>
          </div>

          <div className="hero-visual">
            <div className="dashboard-preview card-surface">
              <div className="preview-header">
                <span className="live-pill">Illustrative demo</span>
                <span className="preview-date">{currentDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
              </div>
              <div className="preview-grid">
                <div className="mini-card">
                  <p>Monthly income</p>
                  <strong>₹78,430</strong>
                </div>
                <div className="mini-card">
                  <p>Total expenses</p>
                  <strong>₹49,250</strong>
                </div>
                <div className="mini-card wide">
                  <p>Net cash flow</p>
                  <strong>₹29,180</strong>
                </div>
              </div>
              <div className="demo-budget">
                <div className="demo-budget-label">
                  <span>Example budget</span>
                  <strong>₹49,250 <small>of ₹55,000</small></strong>
                </div>
                <div
                  className="demo-budget-track"
                  role="img"
                  aria-label="Example budget: 49,250 rupees spent of 55,000 rupees"
                >
                  <span />
                </div>
              </div>
              <div className="preview-bars">
                <span style={{ height: '38%' }} />
                <span style={{ height: '58%' }} />
                <span style={{ height: '45%' }} />
                <span style={{ height: '76%' }} />
                <span style={{ height: '64%' }} />
                <span style={{ height: '90%' }} />
              </div>
              <p className="demo-preview-note">Sample figures only. Your new account starts at ₹0.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section ruvi-intro-section">
        <div className="container">
          <div className="whatsapp-card card-surface">
            <div className="whatsapp-bubble">
              <MessageSquareText size={22} />
              <div>
                <strong>Ruvi AI Assistant</strong>
                <p>Manage everyday finances through a familiar conversation.</p>
              </div>
            </div>
            <div className="whatsapp-details">
              <div>
                <h3>Connect with Ruvi on WhatsApp</h3>
                <p>
                  Record expenses and money received, ask about spending, and get useful summaries.
                  Your WhatsApp activity is linked to the same Ruveon account you use on the web.
                </p>
                {authenticated && user && (
                  <p className="connection-status">
                    Signed in as {user.full_name || user.email}.
                    {whatsappStatus?.linked ? ' WhatsApp is connected.' : ''}
                  </p>
                )}
                {authenticated && whatsappStatus && !whatsappStatus.configured && (
                  <p className="connection-status" role="status">
                    WhatsApp is temporarily unavailable while the service setup is completed.
                  </p>
                )}
                {authenticated && whatsappStatus?.configured && !whatsappStatus.assistant_available && (
                  <p className="connection-status" role="status">
                    WhatsApp linking is available; Ruvi replies need the AI service configured.
                  </p>
                )}
              </div>
              <div className="whatsapp-actions">
                {!authenticated ? (
                  <Link to="/login?connect=whatsapp" className="btn btn-primary">
                    <MessageSquareText size={17} />
                    Connect to Ruvi on WhatsApp
                  </Link>
                ) : whatsappStatus?.configured ? (
                  <button
                    className="btn btn-primary"
                    onClick={onConnectWhatsApp}
                    disabled={whatsappStatus.linked}
                  >
                    {whatsappStatus.linked ? <CheckCircle2 size={17} /> : <MessageSquareText size={17} />}
                    {whatsappStatus.linked ? 'WhatsApp connected' : 'Connect WhatsApp'}
                  </button>
                ) : (
                  <button className="btn btn-secondary" disabled>
                    {whatsappStatus ? 'Setup in progress' : 'Checking availability'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow dark">Built for smarter spending</span>
            <h2>Everything you need to manage personal finance with clarity.</h2>
          </div>
          <div className="feature-grid">
            {featureCards.map(({ title, path, icon: Icon, description }) => (
              <Link key={title} to={path} className="info-card card-surface feature-link">
                <div className="icon-badge">
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="feature-link-label">Explore feature <ArrowRight size={16} /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="privacy" className="section">
        <div className="container privacy-grid">
          <div>
            <span className="eyebrow dark">Privacy first</span>
            <h2>Built with transparency in mind.</h2>
          </div>
          <div className="privacy-list card-surface">
            <div className="privacy-item">
              <ShieldCheck size={18} />
              <span>Your account data is protected by server-verified sign-in.</span>
            </div>
            <div className="privacy-item">
              <FileText size={18} />
              <span>Financial recommendations are based on visible category and budget data.</span>
            </div>
            <div className="privacy-item">
              <Target size={18} />
              <span>Clear savings guidance and transparent assumptions for each insight.</span>
            </div>
            <div className="privacy-item">
              <Sparkles size={18} />
              <span>When you message Ruvi, your message and a limited account summary are sent to Google Gemini to answer or interpret requested financial actions.</span>
            </div>
            <Link to="/privacy" className="text-link">
              Read the full privacy notice <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section id="faq" className="section alt-section">
        <div className="container faq-wrap">
          <div className="section-heading narrow">
            <span className="eyebrow dark">FAQ</span>
            <h2>Answers for the way people actually manage money.</h2>
          </div>
          <div className="faq-list">
            <details className="faq-item card-surface">
              <summary>Can I create an account?</summary>
              <p>Yes. Create an account to save and manage your own transactions, budgets, and savings goals.</p>
            </details>
            <details className="faq-item card-surface">
              <summary>What happens after sign-in?</summary>
              <p>After signing in, choose Connect WhatsApp to open a secure account-link message when Ruvi's WhatsApp service is configured. You can also continue using the finance dashboard without linking WhatsApp.</p>
            </details>
            <details className="faq-item card-surface">
              <summary>Can Ruvi automatically reply on WhatsApp?</summary>
              <p>Yes, after the official Meta Cloud API is configured and you send the first account-link message. Ruvi answers finance questions using your account summary.</p>
            </details>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <div className="brand footer-brand">
            <span className="brand-mark">R</span>
            <span>Ruveon AI</span>
          </div>
          <p>Spend Smarter. Save Better.</p>
          <div className="footer-links">
            <button onClick={() => scrollToSection('features')}>Features</button>
            <button onClick={() => navigate('/login')}>Login</button>
            <button onClick={() => scrollToSection('faq')}>FAQ</button>
            <Link to="/privacy">Privacy notice</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function AuthPage({ authMode, setAuthMode, authForm, authErrors, authSubmitting, handleAuthInput, handleSubmitAuth, showPassword, setShowPassword, authenticated }) {
  const location = useLocation();
  const connectingWhatsApp = new URLSearchParams(location.search).get('connect') === 'whatsapp';

  useEffect(() => {
    setAuthMode(location.pathname === '/register' ? 'register' : 'login');
  }, [location.pathname, setAuthMode]);

  if (authenticated) return <Navigate to="/dashboard" replace />;

  return (
    <main className="page-shell auth-page">
      <div className="container auth-wrapper">
        <div className="auth-panel card-surface">
          <div className="auth-header">
            <div className="brand auth-brand">
              <span className="brand-mark">R</span>
              <span>Ruveon AI</span>
            </div>
            <div className="segmented-control">
              <button className={authMode === 'login' ? 'is-active' : ''} onClick={() => setAuthMode('login')}>
                Login
              </button>
              <button className={authMode === 'register' ? 'is-active' : ''} onClick={() => setAuthMode('register')}>
                Register
              </button>
            </div>
          </div>

          {connectingWhatsApp && (
            <p className="whatsapp-auth-notice" role="status">
              Sign in or create your account first. We’ll open the secure WhatsApp connection after authentication.
            </p>
          )}

          {location.state?.sessionExpired && (
            <p className="session-expired-message" role="alert">
              Your session has expired. Please log in again.
            </p>
          )}

          <form onSubmit={handleSubmitAuth} className="auth-form">
            {authMode === 'register' && (
              <div className="field-group">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  value={authForm.name}
                  onChange={(event) => handleAuthInput('name', event.target.value)}
                  placeholder="Ananya Sharma"
                />
                {authErrors.name && <small>{authErrors.name}</small>}
              </div>
            )}

            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={authForm.email}
                onChange={(event) => handleAuthInput('email', event.target.value)}
                placeholder="you@example.com"
              />
              {authErrors.email && <small>{authErrors.email}</small>}
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={authForm.password}
                  onChange={(event) => handleAuthInput('password', event.target.value)}
                  placeholder="••••••••"
                />
                <button type="button" className="toggle-password" onClick={() => setShowPassword((prev) => !prev)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {authErrors.password && <small>{authErrors.password}</small>}
            </div>

            <button type="submit" className="btn btn-primary full-btn" disabled={authSubmitting}>
              {authSubmitting ? 'Please wait…' : authMode === 'login' ? 'Log in' : 'Create account'}
            </button>
            <p className="auth-privacy-note">
              Please read the <Link to="/privacy">Privacy Notice</Link> before using Ruveon.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

function DashboardPage({ transactions, reportPeriod, setReportPeriod, summary, categorySpending, trendData, recentTransactions, budgetCards, savingsGoals }) {
  const expenseShare = categorySpending.length ? categorySpending.slice(0, 4) : [];
  const detectedSavings = Math.max(0, summary.netCashFlow * 0.25);

  return (
    <main className="page-shell dashboard-page">
      <div className="container">
        <div className="page-header space-between">
          <div>
            <span className="eyebrow dark">Account overview</span>
            <h1>Financial overview</h1>
          </div>
          <div className="period-selector">
            <label htmlFor="report-period">Reporting period</label>
            <select id="report-period" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)}>
              <option value="This month">This month</option>
              <option value="Last 3 months">Last 3 months</option>
              <option value="This year">This year</option>
              <option value="All time">All time</option>
            </select>
          </div>
        </div>

        <section className="stat-grid">
          <StatCard label="Total expenses" value={formatCurrency(summary.totalExpenses)} delta="-" tone="danger" icon={<TrendingDown size={18} />} />
          <StatCard label="Total income" value={formatCurrency(summary.totalIncome)} delta="+" tone="success" icon={<TrendingUp size={18} />} />
          <StatCard label="Net cash flow" value={formatCurrency(summary.netCashFlow)} delta={summary.netCashFlow >= 0 ? 'Positive' : 'Negative'} tone={summary.netCashFlow >= 0 ? 'success' : 'warning'} icon={<Wallet size={18} />} />
          <StatCard
            label="Monthly budget"
            value={formatCurrency(summary.monthlyBudget)}
            delta={summary.monthlyBudget > 0 ? `${formatCurrency(summary.remainingBudget)} remaining` : 'Create a monthly plan'}
            tone="neutral"
            icon={<Banknote size={18} />}
          />
        </section>
        {summary.monthlyBudget === 0 && (
          <div className="empty-budget-prompt card-surface">
            <p>You haven't created a monthly budget yet. Set your budget to start managing your spending.</p>
            <Link to="/budgets" className="btn btn-primary">Set a budget <ArrowRight size={16} /></Link>
          </div>
        )}

        <section className="content-grid two-col">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Spending trend</h3>
              <span className="panel-badge">Last 6 months</span>
            </div>
            <div className="chart-wrap">
              <Suspense fallback={<div className="chart-loading" />}>
                <SpendingTrendChart data={trendData} />
              </Suspense>
            </div>
          </div>

          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Category spending</h3>
              <span className="panel-badge">Current month</span>
            </div>
            <div className="chart-wrap donut-wrap">
              <Suspense fallback={<div className="chart-loading" />}>
                <CategorySpendingChart data={categorySpending} colors={categoryColors} />
              </Suspense>
            </div>
            <div className="legend">
              {categorySpending.map((item) => (
                <div key={item.name} className="legend-item">
                  <span className="legend-color" style={{ background: categoryColors[item.name] || '#14b8a6' }} />
                  <span>{item.name}</span>
                  <strong>{formatCurrency(item.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-grid two-col">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Recent transactions</h3>
              <Link to="/transactions" className="text-link">View all</Link>
            </div>
            <div className="list-table">
              {recentTransactions.map((entry) => (
                <div key={entry.id} className="transaction-row">
                  <div>
                    <strong>{entry.description}</strong>
                    <small>{entry.merchant}</small>
                  </div>
                  <div className="amount-block">
                    <span className={entry.type === 'income' ? 'income' : 'expense'}>
                      {entry.type === 'income' ? '+' : '-'}{formatCurrency(entry.amount)}
                    </span>
                    <small>{entry.date}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Budget progress</h3>
              <Link to="/budgets" className="text-link">Manage</Link>
            </div>
            <div className="budget-stack">
              {budgetCards.slice(0, 4).map((budget) => (
                <div key={budget.id} className="budget-row">
                  <div className="budget-meta">
                    <strong>{budget.category}</strong>
                    <small>{formatCurrency(budget.spent)} of {formatCurrency(budget.limit)}</small>
                  </div>
                  <div className="progress-bar">
                    <span style={{ width: `${Math.min(budget.progress, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-grid two-col">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Savings insight previews</h3>
              <Link to="/savings" className="text-link">More insights</Link>
            </div>
            <div className="insight-list">
              <div className="insight-item highlight">
                <PiggyBank size={18} />
                <div>
                  <strong>Potential monthly savings</strong>
                  <p>{formatCurrency(detectedSavings)}</p>
                </div>
              </div>
              {savingsGoals.slice(0, 2).map((goal) => (
                <div key={goal.title} className="insight-item">
                  <Target size={18} />
                  <div>
                    <strong>{goal.title}</strong>
                    <p>{formatCurrency(goal.saved)} of {formatCurrency(goal.target)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Expense breakdown</h3>
              <span className="panel-badge">Top categories</span>
            </div>
            <div className="split-list">
              {expenseShare.map((entry) => (
                <div key={entry.name} className="split-row">
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: categoryColors[entry.name] || '#14b8a6' }} />
                    <span>{entry.name}</span>
                  </div>
                  <strong>{formatCurrency(entry.value)}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function TransactionsPage({
  transactions,
  searchTerm,
  setSearchTerm,
  typeFilter,
  setTypeFilter,
  categoryFilter,
  setCategoryFilter,
  dateFilter,
  setDateFilter,
  sortBy,
  setSortBy,
  transactionForm,
  setTransactionForm,
  transactionEditId,
  setTransactionEditId,
  onSubmit,
  onEdit,
  onDelete,
  allCategories,
  hasMoreTransactions,
  loadingMoreTransactions,
  onLoadMore,
}) {
  const suggestedCategories = ['Food', 'Housing', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Travel', 'Salary', 'Freelance', 'Investments', 'Other'];
  const categoryOptions = [...new Set([...suggestedCategories, ...allCategories])];

  return (
    <main className="page-shell">
      <div className="container page-stack">
        <div className="page-header">
          <h1>Transactions</h1>
        </div>

        <section className="toolbar card-surface">
          <div className="search-box">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search description, merchant, or category" />
          </div>
          <div className="filter-row">
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">All categories</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
            </select>
          </div>
        </section>

        <section className="content-grid transaction-columns">
          <div className="card-surface form-card">
            <div className="panel-header">
              <h3>{transactionEditId ? 'Edit transaction' : 'Add transaction'}</h3>
              {transactionEditId && (
                <button className="btn btn-ghost small" onClick={() => { setTransactionEditId(null); setTransactionForm({ ...defaultForm, date: getLocalDateString() }); }}>
                  Cancel
                </button>
              )}
            </div>

            <form className="stack-form" onSubmit={onSubmit}>
              <div className="two-field-row">
                <div className="field-group">
                  <label>Type</label>
                  <select value={transactionForm.type} onChange={(event) => setTransactionForm((prev) => ({ ...prev, type: event.target.value }))}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Category</label>
                  <input
                    value={transactionForm.category}
                    onChange={(event) => setTransactionForm((prev) => ({ ...prev, category: event.target.value }))}
                    list="transaction-category-suggestions"
                    placeholder="Type or choose a category"
                    required
                  />
                  <datalist id="transaction-category-suggestions">
                    {categoryOptions.map((category) => <option key={category} value={category} />)}
                  </datalist>
                </div>
              </div>

              <div className="two-field-row">
                <div className="field-group">
                  <label>Description</label>
                  <input value={transactionForm.description} onChange={(event) => setTransactionForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Groceries" required />
                </div>
                <div className="field-group">
                  <label>Merchant</label>
                  <input value={transactionForm.merchant} onChange={(event) => setTransactionForm((prev) => ({ ...prev, merchant: event.target.value }))} placeholder="Fresh Basket" />
                </div>
              </div>

              <div className="two-field-row">
                <div className="field-group">
                  <label>Amount</label>
                  <input type="number" min="0.01" step="0.01" value={transactionForm.amount} onChange={(event) => setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="0.00" required />
                </div>
                <div className="field-group">
                  <label>Date</label>
                  <input type="date" value={transactionForm.date} onChange={(event) => setTransactionForm((prev) => ({ ...prev, date: event.target.value }))} required />
                </div>
              </div>

              <div className="two-field-row">
                <div className="field-group">
                  <label>Payment method</label>
                  <select value={transactionForm.paymentMethod} onChange={(event) => setTransactionForm((prev) => ({ ...prev, paymentMethod: event.target.value }))}>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Notes</label>
                  <input value={transactionForm.notes} onChange={(event) => setTransactionForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Optional" />
                </div>
              </div>

              <button type="submit" className="btn btn-primary full-btn">
                {transactionEditId ? 'Save changes' : 'Add transaction'}
              </button>
            </form>
          </div>

          <div className="card-surface table-card">
            <div className="panel-header">
              <h3>Transaction list</h3>
              <span className="panel-badge">{transactions.length} entries</span>
            </div>

            {transactions.length === 0 ? (
              <div className="empty-state">
                <FileText size={26} />
                <p>No transactions match this filter.</p>
              </div>
            ) : (
              <div className="transaction-table">
                {transactions.map((item) => (
                  <div key={item.id} className="transaction-row table-row">
                    <div>
                      <strong>{item.description}</strong>
                      <small>{item.merchant}</small>
                    </div>
                    <div className="meta-cluster">
                      <span>{item.category}</span>
                      <span>{item.type}</span>
                    </div>
                    <div className="amount-block">
                      <span className={item.type === 'income' ? 'income' : 'expense'}>
                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </span>
                      <small>{item.date}</small>
                    </div>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => onEdit(item)}>
                        <ArrowUpRight size={16} />
                      </button>
                      <button className="action-btn delete" onClick={() => onDelete(item.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {hasMoreTransactions && (
              <button className="btn btn-secondary full-btn load-more-button" type="button" onClick={onLoadMore} disabled={loadingMoreTransactions}>
                {loadingMoreTransactions ? 'Loading…' : 'Load more transactions'}
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function BudgetsPage({ budgets, budgetForm, setBudgetForm, budgetEditId, setBudgetEditId, onSubmit, onDelete }) {
  return (
    <main className="page-shell">
      <div className="container page-stack">
        <div className="page-header">
          <h1>Budgets</h1>
        </div>

        <section className="content-grid budget-layout">
          <div className="card-surface form-card">
            <div className="panel-header">
              <h3>{budgetEditId ? 'Edit budget' : 'Add budget'}</h3>
            </div>
            <form className="stack-form" onSubmit={onSubmit}>
              <div className="field-group">
                <label htmlFor="budget-kind">Budget type</label>
                <select
                  id="budget-kind"
                  value={budgetForm.kind}
                  onChange={(event) => setBudgetForm((prev) => ({
                    ...prev,
                    kind: event.target.value,
                    category: event.target.value === 'overall' ? 'Overall' : prev.category === 'Overall' ? 'Food' : prev.category,
                  }))}
                >
                  <option value="overall">Monthly budget</option>
                  <option value="category">Category budget</option>
                </select>
              </div>
              {budgetForm.kind === 'category' ? (
              <div className="field-group">
                <label htmlFor="budget-category">Category</label>
                <input id="budget-category" value={budgetForm.category} onChange={(event) => setBudgetForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="Food" required />
              </div>
              ) : (
                <p className="muted-copy">This limit applies to all of your expenses for the selected month.</p>
              )}
              <div className="field-group">
                <label htmlFor="budget-limit">Monthly limit</label>
                <input id="budget-limit" type="number" min="0.01" step="0.01" value={budgetForm.limit} onChange={(event) => setBudgetForm((prev) => ({ ...prev, limit: event.target.value }))} placeholder="0.00" required />
              </div>
              <div className="field-group">
                <label htmlFor="budget-period">Period</label>
                <input id="budget-period" type="month" value={budgetForm.period} onChange={(event) => setBudgetForm((prev) => ({ ...prev, period: event.target.value }))} required />
              </div>
              <button type="submit" className="btn btn-primary full-btn">
                {budgetEditId ? 'Save budget' : 'Create budget'}
              </button>
            </form>
          </div>

          <div className="card-surface table-card">
            <div className="panel-header">
              <h3>Monthly budget status</h3>
            </div>
            <div className="budget-list">
              {budgets.length === 0 ? (
                <div className="empty-state"><p>No budgets yet. Create a monthly budget or a category limit to get started.</p></div>
              ) : budgets.map((budget) => {
                const warning = budget.remaining < 0 ? 'Exceeded' : budget.progress > 80 ? 'Approaching limit' : 'On track';
                return (
                  <div key={budget.id} className="budget-card">
                    <div className="budget-head">
                      <div>
                        <strong>{budget.category}</strong>
                        <small>{budget.period}</small>
                      </div>
                      <span className={warning === 'Exceeded' ? 'chip danger' : warning === 'Approaching limit' ? 'chip warning' : 'chip success'}>{warning}</span>
                    </div>
                    <div className="budget-metrics">
                      <div>
                        <p>Spent</p>
                        <strong>{formatCurrency(budget.spent)}</strong>
                      </div>
                      <div>
                        <p>Remaining</p>
                        <strong>{formatCurrency(budget.remaining)}</strong>
                      </div>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${Math.min(budget.progress, 100)}%` }} />
                    </div>
                    <div className="budget-actions">
                      <button className="btn btn-ghost small" onClick={() => {
                        setBudgetEditId(budget.id);
                        setBudgetForm({ category: budget.category, limit: String(budget.limit), period: budget.period, kind: budget.type });
                      }}>
                        Edit
                      </button>
                      <button className="btn btn-ghost small danger" onClick={() => onDelete(budget.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportsPage({ reportTransactions, reportSummary, reportStart, setReportStart, reportEnd, setReportEnd, transactions, getPeriodTransactions, exportCsv, setReportPeriod }) {
  const monthlyTrendFromLoadedTransactions = useMemo(() => {
    const totals = {};
    reportTransactions.forEach((item) => {
      const month = item.date.slice(0, 7);
      const row = totals[month] || { month, income: 0, expense: 0 };
      row[item.type] += Number(item.amount || 0);
      totals[month] = row;
    });
    return Object.values(totals).sort((a, b) => a.month.localeCompare(b.month));
  }, [reportTransactions]);
  const monthlyTrend = reportSummary.monthlyTrend?.length
    ? reportSummary.monthlyTrend
    : monthlyTrendFromLoadedTransactions;
  const categorySpendingFromLoadedTransactions = useMemo(() => {
    const totals = {};
    reportTransactions.filter((item) => item.type === 'expense').forEach((item) => {
      totals[item.category] = (totals[item.category] || 0) + Number(item.amount || 0);
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [reportTransactions]);
  const categorySpending = reportSummary.categorySpending?.length
    ? reportSummary.categorySpending
    : categorySpendingFromLoadedTransactions;

  return (
    <main className="page-shell">
      <div className="container page-stack">
        <div className="page-header space-between">
          <h1>Reports & analytics</h1>
          <div className="toolbar-inline">
            <input type="date" value={reportStart} onChange={(event) => setReportStart(event.target.value)} />
            <input type="date" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} />
            <button className="btn btn-primary small" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>

        <section className="stat-grid report-grid">
          <StatCard label="Income" value={formatCurrency(reportSummary.income)} tone="success" icon={<TrendingUp size={18} />} />
          <StatCard label="Expenses" value={formatCurrency(reportSummary.expense)} tone="danger" icon={<TrendingDown size={18} />} />
          <StatCard label="Net" value={formatCurrency(reportSummary.net)} tone={reportSummary.net >= 0 ? 'success' : 'warning'} icon={<Calculator size={18} />} />
          <StatCard label="Savings rate" value={`${(reportSummary.savingsRate * 100).toFixed(1)}%`} tone="neutral" icon={<PiggyBank size={18} />} />
        </section>

        <section className="content-grid two-col">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Income vs expense</h3>
            </div>
            <div className="chart-wrap">
              <Suspense fallback={<div className="chart-loading" />}>
                <MonthlyExpenseChart data={monthlyTrend} />
              </Suspense>
            </div>
          </div>

          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Category spending</h3>
            </div>
            <div className="split-list">
              {categorySpending.length ? categorySpending.map((item) => (
                <div key={item.name} className="split-row">
                  <span>{item.name}</span>
                  <strong>{formatCurrency(item.value)}</strong>
                </div>
              )) : <p className="muted-copy">No expense categories in this date range.</p>}
            </div>
          </div>
        </section>

        <section className="content-grid">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Largest transactions</h3>
            </div>
            <div className="list-table">
              {[...reportTransactions].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 5).map((item) => (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>{item.description}</strong>
                    <small>{item.category}</small>
                  </div>
                  <span className={item.type === 'income' ? 'income' : 'expense'}>{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SavingsPage({
  insights,
  savingsGoals,
  totalIncome,
  totalExpenses,
  goalForm,
  setGoalForm,
  goalEditId,
  setGoalEditId,
  onGoalSubmit,
  onGoalDelete,
  onGoalEdit,
}) {
  return (
    <main className="page-shell">
      <div className="container page-stack">
        <div className="page-header">
          <h1>Savings insights</h1>
        </div>

        <section className="stat-grid report-grid">
          <StatCard label="Current savings" value={formatCurrency(totalIncome - totalExpenses)} tone="success" icon={<PiggyBank size={18} />} />
          <StatCard label="Suggested target" value={formatCurrency(Math.max(5000, (totalIncome - totalExpenses) * 0.4))} tone="neutral" icon={<Target size={18} />} />
          <StatCard label="Monthly spend" value={formatCurrency(totalExpenses)} tone="danger" icon={<Wallet size={18} />} />
          <StatCard label="Income" value={formatCurrency(totalIncome)} tone="success" icon={<IndianRupee size={18} />} />
        </section>

        <section className="content-grid two-col">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>{goalEditId ? 'Edit savings goal' : 'Add savings goal'}</h3>
              {goalEditId && (
                <button
                  className="btn btn-ghost small"
                  onClick={() => {
                    setGoalEditId(null);
                    setGoalForm({ title: '', target: '', saved: '', color: '#14b8a6' });
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <form className="stack-form" onSubmit={onGoalSubmit}>
              <div className="field-group">
                <label>Goal title</label>
                <input
                  value={goalForm.title}
                  onChange={(event) => setGoalForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Emergency fund"
                />
              </div>
              <div className="two-field-row">
                <div className="field-group">
                  <label>Target amount</label>
                  <input
                    type="number"
                    min="1"
                    value={goalForm.target}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, target: event.target.value }))}
                    placeholder="150000"
                  />
                </div>
                <div className="field-group">
                  <label>Saved so far</label>
                  <input
                    type="number"
                    min="0"
                    value={goalForm.saved}
                    onChange={(event) => setGoalForm((prev) => ({ ...prev, saved: event.target.value }))}
                    placeholder="87000"
                  />
                </div>
              </div>
              <div className="field-group">
                <label>Accent color</label>
                <input
                  type="color"
                  value={goalForm.color}
                  onChange={(event) => setGoalForm((prev) => ({ ...prev, color: event.target.value }))}
                />
              </div>
              <button type="submit" className="btn btn-primary full-btn">
                {goalEditId ? 'Save changes' : 'Create goal'}
              </button>
            </form>
          </div>

          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Savings goals</h3>
            </div>
            <div className="goal-list">
              {savingsGoals.map((goal) => {
                const progress = Math.min((goal.saved / Math.max(goal.target, 1)) * 100, 100);
                return (
                  <div key={goal.id ?? goal.title} className="goal-item">
                    <div className="goal-topline">
                      <strong>{goal.title}</strong>
                      <span>{formatCurrency(goal.saved)} / {formatCurrency(goal.target)}</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${progress}%`, background: goal.color }} />
                    </div>
                    <div className="budget-actions">
                      <button className="btn btn-ghost small" onClick={() => onGoalEdit(goal)}>
                        Edit
                      </button>
                      <button className="btn btn-ghost small danger" onClick={() => onGoalDelete(goal.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="content-grid two-col">
          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Transparent insight stream</h3>
            </div>
            <div className="insight-stack">
              {insights.map((item) => (
                <div key={item.title} className="insight-block">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-surface panel-card">
            <div className="panel-header">
              <h3>Quick summary</h3>
            </div>
            <div className="split-list">
              <div className="split-row"><span>Average monthly surplus</span><strong>{formatCurrency(Math.max(0, totalIncome - totalExpenses))}</strong></div>
              <div className="split-row"><span>Active goal count</span><strong>{savingsGoals.length}</strong></div>
              <div className="split-row"><span>Best progress</span><strong>{Math.max(...savingsGoals.map((goal) => Math.min((goal.saved / Math.max(goal.target, 1)) * 100, 100)), 0).toFixed(0)}%</strong></div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, delta, tone, icon }) {
  return (
    <div className="stat-card card-surface">
      <div className="stat-icon" data-tone={tone}>
        {icon}
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {delta && <small>{delta}</small>}
      </div>
    </div>
  );
}

export default App;
