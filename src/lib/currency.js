export function formatPHP(value) {
  const num = Number(value || 0);
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(num);
  } catch (e) {
    // fallback to simple format with peso sign
    return `₱${num.toFixed(2)}`;
  }
}

export default formatPHP;
