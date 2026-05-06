# Professional Table UI Architecture Guide

This document outlines the standard architecture, patterns, and best practices for building table‑based components in this project. It ensures consistency, performance, and a high‑quality user experience across all table views.

---

## 1. Component Structure

A typical table component consists of the following sections:
┌─────────────────────────────────────────────────────┐
│ Header (Title, actions, refresh, search, filters) │
├─────────────────────────────────────────────────────┤
│ Tabs (if multiple views) │
├─────────────────────────────────────────────────────┤
│ Filter bar (optional dropdowns/inputs) │
├─────────────────────────────────────────────────────┤
│ Data Table (desktop) / Cards (mobile) │
├─────────────────────────────────────────────────────┤
│ Loading overlay (first load) / Refresh spinner │
└─────────────────────────────────────────────────────┘

text

---

## 2. Typography and Spacing Standards

All tables must follow these typography and spacing rules:
- **Headers (`th`):** `text-xs font-semibold text-gray-600 px-4 py-3 uppercase tracking-wider`.
- **Body Cells (`td`):** `text-sm font-medium py-4`. Use `text-gray-900` for names and `text-gray-600` for secondary data.
- **Rows:** `hover:bg-indigo-50/50 transition-colors`.

---

**File naming:** `ComponentName.jsx` (PascalCase).  
**Folder structure:** Keep the component in the appropriate feature folder (e.g., `src/pages/Order/Order.jsx`).

---

## 2. State Management

### 2.1 Core State Variables

```jsx
// Data
const [items, setItems] = useState([]);

// Loading states
const [isLoading, setIsLoading] = useState(true);   // first load
const [isRefreshing, setIsRefreshing] = useState(false); // manual refresh

// UI state
const [searchTerm, setSearchTerm] = useState('');
const [activeFilter, setActiveFilter] = useState('All');
const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

// Optional: modal / editing state
const [modalOpen, setModalOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);
### 2.2 Abort Controller for Fetch
Always use AbortController to cancel pending requests when the component unmounts or when a new request is initiated.

```jsx
const abortControllerRef = useRef(null);

useEffect(() => {
  const controller = new AbortController();
  abortControllerRef.current = controller;
  fetchData(controller.signal);
  return () => controller.abort();
}, [fetchData]);
```

## 3. High-Performance Data Fetching & Caching
Data is fetched using a highly optimized proxy pattern via `fetch` to bypass CORS and redirect overhead. Absolutely **no artificial delays** (e.g., forced `setTimeout`) should be used in the fetch cycle.

To ensure instant transitions between tabs without sacrificing live-data capabilities, utilize the `dataCache` utility.

Two precise modes of operation:
- **First load / Tab Switch:** Checks the cache first. If valid data exists, it renders **instantly** without triggering any loading states. Otherwise, it sets `isLoading` true, fetches via the Vite proxy, caches the result, and sets false.
- **Refresh action:** Explicitly bypasses the cache, sets `isRefreshing` true, fetches fresh data, actively updates the cache, then sets false.

```jsx
import { getCache, setCache } from '../utils/dataCache';

const fetchData = useCallback(async (signal, isRefresh = false) => {
  // 1. Check Cache first (unless explicitly refreshing)
  if (!isRefresh) {
    const cachedData = getCache("my_data_key");
    if (cachedData) {
      setItems(cachedData);
      setIsLoading(false);
      return;
    }
  }

  if (isRefresh) setIsRefreshing(true);
  else setIsLoading(true);

  try {
    // 2. Fetch data via Vite Proxy System
    const url = "/api/my-proxy-route"; 
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const result = await response.json();
    
    if (result.success) {
      setItems(result.data);
      // 3. Populate Cache
      setCache("my_data_key", result.data);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      showToast('Error', 'Failed to load data'); // Or use toast.error
    }
  } finally {
    if (!signal?.aborted) {
      if (isRefresh) setIsRefreshing(false);
      else setIsLoading(false);
    }
  }
}, []);
```

## 4. Sorting Logic
Use sortConfig state to store current sort key and direction.

Provide a reusable requestSort function.

Implement getSortedItems with locale‑aware comparisons.

jsx
const requestSort = (key) => {
  setSortConfig(prev => ({
    key,
    direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
  }));
};

const getSortedItems = useCallback((itemsToSort) => {
  if (!sortConfig.key) return itemsToSort;
  return [...itemsToSort].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    // Numeric comparison
    const aNum = parseFloat(String(aVal).replace(/[^0-9.-]/g, ''));
    const bNum = parseFloat(String(bVal).replace(/[^0-9.-]/g, ''));
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    }
    // Date comparison
    if (sortConfig.key.includes('date')) {
      const aDate = new Date(aVal), bDate = new Date(bVal);
      if (!isNaN(aDate) && !isNaN(bDate)) {
        return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
    }
    // String comparison
    aVal = String(aVal || '').toLowerCase();
    bVal = String(bVal || '').toLowerCase();
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
}, [sortConfig]);
5. Filtering and Search
Search: usually a text input that filters across all fields.

Filters: can be dropdowns, tabs, or radio groups.

Use useMemo for filtered + sorted data to avoid recomputation on every render.

jsx
const filteredAndSortedItems = useMemo(() => {
  const filtered = items.filter(item => {
    const matchesSearch = Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesFilter = activeFilter === 'All' || item.category === activeFilter;
    return matchesSearch && matchesFilter;
  });
  return getSortedItems(filtered);
}, [items, searchTerm, activeFilter, getSortedItems]);
6. Loading States
6.1 Skeleton Loading (First Load)
Use a skeleton loader that mimics the table structure to provide a smooth user experience.

Skeleton Table Component:

jsx
const TableSkeleton = ({ columns = 5, rows = 5 }) => (
  <div className="animate-pulse">
    <div className="bg-gray-100 h-10 mb-2 rounded" />
    {Array(rows).fill().map((_, i) => (
      <div key={i} className="flex gap-4 mb-2">
        {Array(columns).fill().map((_, j) => (
          <div key={j} className="h-8 bg-gray-100 rounded flex-1" />
        ))}
      </div>
    ))}
  </div>
);
Usage:

jsx
{isLoading && <TableSkeleton columns={8} rows={10} />}
{!isLoading && <div className="overflow-x-auto">{/* Actual table */}</div>}
6.2 Refresh Spinner
For manual refresh, show a spinner on the refresh button only (not a full overlay). The button should be disabled during refresh.

jsx
<button onClick={handleRefresh} disabled={isRefreshing}>
  <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
  Refresh
</button>
6.3 Full‑Screen Overlay (Optional)
Use a full‑screen overlay only for first load or saving operations. Do not use it for background refreshes.

jsx
{(isLoading || isSaving) && (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-md">
    {/* Loading spinner and text */}
  </div>
)}
7. Responsive Design
Desktop: a sortable <table> with fixed headers, horizontal scroll if needed.

Mobile: cards that display the same information in a stacked layout.

Use Tailwind’s hidden md:block and md:hidden to switch between views.

Mobile Card Example:

jsx
<div className="md:hidden space-y-3">
  {filteredAndSortedItems.map(item => (
    <div key={item.id} className="bg-white p-4 rounded shadow-sm">
      <div className="flex justify-between">
        <h4 className="font-bold">{item.name}</h4>
        <span className="text-xs text-gray-500">{item.date}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div><span className="text-gray-500">Qty:</span> {item.qty}</div>
        <div><span className="text-gray-500">Status:</span> {item.status}</div>
      </div>
    </div>
  ))}
</div>
8. Accessibility
Use semantic HTML: <table>, <th>, <td>.

Add aria-label to buttons and interactive elements.

Ensure sufficient color contrast.

Provide keyboard navigation for sortable headers (tab + enter/space).

Include role="status" for loading announcements (optional).

9. Performance Optimizations
Memoize computed data: useMemo for filtered/sorted items.

Memoize handlers: useCallback for functions passed to child components.

Use React.memo for expensive child components (e.g., table rows) if they receive many updates.

Virtualization for huge datasets (use react-window or react-virtual).

Debounce search input to avoid excessive filtering on every keystroke:

jsx
const debouncedSearch = useDebounce(searchTerm, 300);
useEffect(() => {
  // filter logic here
}, [debouncedSearch]);
10. Error Handling
Show toast notifications using the global useToast hook.

Distinguish between network errors and API errors.

Log errors to console for debugging.

jsx
try {
  // fetch...
} catch (error) {
  if (error.name !== 'AbortError') {
    console.error('Fetch error:', error);
    showToast('Error', error.message);
  }
}
## 11. Code Example: Complete Table Component
Below is a template that combines all the core optimization concepts. (See the actual components in the project for more detailed UI implementations.)

```jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext'; // Or react-hot-toast
import { getCache, setCache } from '../utils/dataCache';

const MyTable = () => {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const abortControllerRef = useRef(null);

  // Fetch data natively utilizing the Vite Proxy and Cache patterns
  const fetchData = useCallback(async (signal, isRefresh = false) => {
    if (!isRefresh) {
      const cachedData = getCache("my_table_data");
      if (cachedData) {
        setItems(cachedData);
        setIsLoading(false);
        return;
      }
    }

    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const url = "/api/mytable"; // Standardized Proxy Route
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const result = await response.json();

      if (result.success) {
        setItems(result.data);
        setCache("my_table_data", result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        showToast('Error', error.message);
      }
    } finally {
      if (!signal?.aborted) {
        if (isRefresh) setIsRefreshing(false);
        else setIsLoading(false);
      }
    }
  }, []);
```

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  const handleRefresh = () => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchData(controller.signal, true);
  };

  // Sorting
  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortedItems = useCallback((itemsToSort) => {
    if (!sortConfig.key) return itemsToSort;
    return [...itemsToSort].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      // numeric, date, string comparison...
      return 0; // placeholder
    });
  }, [sortConfig]);

  const filteredAndSorted = useMemo(() => {
    const filtered = items.filter(item =>
      Object.values(item).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    return getSortedItems(filtered);
  }, [items, searchTerm, getSortedItems]);

  // Skeleton loader
  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1>My Table</h1>
        <button onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th onClick={() => requestSort('name')}>
                Name
                <ChevronUp size={10} />
                <ChevronDown size={10} />
              </th>
              {/* more headers */}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                {/* more cells */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredAndSorted.map(item => (
          <div key={item.id} className="bg-white p-4 rounded shadow">
            <div className="font-bold">{item.name}</div>
            <div>{item.details}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyTable;
## 12. Consistency Checklist
Before implementing a new table component, verify:

- [ ] Uses `useRef` with `AbortController` for fetch cancellation.
- [ ] **Typography/Spacing:** Headers use `text-xs font-semibold`, body uses `text-sm`, and vertical cell padding is `py-4`.
- [ ] **High-Speed Fetching:** Zero artificial delays (`setTimeout`) anywhere in the fetching logic. Avoids CORS issues by utilizing the `/api/...` Vite proxy.
- [ ] **Caching Model:** Enforces instant UI responses on tab switching by implementing the `dataCache` utility (In-memory TTL).
- [ ] **Proper Loading States:** Skeleton mimicking table columns for the very first un-cached load, spinning icon strictly on the refresh button for manual triggers, zero flicker for cache hits.

Sorting works on all columns (numbers, dates, strings).

Search input filters across all fields.

Responsive: table on desktop, cards on mobile.

Error handling with toast notifications.

All heavy calculations memoized (useMemo, useCallback).

Accessibility: proper HTML, keyboard navigation, ARIA labels.

13. Additional Tips
Date formatting: Always use a consistent utility (e.g., formatDisplayDate) that returns DD-MMM-YYYY.

Unique keys: When mapping rows, use a stable unique key (e.g., originalIndex from the API or a combination of fields).

Column definitions: Define columns as an array of objects with label, key, align, color, etc., to keep the code DRY.

Tailwind classes: Use standard spacing and styling (px‑6 py‑4, border, rounded) for consistency.

By following this guide, all table components will share a consistent architecture, making them easier to maintain, debug, and extend. The use of skeleton loading and proper error handling significantly improves the user experience.