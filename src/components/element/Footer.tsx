import { cn } from '@/lib/utils';
import { Shield, Clock } from 'lucide-react';

export default ({ className }: { className?: string }) => {
    const currentYear = new Date().getFullYear();
    
    return (
        <footer className={cn(
            "mt-auto border-t border-border/40 bg-background/80 backdrop-blur-sm px-4 py-1.5",
            className
        )}>
            <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-primary/80">
                        <div className="size-1.5 rounded-full bg-primary animate-pulse" />
                        <span>System Operational</span>
                    </div>
                    <div className="h-3 w-px bg-border/60" />
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        <Clock size={10} />
                        <span>Sync: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/70 font-medium">
                        <Shield size={10} className="text-primary/60" />
                        <span>Secure Port</span>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground font-medium">
                        &copy; {currentYear} <span className="font-bold text-foreground/80">Mamta Store</span>
                    </div>
                    
                    <div className="text-[9px] px-1.5 py-0.5 rounded-sm bg-muted/50 font-bold text-muted-foreground/80 border border-border/40 leading-none">
                        v2.4.0
                    </div>
                </div>
            </div>
        </footer>
    );
};
