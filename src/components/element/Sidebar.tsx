import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarHeader,
    SidebarFooter,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import type { RouteAttributes, UserPermissions } from '@/types';
import { LogOut, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from './Logo';
import { useMemo } from 'react';

export default ({ items }: { items: RouteAttributes[] }) => {
    const navigate = useNavigate();
    const { indentSheet, updateAll, allLoading } = useSheets();
    const { user, logout } = useAuth();

    // Memoize the permission checking function to avoid re-creation on every render
    // Fix the permission checking logic
    const hasPermission = useMemo(() => {
        return (routeItem: RouteAttributes) => {
            // In the Sidebar component, update the pathToPermissionMap:

            const pathToPermissionMap: Record<string, keyof UserPermissions> = {
                '': 'dashboard',
                'dashboard': 'dashboard',
                'inventory': 'inventory',
                'administration': 'administrate',
                'create-indent': 'createIndent',
                'create-po': 'createPo',
                'approve-indent': 'indentApprovalView',
                'po-history': 'ordersView',
                'po-approval': 'poMaster',
                'pending-pos': 'pendingIndentsView',
                'receive-items': 'receiveItemView',
                'store-out-approval': 'storeOutApprovalView',
                'store-out': 'storeOutApprovalView',
                'quotation': 'quotation',
                'three-party-approval': 'threePartyApprovalView',
                'vendor-rate-update': 'updateVendorView',
                'training-video': 'trainingVideo',
                'license': 'license',
                'master-data': 'administrate',
            };

            const permissionKey = pathToPermissionMap[routeItem.path];
            
            // If it's the admin, and no specific key is defined, allow it
            if (user?.username === 'admin' && !permissionKey) return true;
            
            if (!permissionKey) return routeItem.path === '' || routeItem.path === 'dashboard'; // Default to true only for dashboard

            // Fix: Handle both string and boolean values safely with type assertion
            const userPermission = (user as any)?.[permissionKey];

            // Special handling for Admin: Show everything unless explicitly set to FALSE
            if (user?.username === 'admin') {
                if (userPermission === false || userPermission === 'FALSE' || userPermission === 'False') {
                    return false;
                }
                return true;
            }

            // Handle string values like 'TRUE', 'FALSE', 'No Access'
            if (typeof userPermission === 'string') {
                return userPermission.toUpperCase() === 'TRUE';
            }

            // Handle boolean values
            if (typeof userPermission === 'boolean') {
                return userPermission;
            }

            // Handle numbers (0 = false, 1 = true) or other types
            if (typeof userPermission === 'number') {
                return userPermission !== 0;
            }

            // Default to false if undefined or null
            return false;
        };
    }, [user]);

    // Memoize filtered items to prevent unnecessary re-renders
    const filteredItems = useMemo(() => {
        if (!user) return [];

        return items.filter((item) => {
            // First check existing gateKey condition
            if (item.gateKey && (user as any)[item.gateKey] === 'No Access') {
                return false;
            }

            // Then check new permission-based condition
            return hasPermission(item);
        });
    }, [items, user, hasPermission]);

    // Early return if user is not loaded
    if (!user) {
        return null;
    }

    return (
        <Sidebar side="left" variant="inset" collapsible="offcanvas">
            <SidebarHeader className="p-3 border-b-1">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <Logo />
                        <div>
                            <h2 className="text-xl font-bold">Store App</h2>
                            <p className="text-sm">Management System</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        className="size-7"
                        onClick={() => updateAll()}
                        disabled={allLoading}
                    >
                        <RotateCw />
                    </Button>
                </div>
                <SidebarSeparator />
                <div className="flex justify-between items-center px-3 text-xs text-muted-foreground">
                    <div>
                        <p>
                            Name: <span className="font-semibold">{user.name}</span>
                        </p>
                        <p>
                            Username: <span className="font-semibold">{user.username}</span>
                        </p>
                    </div>
                    <Button variant="outline" className="size-8" onClick={() => logout()}>
                        <LogOut />
                    </Button>
                </div>
            </SidebarHeader>
            <SidebarContent className="py-1 border-b-1">
                <SidebarGroup>
                    <SidebarMenu>
                        {filteredItems.map((item, i) => (
                            <SidebarMenuItem key={`${item.path}-${i}`}>
                                <SidebarMenuButton
                                    className="transition-colors duration-200 rounded-md py-5 flex justify-between font-medium text-secondary-foreground"
                                    onClick={() => navigate(item.path)}
                                    isActive={window.location.pathname.slice(1) === item.path}
                                >
                                    <div className="flex gap-2 items-center">
                                        {item.icon}
                                        {item.name}
                                    </div>
                                    {item.notifications && item.notifications(indentSheet || []) !== 0 && (
                                        <span className="bg-destructive text-secondary w-[1.3rem] h-[1.3rem] rounded-full text-xs grid place-items-center text-center">
                                            {item.notifications(indentSheet || [])}
                                        </span>
                                    )}
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <div className="p-2 text-center text-sm">
                    Powered by &#8208;{' '}
                    <a className="text-primary" href="https://botivate.in" target="_blank" rel="noopener noreferrer">
                        Botivate
                    </a>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
};