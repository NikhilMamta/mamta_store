import type { ReactNode } from 'react';
import { SidebarTrigger } from '../ui/sidebar';
import { TabsList, TabsTrigger } from '../ui/tabs';

interface HeaderProps {
    children: ReactNode;
    heading: string;
    subtext: string;
    tabs?: boolean;
    extraActions?: ReactNode;
}

export default ({ children, heading, subtext, tabs = false, extraActions }: HeaderProps) => {
    return (
        <div className="bg-gradient-to-br from-green-100 via-amber-50 to-green-50 rounded-xl shadow-sm border border-green-100/50">
            <div className="flex justify-between items-center p-6">
                <div className="flex gap-4 items-center">
                    <div className="p-3 bg-white/50 rounded-lg shadow-sm border border-white">
                        {children}
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-primary tracking-tight">{heading}</h1>
                        <p className="text-muted-foreground text-sm font-medium opacity-80">{subtext}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {extraActions}
                    <div className="h-8 w-[1px] bg-primary/10 mx-2" />
                    <SidebarTrigger />
                </div>
            </div>
            {tabs && (
                <TabsList className="w-full rounded-none bg-transparent rounded-b-md">
                    <TabsTrigger value="pending">Pending</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
            )}
        </div>
    );
};
