import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function SpendingTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" />
        <XAxis dataKey="month" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip formatter={(value) => formatCurrency(value)} />
        <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategorySpendingChart({ data, colors }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={52} outerRadius={82} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={colors[entry.name] || '#14b8a6'} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatCurrency(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyExpenseChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" />
        <XAxis dataKey="month" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip formatter={(value) => formatCurrency(value)} />
        <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
