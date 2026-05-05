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
import { LogOut, RotateCw, User, ShieldCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Logo from './Logo';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

export default ({ items }: { items: RouteAttributes[] }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { indentSheet, updateAll, allLoading } = useSheets();
    const { user, logout } = useAuth();

    const currentPath = location.pathname.slice(1);

    const hasPermission = useMemo(() => {
        return (routeItem: RouteAttributes) => {
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
            if (user?.username === 'admin' && !permissionKey) return true;
            if (!permissionKey) return routeItem.path === '' || routeItem.path === 'dashboard';

            const userPermission = (user as any)?.[permissionKey];

            if (user?.username === 'admin') {
                if (userPermission === false || userPermission === 'FALSE' || userPermission === 'False') {
                    return false;
                }
                return true;
            }

            if (typeof userPermission === 'string') {
                return userPermission.toUpperCase() === 'TRUE';
            }

            if (typeof userPermission === 'boolean') {
                return userPermission;
            }

            if (typeof userPermission === 'number') {
                return userPermission !== 0;
            }

            return false;
        };
    }, [user]);

    const filteredItems = useMemo(() => {
        if (!user) return [];

        return items.filter((item) => {
            if (item.gateKey && (user as any)[item.gateKey] === 'No Access') {
                return false;
            }
            return hasPermission(item);
        });
    }, [items, user, hasPermission]);

    if (!user) {
        return null;
    }

    return (
        <Sidebar side="left" variant="inset" collapsible="offcanvas" className="border-r border-sidebar-border/50 bg-sidebar/95 backdrop-blur-md">
            <SidebarHeader className="p-4 border-b border-sidebar-border/50">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 group">
                        <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-all duration-300 shadow-sm border border-primary/20">
                            <Logo />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-lg font-bold tracking-tight leading-none text-primary">Store App</h2>
                            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/70 mt-1">Management v2.0</span>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "size-8 rounded-full hover:bg-primary/10 transition-transform active:scale-95",
                            allLoading && "animate-spin"
                        )}
                        onClick={() => updateAll()}
                        disabled={allLoading}
                    >
                        <RotateCw size={16} className="text-muted-foreground" />
                    </Button>
                </div>
            </SidebarHeader>

            <SidebarContent className="px-2 pb-4 scrollbar-none flex flex-col">
                <SidebarGroup className="p-0 flex-1">
                    <SidebarMenu className="gap-1">
                        {filteredItems.map((item, i) => {
                            const isActive = currentPath === item.path || (item.path === '' && currentPath === 'dashboard');
                            
                            return (
                                <SidebarMenuItem key={`${item.path}-${i}`}>
                                    <SidebarMenuButton
                                        className={cn(
                                            "relative group transition-all duration-300 ease-in-out rounded-xl py-6 px-4 flex justify-between items-center overflow-hidden",
                                            "hover:translate-x-1 hover:scale-[1.02] hover:shadow-md active:scale-95",
                                            isActive 
                                                ? "bg-primary text-white font-bold shadow-lg ring-1 ring-white/20 z-10" 
                                                : "text-muted-foreground hover:bg-primary/5 hover:text-primary font-medium"
                                        )}
                                        onClick={() => navigate(item.path)}
                                        isActive={isActive}
                                    >
                                        <div className="flex gap-3 items-center">
                                            <div className={cn(
                                                "size-5 transition-transform group-hover:scale-110",
                                                isActive ? "text-white" : "text-muted-foreground group-hover:text-primary"
                                            )}>
                                                {item.icon}
                                            </div>
                                            <span className={cn(
                                                "text-sm tracking-wide",
                                                isActive ? "text-white" : "text-secondary-foreground"
                                            )}>{item.name}</span>
                                        </div>
                                        
                                        {/* Active indicator bar */}
                                        {isActive && (
                                            <div className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                                        )}

                                        {item.notifications && item.notifications(indentSheet || []) !== 0 && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-destructive text-destructive-foreground min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center shadow-md animate-in zoom-in duration-300">
                                                {item.notifications(indentSheet || [])}
                                            </div>
                                        )}
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>

            </SidebarContent>

            <SidebarFooter className="p-4 border-t border-sidebar-border/50 gap-4">
                {/* User Profile */}
                <div className="bg-muted/40 rounded-xl p-3 border border-border/40 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary shrink-0 shadow-sm">
                            <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate leading-none">{user.name}</p>
                            <div className="flex items-center gap-1 mt-1">
                                <ShieldCheck size={10} className="text-primary" />
                                <p className="text-[10px] text-muted-foreground font-medium uppercase truncate">@{user.username}</p>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="size-8 rounded-full hover:bg-destructive/10 hover:text-destructive group transition-all" 
                            onClick={() => logout()}
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </Button>
                    </div>
                </div>

                {/* Botivate Partner Footer */}
                <div className="bg-primary/5 rounded-lg p-2 text-center border border-primary/10">
                    <div className="flex items-center justify-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground">Powered by</span>
                        <a 
                            className="text-[10px] text-primary font-bold hover:underline" 
                            href="https://botivate.in" 
                            target="_blank" 
                            rel="noopener noreferrer"
                        >
                            Botivate
                        </a>
                    </div>
                </div>
            </SidebarFooter>
        </Sidebar>
    );
};
