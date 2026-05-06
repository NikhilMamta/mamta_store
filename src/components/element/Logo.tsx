import { cn } from '@/lib/utils';
import { Box } from 'lucide-react';

export default ({ className, size = 20 }: { className?: string; size?: number }) => (
    <div
        className={cn(
            'flex items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-primary/80 shadow-xl shadow-primary/10 ring-1 ring-white/20 transition-all active:scale-95 hover:shadow-primary/20',
            className
        )}
    >
        <Box className="text-white" size={size} />
    </div>
);
