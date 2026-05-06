import '@/index.css';

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from '@/context/AuthContext.tsx';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import Login from './components/views/Login';
import CreateIndent from './components/views/CreateIndent';
import Dashboard from './components/views/Dashboard';
import App from './App';
import ApproveIndent from '@/components/views/ApproveIndent';
import { SheetsProvider } from './context/SheetsContext';
import VendorUpdate from './components/views/VendorUpdate';
import RateApproval from './components/views/RateApproval';
import ReceiveItems from './components/views/ReceiveItems';
import StoreOutApproval from './components/views/StoreOutApproval';
import StoreOut from './components/views/StoreOut';
import GetPurchase from './components/views/getPurchase';
import TrainnigVideo from './components/views/TrainingVideo';
import License from './components/views/License';
import MasterData from './components/views/MasterData';
import AllIndent from './components/views/AllIndent';
import Quotation from './components/views/Quotation';
import type { RouteAttributes } from './types';

import {
    LayoutDashboard,
    ClipboardList,
    UserCheck,
    Users,
    ClipboardCheck,
    Truck,
    PackageCheck,
    ShieldUser,
    FilePlus2,
    ListTodo,
    Package2,
    Store,
    Video,
    KeyRound,
    Database,
} from 'lucide-react';
import type { UserPermissions } from './types/sheets';
import Administration from './components/views/Administration';
import Loading from './components/views/Loading';
import { Button } from './components/ui/button';
import CreatePO from './components/views/CreatePO';
import PendingIndents from './components/views/PendingIndents';
import Order from './components/views/Order';
import Inventory from './components/views/Inventory';
import POMaster from './components/views/POMaster';
import POApproval from './components/views/POApproval';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { loggedIn, loading } = useAuth();
    if (loading) return <Loading />;
    return loggedIn ? children : <Navigate to="/login" />;
}

function GatedRoute({
    children,
    identifier,
}: {
    children: React.ReactNode;
    identifier?: keyof UserPermissions;
}) {
    const { user } = useAuth();
    if (user?.username === 'admin') return children;
    if (!identifier) return children;

    const permissionValue = (user as any)[identifier];

    // Check permission
    if (typeof permissionValue === 'string') {
        if (permissionValue.toUpperCase() !== 'TRUE') {
            return <Navigate to="/" replace />;
        }
    } else if (typeof permissionValue === 'boolean') {
        if (!permissionValue) {
            return <Navigate to="/" replace />;
        }
    } else if (typeof permissionValue === 'number') {
        if (permissionValue === 0) {
            return <Navigate to="/" replace />;
        }
    } else {
        return <Navigate to="/" replace />;
    }

    return children;
}

function DefaultRoute({ routes }: { routes: RouteAttributes[] }) {
    const { user } = useAuth();

    if (!user) return <Navigate to="/login" />;
    if (user.username === 'admin') return <Navigate to="/dashboard" replace />;

    // Find first accessible route
    const firstAccessibleRoute = routes.find(route => {
        // Skip routes without gateKey (always accessible)
        if (!route.gateKey) return true;

        const permissionValue = (user as any)[route.gateKey];

        // Check if user has access
        if (typeof permissionValue === 'string') {
            return permissionValue.toUpperCase() === 'TRUE';
        }
        if (typeof permissionValue === 'boolean') {
            return permissionValue;
        }
        if (typeof permissionValue === 'number') {
            return permissionValue !== 0;
        }
        return false;
    });

    if (firstAccessibleRoute) {
        return <Navigate to={`/${firstAccessibleRoute.path}`} replace />;
    }

    // If no accessible routes, show error instead of looping back to login
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl border max-w-md">
                <h2 className="text-2xl font-bold text-slate-900 mb-4">No Access</h2>
                <p className="text-slate-600 mb-6">Your account does not have permission to access any modules. Please contact your system administrator to assign permissions.</p>
                <Button onClick={() => window.location.href = '/login'}>Back to Login</Button>
            </div>
        </div>
    );
}

const routes: RouteAttributes[] = [
    {
        path: 'dashboard',
        name: 'Dashboard',
        icon: <LayoutDashboard size={20} />,
        element: <Dashboard />,
        gateKey: 'dashboard',
        notifications: () => 0,
    },
    {
        path: 'inventory',
        name: 'Inventory',
        icon: <Store size={20} />,
        element: <Inventory />,
        gateKey: 'inventory',
        notifications: () => 0,
    },
    {
        path: 'create-indent',
        gateKey: 'create_indent',
        name: 'Create Indent',
        icon: <ClipboardList size={20} />,
        element: <CreateIndent />,
        notifications: () => 0,
    },


/*
    {
        path: 'all-indent',
        gateKey: 'all_indent',
        name: 'All Indent',
        icon: <ClipboardList size={20} />,
        element: <AllIndent />,
        notifications: () => 0,
    },
*/
    {
        path: 'approve-indent',
        gateKey: 'approve_indent',
        name: 'Approve Indent',
        icon: <ClipboardCheck size={20} />,
        element: <ApproveIndent />,
        notifications: (sheets) =>
            sheets.filter(
                (sheet) =>
                    sheet.planned1 !== '' &&
                    sheet.vendorType === '' &&
                    sheet.indentType === 'Purchase'
            ).length,
    },
    {
        path: 'vendor-rate-update',
        gateKey: 'vendor_rate_update',
        name: 'Vendor Rate Update',
        icon: <UserCheck size={20} />,
        element: <VendorUpdate />,
        notifications: (sheets) =>
            sheets.filter((sheet) => sheet.planned2 !== '' && sheet.actual2 === '').length,
    },
    {
        path: 'three-party-approval',
        gateKey: 'three_party_approval',
        name: 'Three Party Approval',
        icon: <Users size={20} />,
        element: <RateApproval />,
        notifications: (sheets) =>
            sheets.filter(
                (sheet) =>
                    sheet.planned3 !== '' &&
                    sheet.actual3 === '' &&
                    sheet.vendorType === 'Three Party'
            ).length,
    },
    {
        path: 'pending-pos',
        gateKey: 'pending_pos',
        name: 'Pending POs',
        icon: <ListTodo size={20} />,
        element: <PendingIndents />,
        notifications: (sheets) =>
            sheets.filter((sheet) => sheet.planned4 !== '' && sheet.actual4 === '').length,
    },
    {
        path: 'create-po',
        gateKey: 'create_po',
        name: 'Create PO',
        icon: <FilePlus2 size={20} />,
        element: <CreatePO />,
        notifications: () => 0,
    },
    // {
    //     path: 'po-master',
    //     gateKey: 'poMaster',
    //     name: 'PO Master',
    //     icon: <Users size={20} />,
    //     element: <POMaster />,
    //     notifications: () => 0,
    // },
    {
        path: 'po-history',
        gateKey: 'po_history',
        name: 'PO History',
        icon: <Package2 size={20} />,
        element: <Order />,
        notifications: () => 0,
    },
    {
        path: 'po-approval',
        gateKey: 'po_approval',
        name: 'PO Approval',
        icon: <PackageCheck size={20} />,
        element: <POApproval />,
        notifications: () => 0,
    },
/*
    {
        path: 'get-purchase',
        gateKey: 'get_purchase',
        name: 'Get Purchase',
        icon: <Package2 size={20} />,
        element: <GetPurchase />,
        notifications: () => 0,
    },
*/
    {
        path: 'receive-items',
        gateKey: 'receive_items',
        name: 'Receive Items',
        icon: <Truck size={20} />,
        element: <ReceiveItems />,
        notifications: (sheets) =>
            sheets.filter((sheet) => sheet.planned5 !== '' && sheet.actual5 === '').length,
    },
    {
        path: 'store-out-approval',
        gateKey: 'store_out_approval',
        name: 'Store Out Approval',
        icon: <PackageCheck size={20} />,
        element: <StoreOutApproval />,
        notifications: (sheets) =>
            sheets.filter(
                (sheet) =>
                    sheet.planned6 !== '' &&
                    sheet.actual6 === '' &&
                    sheet.indentType === 'Store Out'
            ).length,
    },
    {
        path: 'store-out',
        gateKey: 'store_out',
        name: 'Store Out',
        icon: <PackageCheck size={20} />,
        element: <StoreOut />,
        notifications: () => 0,
    },
    {
        path: 'quotation',
        gateKey: 'quotation',
        name: 'Quotation',
        icon: <ClipboardList size={20} />,
        element: <Quotation />,
        notifications: () => 0,
    },
    {
        path: 'administration',
        gateKey: 'administration',
        name: 'Administration',
        icon: <ShieldUser size={20} />,
        element: <Administration />,
        notifications: () => 0,
    },
    {
        path: 'master-data',
        gateKey: 'master_data',
        name: 'Master Data',
        icon: <Database size={20} />,
        element: <MasterData />,
        notifications: () => 0,
    },
    {
        path: 'training-video',
        gateKey: 'training_video',
        name: 'Training Video',
        icon: <Video size={20} />,
        element: <TrainnigVideo />,
        notifications: () => 0,
    },
    {
        path: 'license',
        gateKey: 'license',
        name: 'License',
        icon: <KeyRound size={20} />,
        element: <License />,
        notifications: () => 0,
    },
];

const rootElement = document.getElementById('root')!;
const root = (window as any)._root || createRoot(rootElement);
(window as any)._root = root;

root.render(
    <StrictMode>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <SheetsProvider>
                                    <App routes={routes} />
                                </SheetsProvider>
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<DefaultRoute routes={routes} />} />
                        {routes.map(({ path, element, gateKey }, index) => {
                            return <Route
                                key={`${path}-${index}`}
                                path={path}
                                element={<GatedRoute identifier={gateKey}>{element}</GatedRoute>}
                            />
                        })}
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </StrictMode>
);