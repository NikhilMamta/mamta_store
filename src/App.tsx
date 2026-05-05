import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import Sidebar from '@/components/element/Sidebar';
import Footer from '@/components/element/Footer';
import { Outlet } from 'react-router-dom';
import type { RouteAttributes } from './types';

export default ({ routes }: { routes: RouteAttributes[] }) => {
    return (
        <div className="flex w-full h-screen">
            <SidebarProvider>
                <Sidebar items={routes} />
                <SidebarInset className="min-w-0 flex flex-col h-screen overflow-hidden">
                    <main className="flex-1 overflow-y-auto min-w-0 p-4 md:p-6 bg-muted/20">
                        <div className="min-h-full flex flex-col">
                            <div className="flex-1">
                                <Outlet />
                            </div>
                        </div>
                    </main>
                    <Footer />
                </SidebarInset>
            </SidebarProvider>
        </div>
    );
};
