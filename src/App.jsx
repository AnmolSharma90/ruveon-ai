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

const demoTransactions = [
  { id: 1, type: 'expense', category: 'Housing', description: 'Apartment rent', merchant: 'Nest Homes', amount: 24500, date: '2026-10-01', paymentMethod: 'Bank Transfer', notes: 'Monthly rent' },
  { id: 2, type: 'expense', category: 'Food', description: 'Groceries', merchant: 'Fresh Basket', amount: 4200, date: '2026-10-02', paymentMethod: 'UPI', notes: 'Vegetables and staples' },
  { id: 3, type: 'income', category: 'Salary', description: 'Salary deposit', merchant: 'Acme Corp', amount: 84500, date: '2026-10-03', paymentMethod: 'Bank Transfer', notes: 'Monthly salary' },
  { id: 4, type: 'expense', category: 'Transport', description: 'Fuel refill', merchant: 'WheelWay', amount: 2200, date: '2026-10-04', paymentMethod: 'Debit Card', notes: 'Fuel for commute' },
  { id: 5, type: 'expense', category: 'Bills', description: 'Internet bill', merchant: 'Broadlink', amount: 1300, date: '2026-10-06', paymentMethod: 'UPI', notes: 'Home internet plan' },
  { id: 6, type: 'expense', category: 'Entertainment', description: 'Movie night', merchant: 'CineHub', amount: 1800, date: '2026-10-10', paymentMethod: 'Credit Card', notes: 'Weekend outing' },
  { id: 7, type: 'expense', category: 'Shopping', description: 'Laptop accessories', merchant: 'TechSphere', amount: 6200, date: '2026-09-18', paymentMethod: 'Credit Card', notes: 'Power bank and stand' },
  { id: 8, type: 'income', category: 'Freelance', description: 'Design work', merchant: 'NorthStar Labs', amount: 18000, date: '2026-09-21', paymentMethod: 'Bank Transfer', notes: 'Landing page redesign' },
  { id: 9, type: 'expense', category: 'Health', description: 'Pharmacy', merchant: 'CarePlus', amount: 960, date: '2026-09-22', paymentMethod: 'UPI', notes: 'Medicines' },
  { id: 10, type: 'expense', category: 'Travel', description: 'Train tickets', merchant: 'RailConnect', amount: 3100, date: '2026-08-15', paymentMethod: 'Debit Card', notes: 'Weekend trip' },
  { id: 11, type: 'expense', category: 'Food', description: 'Restaurant', merchant: 'Saffron Bowl', amount: 2500, date: '2026-10-12', paymentMethod: 'UPI', notes: 'Client dinner' },
  { id: 12, type: 'income', category: 'Salary', description: 'Bonus', merchant: 'Acme Corp', amount: 15000, date: '2026-09-27', paymentMethod: 'Bank Transfer', notes: 'Quarterly bonus' },
  { id: 13, type: 'expense', category: 'Bills', description: 'Electricity bill', merchant: 'VoltGrid', amount: 2940, date: '2026-10-09', paymentMethod: 'Bank Transfer', notes: 'Power usage' },
  { id: 14, type: 'expense', category: 'Shopping', description: 'Home essentials', merchant: 'Urban Cart', amount: 4700, date: '2026-08-29', paymentMethod: 'Credit Card', notes: 'Kitchen storage' },
  { id: 15, type: 'expense', category: 'Food', description: 'Office snacks', merchant: 'Cafe 7', amount: 1200, date: '2026-10-13', paymentMethod: 'UPI', notes: 'Team meetup' },
  { id: 16, type: 'income', category: 'Investment', description: 'Dividend payout', merchant: 'Growth Funds', amount: 9200, date: '2026-10-18', paymentMethod: 'Bank Transfer', notes: 'Quarterly dividends' },
];

const demoBudgets = [
  { id: 1, category: 'Overall', limit: 55000, period: '2026-10', type: 'overall' },
  { id: 2, category: 'Housing', limit: 25000, period: '2026-10', type: 'category' },
  { id: 3, category: 'Food', limit: 7000, period: '2026-10', type: 'category' },
  { id: 4, category: 'Transport', limit: 4000, period: '2026-10', type: 'category' },
  { id: 5, category: 'Bills', limit: 6000, period: '2026-10', type: 'category' },
  { id: 6, category: 'Shopping', limit: 5000, period: '2026-10', type: 'category' },
  { id: 7, category: 'Entertainment', limit: 3500, period: '2026-10', type: 'category' },
];

const defaultForm = {
  type: 'expense',
  category: 'Food',
  description: '',
  merchant: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  paymentMethod: 'UPI',
  notes: '',
};

const budgetFormDefault = { category: 'Food', limit: '', period: new Date().toISOString().slice(0, 7) };
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
  type: 'category',
});

const requestJson = async (url, options = {}) => {
  const session = typeof window !== 'undefined' ? JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null') : null;
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
  const [transactions, setTransactions] = useState(demoTransactions);
  const [budgets, setBudgets] = useState(demoBudgets);
  const [savingsGoals, setSavingsGoals] = useState([
    { id: 1, title: 'Emergency fund', target: 150000, saved: 87000, color: '#10b981' },
    { id: 2, title: 'Vacation fund', target: 60000, saved: 39000, color: '#38bdf8' },
    { id: 3, title: 'Home setup', target: 100000, saved: 45000, color: '#f59e0b' },
  ]);
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
  const [reportStart, setReportStart] = useState('2026-09-01');
  const [reportEnd, setReportEnd] = useState('2026-10-31');
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', name: '' });
  const [authErrors, setAuthErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (authenticated && (location.pathname === '/login' || location.pathname === '/register')) {
      navigate('/dashboard');
    }
  }, [authenticated, location.pathname, navigate]);

  useEffect(() => {
    if (!authenticated) return;

    const loadData = async () => {
      setApiError('');
      setTransactions([]);
      setBudgets([]);
      setSavingsGoals([]);
      try {
        const [transactionResponse, budgetResponse, goalsResponse] = await Promise.all([
          requestJson(`${API_BASE}/transactions?limit=100`),
          requestJson(`${API_BASE}/budgets`),
          requestJson(`${API_BASE}/goals`),
        ]);

        if (Array.isArray(transactionResponse)) {
          setTransactions(transactionResponse.map(mapTransactionFromApi));
        }

        if (Array.isArray(budgetResponse)) {
          setBudgets([
            { id: 'overall', category: 'Overall', limit: 55000, period: getMonthKey(new Date()), type: 'overall' },
            ...budgetResponse.map(mapBudgetFromApi),
          ]);
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
      } catch (error) {
        setTransactions([]);
        setBudgets([]);
        setSavingsGoals([]);
        setApiError(`Unable to load your account data: ${error.message}`);
      }
    };

    loadData();
  }, [activeUserId, authenticated]);

  const totalIncome = useMemo(() => sumAmounts(transactions, 'income'), [transactions]);
  const totalExpenses = useMemo(() => sumAmounts(transactions, 'expense'), [transactions]);
  const netCashFlow = totalIncome - totalExpenses;
  const currentMonthKey = getMonthKey(new Date());
  const monthlyTransactions = useMemo(
    () => transactions.filter((item) => item.date.startsWith(currentMonthKey)),
    [transactions, currentMonthKey],
  );
  const monthlyExpenseTotal = useMemo(() => sumAmounts(monthlyTransactions, 'expense'), [monthlyTransactions]);
  const overallBudget = useMemo(
    () => budgets.find((item) => item.type === 'overall' && item.period === currentMonthKey)?.limit || 55000,
    [budgets, currentMonthKey],
  );
  const remainingBudget = overallBudget - monthlyExpenseTotal;
  const transactionCount = transactions.length;
  const monthlyIncome = useMemo(() => sumAmounts(monthlyTransactions, 'income'), [monthlyTransactions]);
  const savingsProgress = Math.max(0, Math.min(100, ((monthlyIncome - monthlyExpenseTotal) / Math.max(monthlyIncome, 1)) * 100));

  const categorySpending = useMemo(() => {
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

  const trendData = useMemo(() => {
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

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [transactions],
  );

  const budgetCards = useMemo(
    () =>
      budgets
        .filter((budget) => budget.type === 'category')
        .map((budget) => {
          const spent = transactions
            .filter(
              (item) =>
                item.type === 'expense' &&
                item.category === budget.category &&
                item.date.startsWith(budget.period),
            )
            .reduce((sum, item) => sum + Number(item.amount || 0), 0);
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

  const reportSummary = useMemo(() => {
    const income = sumAmounts(reportTransactions, 'income');
    const expense = sumAmounts(reportTransactions, 'expense');
    return {
      income,
      expense,
      net: income - expense,
      savingsRate: income > 0 ? (income - expense) / income : 0,
    };
  }, [reportTransactions]);

  const filteredTransactions = useMemo(() => {
    let data = [...transactions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(
        (item) =>
          item.description.toLowerCase().includes(term) || item.merchant.toLowerCase().includes(term),
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

  const persistSession = (user, accessToken = '') => {
    const session = {
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.name || 'User',
      ...(accessToken ? { access_token: accessToken } : {}),
    };
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    setActiveUserId(Number(user.id));
    setAuthenticated(true);
  };

  const handleSubmitAuth = async (event) => {
    event.preventDefault();
    setApiError('');
    if (!validateAuth()) return;

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

      persistSession(response.user, response.access_token);
      try {
        const link = await requestJson(`${API_BASE}/whatsapp/link-code`, { method: 'POST' });
        window.location.assign(link.whatsapp_url);
      } catch (error) {
        setApiError(
          error.message === 'WhatsApp is not configured yet'
            ? 'You are signed in. WhatsApp is not configured yet, so continue in the dashboard.'
            : `You are signed in, but Ruvi could not open WhatsApp: ${error.message}`,
        );
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
      }
    } catch (error) {
      window.alert(`Transaction was not saved: ${error.message}`);
      return;
    }

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
    if (!budgetForm.category || !budgetForm.limit || Number(budgetForm.limit) <= 0) return;

    const payload = {
      category: budgetForm.category,
      limit: Number(budgetForm.limit),
      period: budgetForm.period,
      type: 'category',
    };

    try {
      if (budgetEditId) {
        const updated = await requestJson(`${API_BASE}/budgets/${budgetEditId}`, {
          method: 'PUT',
          body: JSON.stringify({
            category: payload.category,
            limit_amount: payload.limit,
            period: payload.period,
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
  };

  const handleDeleteBudget = async (id) => {
    const item = budgets.find((entry) => entry.id === id);
    if (!item || item.type === 'overall') return;
    try {
      await requestJson(`${API_BASE}/budgets/${id}`, { method: 'DELETE' });
      setBudgets((prev) => prev.filter((entry) => entry.id !== id && !(entry.type === 'overall' && entry.id === id)));
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

  return (
    <div className="app-shell">
      <Header authenticated={authenticated} setAuthenticated={setAuthenticated} />
      {apiError && (
        <div className="container" role="alert">
          <p className="form-error">{apiError}</p>
        </div>
      )}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/login" element={<AuthPage authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} authErrors={authErrors} handleAuthInput={handleAuthInput} handleSubmitAuth={handleSubmitAuth} showPassword={showPassword} setShowPassword={setShowPassword} authenticated={authenticated} />} />
        <Route path="/register" element={<AuthPage authMode={authMode} setAuthMode={setAuthMode} authForm={authForm} authErrors={authErrors} handleAuthInput={handleAuthInput} handleSubmitAuth={handleSubmitAuth} showPassword={showPassword} setShowPassword={setShowPassword} authenticated={authenticated} />} />
        <Route
          path="/dashboard"
          element={
            authenticated ? (
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
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/transactions"
          element={
            authenticated ? (
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
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/budgets"
          element={
            authenticated ? (
              <BudgetsPage
                budgets={budgetCards}
                budgetForm={budgetForm}
                setBudgetForm={setBudgetForm}
                budgetEditId={budgetEditId}
                setBudgetEditId={setBudgetEditId}
                onSubmit={handleBudgetSubmit}
                onDelete={handleDeleteBudget}
                transactions={transactions}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/reports"
          element={
            authenticated ? (
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
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/savings"
          element={
            authenticated ? (
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
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </div>
  );
}

function PrivacyPage() {
  return (
    <main className="page-shell privacy-page">
      <section className="section">
        <div className="container privacy-document">
          <span className="eyebrow">Privacy notice</span>
          <h1>How Ruveon handles your information</h1>
          <p className="privacy-updated">Last updated: October 26, 2026</p>
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
                handle link/unlink commands or answer your question. Message identifiers are retained
                to prevent duplicate processing; the app does not save the message text as chat history.
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
                If you message Ruvi on WhatsApp, your question and a limited summary of your current
                month’s income, expenses, cash flow, budget, transaction count, and savings goals are
                sent to Google Gemini to generate a reply. Individual transaction descriptions and
                notes are not included in that summary.
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

function Header({ authenticated, setAuthenticated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/transactions', label: 'Transactions' },
    { to: '/budgets', label: 'Budgets' },
    { to: '/reports', label: 'Reports' },
    { to: '/savings', label: 'Savings' },
  ];

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link to="/" className="brand" aria-label="Ruveon AI home">
          <span className="brand-mark">R</span>
          <span>Ruveon AI</span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'nav-link active' : 'nav-link'}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-actions">
          {!authenticated ? (
            <>
              <Link to="/login" className="btn btn-ghost">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Start free
              </Link>
            </>
          ) : (
            <>
              <button className="icon-button" aria-label="Notifications">
                <Bell size={18} />
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setAuthenticated(false);
                  setActiveUserId(1);
                  setTransactions([]);
                  setBudgets([]);
                  setSavingsGoals([]);
                  if (typeof window !== 'undefined') {
                    window.localStorage.removeItem(SESSION_KEY);
                  }
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const featureCards = [
    { title: 'Expense tracking', icon: Wallet, description: 'Capture and categorize purchases in the portal, with your activity saved to your account.' },
    { title: 'Smart budgets', icon: Calculator, description: 'Set monthly and category limits with clear warnings before overspending.' },
    { title: 'Savings insights', icon: PiggyBank, description: 'See where you can save more and monitor progress toward goals.' },
    { title: 'Reports', icon: BarChart3, description: 'Review trends and compare cash flow with simple, accurate reporting tools.' },
  ];

  return (
    <main className="page-shell landing-page">
      <section className="hero section">
        <div className="container hero-grid">
          <div className="hero-copy">
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
                <span className="live-pill">Demo data</span>
                <span className="preview-date">October 2026</span>
              </div>
              <div className="preview-grid">
                <div className="mini-card">
                  <p>Total expenses</p>
                  <strong>₹49,250</strong>
                </div>
                <div className="mini-card">
                  <p>Net cash flow</p>
                  <strong>₹29,180</strong>
                </div>
                <div className="mini-card wide">
                  <p>Budget status</p>
                  <strong>₹55,000 / ₹49,250</strong>
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
            {featureCards.map(({ title, icon: Icon, description }) => (
              <div key={title} className="info-card card-surface">
                <div className="icon-badge">
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt-section">
        <div className="container split-grid">
          <div className="info-panel card-surface">
            <span className="eyebrow dark">Expense tracking</span>
            <h3>Capture spending wherever you are.</h3>
            <p>
              Log meals, bills, subscriptions, and transfers with a few taps. Ruvi keeps the process frictionless and your history organized.
            </p>
          </div>
          <div className="info-panel card-surface">
            <span className="eyebrow dark">Budget management</span>
            <h3>Stay ahead of monthly limits.</h3>
            <p>
              Use category budgets to identify risk early, monitor remaining spend, and adjust before the month slips away.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading narrow">
            <span className="eyebrow dark">The Ruvi experience</span>
            <h2>Built for everyday habits, not just data entry.</h2>
          </div>
          <div className="whatsapp-card card-surface">
            <div className="whatsapp-bubble">
              <MessageSquareText size={22} />
              <div>
                <strong>Ruvi</strong>
                <p>“You spent 18% more on food this week. Want a budget suggestion?”</p>
              </div>
            </div>
            <div className="whatsapp-details">
              <div>
                <h3>WhatsApp-first finance</h3>
                <p>
                  Ruvi works with the official WhatsApp Business Platform so users can ask account questions and get spending guidance in conversation.
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => navigate('/login')}>
                Sign in to Ruveon
              </button>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section alt-section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow dark">How it works</span>
            <h2>A simple flow that turns money habits into action.</h2>
          </div>
          <div className="steps-grid">
            <div className="step-card card-surface">
              <span>01</span>
              <h3>Connect your data</h3>
              <p>Add income, spending, bills, and goals from the web portal or Ruvi.</p>
            </div>
            <div className="step-card card-surface">
              <span>02</span>
              <h3>Review trends</h3>
              <p>See category patterns, budget health, and monthly progress at a glance.</p>
            </div>
            <div className="step-card card-surface">
              <span>03</span>
              <h3>Save smarter</h3>
              <p>Receive human-friendly suggestions and realistic targets without confusion.</p>
            </div>
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
              <span>When you message Ruvi, a limited monthly account summary and your savings goals are sent to Google Gemini to answer.</span>
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
            <div className="faq-item card-surface">
              <h3>Can I create an account?</h3>
              <p>Yes. Create an account to save and manage your own transactions, budgets, and savings goals.</p>
            </div>
            <div className="faq-item card-surface">
              <h3>What happens after sign-in?</h3>
              <p>When Ruvi's WhatsApp service is configured, sign-in opens WhatsApp with a secure account-link message. Otherwise, continue to the finance dashboard.</p>
            </div>
            <div className="faq-item card-surface">
              <h3>Can Ruvi automatically reply on WhatsApp?</h3>
              <p>Yes, after the official Meta Cloud API is configured and you send the first account-link message. Ruvi answers finance questions using your account summary.</p>
            </div>
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

function AuthPage({ authMode, setAuthMode, authForm, authErrors, handleAuthInput, handleSubmitAuth, showPassword, setShowPassword, authenticated }) {
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

            <button type="submit" className="btn btn-primary full-btn">
              {authMode === 'login' ? 'Log in' : 'Create account'}
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
          <StatCard label="Monthly budget" value={formatCurrency(summary.monthlyBudget)} delta={`${formatCurrency(summary.remainingBudget)} remaining`} tone="neutral" icon={<Banknote size={18} />} />
        </section>

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
}) {
  const categoryOptions = ['Food', 'Housing', 'Transport', 'Bills', 'Shopping', 'Entertainment', 'Health', 'Travel', 'Salary', 'Freelance', 'Investments', 'Other'];

  return (
    <main className="page-shell">
      <div className="container page-stack">
        <div className="page-header">
          <h1>Transactions</h1>
        </div>

        <section className="toolbar card-surface">
          <div className="search-box">
            <Search size={16} />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search description or merchant" />
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
                <button className="btn btn-ghost small" onClick={() => { setTransactionEditId(null); setTransactionForm({ ...defaultForm, date: new Date().toISOString().slice(0, 10) }); }}>
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
                  <select value={transactionForm.category} onChange={(event) => setTransactionForm((prev) => ({ ...prev, category: event.target.value }))}>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
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
                  <input type="number" min="0" step="1" value={transactionForm.amount} onChange={(event) => setTransactionForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="0" required />
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
          </div>
        </section>
      </div>
    </main>
  );
}

function BudgetsPage({ budgets, budgetForm, setBudgetForm, budgetEditId, setBudgetEditId, onSubmit, onDelete, transactions }) {
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
                <label>Category</label>
                <input value={budgetForm.category} onChange={(event) => setBudgetForm((prev) => ({ ...prev, category: event.target.value }))} placeholder="Food" />
              </div>
              <div className="field-group">
                <label>Monthly limit</label>
                <input type="number" min="0" value={budgetForm.limit} onChange={(event) => setBudgetForm((prev) => ({ ...prev, limit: event.target.value }))} placeholder="0" />
              </div>
              <div className="field-group">
                <label>Period</label>
                <input type="month" value={budgetForm.period} onChange={(event) => setBudgetForm((prev) => ({ ...prev, period: event.target.value }))} />
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
              {budgets.map((budget) => {
                const warning = budget.remaining < 0 ? 'Exceeded' : budget.progress > 80 ? 'Approaching limit' : 'On track';
                return (
                  <div key={budget.category + budget.period} className="budget-card">
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
                        setBudgetForm({ category: budget.category, limit: String(budget.limit), period: budget.period });
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
  const expenseByMonth = useMemo(() => {
    const map = {};
    transactions.forEach((item) => {
      if (item.type === 'expense') {
        const month = item.date.slice(0, 7);
        map[month] = (map[month] || 0) + Number(item.amount || 0);
      }
    });
    return Object.entries(map)
      .map(([month, value]) => ({ month, value }))
      .slice(-6);
  }, [transactions]);

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
                <MonthlyExpenseChart data={expenseByMonth} />
              </Suspense>
            </div>
          </div>

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
